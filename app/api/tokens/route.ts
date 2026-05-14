import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbiItem, formatUnits, type PublicClient } from 'viem';
import { REPO_REGISTRY_ABI, BONDING_CURVE_ABI } from '@/lib/contracts';
import { githubHeaders } from '@/lib/github';

const ZG_MAINNET = {
  id: 16661,
  name: '0G Newton Mainnet',
  nativeCurrency: { decimals: 18, name: '0G', symbol: '0G' },
  rpcUrls: { default: { http: ['https://evmrpc.0g.ai'] } },
} as const;

const TOKEN_DEPLOYED_EVENT = parseAbiItem(
  'event TokenDeployed(uint256 indexed repoId, address indexed token, address bondingCurve, address claimContract, address indexed deployer, bytes32 imageHash, uint256 timestamp)'
);

const ERC20_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const;

// Simple in-memory cache — 60s TTL
let cache: { data: TokenData[]; ts: number } | null = null;

export interface TokenData {
  repoId: string;
  tokenAddress: string;
  bondingCurve: string;
  deployer: string;
  imageHash: string;
  deployedAt: number;
  // ERC20
  tokenName: string;
  tokenSymbol: string;
  // GitHub
  repoFullName: string;
  description: string;
  stars: number;
  language: string | null;
  ownerLogin: string;
  ownerAvatarUrl: string;
  // Curve
  spotPrice: string;      // 0G per token (human readable)
  marketCap: string;      // in 0G
  progressPct: number;    // 0-100
  graduated: boolean;
}

async function fetchGitHubRepo(repoId: string) {
  const res = await fetch(`https://api.github.com/repositories/${repoId}`, {
    headers: githubHeaders(),
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchCurveData(client: any, curveAddress: `0x${string}`) {
  try {
    const [spotPriceRaw, progress, graduated] = await Promise.all([
      client.readContract({ address: curveAddress, abi: BONDING_CURVE_ABI, functionName: 'getSpotPrice' }),
      client.readContract({ address: curveAddress, abi: BONDING_CURVE_ABI, functionName: 'getProgress' }),
      client.readContract({ address: curveAddress, abi: BONDING_CURVE_ABI, functionName: 'graduated' }),
    ]);

    const spotPrice = Number(formatUnits(spotPriceRaw as bigint, 18));
    const [tokensSold, threshold] = progress as [bigint, bigint];
    const progressPct = threshold > 0n
      ? Math.min(100, Math.round((Number(tokensSold) / Number(threshold)) * 100))
      : 0;
    const marketCap = spotPrice * 1_000_000_000;

    return {
      spotPrice: spotPrice < 0.000001 ? spotPrice.toExponential(3) : spotPrice.toFixed(8),
      marketCap: marketCap < 1 ? marketCap.toFixed(4) : marketCap.toFixed(2),
      progressPct,
      graduated: graduated as boolean,
    };
  } catch {
    return { spotPrice: '0', marketCap: '0', progressPct: 0, graduated: false };
  }
}

export async function GET(req: NextRequest) {
  const registryAddress = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS_MAINNET as `0x${string}` | undefined;

  // Return mock data if registry not deployed yet
  if (!registryAddress) {
    return NextResponse.json({ tokens: MOCK_TOKENS, live: false });
  }

  // Serve from cache
  if (cache && Date.now() - cache.ts < 60_000) {
    return NextResponse.json({ tokens: cache.data, live: true });
  }

  try {
    const client = createPublicClient({
      chain: ZG_MAINNET as any,
      transport: http('https://evmrpc.0g.ai'),
    });

    // Fetch all TokenDeployed events
    const logs = await client.getLogs({
      address: registryAddress,
      event: TOKEN_DEPLOYED_EVENT,
      fromBlock: 0n,
    });

    if (logs.length === 0) {
      return NextResponse.json({ tokens: [], live: true });
    }

    // Enrich each token in parallel (batch of 5 to avoid rate limits)
    const tokens: TokenData[] = [];
    for (let i = 0; i < logs.length; i += 5) {
      const batch = logs.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map(async (log) => {
          const { repoId, token, bondingCurve, deployer, imageHash, timestamp } = log.args as any;

          const [nameResult, symbolResult, githubData, curveData] = await Promise.all([
            client.readContract({ address: token, abi: ERC20_ABI, functionName: 'name' }).catch(() => ''),
            client.readContract({ address: token, abi: ERC20_ABI, functionName: 'symbol' }).catch(() => ''),
            fetchGitHubRepo(repoId.toString()),
            fetchCurveData(client, bondingCurve),
          ]);

          return {
            repoId: repoId.toString(),
            tokenAddress: token,
            bondingCurve,
            deployer,
            imageHash,
            deployedAt: Number(timestamp),
            tokenName: nameResult as string,
            tokenSymbol: symbolResult as string,
            repoFullName: githubData?.full_name ?? '',
            description: githubData?.description ?? '',
            stars: githubData?.stargazers_count ?? 0,
            language: githubData?.language ?? null,
            ownerLogin: githubData?.owner?.login ?? '',
            ownerAvatarUrl: githubData?.owner?.avatar_url ?? '',
            ...curveData,
          } satisfies TokenData;
        })
      );
      tokens.push(...batchResults);
    }

    // Sort newest first
    tokens.sort((a, b) => b.deployedAt - a.deployedAt);

    cache = { data: tokens, ts: Date.now() };
    return NextResponse.json({ tokens, live: true });
  } catch (err) {
    console.error('tokens API error:', err);
    return NextResponse.json({ tokens: MOCK_TOKENS, live: false });
  }
}

// ─── Mock data (shown before contracts deployed) ─────────────────────────────

const MOCK_TOKENS: TokenData[] = [
  {
    repoId: '111583230',
    tokenAddress: '0x0000000000000000000000000000000000000001',
    bondingCurve: '0x0000000000000000000000000000000000000002',
    deployer: '0x0000000000000000000000000000000000000003',
    imageHash: '0x',
    deployedAt: Date.now() / 1000 - 3600,
    tokenName: 'next.js on fun.tf',
    tokenSymbol: 'NEXTJS',
    repoFullName: 'vercel/next.js',
    description: 'The React Framework for the Web',
    stars: 128000,
    language: 'TypeScript',
    ownerLogin: 'vercel',
    ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/14985020',
    spotPrice: '0.00000142',
    marketCap: '1420.00',
    progressPct: 34,
    graduated: false,
  },
  {
    repoId: '132943948',
    tokenAddress: '0x0000000000000000000000000000000000000004',
    bondingCurve: '0x0000000000000000000000000000000000000005',
    deployer: '0x0000000000000000000000000000000000000006',
    imageHash: '0x',
    deployedAt: Date.now() / 1000 - 7200,
    tokenName: 'vscode on fun.tf',
    tokenSymbol: 'VSCODE',
    repoFullName: 'microsoft/vscode',
    description: 'Visual Studio Code',
    stars: 163000,
    language: 'TypeScript',
    ownerLogin: 'microsoft',
    ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/6154722',
    spotPrice: '0.00000891',
    marketCap: '8910.00',
    progressPct: 67,
    graduated: false,
  },
  {
    repoId: '10270250',
    tokenAddress: '0x0000000000000000000000000000000000000007',
    bondingCurve: '0x0000000000000000000000000000000000000008',
    deployer: '0x0000000000000000000000000000000000000009',
    imageHash: '0x',
    deployedAt: Date.now() / 1000 - 10800,
    tokenName: 'react on fun.tf',
    tokenSymbol: 'REACT',
    repoFullName: 'facebook/react',
    description: 'The library for web and native user interfaces',
    stars: 228000,
    language: 'JavaScript',
    ownerLogin: 'facebook',
    ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/69631',
    spotPrice: '0.00012300',
    marketCap: '123000.00',
    progressPct: 100,
    graduated: true,
  },
  {
    repoId: '724712',
    tokenAddress: '0x000000000000000000000000000000000000000a',
    bondingCurve: '0x000000000000000000000000000000000000000b',
    deployer: '0x000000000000000000000000000000000000000c',
    imageHash: '0x',
    deployedAt: Date.now() / 1000 - 86400,
    tokenName: 'linux on fun.tf',
    tokenSymbol: 'LINUX',
    repoFullName: 'torvalds/linux',
    description: 'Linux kernel source tree',
    stars: 186000,
    language: 'C',
    ownerLogin: 'torvalds',
    ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/1024025',
    spotPrice: '0.00000034',
    marketCap: '340.00',
    progressPct: 8,
    graduated: false,
  },
  {
    repoId: '27193585',
    tokenAddress: '0x000000000000000000000000000000000000000d',
    bondingCurve: '0x000000000000000000000000000000000000000e',
    deployer: '0x000000000000000000000000000000000000000f',
    imageHash: '0x',
    deployedAt: Date.now() / 1000 - 43200,
    tokenName: 'rust on fun.tf',
    tokenSymbol: 'RUST',
    repoFullName: 'rust-lang/rust',
    description: 'Empowering everyone to build reliable and efficient software.',
    stars: 98000,
    language: 'Rust',
    ownerLogin: 'rust-lang',
    ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/5430905',
    spotPrice: '0.00000567',
    marketCap: '5670.00',
    progressPct: 52,
    graduated: false,
  },
  {
    repoId: '23096959',
    tokenAddress: '0x0000000000000000000000000000000000000010',
    bondingCurve: '0x0000000000000000000000000000000000000011',
    deployer: '0x0000000000000000000000000000000000000012',
    imageHash: '0x',
    deployedAt: Date.now() / 1000 - 21600,
    tokenName: 'golang on fun.tf',
    tokenSymbol: 'GOLANG',
    repoFullName: 'golang/go',
    description: 'The Go programming language',
    stars: 124000,
    language: 'Go',
    ownerLogin: 'golang',
    ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/4314092',
    spotPrice: '0.00000219',
    marketCap: '2190.00',
    progressPct: 21,
    graduated: false,
  },
];

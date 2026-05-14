import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbiItem, formatUnits } from 'viem';
import { REPO_REGISTRY_ABI, BONDING_CURVE_ABI } from '@/lib/contracts';
import { githubHeaders, isBot, fetchContributors } from '@/lib/github';

const ZG_MAINNET = {
  id: 16661,
  name: '0G-Aristotle-Mainnet',
  nativeCurrency: { decimals: 18, name: '0G', symbol: '0G' },
  rpcUrls: { default: { http: ['https://evmrpc.0g.ai'] } },
} as const;

const ERC20_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const;

const TOKENS_BOUGHT_EVENT = parseAbiItem(
  'event TokensBought(address indexed buyer, uint256 nativeIn, uint256 tokensOut, uint256 fee)'
);
const TOKENS_SOLD_EVENT = parseAbiItem(
  'event TokensSold(address indexed seller, uint256 tokensIn, uint256 nativeOut, uint256 fee)'
);

const CURVE_SEED = BigInt('1000000000000000000'); // 1 0G
const TOTAL_CURVE_TOKENS = BigInt('850000000') * BigInt('10') ** BigInt('18');

export type RepoDetail = {
  live: boolean;
  found: boolean;
  repoId: string;
  tokenAddress: string | null;
  bondingCurve: string | null;
  claimContract: string | null;
  deployer: string | null;
  deployedAt: number | null;
  tokenName: string | null;
  tokenSymbol: string | null;
  spotPrice: string;
  marketCap: string;
  progressPct: number;
  graduated: boolean;
  repoFullName: string;
  description: string;
  stars: number;
  forks: number;
  language: string | null;
  ownerLogin: string;
  ownerAvatarUrl: string;
  topics: string[];
  eligibleContributors: {
    login: string;
    avatarUrl: string;
    contributions: number;
    allocationPct: string;
  }[];
  filteredBots: number;
  priceHistory: { price: number; type: 'buy' | 'sell' }[];
  recentTrades: {
    type: 'buy' | 'sell';
    account: string;
    tokenAmount: string;
    nativeAmount: string;
    blockNumber: number;
  }[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPriceHistory(buyLogs: readonly any[], sellLogs: readonly any[]) {
  const allEvents = [
    ...buyLogs.map(l => ({ ...l, eventType: 'buy' as const })),
    ...sellLogs.map(l => ({ ...l, eventType: 'sell' as const })),
  ].sort((a, b) => Number((a.blockNumber ?? 0n) - (b.blockNumber ?? 0n)));

  let virtualNative = CURVE_SEED;
  let tokenReserve = TOTAL_CURVE_TOKENS;

  const priceHistory: { price: number; type: 'buy' | 'sell' }[] = [
    { price: Number(virtualNative) / Number(tokenReserve), type: 'buy' },
  ];

  const recentTrades: RepoDetail['recentTrades'] = [];

  for (const ev of allEvents) {
    if (ev.eventType === 'buy') {
      const { buyer, nativeIn, tokensOut, fee } = ev.args as {
        buyer: string; nativeIn: bigint; tokensOut: bigint; fee: bigint;
      };
      virtualNative += nativeIn - fee;
      tokenReserve -= tokensOut;
      priceHistory.push({ price: Number(virtualNative) / Number(tokenReserve), type: 'buy' });
      recentTrades.push({
        type: 'buy',
        account: buyer,
        tokenAmount: formatUnits(tokensOut, 18),
        nativeAmount: formatUnits(nativeIn, 18),
        blockNumber: Number(ev.blockNumber ?? 0n),
      });
    } else {
      const { seller, tokensIn, nativeOut, fee } = ev.args as {
        seller: string; tokensIn: bigint; nativeOut: bigint; fee: bigint;
      };
      virtualNative -= nativeOut + fee;
      tokenReserve += tokensIn;
      priceHistory.push({ price: Number(virtualNative) / Number(tokenReserve), type: 'sell' });
      recentTrades.push({
        type: 'sell',
        account: seller,
        tokenAmount: formatUnits(tokensIn, 18),
        nativeAmount: formatUnits(nativeOut, 18),
        blockNumber: Number(ev.blockNumber ?? 0n),
      });
    }
  }

  return {
    priceHistory,
    recentTrades: recentTrades.slice().reverse().slice(0, 20),
  };
}

// Generates a mock bonding curve price series for preview mode
function mockPriceHistory(progressPct: number): { price: number; type: 'buy' | 'sell' }[] {
  const initialPrice = Number(CURVE_SEED) / Number(TOTAL_CURVE_TOKENS);
  const history: { price: number; type: 'buy' | 'sell' }[] = [
    { price: initialPrice, type: 'buy' },
  ];
  let price = initialPrice;
  const numTrades = 38;
  for (let i = 0; i < numTrades; i++) {
    const isSell = (Math.sin(i * 2.3) + Math.cos(i * 1.7)) < -1.1;
    if (isSell && price > initialPrice * 1.1) {
      price *= 0.95 + Math.sin(i) * 0.02;
      history.push({ price, type: 'sell' });
    } else {
      const ratio = i / numTrades;
      const boost = 1 + (progressPct / 100) * 0.9;
      price *= 1 + (0.04 + ratio * 0.09) * boost;
      history.push({ price, type: 'buy' });
    }
  }
  return history;
}

// Mock curve states for the demo tokens shown in /explore
const MOCK_CURVE: Record<string, Pick<RepoDetail,
  'tokenName' | 'tokenSymbol' | 'spotPrice' | 'marketCap' | 'progressPct' | 'graduated' | 'deployer'
> & { deployedAt: number }> = {
  '111583230': { tokenName: 'next.js on fun.tf', tokenSymbol: 'NEXTJS', spotPrice: '0.00000142', marketCap: '1420.00', progressPct: 34, graduated: false, deployedAt: Math.floor(Date.now() / 1000) - 3600, deployer: '0x0000000000000000000000000000000000000003' },
  '132943948': { tokenName: 'vscode on fun.tf', tokenSymbol: 'VSCODE', spotPrice: '0.00000891', marketCap: '8910.00', progressPct: 67, graduated: false, deployedAt: Math.floor(Date.now() / 1000) - 7200, deployer: '0x0000000000000000000000000000000000000006' },
  '10270250':  { tokenName: 'react on fun.tf',  tokenSymbol: 'REACT',  spotPrice: '0.00012300', marketCap: '123000.00', progressPct: 100, graduated: true, deployedAt: Math.floor(Date.now() / 1000) - 10800, deployer: '0x0000000000000000000000000000000000000009' },
  '724712':    { tokenName: 'linux on fun.tf',  tokenSymbol: 'LINUX',  spotPrice: '0.00000034', marketCap: '340.00',    progressPct: 8,   graduated: false, deployedAt: Math.floor(Date.now() / 1000) - 86400, deployer: '0x000000000000000000000000000000000000000c' },
  '27193585':  { tokenName: 'rust on fun.tf',   tokenSymbol: 'RUST',   spotPrice: '0.00000567', marketCap: '5670.00',  progressPct: 52,  graduated: false, deployedAt: Math.floor(Date.now() / 1000) - 43200, deployer: '0x000000000000000000000000000000000000000f' },
  '23096959':  { tokenName: 'golang on fun.tf', tokenSymbol: 'GOLANG', spotPrice: '0.00000219', marketCap: '2190.00',  progressPct: 21,  graduated: false, deployedAt: Math.floor(Date.now() / 1000) - 21600, deployer: '0x0000000000000000000000000000000000000012' },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const { repoId } = await params;

  if (!repoId || !/^\d+$/.test(repoId)) {
    return NextResponse.json({ error: 'Invalid repoId' }, { status: 400 });
  }

  const registryAddress = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS_MAINNET as `0x${string}` | undefined;

  // Always fetch GitHub data (works regardless of contract state)
  const [githubRes, contributorsRaw] = await Promise.all([
    fetch(`https://api.github.com/repositories/${repoId}`, {
      headers: githubHeaders(),
      next: { revalidate: 300 },
    }),
    // Will be re-fetched below once we have fullName; pre-fetch here to save a round trip
    Promise.resolve(null),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let github: Record<string, any> | null = null;
  if (githubRes.ok) {
    github = await githubRes.json();
  }

  const contribRaw: unknown[] = github
    ? await fetchContributors(github.full_name).catch(() => [])
    : [];

  const eligible = (contribRaw as { login: string; type: string; contributions: number; avatar_url: string }[])
    .filter(c => !isBot(c));
  const filteredBots = contribRaw.length - eligible.length;
  const totalCommits = eligible.reduce((s, c) => s + c.contributions, 0);
  const eligibleContributors = eligible.slice(0, 25).map(c => ({
    login: c.login,
    avatarUrl: c.avatar_url,
    contributions: c.contributions,
    allocationPct: totalCommits > 0
      ? ((c.contributions / totalCommits) * 5).toFixed(3)
      : '0.000',
  }));

  // ── Preview mode (no contracts deployed) ─────────────────────────────────────

  if (!registryAddress) {
    const mock = MOCK_CURVE[repoId];

    if (!mock && !github) {
      return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
    }

    const progressPct = mock?.progressPct ?? 0;

    return NextResponse.json({
      live: false,
      found: !!mock,
      repoId,
      tokenAddress: null,
      bondingCurve: null,
      claimContract: null,
      deployer: mock?.deployer ?? null,
      deployedAt: mock?.deployedAt ?? null,
      tokenName: mock?.tokenName ?? (github ? `${github.name} on fun.tf` : null),
      tokenSymbol: mock?.tokenSymbol ?? null,
      spotPrice: mock?.spotPrice ?? '0',
      marketCap: mock?.marketCap ?? '0',
      progressPct,
      graduated: mock?.graduated ?? false,
      repoFullName: github?.full_name ?? '',
      description: github?.description ?? '',
      stars: github?.stargazers_count ?? 0,
      forks: github?.forks_count ?? 0,
      language: github?.language ?? null,
      ownerLogin: github?.owner?.login ?? '',
      ownerAvatarUrl: github?.owner?.avatar_url ?? '',
      topics: github?.topics ?? [],
      eligibleContributors,
      filteredBots,
      priceHistory: mock ? mockPriceHistory(progressPct) : [],
      recentTrades: [],
    } satisfies RepoDetail);
  }

  // ── Live mode (contracts deployed on 0G Mainnet) ──────────────────────────

  try {
    const client = createPublicClient({
      chain: ZG_MAINNET as Parameters<typeof createPublicClient>[0]['chain'],
      transport: http('https://evmrpc.0g.ai'),
    });

    const tokenInfo = await client.readContract({
      address: registryAddress,
      abi: REPO_REGISTRY_ABI,
      functionName: 'getToken',
      args: [BigInt(repoId)],
    }) as {
      token: `0x${string}`;
      bondingCurve: `0x${string}`;
      claimContract: `0x${string}`;
      deployer: `0x${string}`;
      imageHash: `0x${string}`;
      deployedAt: bigint;
    };

    const notDeployed = tokenInfo.token === '0x0000000000000000000000000000000000000000';

    if (notDeployed) {
      return NextResponse.json({
        live: true,
        found: false,
        repoId,
        tokenAddress: null,
        bondingCurve: null,
        claimContract: null,
        deployer: null,
        deployedAt: null,
        tokenName: null,
        tokenSymbol: null,
        spotPrice: '0',
        marketCap: '0',
        progressPct: 0,
        graduated: false,
        repoFullName: github?.full_name ?? '',
        description: github?.description ?? '',
        stars: github?.stargazers_count ?? 0,
        forks: github?.forks_count ?? 0,
        language: github?.language ?? null,
        ownerLogin: github?.owner?.login ?? '',
        ownerAvatarUrl: github?.owner?.avatar_url ?? '',
        topics: github?.topics ?? [],
        eligibleContributors,
        filteredBots,
        priceHistory: [],
        recentTrades: [],
      } satisfies RepoDetail);
    }

    const curveAddr = tokenInfo.bondingCurve;

    const [tokenName, tokenSymbol, spotPriceRaw, progressRaw, graduatedRaw, buyLogs, sellLogs] =
      await Promise.all([
        client.readContract({ address: tokenInfo.token, abi: ERC20_ABI, functionName: 'name' }).catch(() => ''),
        client.readContract({ address: tokenInfo.token, abi: ERC20_ABI, functionName: 'symbol' }).catch(() => ''),
        client.readContract({ address: curveAddr, abi: BONDING_CURVE_ABI, functionName: 'getSpotPrice' }),
        client.readContract({ address: curveAddr, abi: BONDING_CURVE_ABI, functionName: 'getProgress' }),
        client.readContract({ address: curveAddr, abi: BONDING_CURVE_ABI, functionName: 'graduated' }),
        client.getLogs({ address: curveAddr, event: TOKENS_BOUGHT_EVENT, fromBlock: 0n }),
        client.getLogs({ address: curveAddr, event: TOKENS_SOLD_EVENT, fromBlock: 0n }),
      ]);

    const spotPriceNum = Number(formatUnits(spotPriceRaw as bigint, 18));
    const [tokensSold, threshold] = progressRaw as [bigint, bigint];
    const progressPct = threshold > 0n
      ? Math.min(100, Math.round((Number(tokensSold) / Number(threshold)) * 100))
      : 0;
    const marketCapNum = spotPriceNum * 1_000_000_000;
    const graduated = graduatedRaw as boolean;

    const { priceHistory, recentTrades } = buildPriceHistory(buyLogs, sellLogs);

    return NextResponse.json({
      live: true,
      found: true,
      repoId,
      tokenAddress: tokenInfo.token,
      bondingCurve: tokenInfo.bondingCurve,
      claimContract: tokenInfo.claimContract,
      deployer: tokenInfo.deployer,
      deployedAt: Number(tokenInfo.deployedAt),
      tokenName: tokenName as string,
      tokenSymbol: tokenSymbol as string,
      spotPrice: spotPriceNum < 0.000001 ? spotPriceNum.toExponential(3) : spotPriceNum.toFixed(8),
      marketCap: marketCapNum < 1 ? marketCapNum.toFixed(4) : marketCapNum.toFixed(2),
      progressPct,
      graduated,
      repoFullName: github?.full_name ?? '',
      description: github?.description ?? '',
      stars: github?.stargazers_count ?? 0,
      forks: github?.forks_count ?? 0,
      language: github?.language ?? null,
      ownerLogin: github?.owner?.login ?? '',
      ownerAvatarUrl: github?.owner?.avatar_url ?? '',
      topics: github?.topics ?? [],
      eligibleContributors,
      filteredBots,
      priceHistory,
      recentTrades,
    } satisfies RepoDetail);
  } catch (err) {
    console.error('[repo API]', err);
    return NextResponse.json({ error: 'Failed to fetch token data' }, { status: 500 });
  }
}

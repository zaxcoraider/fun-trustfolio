import { ethers } from 'ethers';
import { createPublicClient, http } from 'viem';
import { REPO_REGISTRY_ABI } from './contracts';

const OG_MAINNET_CHAIN_ID = 16661;
const OG_MAINNET_RPC = 'https://evmrpc.0g.ai';

// TYPE_CONTRIBUTOR = 0, TYPE_OWNER = 1 (matches ContributorClaim.sol)
export const CLAIM_TYPE_CONTRIBUTOR = 0;
export const CLAIM_TYPE_OWNER = 1;

export type Voucher = {
  claimant: string;
  amount: string;        // BigInt as decimal string
  deadline: number;      // unix timestamp
  claimType: number;
  signature: string;
  claimContract: string | null;
};

function getOracleWallet(): ethers.Wallet {
  const pk = process.env.ORACLE_PRIVATE_KEY;
  if (!pk) throw new Error('ORACLE_PRIVATE_KEY not set');
  return new ethers.Wallet(pk);
}

export async function issueVoucher(params: {
  repoId: string;
  claimant: string;
  amount: bigint;
  claimType: number;
}): Promise<Voucher> {
  const { repoId, claimant, amount, claimType } = params;
  const deadline = Math.floor(Date.now() / 1000) + 86400; // 24h validity

  const oracle = getOracleWallet();

  // Must match ContributorClaim.sol:
  // keccak256(abi.encodePacked(block.chainid, repoId, claimant, amount, deadline, claimType))
  const voucherHash = ethers.solidityPackedKeccak256(
    ['uint256', 'uint256', 'address', 'uint256', 'uint256', 'uint8'],
    [
      BigInt(OG_MAINNET_CHAIN_ID),
      BigInt(repoId),
      claimant,
      amount,
      BigInt(deadline),
      claimType,
    ]
  );

  // signMessage applies EIP-191 prefix — matches toEthSignedMessageHash in Solidity
  const signature = await oracle.signMessage(ethers.getBytes(voucherHash));

  // Try to fetch the claimContract address from registry (if deployed)
  let claimContract: string | null = null;
  const registryAddr = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS_MAINNET;
  if (registryAddr) {
    try {
      const client = createPublicClient({
        transport: http(OG_MAINNET_RPC),
      });
      const info = await client.readContract({
        address: registryAddr as `0x${string}`,
        abi: REPO_REGISTRY_ABI,
        functionName: 'getToken',
        args: [BigInt(repoId)],
      }) as { claimContract: string };
      claimContract = info.claimContract !== '0x0000000000000000000000000000000000000000'
        ? info.claimContract
        : null;
    } catch {
      // registry not yet deployed or call failed — that's fine
    }
  }

  return {
    claimant,
    amount: amount.toString(),
    deadline,
    claimType,
    signature,
    claimContract,
  };
}

// 50M tokens in wei (owner allocation)
export const OWNER_ALLOCATION = BigInt('50000000') * BigInt(10) ** BigInt(18);

// Contributor allocation based on commit share
export function contributorAllocation(commits: number, totalCommits: number): bigint {
  const CONTRIBUTOR_POOL = BigInt('50000000') * BigInt(10) ** BigInt(18); // 50M
  if (totalCommits === 0) return 0n;
  // Use integer math: (commits * POOL) / totalCommits
  return (BigInt(commits) * CONTRIBUTOR_POOL) / BigInt(totalCommits);
}

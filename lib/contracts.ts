// Contract addresses — update after deployment
export const CONTRACTS = {
  og_testnet: {
    chainId: 16602,
    repoRegistry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS_TESTNET as `0x${string}` | undefined,
  },
  og_mainnet: {
    chainId: 16661,
    repoRegistry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS_MAINNET as `0x${string}` | undefined,
  },
} as const;

// ─── RepoRegistry ABI ────────────────────────────────────────────────────────

export const REPO_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'deployToken',
    stateMutability: 'payable',
    inputs: [
      { name: 'repoId', type: 'uint256' },
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'imageHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isDeployed',
    stateMutability: 'view',
    inputs: [{ name: 'repoId', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getToken',
    stateMutability: 'view',
    inputs: [{ name: 'repoId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'token', type: 'address' },
          { name: 'bondingCurve', type: 'address' },
          { name: 'claimContract', type: 'address' },
          { name: 'deployer', type: 'address' },
          { name: 'imageHash', type: 'bytes32' },
          { name: 'deployedAt', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'event',
    name: 'TokenDeployed',
    inputs: [
      { name: 'repoId', type: 'uint256', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'bondingCurve', type: 'address', indexed: false },
      { name: 'claimContract', type: 'address', indexed: false },
      { name: 'deployer', type: 'address', indexed: true },
      { name: 'imageHash', type: 'bytes32', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ─── BondingCurve ABI ─────────────────────────────────────────────────────────

export const BONDING_CURVE_ABI = [
  {
    type: 'function',
    name: 'buy',
    stateMutability: 'payable',
    inputs: [{ name: 'minTokensOut', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'sell',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenAmount', type: 'uint256' },
      { name: 'minNativeOut', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getTokensForNative',
    stateMutability: 'view',
    inputs: [{ name: 'nativeAmount', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getNativeForTokens',
    stateMutability: 'view',
    inputs: [{ name: 'tokenAmount', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getSpotPrice',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getProgress',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'tokensSold', type: 'uint256' },
      { name: 'threshold', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'graduated',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'event',
    name: 'TokensBought',
    inputs: [
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'nativeIn', type: 'uint256', indexed: false },
      { name: 'tokensOut', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Graduated',
    inputs: [
      { name: 'totalNativeRaised', type: 'uint256', indexed: false },
      { name: 'remainingTokens', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ─── ContributorClaim ABI ─────────────────────────────────────────────────────

export const CONTRIBUTOR_CLAIM_ABI = [
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'claimant', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'claimType', type: 'uint8' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'sweepUnclaimed',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claimWindowEnd',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'claimWindowExpired',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'usedVouchers',
    stateMutability: 'view',
    inputs: [{ name: 'voucherHash', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

// ─── Deploy cost ─────────────────────────────────────────────────────────────

export const DEPLOY_COST_WEI = BigInt('1100000000000000000'); // 1.1 0G

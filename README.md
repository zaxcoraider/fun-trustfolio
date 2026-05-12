# fun.trustfolio.space

> **Meme tokens for the open source repos you already love — verified on-chain, traded on a bonding curve, impossible to fake.**

Live at → [fun.trustfolio.space](https://fun.trustfolio.space)  
Part of → [trustfolio.space](https://trustfolio.space)  
Built on → [0G Network](https://0g.ai)

---

## What Is This?

`fun.trustfolio.space` is a meme token launchpad for viral open source GitHub repositories.

Every major OSS project — React, Next.js, Vite, Tailwind — has millions of users, thousands of contributors, and zero financial upside for the people who built it. We fix that.

- **Repo owners** can deploy a verified meme token for their project
- **Contributors** get a share of the supply based on their commit history
- **Traders** can buy and sell freely on a bonding curve — no whales, no manipulation
- **One token per repo. Forever. No fakes. No copies.**

---

## How It Works

### Step 1 — Verify Your Repo
Add a `trustfolio.json` file to the root of your GitHub repository:

```json
{
  "wallet": "0xYourWalletAddress"
}
```

Our backend verifies this via the GitHub API. You sign a message with your wallet to confirm ownership. Both sides verified = your repo is claimed.

### Step 2 — Get Scored On-Chain
Our AI (powered by 0G Compute) scores your repo using:

| Signal | What We Measure |
|--------|----------------|
| Stars & Forks | Community impact |
| Commit Frequency | Active development |
| Contributors | Collaboration depth |
| Languages | Complexity |
| Issues & PRs | Maintenance quality |

The score (0–100) and tier (Diamond / Gold / Silver / Bronze) are stored permanently on 0G decentralized storage as a verifiable proof.

### Step 3 — Launch the Token
Deploy your repo's meme token on 0G Network. The bonding curve goes live instantly. Contributors can claim their allocation. Traders start buying.

---

## Tokenomics

**Total Supply: 1,000,000,000 (1 Billion)**

```
┌─────────────────────────────────────────────────────────┐
│                    1B Token Supply                       │
│                                                         │
│  ████████████████████████████████░░  80% Bonding Curve  │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  10% Contributors    │
│  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   5% Repo Owner      │
│  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   5% Platform        │
└─────────────────────────────────────────────────────────┘
```

| Bucket | % | Tokens | Rules |
|--------|---|--------|-------|
| Bonding Curve | 80% | 800,000,000 | Public — anyone buys at curve price |
| Contributors | 10% | 100,000,000 | Split by commit count, 6-month vest |
| Repo Owner | 5% | 50,000,000 | 6-month vest — no immediate dump |
| Platform Treasury | 5% | 50,000,000 | Funds TrustFolio infrastructure |

### Why This Distribution?

- **No insider advantage.** 80% goes to the open market via bonding curve. No presale, no VCs, no whitelist.
- **Contributors can't rug.** Their 10% vests over 6 months — their incentive is aligned with long-term token health.
- **Repo owner can't dump.** Same 6-month vest. They benefit only if the community grows.
- **Platform takes only 5%.** Just enough to sustain infrastructure — not extractive.

---

## The Bonding Curve

We use a bonding curve model inspired by pump.fun — but backed by real GitHub activity instead of just vibes.

```
Price
  ▲
  │                          ╭────── DEX graduation
  │                     ╭───╯
  │               ╭─────╯
  │         ╭─────╯
  │   ╭─────╯
  │───╯  ← starts very cheap
  └──────────────────────────────► Tokens Sold (of 800M)
```

**How it works:**
- Token price starts extremely low
- Every buy increases the price along the curve automatically
- Every sell decreases the price — traders can exit anytime
- No single wallet can buy a large % cheaply — the curve makes accumulation expensive
- **When 80% of the bonding curve fills → the token automatically graduates to a 0G DEX** with full liquidity locked

**Graduation:**
- Raised funds + remaining tokens are added as DEX liquidity
- Liquidity is locked — no rug possible
- From this point the token trades freely on the open market

---

## Zero Fake Tokens — Guaranteed

This is the core protocol guarantee. Here is exactly how it works:

### GitHub Repo IDs Are Immutable

Every GitHub repository has a **permanent numeric ID** assigned at creation. This ID never changes — even if the repo is renamed, transferred, or forked.

```
facebook/react  →  repoId: 10270250  (permanent, forever)
vercel/next.js  →  repoId: 70107786  (permanent, forever)
```

### On-Chain Registry

The `RepoRegistry` smart contract maintains a single mapping:

```solidity
mapping(uint256 repoId => address tokenAddress) public registry;

function deployToken(uint256 repoId, ...) external {
    require(registry[repoId] == address(0), "Token already exists for this repo");
    // deploy token, store address
    registry[repoId] = newTokenAddress;
}
```

**Once a token is deployed for a `repoId`, the contract permanently blocks any second deployment for the same ID.** This is enforced at the EVM level — no admin can override it, no workaround exists.

### What This Prevents

| Attack | Why It Fails |
|--------|-------------|
| Deploy a second token for the same repo | `RepoRegistry` reverts — slot already taken |
| Fork the repo and deploy a token for it | Fork gets a different `repoId` — clearly labeled as fork |
| Rename the repo to impersonate another | `repoId` doesn't change on rename |
| Delete and recreate the repo | GitHub never reuses `repoId`s |
| Claim ownership without `trustfolio.json` | Backend verification fails — no on-chain deploy triggered |

### Verification Flow

```
User submits repo URL
        │
        ▼
Backend checks trustfolio.json via GitHub API
        │
        ▼
User signs message with wallet (proves wallet ownership)
        │
        ▼
Backend fetches immutable repoId from GitHub API
        │
        ▼
Smart contract checks RepoRegistry — repoId taken? → REVERT
                                    — repoId free?  → DEPLOY + LOCK registry
        │
        ▼
Token is live. Registry is sealed. No second token possible.
```

---

## Architecture

```
fun.trustfolio.space
├── Frontend          Next.js 15 + React 19 + TailwindCSS
├── Wallet            RainbowKit + Wagmi (MetaMask, OKX, Trust, etc.)
├── Blockchain        0G Network (EVM-compatible)
│   ├── RepoRegistry.sol      — one token per repoId, forever
│   ├── RepoToken.sol         — ERC-20 with bonding curve
│   ├── BondingCurve.sol      — price discovery, auto-graduation
│   └── ContributorClaim.sol  — vested claim for contributors
├── Storage           0G Decentralized Storage (repo scores, proofs)
├── Compute           0G Compute AI (repo quality scoring)
└── Verification      GitHub API (trustfolio.json + repoId lookup)
```

---

## Smart Contracts (0G Network)

| Contract | Purpose |
|----------|---------|
| `RepoRegistry` | Global registry — maps repoId → token. Prevents all duplicates. |
| `RepoToken` | ERC-20 token for each repo. Holds bonding curve state. |
| `BondingCurve` | Price calculation, buy/sell, DEX graduation trigger. |
| `ContributorClaim` | Vesting + claim logic for repo contributors. |

---

## Revenue Model

`fun.trustfolio.space` generates revenue that sustains the entire TrustFolio ecosystem:

| Fee | Amount | Trigger |
|-----|--------|---------|
| Launch fee | 0.1 0G | Per token deployment |
| Curve trade fee | 1% | Per buy or sell on bonding curve |
| Graduation fee | 0.5% | On total raised at DEX graduation |

All fees flow to the TrustFolio treasury — paying for 0G Compute, storage, and infrastructure.

---

## Why This Matters

Open source software powers the entire internet. The developers who built the tools you use every day — React, Tailwind, Vite, Prisma — received no financial upside when their work went viral.

`fun.trustfolio.space` creates the first on-chain mechanism to turn OSS community momentum into real economic value — for owners, contributors, and traders alike.

Not a meme. A market for reputation.

---

## Tech Stack

- **Frontend:** Next.js 15, React 19, TailwindCSS, Lucide React
- **Web3:** Wagmi 2.x, Viem, Ethers.js v6, RainbowKit
- **Blockchain:** 0G Network (EVM) — testnet + mainnet
- **Storage:** 0G Decentralized Storage
- **AI Scoring:** 0G Compute
- **Verification:** GitHub REST API v3

---

## Part of TrustFolio

`fun.trustfolio.space` is the meme/trading layer of the TrustFolio ecosystem.

[trustfolio.space](https://trustfolio.space) — Verify your portfolio, mint credentials, get hired.  
[fun.trustfolio.space](https://fun.trustfolio.space) — Deploy tokens for the OSS repos you love.

Both powered by 0G Network. Both generating revenue that keeps the ecosystem alive.

---

*Built with love for open source — on 0G Network.*

# fun.trustfolio — Project Memory for Claude

## What This Is
Meme token launchpad for viral open source GitHub repos. Subdomain of trustfolio.space.
Live at: https://fun.trustfolio.space
Repo: https://github.com/zaxcoraider/fun-trustfolio
Built on: 0G Network (same as main TrustFolio)

---

## Core Concept
- Every public GitHub repo gets ONE meme token — forever, no fakes, no copies
- **Anyone from the community can deploy a token** for any public repo — no permission from repo owner needed
- First deployer wins — locked forever at EVM level (anti-fake/anti-copy guarantee)
- Traders buy/sell on a bonding curve (pump.fun style)
- When bonding curve fills → auto-graduates to 0G DEX with locked liquidity
- No gatekeeping — no minimum stars, no whitelist — market decides what survives
- Repo owner + contributors claim their allocation later via trustfolio.json verification
- No vesting — claim within 90 days or allocation goes to treasury

---

## Tokenomics (FINAL)

**Total Supply: 1,000,000,000 (1 Billion)**

| Bucket | % | Tokens | Rules |
|--------|---|--------|-------|
| Bonding Curve | 85% | 850M | Public, price discovery, buy anytime |
| Contributors | 5% | 50M | Eligible humans + AI agents with TEE wallets, 90-day claim, else → treasury |
| Repo Owner | 5% | 50M | Claim within 90 days via trustfolio.json, else → treasury |
| Platform Treasury | 5% | 50M | Auto-minted to treasury wallet at launch, no claim needed |

**Deployer gets no special allocation** — they profit by being first buyer on the bonding curve at lowest price.

---

## Contributor Eligibility Rules (FINAL)

GitHub contributors are filtered before allocation is computed:

| Contributor Type | Eligible? | Reason |
|-----------------|-----------|--------|
| Human developer | YES | Standard trustfolio.json verification |
| AI Agent with TEE wallet (OpenClaw, Hermes, Olas etc.) | YES | TEE attestation proves wallet ownership |
| `dependabot[bot]` | NO | No wallet, automation only |
| `github-actions[bot]` | NO | No wallet, automation only |
| Any GitHub `type: Bot` without TEE | NO | Cannot verify wallet |

- Eligible contributors split 5% proportionally by commit count
- If zero eligible contributors → 5% added to **bonding curve liquidity** at launch (never treasury)
- AI agents claim same way as humans — trustfolio.json in their profile repo + TEE attestation

---

## Token Image (FINAL — Option C)

Every token needs an image. Two-layer approach:

1. **Auto-generated at deploy time** (default, no action needed from deployer):
   - Repo owner's GitHub avatar as base
   - Repo name as text overlay
   - Primary language color as background (GitHub's language color map)
   - Star count badge
2. **Deployer can optionally replace** with a custom meme image before confirming deploy
3. Once deployed → image locked permanently on **0G Storage** (decentralized, no IPFS, no S3)
4. Image content hash stored in RepoToken on-chain metadata

---

## Anti-Fake Token System (FINAL)

GitHub repo IDs are permanent numeric IDs — never change even if repo is renamed/transferred.

```solidity
mapping(uint256 repoId => address tokenAddress) public registry;

function deployToken(uint256 repoId) external {
    require(registry[repoId] == address(0), "Token already exists");
    registry[repoId] = newTokenAddress;
}
```

Once deployed → permanently blocked. No admin override. EVM-enforced.

---

## Revenue Model

| Fee | Amount | Trigger |
|-----|--------|---------|
| Launch fee | 0.1 0G | Per token deployment (paid by community deployer) |
| Curve trade fee | 1% | Per buy or sell |
| Graduation fee | 0.5% | On total raised at DEX graduation |

All fees → fun.trustfolio treasury

---

## Phase-by-Phase Build Plan

### Phase 0 — Already Done
- [x] Landing page (ticker, hero, how it works, trending repos — mock data)
- [x] Navbar with Connect Wallet (RainbowKit + Wagmi)
- [x] /explore placeholder
- [x] /launch placeholder
- [x] Deployed to fun.trustfolio.space on Vercel
- [x] Fire favicon, full README

---

### Phase 1 — GitHub Verification API

**Goal:** Verify any public GitHub repo and fetch all data needed for token deployment.

**Deploy Flow:**
1. Anyone goes to `/launch`
2. Enters any public GitHub repo URL
3. Backend fetches:
   - `repoId` (immutable numeric ID — never changes)
   - Repo name, stars, language, description
   - Owner avatar URL
   - Top contributors list (filtered — bots without TEE removed)
4. Auto-generates token image from GitHub data
5. Deployer can optionally replace with custom meme image
6. Image uploaded to 0G Storage → content hash returned
7. Deployer pays 0.1 0G launch fee
8. `RepoRegistry.deployToken(repoId, imageHash, contributorsMerkleRoot)` called
9. Contract checks — repoId already exists? **REJECT**
10. Token deployed — first deployer wins, locked forever
11. Redirect to `/repo/[repoId]`

**Owner Claim Flow (separate, happens later):**
1. Repo owner sees their repo got tokenized on `/repo/[repoId]`
2. Goes to `/claim`
3. Adds `trustfolio.json` to repo root: `{ "wallet": "0xOwnerAddress" }`
4. Backend verifies: file exists + GitHub confirms they are the actual repo owner
5. Signs message with wallet → claim 5% allocation
6. 90-day window from token launch — miss it → goes to treasury

**Contributor Claim Flow:**
1. Contributor goes to `/claim`
2. Adds `trustfolio.json` to their GitHub profile repo (`github.com/username/username`)
3. Backend verifies: they are in the contributor list for that repoId
4. Signs message with wallet → claim their proportional share of 5%
5. AI agents: trustfolio.json in profile repo + TEE attestation instead of manual signing
6. 90-day window — miss it → goes to treasury

**API Routes to build:**
- `POST /api/verify-repo` — accepts repo URL, returns repoId + repo metadata + filtered contributor list
- `POST /api/generate-image` — generates token image from GitHub data, returns preview
- `POST /api/upload-image` — uploads final image to 0G Storage, returns content hash
- `GET /api/contributors/[repoId]` — fetches contributor list, filters bots, returns eligible list with commit counts
- `POST /api/verify-owner` — verifies trustfolio.json for repo owner claim
- `POST /api/verify-contributor` — verifies trustfolio.json for contributor claim

**Infrastructure:**
- GitHub App (not personal token) — free, 15k req/hour
- 0G Storage SDK for image storage
- No database yet — GitHub API is source of truth

---

### Phase 2 — Smart Contracts (0G Network)

**Goal:** 4 contracts, everything enforced at EVM level.

#### Contract 1: RepoRegistry.sol
- `mapping(uint256 repoId => address tokenAddress) public registry`
- `deployToken(uint256 repoId, bytes32 imageHash, bytes32 contributorsMerkleRoot)` 
- Blocks second token for same repoId forever — no admin override
- Deploys new RepoToken via factory pattern
- Emits event with all token metadata (repoId, tokenAddress, imageHash, deployer, timestamp)

#### Contract 2: RepoToken.sol (ERC-20)
- Total supply: 1,000,000,000
- On deploy:
  - 850M → BondingCurve contract
  - 50M → ContributorClaim contract (contributors 5%)
  - 50M → ContributorClaim contract (owner 5%, separate bucket)
  - 50M → treasury wallet instantly (no claim needed)
- Standard ERC-20, no mint/burn after deploy

#### Contract 3: BondingCurve.sol
- Holds 850M tokens
- Price increases with every buy, decreases with every sell
- 1% fee on every buy/sell → treasury
- At 80% of curve sold (680M tokens) → triggers DEX graduation automatically
- On graduation: remaining tokens + all raised 0G → 0G DEX pool, liquidity burned forever

#### Contract 4: ContributorClaim.sol
- Holds 100M tokens (50M contributors + 50M owner, tracked separately)
- Merkle tree approach — only one root hash stored on-chain (gas efficient at scale)
- `claim(bytes32[] proof, uint256 amount)` — verifies merkle proof, releases tokens
- `sweepUnclaimed(uint256 repoId)` — callable after 90 days, sends all remaining to bonding curve liquidity (never treasury)
- 90-day claim window from token launch timestamp
- No distinction between human wallet and TEE wallet at contract level — just an address

**Deployment order:** RepoRegistry → RepoToken factory → BondingCurve → ContributorClaim
**Network:** 0G Testnet (chain 16602) first → Mainnet (chain 16661)
**Tooling:** Hardhat or Foundry (decide before Phase 2 starts)

---

### Phase 3 — Repo Scoring (0G Compute)

**Goal:** Give every repo a trust/hype score shown on its token page.

**Score inputs:**
- GitHub stars, forks, open issues, commit frequency
- Contributor count, top language, repo age
- Recent activity (last commit date)

**Flow:**
- `POST /api/repo-score` → fetches GitHub stats → sends to 0G Compute AI model → returns score 0-100
- Score stored on 0G Storage (not on-chain — saves gas)
- Shown prominently on `/repo/[repoId]`
- Refreshes periodically (not real-time)

---

### Phase 4 — Frontend Pages

#### `/launch` (Full Deploy Flow)
- Step 1: Enter any public GitHub repo URL
- Step 2: Backend fetches repo data, shows preview (name, stars, language, contributors)
- Step 3: Show auto-generated token image — option to upload custom image
- Step 4: Pay 0.1 0G launch fee + confirm deploy transaction
- Step 5: Success → redirect to `/repo/[repoId]`

#### `/explore`
- Grid of all deployed repo tokens (indexed from RepoRegistry events)
- Filter by: newest, trending, graduating soon, language
- Each card: token image, repo name, score, current price, market cap, graduation progress bar

#### `/repo/[repoId]`
- Token image + repo info (name, stars, language, description, score)
- Bonding curve chart (price over time)
- Buy / Sell panel (calls BondingCurve.sol)
- Contributors list with their allocation %
- Graduation progress bar
- Owner claim status (claimed / unclaimed / expired)

#### `/claim`
- Connect wallet
- Shows all claimable allocations for connected wallet across all repo tokens
- Owner claim: add trustfolio.json to repo root → verify → claim
- Contributor claim: add trustfolio.json to GitHub profile repo → verify → claim
- AI Agent claim: trustfolio.json + TEE attestation
- 90-day countdown timer per token
- After expiry: "Claim expired — sent to treasury"

---

## Security Architecture (MUST implement before mainnet)

### Smart Contract Security

| Risk | Attack | Fix |
|------|--------|-----|
| Reentrancy | Attacker re-enters BondingCurve on sell before balance updates | `ReentrancyGuard` on all buy/sell + checks-effects-interactions pattern |
| Front-running | Sandwich attack on large curve buys | Slippage protection — buyer sets max price, tx reverts if price moved |
| Integer overflow | Bonding curve math breaks at extremes | Solidity 0.8+ built-in protection + audit curve formula carefully |
| Fake merkle proof | Attacker crafts proof to claim tokens they don't own | Merkle root generated from verified GitHub data, immutable after deploy |
| Fake repoId | Attacker submits wrong repoId to hijack a repo token | Backend always fetches repoId from GitHub API — user never inputs it manually |
| Graduation manipulation | Attacker games supply math to drain pool at graduation | Graduation threshold hardcoded in contract — not adjustable after deploy |
| sweepUnclaimed too early | Someone calls sweep before 90 days | `require(block.timestamp >= launchTime + 90 days)` hardcoded |

### Backend / API Security

| Risk | Attack | Fix |
|------|--------|-----|
| GitHub API spoofing | Trick backend into thinking trustfolio.json exists | Always fetch from `api.github.com` directly — never trust user-provided URLs |
| Signature replay | Capture valid wallet signature, reuse on another token | Sign message includes `repoId + chainId + timestamp + nonce` — nonce invalidated after one use |
| Race condition on deploy | Two people verify same repo simultaneously, both approved | Contract is final authority — `RepoRegistry.sol` rejects second `deployToken()` at EVM level regardless |
| SSRF attack | Submit malicious URL to make backend call internal services | Strictly validate all URLs — must match `github.com/:owner/:repo` pattern, reject everything else |

### Economic Security

| Risk | Attack | Fix |
|------|--------|-----|
| Liquidity rug post-graduation | Drain DEX pool after token graduates | LP tokens burned on graduation — mathematically impossible to withdraw |
| Treasury compromise | Treasury wallet hacked — all fees lost | Multi-sig wallet (Gnosis Safe) — require 2/3 signatures for any withdrawal |

### Frontend Security

| Risk | Attack | Fix |
|------|--------|-----|
| Transaction simulation spoofing | Fake RPC shows user safe tx, actually drains wallet | Show decoded tx details before confirm. Use trusted RPC endpoints only |
| Malicious image upload | Image metadata abused | Strip all metadata server-side on upload. Validate file type server-side (not just extension) |

### Top 4 Risks (Priority Order)
1. **Reentrancy on BondingCurve.sol** — most critical, real money at stake
2. **Compromised treasury wallet** — use Gnosis Safe multi-sig from day one
3. **Wallet signature replay** — nonce system must be airtight
4. **Sandwich attacks on curve trades** — slippage protection mandatory

### Audit Strategy (Before Mainnet)
1. Deploy on 0G Testnet — internal testing
2. Bug bounty on testnet — community tries to break it
3. Professional smart contract audit (Certik, Hacken, or similar)
4. Fix all findings
5. Mainnet launch with **TVL cap** (e.g. max 10,000 0G total across all curves initially)
6. Gradually raise cap as confidence grows

---

## What Gets Stored Where

| Data | Where |
|------|-------|
| Token image | 0G Storage (permanent, decentralized) |
| repoId → token address | RepoRegistry.sol (on-chain) |
| Contributor merkle root | ContributorClaim.sol (on-chain) |
| Repo metadata (name, stars, lang) | Emitted as on-chain event |
| Repo score | 0G Storage (off-chain, refreshable) |

---

## Tech Stack
- Next.js 15, React 19, TailwindCSS
- RainbowKit + Wagmi (wallet connection)
- 0G Network mainnet (chain 16661, RPC: https://evmrpc.0g.ai) — deploying to mainnet
- 0G Network testnet (chain 16602) — dev/testing only
- Foundry (smart contracts — forge, cast, anvil)
- 0G Storage (images + scores)
- 0G Compute (AI repo scoring)
- Hardhat or Foundry (smart contracts)
- GitHub App for API (15k req/hour free)
- Same neon dark theme (purple/cyan/pink)

---

## Important Decisions (LOCKED)
- Separate repo from main TrustFolio — not monorepo
- Use immutable GitHub repoId (NOT repo name) as on-chain identifier
- **Anyone can deploy** a token for any public repo — no owner permission needed
- **No gatekeeping** — no minimum stars, market decides what survives
- **No vesting** for owner or contributors — claim within 90 days or lose it
- Unclaimed tokens after 90 days → **added to bonding curve liquidity** via `sweepUnclaimed()` — never treasury
- Zero eligible contributors → 5% added to bonding curve liquidity at launch immediately
- Platform treasury takes 5% only — that's the only team cut, no more
- Platform treasury 5% minted at launch instantly — no claim needed
- Treasury 5% per repo token: team decides to sell, burn, or add to liquidity — flexible, no on-chain rules
- **Deployer gets no special allocation** — first buyer advantage on curve is their reward
- Bot contributors filtered out UNLESS they have TEE wallet with attestation
- Zero eligible contributors → 5% goes to treasury at launch immediately (no wait)
- Token image: auto-generated from GitHub data, deployer can optionally replace, stored on 0G Storage forever
- Bonding curve graduates at 80% sold → liquidity burned, no rug possible
- Merkle tree for contributor claims (gas efficient at scale)

---

## What's Currently Built
- [x] Landing page with ticker, hero, how it works, trending repos (mock data)
- [x] Navbar with Connect Wallet
- [x] /explore placeholder
- [x] /launch placeholder
- [x] Deployed to fun.trustfolio.space on Vercel
- [x] Linked from main TrustFolio navbar as "✦ fun.tf"
- [x] Fire favicon + full README

## What's NOT Built Yet (Build Order)
1. Phase 1 — GitHub verification + image generation API routes
2. Phase 2 — Smart contracts (RepoRegistry, RepoToken, BondingCurve, ContributorClaim)
3. Phase 3 — Repo scoring via 0G Compute
4. Phase 4 — /launch full flow, /explore real data, /repo/[repoId], /claim

---

## Main TrustFolio Repo
- Folder: C:\Users\ASIF KHAN\Desktop\trustfolio
- GitHub: https://github.com/zaxcoraider/trust-folio
- Live: https://trustfolio.space

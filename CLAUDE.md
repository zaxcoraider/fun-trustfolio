# fun.trustfolio — Project Memory for Claude

## What This Is
Meme token launchpad for viral open source GitHub repos. Subdomain of trustfolio.space.
Live at: https://fun.trustfolio.space
Repo: https://github.com/zaxcoraider/fun-trustfolio
Built on: 0G Network (same as main TrustFolio)

## What We Are Building (Full Plan)

### Core Concept
- Every viral OSS GitHub repo gets ONE meme token — forever, no fakes, no copies
- Token is deployed by the repo owner after verifying wallet ownership via GitHub
- Traders buy/sell on a bonding curve (pump.fun style)
- Contributors get vested token allocation based on commit history
- When bonding curve fills → auto-graduates to 0G DEX with locked liquidity

### Phase 1 — GitHub Verification (NOT built yet)
- User submits their GitHub repo URL
- They add a `trustfolio.json` file to repo root: `{ "wallet": "0x..." }`
- Our backend hits GitHub API to verify the file exists
- User signs a message with their wallet (proves wallet owns the address in the file)
- Backend fetches the immutable GitHub repoId (numeric, never changes even if repo renamed)
- repoId is passed to smart contract for deployment

### Phase 2 — Smart Contracts (NOT built yet)
Four contracts needed on 0G Network:

1. **RepoRegistry.sol**
   - `mapping(uint256 repoId => address tokenAddress)`
   - Blocks any second token for same repoId — enforced at EVM level
   - This is the anti-fake/anti-copy guarantee

2. **RepoToken.sol**
   - ERC-20, 1,000,000,000 total supply
   - Holds bonding curve state

3. **BondingCurve.sol**
   - Price starts very low, increases with every buy
   - Sell anytime at current curve price
   - When 80% of curve sold → triggers DEX graduation automatically
   - Liquidity locked on graduation — no rug possible

4. **ContributorClaim.sol**
   - Top contributors from GitHub API get token allocation
   - Contributors verify their wallets the same way (trustfolio.json)
   - 6-month vest — cannot dump immediately

### Phase 3 — Backend API (NOT built yet)
New API routes needed:
- `POST /api/verify-repo` — check trustfolio.json via GitHub API, return repoId
- `POST /api/repo-score` — fetch repo stats (stars, commits, contributors, languages) and pass to 0G Compute for AI scoring
- `GET /api/contributors/[repoId]` — fetch top contributors list from GitHub API

GitHub App (free, 15k req/hour) needed — not personal token.

### Phase 4 — Frontend Pages (partially scaffolded)
- `/` — Landing (DONE — live)
- `/explore` — Browse all deployed repo tokens (placeholder only)
- `/launch` — Repo verification + token deployment flow (placeholder only)
- `/repo/[repoId]` — Individual repo token page, score, bonding curve chart, buy/sell
- `/claim` — Contributors claim their vested allocation

---

## Tokenomics (Final Decision)

**Total Supply: 1,000,000,000 (1 Billion)**

| Bucket | % | Tokens | Rules |
|--------|---|--------|-------|
| Bonding Curve | 80% | 800M | Public, price discovery |
| Contributors | 10% | 100M | Split by commits, 6mo vest |
| Repo Owner | 5% | 50M | 6mo vest |
| Platform Treasury | 5% | 50M | TrustFolio ops |

---

## Anti-Fake Token System (Key Architecture Decision)

GitHub repo IDs are permanent numeric IDs that never change even if repo is renamed/transferred.

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
| Launch fee | 0.1 0G | Per token deployment |
| Curve trade fee | 1% | Per buy or sell |
| Graduation fee | 0.5% | On total raised at DEX graduation |

All fees → TrustFolio treasury (same treasury as main trustfolio.space)

---

## Tech Stack
- Next.js 15, React 19, TailwindCSS (upgraded from TrustFolio's Next 14)
- RainbowKit + Wagmi (same wallet setup as TrustFolio)
- 0G Network (testnet chain 16602, mainnet chain 16661)
- Same neon dark theme as TrustFolio (purple/cyan/pink)

## What's Currently Built
- [x] Landing page with ticker, hero, how it works, trending repos grid (mock data)
- [x] Navbar with Connect Wallet
- [x] /explore page (placeholder)
- [x] /launch page (placeholder)
- [x] Deployed to fun.trustfolio.space on Vercel
- [x] Linked from main TrustFolio navbar as "✦ fun.tf"
- [x] 🔥 favicon
- [x] Full README with tokenomics + anti-fake architecture

## What's NOT Built Yet (Build Order)
1. GitHub verification API route
2. Smart contracts (RepoRegistry, RepoToken, BondingCurve, ContributorClaim)
3. Repo scoring via 0G Compute
4. /launch page — full verification + deploy flow
5. /explore page — real token listings from on-chain
6. /repo/[repoId] — token detail page with bonding curve chart + buy/sell
7. /claim page — contributor vesting + claim

## Important Decisions Already Made
- Separate repo from main TrustFolio (not monorepo) — they'll diverge fast
- fun.trustfolio.space domain registered on Vercel (auto DNS, no external registrar)
- Use immutable GitHub repoId (NOT repo name) as the on-chain identifier
- Bonding curve model like pump.fun — no presale, no insiders
- Contributor/owner allocation vested 6 months to prevent dumps
- 0G Network for all contracts + storage + compute (same as TrustFolio)

## Main TrustFolio Repo
- Folder: C:\Users\ASIF KHAN\Desktop\trustfolio
- GitHub: https://github.com/zaxcoraider/trust-folio
- Live: https://trustfolio.space

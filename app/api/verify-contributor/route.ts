import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { generateNonce, verifyAndConsumeNonce } from '@/lib/nonce-store';
import { isBot, fetchRepoById, fetchContributors, githubHeaders } from '@/lib/github';
import { issueVoucher, contributorAllocation, CLAIM_TYPE_CONTRIBUTOR } from '@/lib/oracle';

const GITHUB_API = 'https://api.github.com';

function nonceKey(repoId: string, githubLogin: string, wallet: string) {
  return `contributor:${repoId}:${githubLogin.toLowerCase()}:${wallet.toLowerCase()}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const repoId = searchParams.get('repoId');
  const githubLogin = searchParams.get('githubLogin');
  const wallet = searchParams.get('wallet');

  if (!repoId || !githubLogin || !wallet) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const nonce = generateNonce(nonceKey(repoId, githubLogin, wallet));
  return NextResponse.json({ nonce });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { repoId, githubLogin, wallet, signature, nonce } = body || {};

  if (!repoId || !githubLogin || !wallet || !signature || !nonce) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9-]+$/.test(githubLogin)) {
    return NextResponse.json({ error: 'Invalid GitHub username' }, { status: 400 });
  }

  // 1. Verify and consume nonce (anti-replay)
  if (!verifyAndConsumeNonce(nonceKey(repoId, githubLogin, wallet), nonce)) {
    return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 401 });
  }

  // 2. Verify wallet signature
  const message = `fun.trustfolio contributor verification\nrepoId: ${repoId}\ngithubLogin: ${githubLogin}\nwallet: ${wallet.toLowerCase()}\nnonce: ${nonce}`;
  try {
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== wallet.toLowerCase()) {
      return NextResponse.json({ error: 'Signature mismatch' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 3. Check trustfolio.json in contributor's GitHub profile repo (username/username)
  const fileRes = await fetch(
    `${GITHUB_API}/repos/${githubLogin}/${githubLogin}/contents/trustfolio.json`,
    { headers: githubHeaders() }
  );
  if (!fileRes.ok) {
    return NextResponse.json(
      {
        error: `trustfolio.json not found at github.com/${githubLogin}/${githubLogin}. Create your profile repo and add { "wallet": "0x..." }.`,
      },
      { status: 400 }
    );
  }

  const fileData = await fileRes.json();
  let content: { wallet?: string };
  try {
    content = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));
  } catch {
    return NextResponse.json({ error: 'trustfolio.json is not valid JSON' }, { status: 400 });
  }

  if (!content.wallet || content.wallet.toLowerCase() !== wallet.toLowerCase()) {
    return NextResponse.json(
      { error: 'Wallet in trustfolio.json does not match your connected wallet' },
      { status: 400 }
    );
  }

  // 4. Verify they actually contributed to this repo and compute their share
  const repoData = await fetchRepoById(repoId);
  if (!repoData) {
    return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
  }

  const allContributors = await fetchContributors(repoData.full_name);
  const eligible = (allContributors as { login: string; type: string; contributions: number; avatar_url: string }[])
    .filter(c => !isBot(c));

  const match = eligible.find(c => c.login.toLowerCase() === githubLogin.toLowerCase());
  if (!match) {
    return NextResponse.json(
      { error: `${githubLogin} is not an eligible contributor for this repo` },
      { status: 400 }
    );
  }

  const totalCommits = eligible.reduce((s, c) => s + c.contributions, 0);
  const amount = contributorAllocation(match.contributions, totalCommits);

  if (amount === 0n) {
    return NextResponse.json({ error: 'Allocation is zero — no tokens to claim' }, { status: 400 });
  }

  // 5. Issue oracle-signed voucher
  try {
    const voucher = await issueVoucher({
      repoId,
      claimant: wallet,
      amount,
      claimType: CLAIM_TYPE_CONTRIBUTOR,
    });

    return NextResponse.json({
      verified: true,
      repoId,
      githubLogin,
      wallet,
      repoFullName: repoData.full_name,
      contributions: match.contributions,
      totalEligibleCommits: totalCommits,
      allocationTokens: amount.toString(),
      allocationPct: ((match.contributions / totalCommits) * 5).toFixed(4),
      voucher,
    });
  } catch (err) {
    console.error('[verify-contributor] oracle signing failed:', err);
    return NextResponse.json({ error: 'Oracle signing failed. Check ORACLE_PRIVATE_KEY.' }, { status: 500 });
  }
}

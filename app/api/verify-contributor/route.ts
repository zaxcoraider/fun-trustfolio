import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { generateNonce, verifyAndConsumeNonce } from '@/lib/nonce-store';
import { isBot, fetchRepoById, fetchContributors, githubHeaders } from '@/lib/github';

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

  // Validate githubLogin format (prevent injection / SSRF)
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
        error: `trustfolio.json not found at github.com/${githubLogin}/${githubLogin}. Create a profile repo and add it with { "wallet": "0x..." }`,
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
      { error: 'Wallet in trustfolio.json does not match connected wallet' },
      { status: 400 }
    );
  }

  // 4. Verify they actually contributed to this repo
  const repoData = await fetchRepoById(repoId);
  if (!repoData) {
    return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
  }

  const contributors = await fetchContributors(repoData.full_name);
  const match = (contributors as any[]).find(
    (c: any) =>
      c.login.toLowerCase() === githubLogin.toLowerCase() && !isBot(c)
  );

  if (!match) {
    return NextResponse.json(
      { error: `${githubLogin} is not an eligible contributor for this repo` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    verified: true,
    repoId,
    githubLogin,
    wallet,
    contributions: match.contributions,
  });
}

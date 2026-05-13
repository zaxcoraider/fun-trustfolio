import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { generateNonce, verifyAndConsumeNonce } from '@/lib/nonce-store';
import { fetchRepoById, githubHeaders } from '@/lib/github';

const GITHUB_API = 'https://api.github.com';

function nonceKey(repoId: string, wallet: string) {
  return `owner:${repoId}:${wallet.toLowerCase()}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const repoId = searchParams.get('repoId');
  const wallet = searchParams.get('wallet');

  if (!repoId || !wallet) {
    return NextResponse.json({ error: 'Missing repoId or wallet' }, { status: 400 });
  }

  const nonce = generateNonce(nonceKey(repoId, wallet));
  return NextResponse.json({ nonce });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { repoId, wallet, signature, nonce } = body || {};

  if (!repoId || !wallet || !signature || !nonce) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // 1. Verify and consume nonce (anti-replay)
  if (!verifyAndConsumeNonce(nonceKey(repoId, wallet), nonce)) {
    return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 401 });
  }

  // 2. Verify wallet signature
  const message = `fun.trustfolio owner verification\nrepoId: ${repoId}\nwallet: ${wallet.toLowerCase()}\nnonce: ${nonce}`;
  try {
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== wallet.toLowerCase()) {
      return NextResponse.json({ error: 'Signature mismatch' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 3. Fetch repo from repoId
  const repoData = await fetchRepoById(repoId);
  if (!repoData) {
    return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
  }

  // 4. Fetch trustfolio.json from repo root
  const fileRes = await fetch(
    `${GITHUB_API}/repos/${repoData.full_name}/contents/trustfolio.json`,
    { headers: githubHeaders() }
  );
  if (!fileRes.ok) {
    return NextResponse.json(
      { error: 'trustfolio.json not found in repo root. Add it with { "wallet": "0x..." }' },
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

  return NextResponse.json({
    verified: true,
    repoId,
    wallet,
    ownerLogin: repoData.owner.login,
  });
}

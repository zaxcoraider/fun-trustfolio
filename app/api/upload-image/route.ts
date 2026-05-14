import { NextRequest, NextResponse } from 'next/server';
import { Indexer, MemData } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';

const OG_MAINNET_RPC = 'https://evmrpc.0g.ai';
const STORAGE_INDEXER = 'https://indexer-storage-turbo.0g.ai';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('image') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid image type. Use PNG, JPEG, GIF, or WEBP' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Image too large. Max 5MB' }, { status: 400 });
  }

  const pk = process.env.ORACLE_PRIVATE_KEY;
  if (!pk) {
    return NextResponse.json({ error: 'Storage signer not configured (ORACLE_PRIVATE_KEY missing)' }, { status: 500 });
  }

  try {
    const provider = new ethers.JsonRpcProvider(OG_MAINNET_RPC);
    const signer = new ethers.Wallet(pk, provider);
    const indexer = new Indexer(STORAGE_INDEXER);

    const buf = Buffer.from(await file.arrayBuffer());
    const memData = new MemData(buf);

    // Get root hash before upload — this is the permanent content address
    const [tree, treeErr] = await memData.merkleTree();
    if (treeErr) {
      console.error('[upload-image] merkle tree error:', treeErr);
      return NextResponse.json({ error: 'Failed to compute image hash' }, { status: 500 });
    }
    const rootHash = tree!.rootHash() as string;

    // Upload to 0G Storage mainnet
    const [tx, uploadErr] = await indexer.upload(memData, OG_MAINNET_RPC, signer);
    if (uploadErr) {
      console.error('[upload-image] upload error:', uploadErr);
      return NextResponse.json({ error: `0G Storage upload failed: ${uploadErr}` }, { status: 500 });
    }

    return NextResponse.json({
      hash: rootHash,   // bytes32 — store this on-chain as imageHash
      tx,               // storage tx hash (for reference)
      storageUrl: `${STORAGE_INDEXER}/file/${rootHash}`,
    });
  } catch (err) {
    console.error('[upload-image]', err);
    return NextResponse.json({ error: 'Upload failed. Check server logs.' }, { status: 500 });
  }
}

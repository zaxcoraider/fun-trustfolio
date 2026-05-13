import { NextRequest, NextResponse } from 'next/server';

// TODO Phase 2: Replace with real 0G Storage SDK upload
// import { ZgFile, Indexer } from '@0glabs/0g-ts-sdk';

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('image') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  // Validate file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid image type. Use PNG, JPEG, GIF, or WEBP' }, { status: 400 });
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image too large. Max 5MB' }, { status: 400 });
  }

  // Placeholder: return mock hash until 0G Storage SDK is integrated in Phase 2
  const mockHash = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')}`;

  return NextResponse.json({
    hash: mockHash,
    url: `https://0g-storage-placeholder/${mockHash}`,
    note: '0G Storage integration pending Phase 2',
  });
}

const store = new Map<string, { nonce: string; expiresAt: number }>();

export function generateNonce(key: string): string {
  const nonce = crypto.randomUUID();
  store.set(key, { nonce, expiresAt: Date.now() + 5 * 60 * 1000 }); // 5 min TTL
  return nonce;
}

export function verifyAndConsumeNonce(key: string, nonce: string): boolean {
  const stored = store.get(key);
  if (!stored) return false;
  if (stored.expiresAt < Date.now()) {
    store.delete(key);
    return false;
  }
  if (stored.nonce !== nonce) return false;
  store.delete(key); // one-time use
  return true;
}

'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { NeonCard } from '@/components/NeonCard';
import {
  Gift, CheckCircle, AlertCircle, Loader2, ExternalLink, Copy, ChevronRight, User, Code2,
} from 'lucide-react';
import { CONTRIBUTOR_CLAIM_ABI } from '@/lib/contracts';

type ClaimMode = 'owner' | 'contributor';
type Step = 'input' | 'instructions' | 'verifying' | 'ready' | 'claiming' | 'success' | 'error';

interface Voucher {
  claimant: string;
  amount: string;
  deadline: number;
  claimType: number;
  signature: string;
  claimContract: string | null;
}

interface VerifyResult {
  repoFullName: string;
  repoId: string;
  allocationTokens: string;
  allocationPct?: string;
  contributions?: number;
  voucher: Voucher;
}

const FORMAT_TOKENS = (raw: string) => {
  const n = BigInt(raw) / BigInt(10) ** BigInt(18);
  return Number(n).toLocaleString();
};

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  if (done) return <div className="w-2 h-2 rounded-full bg-neon-green" />;
  if (active) return <div className="w-2 h-2 rounded-full bg-neon-purple animate-pulse" />;
  return <div className="w-2 h-2 rounded-full bg-gray-700" />;
}

export default function ClaimPage() {
  const { isConnected, address, chain } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [mode, setMode] = useState<ClaimMode>('owner');
  const [step, setStep] = useState<Step>('input');
  const [repoUrl, setRepoUrl] = useState('');
  const [githubLogin, setGithubLogin] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const { isLoading: txPending } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}` | undefined,
    query: { enabled: !!txHash },
  });

  function reset() {
    setStep('input');
    setResult(null);
    setTxHash('');
    setError('');
    setRepoUrl('');
    setGithubLogin('');
  }

  function copyJson(wallet: string) {
    navigator.clipboard.writeText(`{ "wallet": "${wallet}" }`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleVerify() {
    if (!address) return;
    setError('');

    // 1. Resolve repo URL → repoId
    setStep('verifying');
    let repoId: string;
    try {
      const verifyRes = await fetch('/api/verify-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: repoUrl.trim() }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Failed to fetch repo');
      repoId = String(verifyData.repoId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resolve repo');
      setStep('error');
      return;
    }

    // 2. Get nonce
    const nonceParams =
      mode === 'owner'
        ? `?repoId=${repoId}&wallet=${address}`
        : `?repoId=${repoId}&githubLogin=${githubLogin.trim()}&wallet=${address}`;

    const nonceEndpoint = mode === 'owner' ? '/api/verify-owner' : '/api/verify-contributor';
    let nonce: string;
    try {
      const nonceRes = await fetch(nonceEndpoint + nonceParams);
      const nonceData = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(nonceData.error || 'Failed to get nonce');
      nonce = nonceData.nonce;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to get nonce');
      setStep('error');
      return;
    }

    // 3. Sign message with wallet
    let signature: string;
    try {
      const message =
        mode === 'owner'
          ? `fun.trustfolio owner verification\nrepoId: ${repoId}\nwallet: ${address.toLowerCase()}\nnonce: ${nonce}`
          : `fun.trustfolio contributor verification\nrepoId: ${repoId}\ngithubLogin: ${githubLogin.trim()}\nwallet: ${address.toLowerCase()}\nnonce: ${nonce}`;

      const { ethereum } = window as unknown as { ethereum?: { request: (args: { method: string; params: string[] }) => Promise<string> } };
      if (!ethereum) throw new Error('No wallet found');
      signature = await ethereum.request({ method: 'personal_sign', params: [message, address] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('rejected') || msg.includes('denied')) {
        setStep('input');
        return;
      }
      setError('Wallet signing failed');
      setStep('error');
      return;
    }

    // 4. POST to verify endpoint
    try {
      const body =
        mode === 'owner'
          ? { repoId, wallet: address, signature, nonce }
          : { repoId, githubLogin: githubLogin.trim(), wallet: address, signature, nonce };

      const res = await fetch(nonceEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      setResult({
        repoFullName: data.repoFullName,
        repoId,
        allocationTokens: data.allocationTokens,
        allocationPct: data.allocationPct,
        contributions: data.contributions,
        voucher: data.voucher,
      });
      setStep('ready');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setStep('error');
    }
  }

  async function handleClaim() {
    if (!result?.voucher || !result.voucher.claimContract) {
      setError('No claim contract found for this token');
      setStep('error');
      return;
    }

    setStep('claiming');
    try {
      const hash = await writeContractAsync({
        address: result.voucher.claimContract as `0x${string}`,
        abi: CONTRIBUTOR_CLAIM_ABI,
        functionName: 'claim',
        args: [
          result.voucher.claimant as `0x${string}`,
          BigInt(result.voucher.amount),
          BigInt(result.voucher.deadline),
          result.voucher.claimType,
          result.voucher.signature as `0x${string}`,
        ],
      });
      setTxHash(hash);
      setStep('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('rejected') || msg.includes('denied')) {
        setStep('ready');
        return;
      }
      setError(msg || 'Transaction failed');
      setStep('error');
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="fixed inset-0 bg-grid pointer-events-none" />
        <NeonCard className="p-10 text-center max-w-sm w-full" glow="purple">
          <Gift size={40} className="mx-auto mb-4 text-neon-purple/40" />
          <p className="text-white font-mono text-lg font-bold mb-2">Claim Your Tokens</p>
          <p className="text-gray-400 font-mono text-sm mb-6">
            Connect your wallet to claim repo owner or contributor allocations
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </NeonCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-24">
      <div className="fixed inset-0 bg-grid pointer-events-none" />
      <div className="relative max-w-xl mx-auto">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-mono text-3xl font-bold text-white mb-2">
            <span className="text-neon-purple">Claim</span> Your Allocation
          </h1>
          <p className="text-gray-400 font-mono text-sm">
            Repo owners and contributors each get 5% of the token supply.
            <br />Claim within 90 days of token launch.
          </p>
        </div>

        {/* Mode Toggle */}
        {(step === 'input' || step === 'instructions') && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setMode('owner'); setStep('input'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border font-mono text-sm transition-all ${
                mode === 'owner'
                  ? 'bg-neon-purple/20 border-neon-purple text-white'
                  : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              <Code2 size={16} />
              Repo Owner
            </button>
            <button
              onClick={() => { setMode('contributor'); setStep('input'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border font-mono text-sm transition-all ${
                mode === 'contributor'
                  ? 'bg-neon-cyan/20 border-neon-cyan text-white'
                  : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              <User size={16} />
              Contributor
            </button>
          </div>
        )}

        {/* Step progress dots */}
        {step !== 'success' && (
          <div className="flex items-center gap-2 mb-6 justify-center">
            <StepDot active={step === 'input'} done={['verifying','ready','claiming'].includes(step)} />
            <div className="w-8 h-px bg-gray-700" />
            <StepDot active={step === 'verifying'} done={['ready','claiming'].includes(step)} />
            <div className="w-8 h-px bg-gray-700" />
            <StepDot active={step === 'ready'} done={step === 'claiming'} />
            <div className="w-8 h-px bg-gray-700" />
            <StepDot active={step === 'claiming'} done={false} />
          </div>
        )}

        {/* ── INPUT STEP ── */}
        {step === 'input' && (
          <NeonCard className="p-6" glow={mode === 'owner' ? 'purple' : 'cyan'}>
            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs text-gray-400 mb-1">GitHub Repo URL</label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={e => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2.5 font-mono text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-neon-purple"
                />
              </div>

              {mode === 'contributor' && (
                <div>
                  <label className="block font-mono text-xs text-gray-400 mb-1">Your GitHub Username</label>
                  <input
                    type="text"
                    value={githubLogin}
                    onChange={e => setGithubLogin(e.target.value)}
                    placeholder="your-github-username"
                    className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2.5 font-mono text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-neon-cyan"
                  />
                </div>
              )}

              {/* trustfolio.json instructions */}
              <div className="rounded-lg bg-black/30 border border-gray-800 p-4 space-y-2">
                <p className="font-mono text-xs text-gray-300 font-bold">
                  {mode === 'owner'
                    ? 'Add trustfolio.json to your repo root:'
                    : `Add trustfolio.json to your profile repo (github.com/${githubLogin || 'username'}/${githubLogin || 'username'}):`}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-black/50 rounded px-3 py-2 font-mono text-xs text-neon-green">
                    {'{ "wallet": "'}
                    <span className="text-neon-cyan">{address ? `${address.slice(0, 10)}...` : '0xYourAddress'}</span>
                    {'" }'}
                  </code>
                  <button
                    onClick={() => address && copyJson(address)}
                    className="p-2 rounded border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white transition-colors"
                    title="Copy"
                  >
                    {copied ? <CheckCircle size={14} className="text-neon-green" /> : <Copy size={14} />}
                  </button>
                </div>
                {mode === 'contributor' && (
                  <p className="font-mono text-xs text-gray-500">
                    Profile repo must be named exactly the same as your GitHub username.
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 text-red-400 font-mono text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={!repoUrl.trim() || (mode === 'contributor' && !githubLogin.trim())}
                className="w-full py-3 rounded-lg font-mono text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-neon-purple hover:bg-neon-purple/80 text-black flex items-center justify-center gap-2"
              >
                Verify & Sign
                <ChevronRight size={16} />
              </button>
            </div>
          </NeonCard>
        )}

        {/* ── VERIFYING STEP ── */}
        {step === 'verifying' && (
          <NeonCard className="p-8 text-center" glow="purple">
            <Loader2 size={36} className="mx-auto mb-4 text-neon-purple animate-spin" />
            <p className="font-mono text-sm text-gray-300">Verifying with GitHub + signing oracle voucher…</p>
          </NeonCard>
        )}

        {/* ── READY TO CLAIM ── */}
        {step === 'ready' && result && (
          <NeonCard className="p-6 space-y-5" glow={mode === 'owner' ? 'purple' : 'cyan'}>
            <div className="flex items-center gap-3">
              <CheckCircle size={22} className="text-neon-green shrink-0" />
              <div>
                <p className="font-mono text-sm font-bold text-white">Verification passed</p>
                <p className="font-mono text-xs text-gray-400">{result.repoFullName}</p>
              </div>
            </div>

            <div className="rounded-lg bg-black/30 border border-gray-800 p-4 space-y-3">
              <div className="flex justify-between font-mono text-sm">
                <span className="text-gray-400">Your allocation</span>
                <span className="text-neon-green font-bold">{FORMAT_TOKENS(result.allocationTokens)} tokens</span>
              </div>
              {result.allocationPct && (
                <div className="flex justify-between font-mono text-sm">
                  <span className="text-gray-400">Share of supply</span>
                  <span className="text-white">{result.allocationPct}%</span>
                </div>
              )}
              {result.contributions && (
                <div className="flex justify-between font-mono text-sm">
                  <span className="text-gray-400">Your commits</span>
                  <span className="text-white">{result.contributions.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-mono text-sm">
                <span className="text-gray-400">Type</span>
                <span className={mode === 'owner' ? 'text-neon-purple' : 'text-neon-cyan'}>
                  {mode === 'owner' ? 'Repo Owner' : 'Contributor'}
                </span>
              </div>
              <div className="flex justify-between font-mono text-sm">
                <span className="text-gray-400">Voucher expires</span>
                <span className="text-white">
                  {new Date(result.voucher.deadline * 1000).toLocaleString()}
                </span>
              </div>
            </div>

            {!result.voucher.claimContract && (
              <div className="flex items-start gap-2 text-yellow-400 font-mono text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                Claim contract not found — this token may not be fully deployed yet.
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-red-400 font-mono text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 py-3 rounded-lg font-mono text-sm border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleClaim}
                disabled={!result.voucher.claimContract}
                className="flex-1 py-3 rounded-lg font-mono text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-neon-green hover:bg-neon-green/80 text-black flex items-center justify-center gap-2"
              >
                <Gift size={16} />
                Claim Tokens
              </button>
            </div>
          </NeonCard>
        )}

        {/* ── CLAIMING ── */}
        {step === 'claiming' && (
          <NeonCard className="p-8 text-center" glow="green">
            <Loader2 size={36} className="mx-auto mb-4 text-neon-green animate-spin" />
            <p className="font-mono text-sm text-gray-300">Confirm the transaction in your wallet…</p>
          </NeonCard>
        )}

        {/* ── SUCCESS ── */}
        {step === 'success' && result && (
          <NeonCard className="p-8 text-center space-y-5" glow="green">
            <div className="w-16 h-16 mx-auto rounded-full bg-neon-green/10 border border-neon-green/30 flex items-center justify-center">
              <CheckCircle size={32} className="text-neon-green" />
            </div>
            <div>
              <p className="font-mono text-xl font-bold text-white mb-1">Tokens Claimed!</p>
              <p className="font-mono text-sm text-gray-400">
                {FORMAT_TOKENS(result.allocationTokens)} tokens sent to your wallet
              </p>
            </div>

            {txHash && (
              <a
                href={`https://chainscan.0g.ai/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-mono text-xs text-neon-cyan hover:underline"
              >
                View on explorer
                <ExternalLink size={12} />
              </a>
            )}

            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 py-3 rounded-lg font-mono text-sm border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white transition-colors"
              >
                Claim Another
              </button>
              <a
                href={`/repo/${result.repoId}`}
                className="flex-1 py-3 rounded-lg font-mono text-sm font-bold bg-neon-purple hover:bg-neon-purple/80 text-black flex items-center justify-center gap-2 transition-colors"
              >
                View Token
                <ExternalLink size={14} />
              </a>
            </div>
          </NeonCard>
        )}

        {/* ── ERROR ── */}
        {step === 'error' && (
          <NeonCard className="p-6 space-y-4" glow="purple">
            <div className="flex items-start gap-3">
              <AlertCircle size={22} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-mono text-sm font-bold text-white mb-1">Verification Failed</p>
                <p className="font-mono text-xs text-red-400">{error}</p>
              </div>
            </div>
            <button
              onClick={reset}
              className="w-full py-3 rounded-lg font-mono text-sm border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white transition-colors"
            >
              Try Again
            </button>
          </NeonCard>
        )}

        {/* Bottom note */}
        <p className="text-center font-mono text-xs text-gray-600 mt-6">
          Claim window is 90 days from token launch. Unclaimed tokens go to the bonding curve.
        </p>
      </div>
    </div>
  );
}

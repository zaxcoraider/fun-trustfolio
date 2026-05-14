'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  useAccount, useReadContract, useWriteContract,
  useWaitForTransactionReceipt, useSwitchChain,
} from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import {
  ArrowLeft, Star, GitFork, ExternalLink, Copy, Check,
  TrendingUp, Zap, Radio, Rocket, ArrowUpRight, ArrowDownRight,
  Users, AlertCircle, Loader2, CheckCircle,
} from 'lucide-react';
import { NeonCard } from '@/components/NeonCard';
import { BONDING_CURVE_ABI } from '@/lib/contracts';
import type { RepoDetail } from '@/app/api/repo/[repoId]/route';

// ─── Constants ────────────────────────────────────────────────────────────────

const OG_MAINNET_CHAIN_ID = 16661;

const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
  Rust: '#dea584', Go: '#00ADD8', Java: '#b07219', 'C++': '#f34b7d',
  C: '#555555', 'C#': '#178600', Ruby: '#701516', Solidity: '#AA6746',
  Vue: '#41b883', Swift: '#F05138', Kotlin: '#A97BFF',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgo(ts: number) {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtPrice(p: string) {
  const n = parseFloat(p);
  if (n === 0) return '—';
  return n < 0.000001 ? n.toExponential(3) : n.toFixed(8);
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ─── Price Chart (SVG) ────────────────────────────────────────────────────────

function PriceChart({ history }: { history: RepoDetail['priceHistory'] }) {
  if (history.length < 2) {
    return (
      <div className="h-[180px] flex items-center justify-center text-gray-700 font-mono text-xs">
        No trades yet — be the first buyer
      </div>
    );
  }

  const W = 600;
  const H = 160;
  const PAD = 12;

  const prices = history.map(h => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || max * 0.1 || 1e-12;

  const pts = history.map((h, i) => ({
    x: PAD + (i / (history.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - (h.price - min) / range) * (H - PAD * 2),
    type: h.type,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;

  // Grid lines (5 horizontal)
  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const y = PAD + (i / 4) * (H - PAD * 2);
    const val = max - (i / 4) * range;
    const label = val < 0.000001 ? val.toExponential(2) : val.toFixed(8);
    return { y, label };
  });

  const currentPrice = prices[prices.length - 1];
  const startPrice = prices[0];
  const priceDelta = ((currentPrice - startPrice) / startPrice) * 100;
  const isUp = priceDelta >= 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="font-mono text-xs text-gray-500">Price history</span>
        <span className={`font-mono text-xs font-bold ${isUp ? 'text-neon-green' : 'text-neon-pink'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(priceDelta).toFixed(1)}%
        </span>
      </div>
      <div className="relative overflow-hidden rounded-xl bg-black/30 border border-white/5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 180 }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isUp ? '#06b6d4' : '#ec4899'} stopOpacity="0.25" />
              <stop offset="100%" stopColor={isUp ? '#06b6d4' : '#ec4899'} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {gridLines.map((g, i) => (
            <line key={i} x1={PAD} x2={W - PAD} y1={g.y} y2={g.y}
              stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          ))}

          {/* Area fill */}
          <path d={areaPath} fill="url(#areaGrad)" />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={isUp ? '#06b6d4' : '#ec4899'}
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Sell event dots */}
          {pts.filter(p => p.type === 'sell').map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill="#ec4899" opacity="0.8" />
          ))}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute inset-0 pointer-events-none" style={{ padding: `${PAD}px` }}>
          {gridLines.map((g, i) => (
            <div
              key={i}
              className="absolute right-2 font-mono text-[9px] text-gray-700"
              style={{ top: `${(g.y / H) * 100}%`, transform: 'translateY(-50%)' }}
            >
              {g.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={handleCopy} className="ml-1 text-gray-600 hover:text-gray-300 transition-colors">
      {copied ? <Check size={12} className="text-neon-green" /> : <Copy size={12} />}
    </button>
  );
}

// ─── Buy / Sell Panel ─────────────────────────────────────────────────────────

function BuySellPanel({ data }: { data: RepoDetail }) {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amountStr, setAmountStr] = useState('');
  const [status, setStatus] = useState<'idle' | 'approving' | 'pending' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [errMsg, setErrMsg] = useState('');

  const curveAddress = data.bondingCurve as `0x${string}` | null;
  const tokenAddress = data.tokenAddress as `0x${string}` | null;
  const isLive = data.live && data.found && !!curveAddress;
  const onCorrectChain = chain?.id === OG_MAINNET_CHAIN_ID;

  const parsedAmount = useMemo(() => {
    try { return parseUnits(amountStr || '0', 18); } catch { return 0n; }
  }, [amountStr]);

  // Quote: tokens for native (buy)
  const { data: tokensOut } = useReadContract({
    address: curveAddress ?? undefined,
    abi: BONDING_CURVE_ABI,
    functionName: 'getTokensForNative',
    args: [parsedAmount],
    query: { enabled: mode === 'buy' && parsedAmount > 0n && isLive && !data.graduated },
  });

  // Quote: native for tokens (sell)
  const { data: nativeOut } = useReadContract({
    address: curveAddress ?? undefined,
    abi: BONDING_CURVE_ABI,
    functionName: 'getNativeForTokens',
    args: [parsedAmount],
    query: { enabled: mode === 'sell' && parsedAmount > 0n && isLive && !data.graduated },
  });

  // Token balance (for sell)
  const { data: tokenBalance } = useReadContract({
    address: tokenAddress ?? undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: mode === 'sell' && !!address && !!tokenAddress },
  });

  // Allowance (for sell)
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress ?? undefined,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, curveAddress!],
    query: { enabled: mode === 'sell' && !!address && !!tokenAddress && !!curveAddress },
  });

  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  useEffect(() => {
    if (txConfirmed && status === 'pending') {
      setStatus('success');
      setAmountStr('');
      refetchAllowance();
    }
  }, [txConfirmed, status, refetchAllowance]);

  const needsApproval = mode === 'sell' && parsedAmount > 0n && (allowance ?? 0n) < parsedAmount;

  async function handleApprove() {
    if (!tokenAddress || !curveAddress) return;
    setErrMsg('');
    setStatus('approving');
    try {
      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [curveAddress, parsedAmount],
      });
      setTxHash(hash);
      // Wait a beat then refetch allowance
      setTimeout(() => refetchAllowance(), 3000);
      setStatus('idle');
    } catch (e: unknown) {
      setErrMsg((e as Error)?.message?.slice(0, 120) ?? 'Approval failed');
      setStatus('error');
    }
  }

  async function handleTrade() {
    if (!curveAddress || !address) return;
    setErrMsg('');
    setStatus('pending');
    try {
      const SLIPPAGE = 99n; // 1% slippage tolerance
      let hash: `0x${string}`;
      if (mode === 'buy') {
        const minOut = tokensOut ? (tokensOut as bigint) * SLIPPAGE / 100n : 0n;
        hash = await writeContractAsync({
          address: curveAddress,
          abi: BONDING_CURVE_ABI,
          functionName: 'buy',
          args: [minOut],
          value: parsedAmount,
        });
      } else {
        if (!tokenAddress) return;
        const minOut = nativeOut ? (nativeOut as bigint) * SLIPPAGE / 100n : 0n;
        hash = await writeContractAsync({
          address: curveAddress,
          abi: BONDING_CURVE_ABI,
          functionName: 'sell',
          args: [parsedAmount, minOut],
        });
      }
      setTxHash(hash);
    } catch (e: unknown) {
      setErrMsg((e as Error)?.message?.slice(0, 120) ?? 'Transaction failed');
      setStatus('error');
    }
  }

  if (data.graduated) {
    return (
      <NeonCard className="p-5" glow="green">
        <div className="text-center">
          <Zap size={28} className="mx-auto mb-3 text-neon-green" />
          <p className="font-mono text-sm font-bold text-neon-green mb-1">Token Graduated!</p>
          <p className="font-mono text-xs text-gray-500">
            Trading has moved to 0G DEX. Liquidity is locked permanently.
          </p>
        </div>
      </NeonCard>
    );
  }

  if (!isLive) {
    return (
      <NeonCard className="p-5" glow="purple">
        <p className="font-mono text-xs text-gray-500 text-center">
          Contracts deploying to 0G Mainnet soon.<br />
          Trading will be enabled once live.
        </p>
      </NeonCard>
    );
  }

  return (
    <NeonCard className="p-5" glow="purple">
      {/* Mode tabs */}
      <div className="flex rounded-lg overflow-hidden border border-white/10 mb-4">
        {(['buy', 'sell'] as const).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setAmountStr(''); setStatus('idle'); setErrMsg(''); }}
            className={`flex-1 font-mono text-xs py-2 transition-all ${
              mode === m
                ? m === 'buy'
                  ? 'bg-neon-cyan/20 text-neon-cyan'
                  : 'bg-neon-pink/20 text-neon-pink'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {m === 'buy' ? '▲ Buy' : '▼ Sell'}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <label className="block font-mono text-[10px] text-gray-600 uppercase tracking-widest mb-1.5">
        {mode === 'buy' ? 'Amount (0G)' : `Amount ($${data.tokenSymbol ?? 'TOKEN'})`}
      </label>
      <div className="relative mb-1">
        <input
          type="number"
          value={amountStr}
          onChange={e => { setAmountStr(e.target.value); setStatus('idle'); setErrMsg(''); }}
          placeholder="0.0"
          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 font-mono text-sm text-white placeholder-gray-700 focus:outline-none focus:border-neon-purple/50"
        />
        {mode === 'sell' && tokenBalance && (
          <button
            onClick={() => setAmountStr(formatUnits(tokenBalance as bigint, 18))}
            className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-neon-cyan hover:text-neon-cyan/80"
          >
            MAX
          </button>
        )}
      </div>

      {/* Balance hint for sell */}
      {mode === 'sell' && tokenBalance && (
        <p className="font-mono text-[10px] text-gray-600 mb-3">
          Balance: {parseFloat(formatUnits(tokenBalance as bigint, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens
        </p>
      )}

      {/* Quote */}
      {parsedAmount > 0n && (
        <div className="bg-black/30 rounded-lg px-4 py-3 mb-4 border border-white/5">
          <p className="font-mono text-[10px] text-gray-600 uppercase tracking-widest mb-1">
            {mode === 'buy' ? 'You receive' : 'You receive'}
          </p>
          <p className="font-mono text-sm font-bold text-white">
            {mode === 'buy'
              ? tokensOut
                ? `${parseFloat(formatUnits(tokensOut as bigint, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} $${data.tokenSymbol}`
                : '…'
              : nativeOut
                ? `${parseFloat(formatUnits(nativeOut as bigint, 18)).toFixed(6)} 0G`
                : '…'}
          </p>
          <p className="font-mono text-[10px] text-gray-600 mt-0.5">Includes 1% fee · 1% slippage</p>
        </div>
      )}

      {/* Action buttons */}
      {!isConnected ? (
        <p className="font-mono text-xs text-gray-500 text-center py-2">
          Connect wallet to trade
        </p>
      ) : !onCorrectChain ? (
        <button
          onClick={() => switchChain({ chainId: OG_MAINNET_CHAIN_ID })}
          className="w-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 font-mono text-sm py-3 rounded-lg hover:bg-yellow-500/30 transition-all"
        >
          Switch to 0G Mainnet
        </button>
      ) : (
        <div className="space-y-2">
          {needsApproval && (
            <button
              onClick={handleApprove}
              disabled={status === 'approving'}
              className="w-full flex items-center justify-center gap-2 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 font-mono text-sm py-3 rounded-lg hover:bg-yellow-500/30 transition-all disabled:opacity-50"
            >
              {status === 'approving' ? <Loader2 size={14} className="animate-spin" /> : null}
              Approve $${data.tokenSymbol} first
            </button>
          )}
          <button
            onClick={handleTrade}
            disabled={!parsedAmount || parsedAmount === 0n || needsApproval || status === 'pending' || status === 'approving'}
            className={`w-full flex items-center justify-center gap-2 font-mono text-sm py-3 rounded-lg transition-all disabled:opacity-40 ${
              mode === 'buy'
                ? 'bg-neon-cyan/20 hover:bg-neon-cyan/30 border border-neon-cyan/50 text-neon-cyan'
                : 'bg-neon-pink/20 hover:bg-neon-pink/30 border border-neon-pink/50 text-neon-pink'
            }`}
          >
            {status === 'pending' ? (
              <><Loader2 size={14} className="animate-spin" /> Confirming…</>
            ) : status === 'success' ? (
              <><CheckCircle size={14} /> Done!</>
            ) : (
              <>{mode === 'buy' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {mode === 'buy' ? `Buy with ${amountStr || '0'} 0G` : `Sell ${amountStr || '0'} tokens`}
              </>
            )}
          </button>
        </div>
      )}

      {errMsg && (
        <p className="mt-2 font-mono text-[10px] text-red-400 flex items-start gap-1">
          <AlertCircle size={10} className="flex-shrink-0 mt-0.5" />
          {errMsg}
        </p>
      )}

      {txHash && (
        <a
          href={`https://chainscan.0g.ai/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1 font-mono text-[10px] text-neon-purple hover:underline"
        >
          View on explorer <ExternalLink size={10} />
        </a>
      )}
    </NeonCard>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function GraduationBar({ progressPct, graduated }: { progressPct: number; graduated: boolean }) {
  const color = graduated ? 'bg-neon-green' : progressPct >= 80 ? 'bg-neon-pink' : progressPct >= 50 ? 'bg-neon-yellow' : 'bg-neon-cyan';
  return (
    <NeonCard className="p-4" glow={graduated ? 'green' : progressPct >= 80 ? 'pink' : 'cyan'}>
      <div className="flex justify-between items-center mb-2">
        <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">
          {graduated ? 'Graduated to DEX' : 'Bonding Curve Progress'}
        </span>
        <span className={`font-mono text-xs font-bold ${graduated ? 'text-neon-green' : progressPct >= 80 ? 'text-neon-pink' : 'text-neon-cyan'}`}>
          {graduated ? '100%' : `${progressPct}%`}
        </span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${graduated ? 100 : progressPct}%` }}
        />
      </div>
      <p className="mt-2 font-mono text-[10px] text-gray-600">
        {graduated
          ? 'Liquidity locked permanently on 0G DEX'
          : `${80 - progressPct > 0 ? 80 - progressPct : 0}% until DEX graduation`}
      </p>
    </NeonCard>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RepoPage() {
  const params = useParams<{ repoId: string }>();
  const repoId = params?.repoId ?? '';

  const [data, setData] = useState<RepoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const imageUrl = useCallback((d: RepoDetail) => {
    if (!d.repoFullName) return d.ownerAvatarUrl || '';
    const [, repoName] = d.repoFullName.split('/');
    return `/api/generate-image?${new URLSearchParams({
      repoName: repoName || d.repoFullName,
      ownerLogin: d.ownerLogin,
      ownerAvatarUrl: d.ownerAvatarUrl,
      language: d.language || '',
      stars: String(d.stars),
    })}`;
  }, []);

  useEffect(() => {
    if (!repoId) return;
    fetch(`/api/repo/${repoId}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then(d => { if (d) setData(d); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [repoId]);

  if (loading) return <LoadingSkeleton />;
  if (notFound || !data) return <NotFound />;

  const langColor = data.language ? (LANGUAGE_COLORS[data.language] || '#7c3aed') : '#7c3aed';

  return (
    <div className="relative min-h-screen bg-bg-primary px-4 py-10">
      <div className="fixed inset-0 bg-grid pointer-events-none" />

      <div className="relative max-w-6xl mx-auto space-y-6">

        {/* Nav */}
        <div className="flex items-center justify-between">
          <Link href="/explore" className="flex items-center gap-2 font-mono text-xs text-gray-500 hover:text-gray-300 transition-colors">
            <ArrowLeft size={14} /> Back to Explore
          </Link>
          <div className={`flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1 rounded-full border ${
            data.live
              ? 'border-neon-green/30 bg-neon-green/10 text-neon-green'
              : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
          }`}>
            <Radio size={8} className={data.live ? 'animate-pulse' : ''} />
            {data.live ? 'Live · 0G Mainnet' : 'Preview · Contracts deploying soon'}
          </div>
        </div>

        {/* Hero header */}
        <NeonCard className="p-6" glow={data.graduated ? 'green' : 'purple'}>
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0">
              <img src={imageUrl(data)} alt={data.repoFullName} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="font-mono text-xl font-bold text-white">
                  {data.tokenSymbol ? `$${data.tokenSymbol}` : data.tokenName ?? `Repo #${repoId}`}
                </h1>
                {data.graduated && (
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-neon-green/20 text-neon-green border border-neon-green/30">
                    GRADUATED
                  </span>
                )}
                {!data.graduated && data.progressPct >= 80 && (
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-neon-pink/20 text-neon-pink border border-neon-pink/30 animate-pulse">
                    🔥 HOT
                  </span>
                )}
                {!data.found && (
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    NOT TOKENIZED
                  </span>
                )}
              </div>

              {data.tokenName && (
                <p className="font-mono text-sm text-gray-400 mb-1">{data.tokenName}</p>
              )}

              <a
                href={`https://github.com/${data.repoFullName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-mono text-xs text-neon-purple hover:text-neon-purple/80 mb-2"
              >
                {data.repoFullName} <ExternalLink size={11} />
              </a>

              {data.description && (
                <p className="font-mono text-xs text-gray-500 mb-3 max-w-xl">{data.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-gray-400">
                {data.stars > 0 && (
                  <span className="flex items-center gap-1">
                    <Star size={12} className="text-yellow-400" /> {fmtNum(data.stars)}
                  </span>
                )}
                {data.forks > 0 && (
                  <span className="flex items-center gap-1">
                    <GitFork size={12} /> {fmtNum(data.forks)}
                  </span>
                )}
                {data.language && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: `${langColor}22`, color: langColor, border: `1px solid ${langColor}44` }}
                  >
                    {data.language}
                  </span>
                )}
                {data.deployedAt && (
                  <span className="text-gray-600">Launched {timeAgo(data.deployedAt)}</span>
                )}
              </div>

              {data.topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {data.topics.slice(0, 6).map(t => (
                    <span key={t} className="bg-neon-purple/10 border border-neon-purple/20 text-neon-purple font-mono text-[10px] px-2 py-0.5 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </NeonCard>

        {/* Stats bar */}
        {data.found && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Price', value: `${fmtPrice(data.spotPrice)} 0G`, color: 'text-neon-cyan' },
              { label: 'Market Cap', value: `${parseFloat(data.marketCap).toLocaleString()} 0G`, color: 'text-neon-purple' },
              { label: 'Progress', value: `${data.progressPct}%`, color: data.graduated ? 'text-neon-green' : data.progressPct >= 80 ? 'text-neon-pink' : 'text-neon-cyan' },
              { label: 'Contributors', value: String(data.eligibleContributors.length), color: 'text-yellow-400' },
            ].map(s => (
              <NeonCard key={s.label} className="px-4 py-3 text-center" glow="purple">
                <p className={`font-mono text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="font-mono text-[10px] text-gray-600 uppercase tracking-widest mt-0.5">{s.label}</p>
              </NeonCard>
            ))}
          </div>
        )}

        {/* "Not tokenized" CTA */}
        {!data.found && data.live && (
          <NeonCard className="p-8 text-center" glow="purple">
            <Rocket size={36} className="mx-auto mb-4 text-neon-purple/50" />
            <h2 className="font-mono text-lg font-bold text-white mb-2">This repo hasn&apos;t been tokenized yet</h2>
            <p className="font-mono text-xs text-gray-500 mb-6">
              Be the first to deploy a token for <span className="text-neon-purple">{data.repoFullName}</span>.
              First deployer wins — locked forever.
            </p>
            <Link
              href={`/launch?repo=https://github.com/${data.repoFullName}`}
              className="inline-flex items-center gap-2 bg-neon-purple/20 hover:bg-neon-purple/30 border border-neon-purple/50 text-neon-purple font-mono text-sm px-6 py-3 rounded-lg transition-all"
            >
              <Rocket size={14} /> Launch Token — 0.1 0G
            </Link>
          </NeonCard>
        )}

        {/* Main grid: chart + buy-sell */}
        {data.found && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Left: chart + trades */}
            <div className="lg:col-span-3 space-y-5">
              <NeonCard className="p-5" glow="cyan">
                <PriceChart history={data.priceHistory} />
              </NeonCard>

              {/* Recent trades */}
              {data.recentTrades.length > 0 && (
                <NeonCard className="p-5" glow="purple">
                  <h3 className="font-mono text-xs text-gray-500 uppercase tracking-widest mb-4">Recent Trades</h3>
                  <div className="space-y-2">
                    {data.recentTrades.map((t, i) => (
                      <div key={i} className="flex items-center justify-between font-mono text-xs">
                        <div className="flex items-center gap-2">
                          {t.type === 'buy'
                            ? <ArrowUpRight size={13} className="text-neon-green flex-shrink-0" />
                            : <ArrowDownRight size={13} className="text-neon-pink flex-shrink-0" />}
                          <span className={t.type === 'buy' ? 'text-neon-green' : 'text-neon-pink'}>
                            {t.type === 'buy' ? 'Buy' : 'Sell'}
                          </span>
                          <span className="text-gray-600">{shortAddr(t.account)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-300">
                            {parseFloat(t.tokenAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens
                          </span>
                          <span className="text-gray-600 ml-2">
                            {parseFloat(t.nativeAmount).toFixed(4)} 0G
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </NeonCard>
              )}
            </div>

            {/* Right: buy-sell + info */}
            <div className="lg:col-span-2 space-y-4">
              <GraduationBar progressPct={data.progressPct} graduated={data.graduated} />
              <BuySellPanel data={data} />

              {/* Token addresses */}
              <NeonCard className="p-4" glow="purple">
                <h3 className="font-mono text-[10px] text-gray-600 uppercase tracking-widest mb-3">Token Info</h3>
                <div className="space-y-2 font-mono text-[11px]">
                  {[
                    { label: 'Token', value: data.tokenAddress },
                    { label: 'Curve', value: data.bondingCurve },
                    { label: 'Claims', value: data.claimContract },
                    { label: 'Deployer', value: data.deployer },
                  ].map(row => row.value && (
                    <div key={row.label} className="flex items-center justify-between gap-2">
                      <span className="text-gray-600 w-14 flex-shrink-0">{row.label}</span>
                      <span className="text-gray-400 truncate">{shortAddr(row.value)}</span>
                      <CopyBtn value={row.value} />
                      <a
                        href={`https://chainscan.0g.ai/address/${row.value}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-700 hover:text-gray-400 flex-shrink-0"
                      >
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  ))}
                </div>
              </NeonCard>
            </div>
          </div>
        )}

        {/* Contributors */}
        {data.eligibleContributors.length > 0 && (
          <NeonCard className="p-5" glow="purple">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-xs text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <Users size={12} /> Contributors
              </h3>
              <span className="font-mono text-[10px] text-gray-600">
                50M tokens allocated · claim within 90 days
              </span>
            </div>
            <div className="space-y-2">
              {data.eligibleContributors.map((c, i) => (
                <div key={c.login} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                  <span className="font-mono text-[10px] text-gray-700 w-5 text-right">{i + 1}</span>
                  <img src={c.avatarUrl} alt={c.login} className="w-7 h-7 rounded-full border border-white/10" />
                  <div className="flex-1 min-w-0">
                    <a
                      href={`https://github.com/${c.login}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-gray-300 hover:text-neon-purple transition-colors truncate block"
                    >
                      {c.login}
                    </a>
                  </div>
                  <span className="font-mono text-[10px] text-gray-600">{c.contributions.toLocaleString()} commits</span>
                  <span className="font-mono text-xs font-bold text-neon-purple w-14 text-right">{c.allocationPct}%</span>
                </div>
              ))}
            </div>
            {data.filteredBots > 0 && (
              <p className="mt-3 font-mono text-[10px] text-gray-700">
                {data.filteredBots} bot{data.filteredBots > 1 ? 's' : ''} filtered from allocation
              </p>
            )}
            {data.found && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <Link
                  href="/claim"
                  className="font-mono text-xs text-neon-cyan hover:underline flex items-center gap-1"
                >
                  <TrendingUp size={12} /> Claim your contributor allocation →
                </Link>
              </div>
            )}
          </NeonCard>
        )}

      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="relative min-h-screen bg-bg-primary px-4 py-10">
      <div className="fixed inset-0 bg-grid pointer-events-none" />
      <div className="relative max-w-6xl mx-auto space-y-6 animate-pulse">
        <div className="h-4 w-28 bg-white/5 rounded" />
        <div className="bg-bg-card border border-white/5 rounded-2xl p-6">
          <div className="flex gap-5">
            <div className="w-20 h-20 bg-white/5 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-32 bg-white/5 rounded" />
              <div className="h-3 w-48 bg-white/5 rounded" />
              <div className="h-3 w-64 bg-white/5 rounded" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[0,1,2,3].map(i => <div key={i} className="h-16 bg-white/5 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-5 gap-5">
          <div className="col-span-3 h-64 bg-white/5 rounded-2xl" />
          <div className="col-span-2 space-y-4">
            <div className="h-20 bg-white/5 rounded-2xl" />
            <div className="h-48 bg-white/5 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-grid pointer-events-none" />
      <NeonCard className="p-12 text-center max-w-sm w-full" glow="purple">
        <AlertCircle size={36} className="mx-auto mb-4 text-gray-700" />
        <h2 className="font-mono text-lg font-bold text-white mb-2">Repo Not Found</h2>
        <p className="font-mono text-xs text-gray-500 mb-6">No GitHub repo with this ID exists.</p>
        <Link href="/explore" className="font-mono text-xs text-neon-purple hover:underline">
          ← Back to Explore
        </Link>
      </NeonCard>
    </div>
  );
}

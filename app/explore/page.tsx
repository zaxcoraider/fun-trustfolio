'use client';

import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Search, Loader2, Zap, Radio } from 'lucide-react';
import { TokenCard } from '@/components/TokenCard';
import { NeonCard } from '@/components/NeonCard';
import type { TokenData } from '@/app/api/tokens/route';

type Filter = 'all' | 'new' | 'hot' | 'graduating' | 'graduated';
type Sort = 'newest' | 'price' | 'marketcap' | 'progress';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'hot', label: '🔥 Hot' },
  { id: 'graduating', label: 'Graduating Soon' },
  { id: 'graduated', label: '⚡ Graduated' },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'marketcap', label: 'Market Cap' },
  { id: 'price', label: 'Price' },
  { id: 'progress', label: 'Progress' },
];

function SkeletonCard() {
  return (
    <div className="bg-bg-card border border-white/5 rounded-2xl p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-white/5" />
        <div className="flex-1">
          <div className="h-4 bg-white/5 rounded w-20 mb-2" />
          <div className="h-3 bg-white/5 rounded w-32" />
        </div>
      </div>
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-12 bg-white/5 rounded-full" />
        <div className="h-5 w-16 bg-white/5 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="h-12 bg-white/5 rounded-lg" />
        <div className="h-12 bg-white/5 rounded-lg" />
      </div>
      <div className="h-1.5 bg-white/5 rounded-full" />
    </div>
  );
}

export default function ExplorePage() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/tokens')
      .then(r => r.json())
      .then(data => {
        setTokens(data.tokens || []);
        setIsLive(data.live);
      })
      .catch(() => setTokens([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = [...tokens];

    // Filter
    if (filter === 'new') {
      const cutoff = Date.now() / 1000 - 86400; // last 24h
      list = list.filter(t => t.deployedAt >= cutoff);
    } else if (filter === 'hot') {
      list = list.filter(t => !t.graduated && t.progressPct >= 50);
    } else if (filter === 'graduating') {
      list = list.filter(t => !t.graduated && t.progressPct >= 75);
    } else if (filter === 'graduated') {
      list = list.filter(t => t.graduated);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        t =>
          t.repoFullName.toLowerCase().includes(q) ||
          t.tokenSymbol.toLowerCase().includes(q) ||
          t.tokenName.toLowerCase().includes(q) ||
          (t.language || '').toLowerCase().includes(q)
      );
    }

    // Sort
    if (sort === 'newest') list.sort((a, b) => b.deployedAt - a.deployedAt);
    else if (sort === 'marketcap') list.sort((a, b) => parseFloat(b.marketCap) - parseFloat(a.marketCap));
    else if (sort === 'price') list.sort((a, b) => parseFloat(b.spotPrice) - parseFloat(a.spotPrice));
    else if (sort === 'progress') list.sort((a, b) => b.progressPct - a.progressPct);

    return list;
  }, [tokens, filter, sort, search]);

  // Stats for header
  const stats = useMemo(() => ({
    total: tokens.length,
    graduated: tokens.filter(t => t.graduated).length,
    hot: tokens.filter(t => !t.graduated && t.progressPct >= 50).length,
  }), [tokens]);

  return (
    <div className="relative min-h-screen bg-bg-primary px-4 py-12">
      <div className="fixed inset-0 bg-grid pointer-events-none" />

      <div className="relative max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-mono text-3xl font-bold mb-1 flex items-center gap-3">
              <TrendingUp className="text-neon-purple" />
              Explore Tokens
            </h1>
            <p className="text-gray-500 font-mono text-sm">
              Verified OSS repo tokens on 0G Network
            </p>
          </div>

          {/* Live / mock indicator */}
          <div className={`flex items-center gap-2 font-mono text-xs px-3 py-1.5 rounded-full border ${
            isLive
              ? 'border-neon-green/30 bg-neon-green/10 text-neon-green'
              : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
          }`}>
            <Radio size={10} className={isLive ? 'animate-pulse' : ''} />
            {isLive ? 'Live on-chain' : 'Preview — contracts deploying soon'}
          </div>
        </div>

        {/* Stats bar */}
        {!loading && tokens.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Total Tokens', value: stats.total, color: 'text-neon-purple' },
              { label: 'Hot (>50%)', value: stats.hot, color: 'text-neon-cyan' },
              { label: 'Graduated', value: stats.graduated, color: 'text-neon-green' },
            ].map(s => (
              <NeonCard key={s.label} className="px-4 py-3 text-center" glow="purple">
                <p className={`font-mono text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="font-mono text-[10px] text-gray-600 uppercase tracking-widest mt-0.5">{s.label}</p>
              </NeonCard>
            ))}
          </div>
        )}

        {/* Search + sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by repo, symbol, or language..."
              className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 font-mono text-sm text-white placeholder-gray-600 focus:outline-none focus:border-neon-purple/50"
            />
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as Sort)}
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 font-mono text-sm text-gray-300 focus:outline-none focus:border-neon-purple/50"
          >
            {SORTS.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap mb-8">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`font-mono text-xs px-4 py-1.5 rounded-full border transition-all ${
                filter === f.id
                  ? 'bg-neon-purple/20 border-neon-purple/50 text-neon-purple'
                  : 'border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <NeonCard className="p-16 text-center" glow="purple">
            {search ? (
              <>
                <Search size={32} className="mx-auto mb-4 text-gray-700" />
                <p className="font-mono text-gray-500">No tokens match &quot;{search}&quot;</p>
              </>
            ) : (
              <>
                <Zap size={32} className="mx-auto mb-4 text-gray-700" />
                <p className="font-mono text-gray-500 mb-2">No tokens in this category yet</p>
                <p className="font-mono text-gray-700 text-xs">Be the first — deploy a repo token</p>
              </>
            )}
          </NeonCard>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(token => (
                <TokenCard key={token.repoId} token={token} />
              ))}
            </div>
            <p className="text-center font-mono text-xs text-gray-700 mt-8">
              {filtered.length} token{filtered.length !== 1 ? 's' : ''} shown
            </p>
          </>
        )}

      </div>
    </div>
  );
}

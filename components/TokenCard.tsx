'use client';

import Link from 'next/link';
import { Star, Zap, TrendingUp } from 'lucide-react';
import { NeonCard } from './NeonCard';
import type { TokenData } from '@/app/api/tokens/route';

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Solidity: '#AA6746',
  Vue: '#41b883',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
};

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function progressColor(pct: number, graduated: boolean): string {
  if (graduated) return 'bg-neon-green';
  if (pct >= 80) return 'bg-neon-pink';
  if (pct >= 50) return 'bg-neon-yellow';
  return 'bg-neon-cyan';
}

function progressGlow(pct: number, graduated: boolean): string {
  if (graduated) return 'shadow-neon-green';
  if (pct >= 80) return 'shadow-neon-pink';
  if (pct >= 50) return 'shadow-[0_0_8px_rgba(234,179,8,0.6)]';
  return 'shadow-neon-cyan';
}

interface TokenCardProps {
  token: TokenData;
}

export function TokenCard({ token }: TokenCardProps) {
  const langColor = token.language ? (LANGUAGE_COLORS[token.language] || '#7c3aed') : '#7c3aed';

  const imageUrl = token.repoFullName
    ? `/api/generate-image?${new URLSearchParams({
        repoName: token.repoFullName.split('/')[1] || token.repoFullName,
        ownerLogin: token.ownerLogin,
        ownerAvatarUrl: token.ownerAvatarUrl,
        language: token.language || '',
        stars: String(token.stars),
      })}`
    : token.ownerAvatarUrl;

  const glowType = token.graduated ? 'green' : token.progressPct >= 80 ? 'pink' : token.progressPct >= 50 ? 'cyan' : 'purple';

  return (
    <Link href={`/repo/${token.repoId}`}>
      <NeonCard className="p-4 h-full flex flex-col gap-3" glow={glowType}>

        {/* Header: image + name + badge */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
            <img src={imageUrl} alt={token.repoFullName} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-white text-sm truncate">
                ${token.tokenSymbol}
              </span>
              {token.graduated && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-neon-green/20 text-neon-green border border-neon-green/30">
                  GRADUATED
                </span>
              )}
              {!token.graduated && token.progressPct >= 80 && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-neon-pink/20 text-neon-pink border border-neon-pink/30 animate-pulse">
                  🔥 HOT
                </span>
              )}
            </div>
            <p className="font-mono text-xs text-gray-500 truncate">{token.repoFullName}</p>
          </div>
          <span className="font-mono text-[10px] text-gray-600 flex-shrink-0">{timeAgo(token.deployedAt)}</span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 font-mono text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Star size={11} className="text-yellow-400" />
            {token.stars >= 1000 ? `${(token.stars / 1000).toFixed(0)}k` : token.stars}
          </span>
          {token.language && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: `${langColor}22`, color: langColor, border: `1px solid ${langColor}44` }}
            >
              {token.language}
            </span>
          )}
        </div>

        {/* Price + Market Cap */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-black/30 rounded-lg px-3 py-2">
            <p className="font-mono text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Price</p>
            <p className="font-mono text-xs font-bold text-neon-cyan">{token.spotPrice} 0G</p>
          </div>
          <div className="bg-black/30 rounded-lg px-3 py-2">
            <p className="font-mono text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Mkt Cap</p>
            <p className="font-mono text-xs font-bold text-neon-purple">{token.marketCap} 0G</p>
          </div>
        </div>

        {/* Graduation progress */}
        <div className="mt-auto">
          <div className="flex justify-between font-mono text-[10px] text-gray-600 mb-1.5">
            <span className="flex items-center gap-1">
              {token.graduated ? (
                <><Zap size={10} className="text-neon-green" /> DEX listed</>
              ) : (
                <><TrendingUp size={10} /> Bonding curve</>
              )}
            </span>
            <span className={token.graduated ? 'text-neon-green' : token.progressPct >= 80 ? 'text-neon-pink' : 'text-gray-400'}>
              {token.graduated ? '100%' : `${token.progressPct}%`}
            </span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor(token.progressPct, token.graduated)} ${progressGlow(token.progressPct, token.graduated)}`}
              style={{ width: `${token.graduated ? 100 : token.progressPct}%` }}
            />
          </div>
        </div>

      </NeonCard>
    </Link>
  );
}

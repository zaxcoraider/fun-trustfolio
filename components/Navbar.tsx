'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Rocket } from 'lucide-react';

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-neon-purple/10 bg-bg-primary/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Rocket size={20} className="text-neon-purple" />
          <span className="font-mono font-bold text-white">
            fun.<span className="text-neon-purple">trustfolio</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/explore" className="font-mono text-sm text-gray-400 hover:text-white transition-colors">
            Explore
          </Link>
          <Link href="/launch" className="font-mono text-sm text-gray-400 hover:text-white transition-colors">
            Launch
          </Link>
          <Link href="/claim" className="font-mono text-sm text-gray-400 hover:text-white transition-colors">
            Claim
          </Link>
          <Link
            href="https://trustfolio.space"
            target="_blank"
            className="font-mono text-xs text-neon-cyan/70 hover:text-neon-cyan transition-colors"
          >
            ← TrustFolio
          </Link>
          <div className="flex justify-center">
            <ConnectButton chainStatus="none" accountStatus="address" showBalance={false} />
          </div>
        </div>
      </div>
    </nav>
  );
}

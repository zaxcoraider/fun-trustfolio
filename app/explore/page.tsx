'use client';

import { NeonCard } from '@/components/NeonCard';
import { TrendingUp } from 'lucide-react';

export default function ExplorePage() {
  return (
    <div className="relative min-h-screen bg-bg-primary px-4 py-12">
      <div className="fixed inset-0 bg-grid pointer-events-none" />
      <div className="relative max-w-5xl mx-auto">
        <h1 className="font-mono text-3xl font-bold mb-2 flex items-center gap-3">
          <TrendingUp className="text-neon-purple" />
          Explore Tokens
        </h1>
        <p className="text-gray-500 font-mono text-sm mb-10">All verified OSS repo tokens on 0G Network</p>
        <NeonCard className="p-10 text-center" glow="purple">
          <p className="font-mono text-gray-500">Coming soon — token listings will appear here.</p>
        </NeonCard>
      </div>
    </div>
  );
}

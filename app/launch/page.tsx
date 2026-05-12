'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { NeonCard } from '@/components/NeonCard';
import { Rocket } from 'lucide-react';

export default function LaunchPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="fixed inset-0 bg-grid pointer-events-none" />
        <NeonCard className="p-10 text-center max-w-sm w-full" glow="purple">
          <Rocket size={40} className="mx-auto mb-4 text-neon-purple/40" />
          <p className="text-gray-300 font-mono text-sm mb-6">Connect wallet to launch a repo token</p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </NeonCard>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-bg-primary px-4 py-12">
      <div className="fixed inset-0 bg-grid pointer-events-none" />
      <div className="relative max-w-2xl mx-auto">
        <h1 className="font-mono text-3xl font-bold mb-2 flex items-center gap-3">
          <Rocket className="text-neon-purple" />
          Launch a Repo Token
        </h1>
        <p className="text-gray-500 font-mono text-sm mb-10">Verify your GitHub repo and deploy its meme token on 0G</p>
        <NeonCard className="p-10 text-center" glow="purple">
          <p className="font-mono text-gray-500">Repo verification flow coming soon.</p>
        </NeonCard>
      </div>
    </div>
  );
}

'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { NeonCard } from '@/components/NeonCard';
import { Rocket, Github, Star, Coins, ShieldCheck, TrendingUp, ArrowRight, Zap } from 'lucide-react';
import Link from 'next/link';

const TRENDING_TOKENS = [
  { name: 'REACT', repo: 'facebook/react', stars: '228k', change: '+12.4%', up: true },
  { name: 'VITE', repo: 'vitejs/vite', stars: '68k', change: '+8.1%', up: true },
  { name: 'NEXT', repo: 'vercel/next.js', stars: '126k', change: '+5.3%', up: true },
  { name: 'TAIL', repo: 'tailwindcss/tailwindcss', stars: '83k', change: '-2.1%', up: false },
  { name: 'PRISMA', repo: 'prisma/prisma', stars: '40k', change: '+18.7%', up: true },
  { name: 'TRPC', repo: 'trpc/trpc', stars: '35k', change: '+6.2%', up: true },
];

export default function HomePage() {
  const { isConnected } = useAccount();

  return (
    <div className="relative min-h-screen bg-bg-primary">
      <div className="fixed inset-0 bg-grid opacity-100 pointer-events-none" />
      <div className="fixed inset-0 bg-hero-gradient pointer-events-none" />

      {/* Ticker */}
      <div className="relative border-b border-neon-purple/10 bg-bg-secondary/50 overflow-hidden py-2">
        <div className="flex animate-ticker whitespace-nowrap">
          {[...TRENDING_TOKENS, ...TRENDING_TOKENS].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-2 mx-8 font-mono text-xs">
              <span className="text-neon-purple font-bold">{t.name}</span>
              <span className={t.up ? 'text-neon-green' : 'text-neon-pink'}>{t.change}</span>
              <span className="text-gray-600">•</span>
            </span>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className="relative px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-neon-purple/30 bg-neon-purple/10 mb-6">
          <Zap size={12} className="text-neon-purple" />
          <span className="font-mono text-xs text-neon-purple">Meme tokens backed by real GitHub repos</span>
        </div>

        <h1 className="font-mono text-4xl sm:text-6xl font-bold mb-6 leading-tight">
          Trade the repos<br />
          <span className="gradient-text">you already love</span>
        </h1>

        <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
          Every viral open source project gets one verified meme token on 0G Network.
          No fakes. No copies. Just real OSS hype — on-chain.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {isConnected ? (
            <>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-mono text-sm font-semibold bg-gradient-to-r from-neon-purple to-neon-cyan text-white shadow-neon-purple hover:shadow-neon-cyan transition-all duration-300 hover:scale-105"
              >
                <TrendingUp size={16} />
                Explore Tokens
              </Link>
              <Link
                href="/launch"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-mono text-sm font-semibold border border-neon-purple/30 text-white hover:bg-neon-purple/10 transition-all duration-300"
              >
                <Rocket size={16} />
                Launch a Repo Token
              </Link>
            </>
          ) : (
            <div className="flex justify-center">
              <ConnectButton label="Connect to Get Started" />
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="relative px-4 py-16 max-w-5xl mx-auto">
        <h2 className="font-mono text-2xl font-bold text-center mb-12">
          How it <span className="text-neon-purple">works</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: <Github size={28} className="text-neon-purple" />,
              step: '01',
              title: 'Verify your repo',
              desc: 'Add a trustfolio.json to your repo root with your wallet address. We verify via GitHub API.',
            },
            {
              icon: <ShieldCheck size={28} className="text-neon-cyan" />,
              step: '02',
              title: 'Get scored on-chain',
              desc: 'Our AI scores your repo by stars, commits, contributors, and activity. One score, forever on 0G.',
            },
            {
              icon: <Coins size={28} className="text-neon-pink" />,
              step: '03',
              title: 'Deploy your meme token',
              desc: 'One token per repo. Contributors get a share. Traders do the rest.',
            },
          ].map((item) => (
            <NeonCard key={item.step} className="p-6" glow="purple">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-bg-hover">{item.icon}</div>
                <div>
                  <div className="font-mono text-xs text-gray-600 mb-1">{item.step}</div>
                  <h3 className="font-mono font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              </div>
            </NeonCard>
          ))}
        </div>
      </section>

      {/* Trending repos */}
      <section className="relative px-4 py-16 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-mono text-2xl font-bold">
            <TrendingUp size={20} className="inline mr-2 text-neon-purple" />
            Trending Repos
          </h2>
          <Link href="/explore" className="font-mono text-sm text-neon-purple hover:text-neon-cyan transition-colors flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TRENDING_TOKENS.map((token) => (
            <NeonCard key={token.name} className="p-4 cursor-pointer" glow="purple">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono font-bold text-white text-lg">${token.name}</span>
                <span className={`font-mono text-sm font-semibold ${token.up ? 'text-neon-green' : 'text-neon-pink'}`}>
                  {token.change}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs font-mono">
                <Github size={12} />
                {token.repo}
              </div>
              <div className="flex items-center gap-1 mt-2 text-gray-600 text-xs font-mono">
                <Star size={11} />
                {token.stars} stars
              </div>
            </NeonCard>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-4 py-24 text-center border-t border-neon-purple/10">
        <h2 className="font-mono text-3xl font-bold mb-4">
          Your favorite repo deserves a token
        </h2>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          Join fun.trustfolio and be the first to launch the token for the OSS project you love.
        </p>
        <div className="flex justify-center">
          {isConnected ? (
            <Link
              href="/launch"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-mono text-base font-semibold bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan text-white shadow-neon-purple hover:shadow-neon-cyan transition-all duration-300 hover:scale-105"
            >
              <Rocket size={18} />
              Launch a Token Now
            </Link>
          ) : (
            <div className="flex justify-center">
              <ConnectButton label="Get Started Free" />
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neon-purple/10 py-8 px-4 text-center">
        <p className="font-mono text-xs text-gray-700">
          fun.trustfolio.space — powered by{' '}
          <span className="text-neon-purple">0G Network</span> •{' '}
          <Link href="https://trustfolio.space" className="text-neon-cyan hover:underline">
            trustfolio.space
          </Link>
        </p>
      </footer>
    </div>
  );
}

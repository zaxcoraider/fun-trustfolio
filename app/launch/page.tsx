'use client';

import { useState, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { NeonCard } from '@/components/NeonCard';
import { Rocket, Search, Upload, CheckCircle, AlertCircle, Star, GitFork, Users, Loader2, X } from 'lucide-react';
import { REPO_REGISTRY_ABI, DEPLOY_COST_WEI } from '@/lib/contracts';

type Step = 'url' | 'preview' | 'deploying' | 'success';

interface RepoData {
  repoId: number;
  name: string;
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  language: string | null;
  ownerLogin: string;
  ownerAvatarUrl: string;
  topics: string[];
  eligibleContributors: { login: string; avatarUrl: string; contributions: number }[];
  totalContributors: number;
  filteredBots: number;
}

export default function LaunchPage() {
  const { isConnected, address, chain } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<Step>('url');
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [repoData, setRepoData] = useState<RepoData | null>(null);
  const [customImage, setCustomImage] = useState<File | null>(null);
  const [customImagePreview, setCustomImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="fixed inset-0 bg-grid pointer-events-none" />
        <NeonCard className="p-10 text-center max-w-sm w-full" glow="purple">
          <Rocket size={40} className="mx-auto mb-4 text-neon-purple/40" />
          <p className="text-gray-300 font-mono text-sm mb-6">Connect wallet to deploy a repo token</p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </NeonCard>
      </div>
    );
  }

  async function handleVerify() {
    setError('');
    if (!repoUrl.trim()) {
      setError('Enter a GitHub repo URL');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/verify-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to verify repo');
        return;
      }
      setRepoData(data);
      setStep('preview');
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image too large. Max 5MB.');
      return;
    }
    setCustomImage(file);
    setCustomImagePreview(URL.createObjectURL(file));
    setError('');
  }

  function removeCustomImage() {
    setCustomImage(null);
    setCustomImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleDeploy() {
    if (!repoData || !address) return;
    setError('');
    setLoading(true);
    setStep('deploying');

    try {
      // 1. Upload image to 0G Storage
      let imageHash = '';
      const formData = new FormData();

      if (customImage) {
        formData.append('image', customImage);
      } else {
        // Fetch auto-generated image and upload it
        const imgParams = new URLSearchParams({
          repoName: repoData.name,
          ownerLogin: repoData.ownerLogin,
          ownerAvatarUrl: repoData.ownerAvatarUrl,
          language: repoData.language || '',
          stars: String(repoData.stars),
        });
        const imgRes = await fetch(`/api/generate-image?${imgParams}`);
        const imgBlob = await imgRes.blob();
        formData.append('image', new File([imgBlob], 'token.png', { type: 'image/png' }));
      }

      const uploadRes = await fetch('/api/upload-image', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setError(uploadData.error || 'Image upload failed');
        setStep('preview');
        return;
      }
      imageHash = uploadData.hash;

      // 2. Call RepoRegistry.deployToken on-chain
      const registryAddress = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS_MAINNET as `0x${string}`;
      if (!registryAddress) {
        setError('Registry contract not deployed yet. Set NEXT_PUBLIC_REGISTRY_ADDRESS_MAINNET in .env.local');
        setStep('preview');
        return;
      }

      const tokenSymbol = repoData.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
      const tokenName = `${repoData.name} on fun.tf`;

      await writeContractAsync({
        address: registryAddress,
        abi: REPO_REGISTRY_ABI,
        functionName: 'deployToken',
        args: [
          BigInt(repoData.repoId),
          tokenName,
          tokenSymbol,
          imageHash as `0x${string}`,
        ],
        value: DEPLOY_COST_WEI,
      });

      setStep('success');
    } catch {
      setError('Deploy failed. Try again.');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  }

  const autoImageUrl = repoData
    ? `/api/generate-image?${new URLSearchParams({
        repoName: repoData.name,
        ownerLogin: repoData.ownerLogin,
        ownerAvatarUrl: repoData.ownerAvatarUrl,
        language: repoData.language || '',
        stars: String(repoData.stars),
      })}`
    : '';

  return (
    <div className="relative min-h-screen bg-bg-primary px-4 py-12">
      <div className="fixed inset-0 bg-grid pointer-events-none" />
      <div className="relative max-w-2xl mx-auto">

        {/* Header */}
        <h1 className="font-mono text-3xl font-bold mb-2 flex items-center gap-3">
          <Rocket className="text-neon-purple" />
          Launch a Repo Token
        </h1>
        <p className="text-gray-500 font-mono text-sm mb-10">
          Deploy a meme token for any public GitHub repo. First deployer wins — forever.
        </p>

        {/* Step: URL Input */}
        {step === 'url' && (
          <NeonCard className="p-8" glow="purple">
            <label className="block font-mono text-xs text-gray-400 mb-2 uppercase tracking-widest">
              GitHub Repo URL
            </label>
            <div className="flex gap-3">
              <input
                type="url"
                value={repoUrl}
                onChange={e => { setRepoUrl(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
                placeholder="https://github.com/owner/repo"
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-3 font-mono text-sm text-white placeholder-gray-600 focus:outline-none focus:border-neon-purple/60"
              />
              <button
                onClick={handleVerify}
                disabled={loading}
                className="flex items-center gap-2 bg-neon-purple/20 hover:bg-neon-purple/30 border border-neon-purple/50 text-neon-purple font-mono text-sm px-5 py-3 rounded-lg transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Verify
              </button>
            </div>
            {error && (
              <p className="mt-3 text-red-400 font-mono text-xs flex items-center gap-2">
                <AlertCircle size={14} /> {error}
              </p>
            )}
            <p className="mt-4 text-gray-600 font-mono text-xs">
              Any public repo can be tokenized. No owner permission needed.
            </p>
          </NeonCard>
        )}

        {/* Step: Preview + Image */}
        {step === 'preview' && repoData && (
          <div className="space-y-6">
            {/* Repo Info */}
            <NeonCard className="p-6" glow="purple">
              <div className="flex items-start gap-4">
                <img
                  src={repoData.ownerAvatarUrl}
                  alt={repoData.ownerLogin}
                  className="w-14 h-14 rounded-full border border-neon-purple/30"
                />
                <div className="flex-1 min-w-0">
                  <h2 className="font-mono text-lg font-bold text-white truncate">{repoData.fullName}</h2>
                  {repoData.description && (
                    <p className="text-gray-400 font-mono text-xs mt-1 line-clamp-2">{repoData.description}</p>
                  )}
                  <div className="flex flex-wrap gap-4 mt-3 font-mono text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400" /> {repoData.stars.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><GitFork size={12} /> {repoData.forks.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Users size={12} /> {repoData.eligibleContributors.length} contributors</span>
                    {repoData.language && (
                      <span className="text-neon-cyan">{repoData.language}</span>
                    )}
                  </div>
                  {repoData.filteredBots > 0 && (
                    <p className="mt-2 text-gray-600 font-mono text-xs">
                      {repoData.filteredBots} bot{repoData.filteredBots > 1 ? 's' : ''} filtered from contributor list
                    </p>
                  )}
                </div>
              </div>
              {repoData.topics.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {repoData.topics.slice(0, 6).map(t => (
                    <span key={t} className="bg-neon-purple/10 border border-neon-purple/20 text-neon-purple font-mono text-xs px-2 py-0.5 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </NeonCard>

            {/* Token Image */}
            <NeonCard className="p-6" glow="cyan">
              <h3 className="font-mono text-xs text-gray-400 uppercase tracking-widest mb-4">Token Image</h3>
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                {/* Image preview */}
                <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                  {customImagePreview ? (
                    <>
                      <img src={customImagePreview} alt="Custom token image" className="w-full h-full object-cover" />
                      <button
                        onClick={removeCustomImage}
                        className="absolute top-1 right-1 bg-black/80 rounded-full p-0.5 text-gray-400 hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <img src={autoImageUrl} alt="Auto-generated token image" className="w-full h-full object-cover" />
                  )}
                </div>

                {/* Upload option */}
                <div className="flex-1">
                  <p className="font-mono text-xs text-gray-400 mb-3">
                    {customImagePreview
                      ? 'Custom image selected. Remove it to use the auto-generated one.'
                      : 'Auto-generated from GitHub data. Optionally replace with a custom meme image.'}
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="flex items-center gap-2 cursor-pointer bg-black/40 hover:bg-black/60 border border-white/10 hover:border-neon-cyan/40 text-gray-400 hover:text-neon-cyan font-mono text-xs px-4 py-2.5 rounded-lg transition-all w-fit"
                  >
                    <Upload size={14} />
                    Upload custom image
                  </label>
                  <p className="mt-2 text-gray-600 font-mono text-xs">PNG, JPEG, GIF, WEBP — max 5MB</p>
                </div>
              </div>
            </NeonCard>

            {/* Tokenomics preview */}
            <NeonCard className="p-6" glow="pink">
              <h3 className="font-mono text-xs text-gray-400 uppercase tracking-widest mb-4">Token Distribution</h3>
              <div className="space-y-2 font-mono text-sm">
                {[
                  { label: 'Bonding Curve (public)', pct: '85%', color: 'text-neon-cyan' },
                  { label: 'Contributors (claim 90 days)', pct: repoData.eligibleContributors.length === 0 ? '5% → liquidity' : '5%', color: 'text-neon-purple' },
                  { label: 'Repo Owner (claim 90 days)', pct: '5%', color: 'text-neon-pink' },
                  { label: 'Platform Treasury', pct: '5%', color: 'text-yellow-400' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span className="text-gray-400 text-xs">{row.label}</span>
                    <span className={`${row.color} font-bold text-xs`}>{row.pct}</span>
                  </div>
                ))}
              </div>
              {repoData.eligibleContributors.length === 0 && (
                <p className="mt-3 text-gray-600 font-mono text-xs">
                  No eligible contributors found — their 5% will be added to liquidity at launch.
                </p>
              )}
            </NeonCard>

            {error && (
              <p className="text-red-400 font-mono text-xs flex items-center gap-2">
                <AlertCircle size={14} /> {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { setStep('url'); setRepoData(null); setError(''); setCustomImage(null); setCustomImagePreview(null); }}
                className="flex-1 bg-black/40 border border-white/10 text-gray-400 font-mono text-sm py-3 rounded-lg hover:border-white/20 transition-all"
              >
                Back
              </button>
              <button
                onClick={handleDeploy}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-neon-purple/20 hover:bg-neon-purple/30 border border-neon-purple/50 text-neon-purple font-mono text-sm py-3 rounded-lg transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                Deploy Token — 0.1 0G
              </button>
            </div>

            <p className="text-center text-gray-600 font-mono text-xs">
              Smart contract deployment active on 0G Testnet. Mainnet after audit.
            </p>
          </div>
        )}

        {/* Step: Deploying */}
        {step === 'deploying' && (
          <NeonCard className="p-12 text-center" glow="purple">
            <Loader2 size={48} className="mx-auto mb-6 text-neon-purple animate-spin" />
            <h2 className="font-mono text-xl font-bold text-white mb-2">Deploying Token</h2>
            <p className="text-gray-400 font-mono text-sm">Uploading image to 0G Storage...</p>
          </NeonCard>
        )}

        {/* Step: Success */}
        {step === 'success' && repoData && (
          <NeonCard className="p-12 text-center" glow="cyan">
            <CheckCircle size={48} className="mx-auto mb-6 text-neon-cyan" />
            <h2 className="font-mono text-2xl font-bold text-white mb-2">Token Deployed!</h2>
            <p className="text-gray-400 font-mono text-sm mb-2">
              <span className="text-neon-cyan">{repoData.fullName}</span> is now on-chain.
            </p>
            <p className="text-gray-600 font-mono text-xs mb-8">
              This repo is permanently locked — no second token can ever be deployed.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={`/repo/${repoData.repoId}`}
                className="bg-neon-cyan/20 hover:bg-neon-cyan/30 border border-neon-cyan/50 text-neon-cyan font-mono text-sm px-6 py-3 rounded-lg transition-all"
              >
                View Token Page
              </a>
              <button
                onClick={() => { setStep('url'); setRepoData(null); setRepoUrl(''); setCustomImage(null); setCustomImagePreview(null); }}
                className="bg-black/40 border border-white/10 text-gray-400 font-mono text-sm px-6 py-3 rounded-lg hover:border-white/20 transition-all"
              >
                Deploy Another
              </button>
            </div>
          </NeonCard>
        )}
      </div>
    </div>
  );
}

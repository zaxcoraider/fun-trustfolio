'use client';

import { defineChain } from 'viem';
import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  trustWallet,
  okxWallet,
  rainbowWallet,
  injectedWallet,
} from '@rainbow-me/rainbowkit/wallets';

export const zgTestnet = defineChain({
  id: 16602,
  name: '0G-Galileo-Testnet',
  nativeCurrency: { decimals: 18, name: '0G', symbol: '0G' },
  rpcUrls: {
    default: { http: ['https://evmrpc-testnet.0g.ai'] },
  },
  blockExplorers: {
    default: { name: '0G Explorer', url: 'https://chainscan-galileo.0g.ai' },
  },
  testnet: true,
});

export const zgMainnet = defineChain({
  id: 16661,
  name: '0G-Newton-Mainnet',
  nativeCurrency: { decimals: 18, name: '0G', symbol: '0G' },
  rpcUrls: {
    default: { http: ['https://evmrpc.0g.ai'] },
  },
  blockExplorers: {
    default: { name: '0G Explorer', url: 'https://chainscan.0g.ai' },
  },
  testnet: false,
});

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [metaMaskWallet, rainbowWallet, coinbaseWallet, walletConnectWallet],
    },
    {
      groupName: 'More',
      wallets: [trustWallet, okxWallet, injectedWallet],
    },
  ],
  { appName: 'fun.trustfolio', projectId }
);

export const wagmiConfig = createConfig({
  chains: [zgTestnet, zgMainnet, mainnet],
  connectors,
  transports: {
    [zgTestnet.id]: http('https://evmrpc-testnet.0g.ai'),
    [zgMainnet.id]: http('https://evmrpc.0g.ai'),
    [mainnet.id]: http(),
  },
  ssr: true,
});

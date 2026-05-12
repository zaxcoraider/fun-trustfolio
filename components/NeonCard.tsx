'use client';

import { ReactNode } from 'react';

interface NeonCardProps {
  children: ReactNode;
  className?: string;
  glow?: 'purple' | 'cyan' | 'pink' | 'green';
  onClick?: () => void;
}

const glowMap = {
  purple: 'border-neon-purple/20 shadow-neon-purple/20 hover:border-neon-purple/40',
  cyan: 'border-neon-cyan/20 shadow-neon-cyan/20 hover:border-neon-cyan/40',
  pink: 'border-neon-pink/20 shadow-neon-pink/20 hover:border-neon-pink/40',
  green: 'border-neon-green/20 shadow-neon-green/20 hover:border-neon-green/40',
};

export function NeonCard({ children, className = '', glow = 'purple', onClick }: NeonCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-bg-card border rounded-2xl shadow-card-glow
        transition-all duration-300
        ${glowMap[glow]}
        ${onClick ? 'cursor-pointer hover:scale-[1.01]' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

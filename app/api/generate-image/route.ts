import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import React from 'react';

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
  Dart: '#00B4AB',
};

const e = React.createElement;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const repoName = searchParams.get('repoName') || 'repo';
  const ownerLogin = searchParams.get('ownerLogin') || '';
  const ownerAvatarUrl = searchParams.get('ownerAvatarUrl') || '';
  const language = searchParams.get('language') || '';
  const stars = parseInt(searchParams.get('stars') || '0', 10);

  const bgColor = LANGUAGE_COLORS[language] || '#7c3aed';
  const shortName = repoName.length > 18 ? repoName.slice(0, 18) + '…' : repoName;

  const image = new ImageResponse(
    e(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, #0a0a0f 0%, ${bgColor}44 100%)`,
          borderRadius: '16px',
          padding: '28px',
          fontFamily: 'monospace',
          position: 'relative' as const,
        },
      },
      ownerAvatarUrl &&
        e('img', {
          src: ownerAvatarUrl,
          width: 80,
          height: 80,
          style: {
            borderRadius: '50%',
            border: `3px solid ${bgColor}`,
            marginBottom: '14px',
          },
        }),
      e(
        'div',
        {
          style: {
            color: '#ffffff',
            fontSize: '24px',
            fontWeight: 'bold',
            textAlign: 'center' as const,
            marginBottom: '6px',
          },
        },
        shortName
      ),
      e(
        'div',
        { style: { color: '#9ca3af', fontSize: '13px', marginBottom: '14px' } },
        `@${ownerLogin}`
      ),
      e(
        'div',
        { style: { display: 'flex', gap: '10px', alignItems: 'center' } },
        language &&
          e(
            'div',
            {
              style: {
                background: bgColor,
                color: '#fff',
                padding: '3px 12px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 'bold',
              },
            },
            language
          ),
        e(
          'div',
          { style: { color: '#f59e0b', fontSize: '13px' } },
          `★ ${stars.toLocaleString()}`
        )
      ),
      e(
        'div',
        {
          style: {
            position: 'absolute' as const,
            bottom: '10px',
            right: '14px',
            color: '#4b5563',
            fontSize: '10px',
          },
        },
        'fun.trustfolio.space'
      )
    ),
    { width: 400, height: 400 }
  );

  return image;
}

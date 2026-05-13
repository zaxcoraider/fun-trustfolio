const GITHUB_API = 'https://api.github.com';

const BOT_PATTERNS = [
  '[bot]', 'dependabot', 'renovate', 'github-actions',
  'codecov', 'semantic-release', 'greenkeeper', 'snyk-bot',
  'imgbot', 'allcontributors',
];

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname !== 'github.com') return null;
    const parts = parsed.pathname.replace(/^\//, '').replace(/\/$/, '').split('/');
    if (parts.length < 2) return null;
    const [owner, repo] = parts;
    if (!owner || !repo) return null;
    if (!/^[a-zA-Z0-9._-]+$/.test(owner) || !/^[a-zA-Z0-9._-]+$/.test(repo)) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

export function isBot(contributor: { login: string; type: string }): boolean {
  const login = (contributor.login || '').toLowerCase();
  if (contributor.type === 'Bot') return true;
  return BOT_PATTERNS.some(p => login.includes(p));
}

export function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export async function fetchRepoById(repoId: string) {
  const res = await fetch(`${GITHUB_API}/repositories/${repoId}`, {
    headers: githubHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchContributors(fullName: string) {
  const res = await fetch(
    `${GITHUB_API}/repos/${fullName}/contributors?per_page=100`,
    { headers: githubHeaders() }
  );
  if (!res.ok) return [];
  return res.json();
}

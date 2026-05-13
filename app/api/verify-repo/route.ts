import { NextRequest, NextResponse } from 'next/server';
import { parseGitHubUrl, isBot, githubHeaders, fetchContributors } from '@/lib/github';

const GITHUB_API = 'https://api.github.com';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.repoUrl || typeof body.repoUrl !== 'string') {
    return NextResponse.json({ error: 'Missing repoUrl' }, { status: 400 });
  }

  const parsed = parseGitHubUrl(body.repoUrl);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid GitHub repo URL' }, { status: 400 });
  }

  const { owner, repo } = parsed;
  const headers = githubHeaders();

  const [repoRes, contributorsRaw] = await Promise.all([
    fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers }),
    fetchContributors(`${owner}/${repo}`),
  ]);

  if (!repoRes.ok) {
    const status = repoRes.status === 404 ? 404 : 502;
    const error = repoRes.status === 404 ? 'Repo not found' : 'GitHub API error';
    return NextResponse.json({ error }, { status });
  }

  const repoData = await repoRes.json();

  if (repoData.private) {
    return NextResponse.json({ error: 'Private repos cannot be tokenized' }, { status: 400 });
  }

  const eligible = (contributorsRaw as any[]).filter(c => !isBot(c));
  const bots = (contributorsRaw as any[]).length - eligible.length;

  return NextResponse.json({
    repoId: repoData.id,
    name: repoData.name,
    fullName: repoData.full_name,
    description: repoData.description || '',
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    language: repoData.language || null,
    ownerLogin: repoData.owner.login,
    ownerAvatarUrl: repoData.owner.avatar_url,
    createdAt: repoData.created_at,
    topics: repoData.topics || [],
    eligibleContributors: eligible.map((c: any) => ({
      login: c.login,
      avatarUrl: c.avatar_url,
      contributions: c.contributions,
    })),
    totalContributors: (contributorsRaw as any[]).length,
    filteredBots: bots,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { isBot, fetchRepoById, fetchContributors } from '@/lib/github';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const { repoId } = await params;

  if (!repoId || !/^\d+$/.test(repoId)) {
    return NextResponse.json({ error: 'Invalid repoId' }, { status: 400 });
  }

  const repoData = await fetchRepoById(repoId);
  if (!repoData) {
    return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
  }

  const contributorsRaw = await fetchContributors(repoData.full_name);
  const eligible = (contributorsRaw as any[]).filter((c: any) => !isBot(c));
  const totalCommits = eligible.reduce((sum: number, c: any) => sum + c.contributions, 0);

  return NextResponse.json({
    repoId,
    repoName: repoData.full_name,
    totalEligible: eligible.length,
    totalContributors: (contributorsRaw as any[]).length,
    contributors: eligible.map((c: any) => ({
      login: c.login,
      avatarUrl: c.avatar_url,
      contributions: c.contributions,
      sharePercent: totalCommits > 0
        ? ((c.contributions / totalCommits) * 100).toFixed(2)
        : '0.00',
    })),
  });
}

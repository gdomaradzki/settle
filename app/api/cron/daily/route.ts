import 'server-only';
import { NextResponse } from 'next/server';
import { runAllJobs } from '@/server/cron/runner';

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return false;
  return authHeader === `Bearer ${secret}`;
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return new NextResponse(null, { status: 401 });
  }

  const jobs = await runAllJobs();
  return NextResponse.json({ jobs });
}

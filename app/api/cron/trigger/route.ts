import 'server-only';
import { NextResponse } from 'next/server';
import { runJob, CronJobNotFoundError } from '@/server/cron/runner';

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('jobName' in body) ||
    typeof (body as Record<string, unknown>).jobName !== 'string' ||
    (body as Record<string, unknown>).jobName === ''
  ) {
    return new NextResponse(null, { status: 400 });
  }

  const { jobName } = body as { jobName: string };

  try {
    const job = await runJob(jobName);
    return NextResponse.json({ job });
  } catch (err) {
    if (err instanceof CronJobNotFoundError) {
      return new NextResponse(null, { status: 404 });
    }
    throw err;
  }
}

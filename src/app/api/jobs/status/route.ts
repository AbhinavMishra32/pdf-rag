import { myQueue } from '@/lib/queue';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  if (!jobId) return new Response(JSON.stringify({ ok: false, error: 'Missing jobId'}), { status: 400 });

  try {
    const job = await myQueue.getJob(jobId);
    if (!job) return new Response(JSON.stringify({ ok: false, error: 'Not found'}), { status: 404 });

    const isCompleted = await job.isCompleted();
    const isFailed = await job.isFailed();

    return new Response(JSON.stringify({
      ok: true,
      jobId,
      state: isCompleted ? 'completed' : isFailed ? 'failed' : 'active',
      returnvalue: isCompleted ? job.returnvalue : undefined,
      failedReason: isFailed ? job.failedReason : undefined,
    }), { status: 200, headers: { 'Content-Type': 'application/json' }});
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'Error'}), { status: 500 });
  }
}

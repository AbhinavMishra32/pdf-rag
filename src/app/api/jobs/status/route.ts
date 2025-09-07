import { myQueue } from '@/lib/queue';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  if (!jobId) return new Response(JSON.stringify({ ok: false, error: 'Missing jobId'}), { status: 400 });

  try {
    const job = await myQueue.getJob(jobId);
    if (!job) return new Response(JSON.stringify({ ok: false, error: 'Not found'}), { status: 404 });

    const state = job.state;
    return new Response(JSON.stringify({
      ok: true,
      jobId,
      state,
      returnvalue: state === 'completed' ? job.returnvalue : undefined,
      failedReason: state === 'failed' ? job.failedReason : undefined,
    }), { status: 200, headers: { 'Content-Type': 'application/json' }});
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'Error'}), { status: 500 });
  }
}

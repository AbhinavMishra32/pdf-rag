import { QueueEvents } from 'bullmq';
import { connection } from '@/lib/queue';

// Simple SSE endpoint: /api/jobs/subscribe?jobId=123
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  if (!jobId) {
    return new Response('Missing jobId', { status: 400 });
  }

  const queueEvents = new QueueEvents('file-upload-queue', { connection });
  await queueEvents.waitUntilReady();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(evt: string, data: any) {
        controller.enqueue(encoder.encode(`event: ${evt}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      const onActive = ({ jobId: id }: any) => {
        if (id === jobId) send('active', { jobId });
      };
      const onCompleted = ({ jobId: id, returnvalue }: any) => {
        if (id === jobId) {
          send('completed', { jobId, returnvalue });
          cleanup();
        }
      };
      const onFailed = ({ jobId: id, failedReason }: any) => {
        if (id === jobId) {
          send('failed', { jobId, failedReason });
            cleanup();
        }
      };

      function cleanup() {
        queueEvents.removeListener('active', onActive);
        queueEvents.removeListener('completed', onCompleted);
        queueEvents.removeListener('failed', onFailed);
        queueEvents.close().catch(() => {});
        controller.close();
      }

      queueEvents.on('active', onActive);
      queueEvents.on('completed', onCompleted);
      queueEvents.on('failed', onFailed);

      // Optional timeout (60s) to avoid dangling connections
      const timeout = setTimeout(() => {
        send('timeout', { jobId });
        cleanup();
      }, 60000);

      // If client disconnects
      (request as any).signal?.addEventListener?.('abort', () => {
        clearTimeout(timeout);
        cleanup();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}

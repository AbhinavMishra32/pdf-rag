import { myQueue } from '@/lib/queue';

export async function POST(request: Request) {
    try {
        let payload: any = null;

        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            try {
                payload = await request.json();
            } catch (e) {
                return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
        } else {
            const text = await request.text();
            payload = text || { note: 'empty body' };
        }

        const job = await myQueue.add('file-upload', payload);
        return new Response(JSON.stringify({ ok: true, jobId: job.id }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err: any) {
        const message = err?.message || 'Unknown error adding job';
        return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
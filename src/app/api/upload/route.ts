import { myQueue } from '@/lib/queue';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
    const file = formData.get('file') as File;
        
        if (!file) {
            return new Response(JSON.stringify({ ok: false, error: 'No file provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const arrayBuffer = await file.arrayBuffer();
        const b64 = Buffer.from(arrayBuffer).toString('base64');

        const userIdEntry = formData.get('userId');
        const userId = typeof userIdEntry === 'string' ? userIdEntry : 'guest';

        const job = await myQueue.add('file-upload', {
            b64,
            originalName: file.name,
            size: file.size,
            mime: file.type || 'application/pdf',
            userId,
        });
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
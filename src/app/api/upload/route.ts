import { auth } from '@clerk/nextjs/server';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { vectorStore } from '@/lib/vectorStore';

const PAGE_LIMIT = 20;

export async function POST(request: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        const formData = await request.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            return new Response(JSON.stringify({ ok: false, error: 'No file provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        try {
            // Dynamic import to avoid build-time side effects from pdf-parse
            const { default: pdfParse } = await import('pdf-parse');
            const meta = await pdfParse(buffer).catch(() => null);
            const numPages = (meta as any)?.numpages || (meta as any)?.numPages || null;
            if (numPages && numPages > PAGE_LIMIT) {
                return new Response(JSON.stringify({ ok: false, error: `PDF has ${numPages} pages (limit ${PAGE_LIMIT}).` }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        } catch (e:any) {
            console.warn('[upload] pdf page count parse failed', e?.message || e);
        }

        // Inline processing (was previously queued)
        const uint8 = new Uint8Array(buffer);
        const loader = new PDFLoader(new Blob([uint8]));
        const pages = await loader.load();
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 100 });
        const chunks = (await splitter.splitDocuments(pages)).map(d => {
            const page = (d as any).metadata?.loc?.pageNumber ?? (d as any).metadata?.page ?? null;
            return { ...d, metadata: { ...d.metadata, page } } as any;
        });
        const docId = crypto.randomUUID();
        const store = await vectorStore(userId, docId);
        await store.addDocuments(chunks);
        return new Response(JSON.stringify({ ok: true, docId, pages: pages.length, chunks: chunks.length }), {
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
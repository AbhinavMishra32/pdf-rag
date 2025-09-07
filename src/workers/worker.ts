import { Worker } from 'bullmq';
import { connection } from '@/lib/queue';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CharacterTextSplitter, RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { embeddings, qdrantClient } from "@/lib/vectordb";
import { QdrantVectorStore } from '@langchain/qdrant';
import { vectorStore } from '@/lib/vectorStore';

const worker = new Worker('file-upload-queue', async job => {
    console.log(`Processing job ${job.id} of type ${job.name}`);
    const { b64, originalName, userId, docId } = job.data || {};
    if (!b64) {
        throw new Error(`No base64 data provided for job ${job.id}`);
    }

    const buffer = Buffer.from(b64, 'base64');
    const uint8 = new Uint8Array(buffer);
    const pdfLoader = new PDFLoader(new Blob([uint8]));
    console.time(`[worker:${job.id}] pdf_load`);
    const loadedPages = await pdfLoader.load(); // raw page-level documents
    console.timeEnd(`[worker:${job.id}] pdf_load`);
    console.log(`Loaded ${loadedPages.length} pages from in-memory PDF '${originalName}' (bytes=${buffer.length})`);

    // const textSplitter = new CharacterTextSplitter({
    //     chunkSize: 100,
    //     chunkOverlap: 50,
    // });
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 100,
    });

    console.time(`[worker:${job.id}] split_docs`);
    const chunkedDocs = (await textSplitter.splitDocuments(loadedPages)).map(d => {
        const page = d.metadata?.loc?.pageNumber ?? d.metadata?.page ?? null;
        return { ...d, metadata: { ...d.metadata, page } } as any;
    });
    console.timeEnd(`[worker:${job.id}] split_docs`);
    console.log(`[worker:${job.id}] Produced ${chunkedDocs.length} chunks (avgLength=${(chunkedDocs.reduce((a,c)=>a+(c.pageContent?.length||0),0)/Math.max(1,chunkedDocs.length)).toFixed(1)})`);

    try {
        const result = await qdrantClient?.getCollections();
        console.log('List of collections:', result?.collections);
    } catch (err) {
        console.warn('Qdrant call failed (skipping):', (err as any)?.message);
    }

    console.time(`[worker:${job.id}] vector_store_init`);
    const effectiveDocId = docId || (originalName || 'untitled').replace(/\.[^.]+$/, '').slice(0,40);
    const store = await vectorStore(userId, effectiveDocId);
    console.timeEnd(`[worker:${job.id}] vector_store_init`);
    console.log(`[worker:${job.id}] Using vector store type: ${store.constructor.name} (user: ${userId || 'guest'}, doc: ${effectiveDocId})`);
    try {
        console.time(`[worker:${job.id}] add_documents`);
        await store.addDocuments(chunkedDocs);
        console.timeEnd(`[worker:${job.id}] add_documents`);
    } catch (e:any) {
        console.error(`[worker:${job.id}] addDocuments failed:`, e?.message || e);
        throw e;
    }

    return { pages: loadedPages.length, originalName, chunks: chunkedDocs.length };
}, { connection });

worker.on('completed', job => {
    console.log(`Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} has failed with error ${err.message}`);
});

console.log('Worker is running and waiting for jobs...');

// Keep the worker running
process.stdin.resume();

export default worker;
import { Worker } from 'bullmq';
import { connection } from '@/lib/queue';
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { Document } from "@langchain/core/documents";
import type { AttributeInfo } from "langchain/chains/query_constructor";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

import { QdrantClient } from "@qdrant/js-client-rest";

const worker = new Worker('file-upload-queue', async job => {
    console.log(`Processing job ${job.id} of type ${job.name}: `, job.data);
        const { b64, originalName } = job.data || {};
        if (!b64) {
            throw new Error(`No base64 data provided for job ${job.id}`);
        }

        const buffer = Buffer.from(b64, 'base64');
        // PDFLoader from @langchain/community accepts a FilePath string OR a Blob-like
        // We create a temporary in-memory blob via a small shim using a Uint8Array.
        // If this fails in this environment, you'd need a custom loader.
        const uint8 = new Uint8Array(buffer);
        const pdfLoader = new PDFLoader(new Blob([uint8]));
        const documents = await pdfLoader.load();
        console.log(`Loaded ${documents.length} pages from in-memory PDF '${originalName}'`);

    // Simulate additional processing time if needed
    // await new Promise(r => setTimeout(r, 500));

    return { pages: documents.length, originalName };
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
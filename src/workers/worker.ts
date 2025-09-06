import { Worker } from 'bullmq';
import { connection } from '@/lib/queue';
// (Embeddings & vector store imports removed for now)
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CharacterTextSplitter } from "@langchain/textsplitters";
import { embeddings, qdrantClient } from "@/lib/vectordb";
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';

const worker = new Worker('file-upload-queue', async job => {
    console.log(`Processing job ${job.id} of type ${job.name}`);
    const { b64, originalName } = job.data || {};
    if (!b64) {
        throw new Error(`No base64 data provided for job ${job.id}`);
    }

    const buffer = Buffer.from(b64, 'base64');
    const uint8 = new Uint8Array(buffer);
    const pdfLoader = new PDFLoader(new Blob([uint8]));
    const documents = await pdfLoader.load();
    console.log(`Loaded ${documents.length} pages from in-memory PDF '${originalName}'`);

    const textSplitter = new CharacterTextSplitter({
        chunkSize: 100,
        chunkOverlap: 0,
    });

    const texts = await textSplitter.splitDocuments(documents);
    // console.log(
    //   'texts:',
    //   JSON.stringify(
    //     texts.map((d, i) => ({
    //       index: i,
    //       pageContent: d.pageContent,
    //       metadata: d.metadata,
    //     })),
    //     null,
    //     2
    //   )
    // );


    try {
        const result = await qdrantClient?.getCollections();
        console.log('List of collections:', result?.collections);
    } catch (err) {
        console.warn('Qdrant call failed (skipping):', (err as any)?.message);
    }

    const vectorStore = await QdrantVectorStore.fromDocuments(documents, embeddings, {
        client: qdrantClient ?? undefined,
        collectionName: "pdf-collection",
    });

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
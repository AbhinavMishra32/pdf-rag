import { QdrantVectorStore } from "@langchain/qdrant";
import { embeddings, qdrantClient } from "./vectordb";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

const storeCache: Map<string, QdrantVectorStore | MemoryVectorStore> = new Map();

function normalizeUserId(userId?: string | null) {
    if (!userId || typeof userId !== 'string' || !userId.trim()) return 'guest';
    return userId.trim();
}

export async function vectorStore(userId?: string | null): Promise<QdrantVectorStore | MemoryVectorStore> {
    const uid = normalizeUserId(userId);
    if (storeCache.has(uid)) return storeCache.get(uid)!;

    if (!qdrantClient) {
        console.warn(`[vectorStore] No QDRANT_URL provided. Using in-memory vector store for user '${uid}'.`);
        const mem = await MemoryVectorStore.fromTexts([], [], embeddings);
        storeCache.set(uid, mem);
        return mem;
    }

    const collectionName = `pdf_${uid}`; 
    try {
        const existing = await QdrantVectorStore.fromExistingCollection(embeddings, {
            client: qdrantClient,
            collectionName,
        });
        storeCache.set(uid, existing);
        return existing;
    } catch (err: any) {
        console.info(`[vectorStore] Creating new collection '${collectionName}' for user '${uid}'. Reason: ${err?.message || err}`);
        try {
            const created = await QdrantVectorStore.fromDocuments([], embeddings, {
                client: qdrantClient,
                collectionName,
            });
            storeCache.set(uid, created);
            return created;
        } catch (inner: any) {
            console.error(`[vectorStore] Failed to create collection '${collectionName}' for user '${uid}'. Falling back to in-memory.`, inner?.message || inner);
            const mem = await MemoryVectorStore.fromTexts([], [], embeddings);
            storeCache.set(uid, mem);
            return mem;
        }
    }
}

export function clearUserVectorStore(userId?: string | null) {
    const uid = normalizeUserId(userId);
    storeCache.delete(uid);
}

export function getUserVectorStore(userId?: string | null) {
    const uid = normalizeUserId(userId);
    return storeCache.get(uid) || null;
}

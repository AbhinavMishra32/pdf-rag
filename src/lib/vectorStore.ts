import { QdrantVectorStore } from "@langchain/qdrant";
import { embeddings, qdrantClient } from "./vectordb";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

const storeCache: Map<string, QdrantVectorStore | MemoryVectorStore> = new Map();

function normalizeUserId(userId?: string | null) {
    if (!userId || typeof userId !== 'string' || !userId.trim()) return 'guest';
    return userId.trim();
}

function sanitizeId(id?: string | null) {
    if (!id) return 'default';
    return id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'default';
}

export async function vectorStore(userId?: string | null, docId?: string | null): Promise<QdrantVectorStore | MemoryVectorStore> {
    const uid = normalizeUserId(userId);
    const did = sanitizeId(docId);
    const cacheKey = `${uid}::${did}`;
    if (storeCache.has(cacheKey)) return storeCache.get(cacheKey)!;

    if (!qdrantClient) {
        console.warn(`[vectorStore] No QDRANT_URL provided. Using in-memory vector store for user '${uid}', doc '${did}'.`);
        const mem = await MemoryVectorStore.fromTexts([], [], embeddings);
        storeCache.set(cacheKey, mem);
        return mem;
    }

    const collectionName = `pdf_${uid}_${did}`; 
    try {
        console.log(`[vectorStore] Attempting to open existing collection '${collectionName}' (user='${uid}', doc='${did}').`);
        const existing = await QdrantVectorStore.fromExistingCollection(embeddings, {
            client: qdrantClient,
            collectionName,
        });
        console.log(`[vectorStore] Opened existing collection '${collectionName}'.`);
        storeCache.set(cacheKey, existing);
        return existing;
    } catch (err: any) {
        if (err?.message?.includes('fetch failed')) {
            console.warn(`[vectorStore] Qdrant fetch failed for '${collectionName}', using in-memory store fallback.`);
            const mem = await MemoryVectorStore.fromTexts([], [], embeddings);
            storeCache.set(cacheKey, mem);
            return mem;
        }
        console.info(`[vectorStore] Creating new collection '${collectionName}' (user='${uid}', doc='${did}'). Reason: ${err?.message || err}`);
        try {
            const created = await QdrantVectorStore.fromDocuments([], embeddings, {
                client: qdrantClient,
                collectionName,
            });
            console.log(`[vectorStore] Created new collection '${collectionName}'.`);
            storeCache.set(cacheKey, created);
            return created;
        } catch (inner: any) {
            console.error(`[vectorStore] Failed to create collection '${collectionName}'. Falling back to in-memory.`, inner?.message || inner);
            const mem = await MemoryVectorStore.fromTexts([], [], embeddings);
            storeCache.set(cacheKey, mem);
            return mem;
        }
    }
}

export function clearUserVectorStore(userId?: string | null, docId?: string | null) {
    const uid = normalizeUserId(userId);
    if (docId) {
        storeCache.delete(`${uid}::${sanitizeId(docId)}`);
    } else {
        // clear all docs for user
        for (const key of Array.from(storeCache.keys())) {
            if (key.startsWith(`${uid}::`)) storeCache.delete(key);
        }
    }
}

export function getUserVectorStore(userId?: string | null, docId?: string | null) {
    const uid = normalizeUserId(userId);
    if (docId) return storeCache.get(`${uid}::${sanitizeId(docId)}`) || null;
    return null;
}

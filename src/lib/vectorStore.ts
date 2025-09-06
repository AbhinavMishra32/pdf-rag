import { QdrantVectorStore } from "@langchain/qdrant";
import { embeddings, qdrantClient } from "./vectordb";

// Simple lazy singleton. Call vectorStore() to get the instance.
let _store: QdrantVectorStore | null = null;

export async function vectorStore(): Promise<QdrantVectorStore> {
    if (_store) return _store;
    _store = await QdrantVectorStore.fromExistingCollection(embeddings, {
        client: qdrantClient ?? undefined,
        collectionName: "pdf-collection",
    });
    return _store;
}

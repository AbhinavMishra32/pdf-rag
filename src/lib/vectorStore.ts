import { QdrantVectorStore } from "@langchain/qdrant";
import { embeddings, qdrantClient } from "./vectordb";

export const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client: qdrantClient ?? undefined,
    collectionName: "pdf-collection",
});

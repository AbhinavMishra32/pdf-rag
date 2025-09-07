import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantClient } from "@qdrant/js-client-rest";

if (!process.env.QDRANT_URL) {
    console.warn('QDRANT_URL not set – Qdrant client will not be initialized.');
}

function createClient() {
	const url = process.env.QDRANT_URL;
	if (!url) return null;
	return new QdrantClient({
		url,
		apiKey: process.env.QDRANT_API_KEY,
		checkCompatibility: false as any,
	});
}

export const embeddings = new OpenAIEmbeddings(process.env.OPENAI_API_KEY ? { openAIApiKey: process.env.OPENAI_API_KEY, model: 'text-embedding-3-small' } : {});

export const qdrantClient = createClient();
export type OptionalQdrantClient = QdrantClient

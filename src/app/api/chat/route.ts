import { vectorStore } from "@/lib/vectorStore";
import OpenAI from 'openai';

export async function GET(request: Request) {
    const userQuery = "what is priority queue?";
    const store = await vectorStore();
    const sources = await store.similaritySearch(userQuery);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const SYSTEM_PROMPT = `You are a helpful AI assistant. Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

    Context:
    ${sources.map(result => `- ${result}`).join("\n")}

    Question:
    ${userQuery}
    `;

    const chatResult = await client.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userQuery }
        ]
    });

    return new Response(JSON.stringify({ message: chatResult.choices[0].message.content, source: sources}), {
        headers: { "Content-Type": "application/json" },
    });
}
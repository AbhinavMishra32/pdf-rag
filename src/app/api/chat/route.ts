import { vectorStore } from "@/lib/vectorStore";
import OpenAI from 'openai';
export async function POST(request: Request) {
    const { question } = await request.json().catch(() => ({}));
    const userQuery = typeof question === 'string' ? question.trim() : '';

    if (!userQuery) {
        return new Response(JSON.stringify({
            message: 'No valid question provided.',
            sources: []
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 400
        });
    }

    const store = await vectorStore();
    const docs = await store.similaritySearch(userQuery, 4);

    const sources = docs.map((d: any, i: number) => {
        const meta = d?.metadata || {};
        const page = meta.loc?.pageNumber ?? meta.page ?? null;
        return {
            doc: i + 1,
            page,
            snippet: (d.pageContent || '').slice(0, 300)
        };
    });

    const contextText = sources
        .map(s => `[Doc ${s.doc}${s.page !== null ? ` p${s.page}` : ''}] ${s.snippet}`)
        .join('\n');

    const systemPrompt = `You are a helpful assistant. Only use the context below. If you don't see the answer, say you don't know.\n\nContext:\n${contextText}\n\nQuestion: ${userQuery}`;

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const chat = await client.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userQuery }
        ]
    });

    return new Response(JSON.stringify({
        message: chat.choices[0].message.content,
        sources
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

import { vectorStore } from "@/lib/vectorStore";
import OpenAI from "openai";

type HistoryItem = { role: 'user' | 'assistant'; text: string };

export async function POST(request: Request) {
    const { question, userId, history } = await request.json().catch(() => ({}));
    const q = typeof question === 'string' ? question.trim() : '';
    const historyItems: HistoryItem[] = Array.isArray(history)
        ? history.filter((h: any) => (h?.role === 'user' || h?.role === 'assistant') && typeof h?.text === 'string').slice(-12)
        : [];

    if (!q) {
        return new Response(JSON.stringify({ message: 'No question provided', sources: [] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const store = await vectorStore(userId);
        const results = await store.similaritySearchWithScore(q, 8);
        const sorted = results.sort((a,b)=> (a[1]??0) - (b[1]??0)).slice(0,5);
        const sources = sorted.map(([doc,_score],i)=>{
            const meta = doc.metadata || {}; const page = meta.loc?.pageNumber ?? meta.page ?? null;
            return { doc: i+1, page, snippet: (doc.pageContent||'').slice(0,400) };
        });
        const context = sources.map(s=>`[Doc ${s.doc}${s.page?` p${s.page}`:''}] ${s.snippet}`).join('\n');
        const systemPrompt = `Use only the provided snippets. Cite like [Doc 2 p5]. If answer not present say: I don't know based on the stored documents.\n\nSnippets:\n${context}\n\nQuestion: ${q}`;

        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const past = historyItems.map(h=>({ role: h.role, content: h.text })).slice(-6);
        const stream = await client.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-5-mini',
            messages: [ { role:'system', content: systemPrompt }, ...past, { role:'user', content: q } ],
            stream: true,
            temperature: 0.2,
        });

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                // send meta first
                controller.enqueue(encoder.encode(JSON.stringify({ type:'meta', sources }) + '\n'));
                try {
                    for await (const part of stream) {
                        const delta = part.choices?.[0]?.delta?.content;
                        if (delta) controller.enqueue(encoder.encode(JSON.stringify({ type:'chunk', delta }) + '\n'));
                    }
                    controller.enqueue(encoder.encode(JSON.stringify({ type:'done' }) + '\n'));
                } catch (e:any) {
                    controller.enqueue(encoder.encode(JSON.stringify({ type:'error', error: e?.message || String(e) }) + '\n'));
                } finally {
                    controller.close();
                }
            }
        });
        return new Response(readable, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    } catch (err:any) {
        return new Response(JSON.stringify({ message:'Error generating response', error: String(err) }), { status:500, headers:{'Content-Type':'application/json'} });
    }
}
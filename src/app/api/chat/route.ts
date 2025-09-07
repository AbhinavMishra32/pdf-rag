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
        const start = Date.now();
        console.log('[chat] incoming question:', q);
        const store = await vectorStore(userId);
        console.log('[chat] vector store ready');
        const results = await store.similaritySearchWithScore(q, 8);
        console.log('[chat] raw results:', results.length);
        const sorted = results.sort((a,b)=> (a[1]??0) - (b[1]??0)).slice(0,5);
        const sources = sorted.map(([doc,score],i)=>{
            const meta = doc.metadata || {}; const page = meta.loc?.pageNumber ?? meta.page ?? null;
            return { doc: i+1, page, snippet: (doc.pageContent||'').slice(0,400), score };
        });
        console.log('[chat] prepared sources:', sources.map(s=>({doc:s.doc,page:s.page,len:s.snippet.length,score:s.score})));        
        const context = sources.map(s=>`[Doc ${s.doc}${s.page?` p${s.page}`:''}] ${s.snippet}`).join('\n');
        const systemPrompt = `Use only the provided snippets. Cite like [Doc 2 p5]. If answer not present say: I don't know based on the stored documents.\n\nSnippets:\n${context}\n\nQuestion: ${q}`;

        const rawModel = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
        // Fallback if user sets an invalid/experimental model id
        const model = rawModel.trim() === '' ? 'gpt-4.1-mini' : rawModel;
        const supportsTuning = !/^gpt-5/i.test(model); // heuristic: gpt-5-* currently rejects temperature changes
        console.log('[chat] using model:', model, 'supportsTuning:', supportsTuning);
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const past = historyItems.map(h=>({ role: h.role, content: h.text })).slice(-6);
        console.log('[chat] past messages count:', past.length);
        const baseRequest: any = {
            model,
            messages: [ { role:'system', content: systemPrompt }, ...past, { role:'user', content: q } ],
            stream: true,
        };
        if (supportsTuning) baseRequest.temperature = 0.2;
        console.log('[chat] openai request keys:', Object.keys(baseRequest));
        const streamResp = await client.chat.completions.create(baseRequest);
        const asyncIterable = (streamResp as any)[Symbol.asyncIterator] ? streamResp as any : null;
        if (!asyncIterable) {
            console.log('[chat] Streaming not supported by model or SDK for this call; returning single chunk');
        } else {
            console.log('[chat] OpenAI stream started');
        }

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                // send meta first
                                controller.enqueue(encoder.encode(JSON.stringify({ type:'meta', sources }) + '\n'));
                try {
                    if (asyncIterable) {
                        for await (const part of asyncIterable) {
                            const delta = part.choices?.[0]?.delta?.content;
                            if (delta) {
                              controller.enqueue(encoder.encode(JSON.stringify({ type:'chunk', delta }) + '\n'));
                            }
                        }
                    } else {
                        const full = streamResp.choices?.[0]?.message?.content || '';
                        controller.enqueue(encoder.encode(JSON.stringify({ type:'chunk', delta: full }) + '\n'));
                    }
                    controller.enqueue(encoder.encode(JSON.stringify({ type:'done' }) + '\n'));
                } catch (e:any) {
                                        console.error('[chat] stream error:', e?.message || e);
                    controller.enqueue(encoder.encode(JSON.stringify({ type:'error', error: e?.message || String(e) }) + '\n'));
                } finally {
                                        console.log('[chat] finished in ms:', Date.now()-start);
                    controller.close();
                }
            }
        });
        return new Response(readable, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    } catch (err:any) {
                console.error('[chat] top-level error:', err?.message || err);
        return new Response(JSON.stringify({ message:'Error generating response', error: String(err) }), { status:500, headers:{'Content-Type':'application/json'} });
    }
}
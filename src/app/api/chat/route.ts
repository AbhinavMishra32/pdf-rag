import { vectorStore } from "@/lib/vectorStore";
import OpenAI from "openai";

type HistoryItem = { role: 'user' | 'assistant'; text: string };

export async function POST(request: Request) {
    const { question, userId, history } = await request.json().catch(() => ({}));
    const userQuery = typeof question === "string" ? question.trim() : "";
    const historyItems: HistoryItem[] = Array.isArray(history)
        ? history.filter((h: any) => (h?.role === 'user' || h?.role === 'assistant') && typeof h?.text === 'string').slice(-12)
        : [];

    if (!userQuery) {
        return new Response(
            JSON.stringify({
                message: "No valid question provided.",
                sources: [],
            }),
            {
                headers: { "Content-Type": "application/json" },
                status: 400,
            }
        );
    }

    try {
    const store = await vectorStore(userId);
        const results = await store.similaritySearchWithScore(userQuery, 8);

        const sorted = results.sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0));
        const top = sorted.slice(0, 5);

        const sources = top.map(([doc, score], i) => {
            const meta = doc?.metadata || {};
            const page = meta.loc?.pageNumber ?? meta.page ?? null;
            return {
                doc: i + 1,
                page,
                snippet: (doc.pageContent || "").slice(0, 400),
                score: typeof score === "number" ? Number(score.toFixed(4)) : null,
            };
        });

        const contextText = sources.length
            ? sources
                .map(
                    (s) =>
                        `[Doc ${s.doc}${s.page !== null ? ` p${s.page}` : ""}] ${s.snippet}`
                )
                .join("\n")
            : "(no snippets)";

        const systemPrompt = `Answer the question using the text in the snippets below.
When you use information from a snippet, cite it inline right after that sentence like [Doc 2 p63].
Write a concise but complete answer that may synthesize across multiple snippets.

Snippets:
${contextText}

Question: ${userQuery}`;

        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const pastMessages = historyItems.map(h => ({ role: h.role, content: h.text })).slice(-8); // trim to avoid context bloat
        const chat = await client.chat.completions.create({
            model: "",
            messages: [
                { role: "system", content: systemPrompt },
                ...pastMessages,
                { role: "user", content: userQuery },
            ],
        });

        const answer = chat.choices[0].message?.content?.trim() || "";

        const citedDocs = new Set<number>();
        const citationRegex = /\[Doc\s+(\d+)/g;
        let match;
        while ((match = citationRegex.exec(answer)) !== null) {
            citedDocs.add(Number(match[1]));
        }
        const citedSources = sources.filter((s) => citedDocs.has(s.doc));

        return new Response(
            JSON.stringify({
                message: answer,
                sources: citedSources.length ? citedSources : sources, // fallback: return all if none cited
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (err: any) {
        return new Response(
            JSON.stringify({
                message: "Error generating response.",
                error: String(err),
                sources: [],
            }),
            {
                headers: { "Content-Type": "application/json" },
                status: 500,
            }
        );
    }
}
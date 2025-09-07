## pdf-rag

A small RAG (Retrieval Augmented Generation) playground for PDF documents.

Tech: Next.js (App Router) + In-memory queue + Qdrant (optional) + OpenAI embeddings + Clerk auth.

### What it does
1. Upload a PDF → job queued (in-memory) → processor splits pages into chunks.
2. Chunks stored in Qdrant (or in-memory fallback if no Qdrant configured).
3. Chat UI retrieves relevant chunks and streams an answer with citations.

---
### Features
- PDF upload + chunking (recursive splitter)
- Background processing via embedded in-memory processor
- Embeddings with OpenAI (text-embedding-3-small)
- Vector store: Qdrant or in-memory fallback
- Streaming chat answers with simple citation format
- Clerk-based auth (guarded endpoints)
- Cloud Run ready (combined or split worker mode)

---
### Repo layout (key parts)
```
src/app/api/upload/route.ts    -> enqueue PDF processing job
src/workers/worker.ts          -> registers in-memory processor
src/lib/vectorStore.ts         -> vector store abstraction (Qdrant or memory)
src/lib/worker-autostart.ts    -> optional embedded worker startup
start-cloud-run.sh             -> entrypoint (web only; processor embedded)
```

---
### Environment variables

Required for full functionality:
- `OPENAI_API_KEY` – for embeddings + chat
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` – auth

Optional:
- `QDRANT_URL` + `QDRANT_API_KEY` – persistent vector store
- `OPENAI_MODEL` – override chat model (default `gpt-4.1-mini`)

No Qdrant? It falls back to an in-memory vector store (ephemeral per instance).

---
### Local development
```bash
cp .env.local.example .env.local   # create one if you like (provide keys)
npm install
npm run dev
```
Open http://localhost:3000

Queue is in-memory; no Redis needed.

---
### Worker mode
Single embedded processor. For horizontal scale with deduped processing you'd need an external queue (future enhancement).

---
### Cloud Run deployment
Build:
```bash
gcloud builds submit --tag gcr.io/$(gcloud config get-value project)/pdf-rag
```

Deploy (basic):
```bash
gcloud run deploy pdf-rag \
	--image gcr.io/$(gcloud config get-value project)/pdf-rag \
	--region us-central1 --platform managed \
	--allow-unauthenticated \
	--port 8080 \
	--set-env-vars OPENAI_API_KEY=sk-...,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...,CLERK_SECRET_KEY=sk_... \
	--set-env-vars QDRANT_URL=https://...,QDRANT_API_KEY=... 
```

Keep worker always alive (optional but recommended):
```bash
gcloud run deploy pdf-rag --image gcr.io/$(gcloud config get-value project)/pdf-rag \
	--region us-central1 --platform managed \
	--allow-unauthenticated --port 8080 \
	--min-instances=1 --no-cpu-throttling \
	--set-env-vars ...
```

Health check endpoint: `/api/health`

---
### Troubleshooting
| Issue | Cause | Fix |
|-------|-------|-----|
| Build fails: missing `@tailwindcss/postcss` | Tailwind plugin pruned | We moved it to dependencies (pull latest) |
| Build fails: Clerk publishable key missing | Prerender tried to access Clerk | Key not set or rely on dynamic mode (already configured) |
| Worker seems idle | No jobs submitted | Upload a PDF |
| No vectors persisted | No Qdrant configured | Set `QDRANT_URL` + `QDRANT_API_KEY` |

Log phrases to search:
- `Processing job` – processor handled a PDF
- `[vectorStore]` – vector storage actions

---
### Security / Secrets
Use Secret Manager (`--set-secrets`) instead of inline env for: Clerk secret, OpenAI key, Qdrant key. Rotate if exposed.

---
### Future ideas
- Reintroduce external queue (Redis/PubSub) for distributed processing
- Add tests for vector store + worker path
- Add chunk metadata browsing UI

---
### License
Add a license file (MIT, Apache 2.0, etc.) if you plan to share publicly.

---
### Quick start (TL;DR)
```bash
npm install
OPENAI_API_KEY=sk-... NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_... CLERK_SECRET_KEY=sk_... npm run dev
```

Upload a PDF → wait for job completion → ask questions.

---
PRs welcome.

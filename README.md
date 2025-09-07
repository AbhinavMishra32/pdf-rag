## pdf-rag

A small RAG (Retrieval Augmented Generation) playground for PDF documents.

Tech: Next.js (App Router) + BullMQ + Redis (Upstash/Valkey) + Qdrant (optional) + OpenAI embeddings + Clerk auth.

### What it does
1. Upload a PDF → job queued → worker splits pages into chunks.
2. Chunks stored in Qdrant (or in-memory fallback if no Qdrant configured).
3. Chat UI retrieves relevant chunks and streams an answer with citations.

---
### Features
- PDF upload + chunking (recursive splitter)
- Background processing via BullMQ worker
- Embeddings with OpenAI (text-embedding-3-small)
- Vector store: Qdrant or in-memory fallback
- Streaming chat answers with simple citation format
- Clerk-based auth (guarded endpoints)
- Cloud Run ready (combined or split worker mode)

---
### Repo layout (key parts)
```
src/app/api/upload/route.ts    -> enqueue PDF processing job
src/workers/worker.ts          -> BullMQ worker
src/lib/vectorStore.ts         -> vector store abstraction (Qdrant or memory)
src/lib/worker-autostart.ts    -> optional embedded worker startup
start-cloud-run.sh             -> entrypoint starting web + worker
```

---
### Environment variables

Required for full functionality:
- `UPSTASH_REDIS_URL` (or `REDIS_URL`) – Redis/Valkey URL (BullMQ)
- `OPENAI_API_KEY` – for embeddings + chat
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` – auth

Optional:
- `QDRANT_URL` + `QDRANT_API_KEY` – persistent vector store
- `OPENAI_MODEL` – override chat model (default `gpt-4.1-mini`)
- `AUTO_START_WORKER=0` – disable embedded worker

No Qdrant? It falls back to an in-memory vector store (ephemeral per instance).

---
### Local development
```bash
cp .env.local.example .env.local   # create one if you like (provide keys)
npm install
docker compose up -d valkey        # optional if you want local Redis instead of Upstash
npm run dev
```
Open http://localhost:3000

Queue uses `UPSTASH_REDIS_URL` first; for local valkey set:
```
REDIS_URL=redis://localhost:6379
```

Run worker separately (in another terminal) if you want to isolate logs:
```bash
npm run worker
```

---
### Worker modes
1. Combined (default Cloud Run) – `start-cloud-run.sh` spawns worker + web.
2. Embedded – import side‑effect (`worker-autostart.ts`) starts worker on first request.
3. Split services – deploy a second Cloud Run service running only `npm run worker`.

Recommended for production scale: split services with `--min-instances=1` on the worker and `--no-cpu-throttling` so it can poll.

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
	--set-env-vars UPSTASH_REDIS_URL=rediss://... \
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

Split worker:
```bash
gcloud run deploy pdf-rag-worker \
	--image gcr.io/$(gcloud config get-value project)/pdf-rag \
	--command "npm" --args "run","worker" \
	--region us-central1 --platform managed \
	--min-instances=1 --no-allow-unauthenticated \
	--no-cpu-throttling \
	--set-env-vars UPSTASH_REDIS_URL=rediss://...,OPENAI_API_KEY=sk-... 
```

Health check endpoint: `/api/health`

---
### Troubleshooting
| Issue | Cause | Fix |
|-------|-------|-----|
| Build fails: missing `@tailwindcss/postcss` | Tailwind plugin pruned | We moved it to dependencies (pull latest) |
| Build fails: Clerk publishable key missing | Prerender tried to access Clerk | Key not set or rely on dynamic mode (already configured) |
| Queue errors: Redis not configured | Missing `UPSTASH_REDIS_URL` | Set env var or run local Redis and set `REDIS_URL` |
| Worker seems idle | Instance scaled to zero or no min instance | Set `--min-instances=1` or rely on embedded autostart |
| No vectors persisted | No Qdrant configured | Set `QDRANT_URL` + `QDRANT_API_KEY` |

Log phrases to search:
- `Processing job` – worker processed a PDF
- `[vectorStore]` – vector storage actions
- `[worker-autostart]` – embedded worker startup

---
### Security / Secrets
Use Secret Manager (`--set-secrets`) instead of inline env for: Clerk secret, OpenAI key, Qdrant key, Redis URL. Rotate if exposed.

---
### Future ideas
- Replace BullMQ with Pub/Sub / Cloud Tasks for true scale-to-zero
- Add tests for vector store + worker path
- Add chunk metadata browsing UI

---
### License
Add a license file (MIT, Apache 2.0, etc.) if you plan to share publicly.

---
### Quick start (TL;DR)
```bash
npm install
REDIS_URL=redis://localhost:6379 OPENAI_API_KEY=sk-... NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_... CLERK_SECRET_KEY=sk_... npm run dev
npm run worker  # separate terminal (optional locally)
```

Upload a PDF → wait for job completion → ask questions.

---
PRs welcome.

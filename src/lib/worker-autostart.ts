// starts the worker inside the web process if a separate worker isn't running.

import '../load-env.js';

declare global {
  var __PDF_RAG_WORKER_STARTED__: boolean | undefined;
}

function shouldStart() {
  if (process.env.AUTO_START_WORKER === '0' || process.env.ENABLE_EMBEDDED_WORKER === '0') return false;
  if (typeof window !== 'undefined') return false;
  return true;
}

(async () => {
  if (!shouldStart()) return;
  if (global.__PDF_RAG_WORKER_STARTED__) return;
  global.__PDF_RAG_WORKER_STARTED__ = true;
  try {
  console.log('[worker-autostart] starting embedded worker');
    await import('../workers/worker');
  console.log('[worker-autostart] started');
  } catch (e: any) {
  global.__PDF_RAG_WORKER_STARTED__ = false;
  console.error('[worker-autostart] failed:', e?.message || e);
  }
})();

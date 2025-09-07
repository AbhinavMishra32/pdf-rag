// In-memory queue replacement (no Redis dependency)
// Provides minimal subset of BullMQ API used by the app: add(), getJob(id)
// and events: 'active','completed','failed'.
import { inMemoryQueue } from './inmemory-queue';

export const myQueue = {
  add: (name: string, data: any) => inMemoryQueue.add(name, data),
  getJob: async (id: string) => inMemoryQueue.getJob(id),
  // compatibility shim: event subscription for SSE/status polling
  on: (evt: string, handler: any) => { inMemoryQueue.on(evt, handler); return myQueue; },
  off: (evt: string, handler: any) => { inMemoryQueue.off(evt, handler); return myQueue; }
} as any;

// For code that imported 'connection' just provide undefined; SSE route will be adapted.
export const connection: any = undefined;
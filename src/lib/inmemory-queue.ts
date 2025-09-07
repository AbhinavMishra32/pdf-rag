import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export interface InMemoryJob<Data = any, ReturnValue = any> {
  id: string;
  name: string;
  data: Data;
  returnvalue?: ReturnValue;
  failedReason?: string;
  state: 'waiting' | 'active' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
}

export type Processor<Data = any, ReturnValue = any> = (job: InMemoryJob<Data, ReturnValue>) => Promise<ReturnValue> | ReturnValue;

class InMemoryQueue extends EventEmitter {
  private jobs: Map<string, InMemoryJob> = new Map();
  private waiting: string[] = [];
  private processing = false;
  private processor: Processor | null = null;

  constructor(public readonly name: string) { super(); }

  setProcessor(p: Processor) { this.processor = p; this.run(); }

  async add(name: string, data: any) {
    const id = randomUUID();
    const job: InMemoryJob = { id, name, data, state: 'waiting', createdAt: Date.now(), updatedAt: Date.now() };
    this.jobs.set(id, job);
    this.waiting.push(id);
    this.emit('waiting', { jobId: id });
    this.run();
    return job;
  }

  getJob(id: string) { return this.jobs.get(id) || null; }

  private async run() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.waiting.length && this.processor) {
        const id = this.waiting.shift()!;
        const job = this.jobs.get(id);
        if (!job) continue;
        job.state = 'active';
        job.updatedAt = Date.now();
        this.emit('active', { jobId: id });
        try {
          const ret = await this.processor(job);
          job.returnvalue = ret;
          job.state = 'completed';
          job.updatedAt = Date.now();
          this.emit('completed', { jobId: id, returnvalue: ret });
        } catch (e: any) {
          job.failedReason = e?.message || String(e);
            job.state = 'failed';
          job.updatedAt = Date.now();
          this.emit('failed', { jobId: id, failedReason: job.failedReason });
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

export const inMemoryQueue = new InMemoryQueue('file-upload-queue');

export function registerProcessor(p: Processor) { inMemoryQueue.setProcessor(p); }

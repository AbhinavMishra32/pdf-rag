import { Queue } from 'bullmq';
import Redis from 'ioredis';

let _connection: Redis | undefined;
let _queue: Queue | undefined;

function createConnection(): Redis | undefined {
  const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;
  if (!redisUrl) return undefined;
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

export function getRedisConnection(): Redis | undefined {
  if (_connection) return _connection;
  _connection = createConnection();
  if (!_connection) console.warn('[queue] Redis URL not configured');
  return _connection;
}

export function getQueue(): Queue | undefined {
  if (_queue) return _queue;
  const conn = getRedisConnection();
  if (!conn) return undefined;
  _queue = new Queue('file-upload-queue', { connection: conn });
  return _queue;
}

export const myQueue = new Proxy({}, {
  get(_t, prop: string) {
    const q = getQueue();
    if (!q) {
      throw new Error(`[queue] Cannot use queue method '${prop}' – Redis not configured.`);
    }
    // @ts-ignore dynamic access
    return q[prop].bind(q);
  }
}) as unknown as Queue;

export const connection = new Proxy({}, {
  get(_t, prop: string) {
    const c = getRedisConnection();
    if (!c) {
      throw new Error(`[queue] Cannot access Redis connection property '${prop}' – Redis not configured.`);
    }
    // @ts-ignore
    return c[prop];
  }
}) as unknown as Redis;
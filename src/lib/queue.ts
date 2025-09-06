import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('Missing UPSTASH_REDIS_URL or REDIS_URL');
}

export const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
export const myQueue = new Queue('file-upload-queue', { connection });
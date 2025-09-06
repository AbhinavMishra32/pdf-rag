import { Queue } from "bullmq";
import { Redis } from 'ioredis';

export const connection = new Redis(process.env.UPSTASH_REDIS_REST_URL!, {
  maxRetriesPerRequest: null,  // required for BullMQ
});

export const myQueue = new Queue('file-upload-queue', { connection });
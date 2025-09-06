import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { connection } from '@/lib/queue';

const worker = new Worker('file-upload-queue', async job => {
    // const { foo, ts } = job.data || {};
    // console.log(`job: ${job.id} starting (foo=${foo}, ts=${ts})`);
    // await new Promise(r => setTimeout(r, 2000));
    // console.log(`job: ${job.id} finished after 2s`);
    console.log(`Processing job ${job.id} of type ${job.name}: `, job.data);
    return { received: job.data, simulatedDurationMs: 2000 };
}, { connection });

worker.on('completed', job => {
    console.log(`Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} has failed with error ${err.message}`);
});

console.log('Worker is running and waiting for jobs...');

// Keep the worker running
process.stdin.resume();

export default worker;
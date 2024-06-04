import { createClient } from 'redis';

export const redis = createClient();
redis
  .on('error', (err) => {
    if (error.code === 'ECONNREFUSED') {
      console.error(
        `Redis client connection error. Start Redis on port ${error.port} before running.`
      );
    } else {
      console.error('Redis client:', error);
    }
  })
  .connect();

/**
 * Builds a search index from all word entries as a sorted set.
 */
export async function buildIndex() {
  console.time('buildIndex');
  console.log('Building search index...');

  const BATCH_SIZE = 100000;
  const SORTED_SET_KEY = 'keys';
  const promises = [];
  const keys = await redis.keys('*');
  let processed = 0;

  await redis.del(SORTED_SET_KEY);

  while (keys.length) {
    const batch = keys.splice(0, BATCH_SIZE);
    await Promise.all(
      batch.map((key) => redis.zAdd(SORTED_SET_KEY, { score: 0, value: key }))
    );
    processed += batch.length;
    console.log(`Added ${processed} keys to set '${SORTED_SET_KEY}'`);
  }

  console.timeEnd('buildIndex');
}

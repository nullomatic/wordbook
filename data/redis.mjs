import { createClient } from 'redis';

export const client = createClient();
client.on('error', (err) => console.log('Redis Client Error', err)).connect();

/**
 * Builds a search index from all word entries as a sorted set.
 */
export async function buildIndex() {
  console.time('buildIndex');
  console.log('Building search index...');

  const BATCH_SIZE = 100000;
  const SORTED_SET_KEY = 'keys';
  const promises = [];
  const keys = await client.keys('*');
  let processed = 0;

  await client.del(SORTED_SET_KEY);

  while (keys.length) {
    const batch = keys.splice(0, BATCH_SIZE);
    await Promise.all(
      batch.map((key) => client.zAdd(SORTED_SET_KEY, { score: 0, value: key }))
    );
    processed += batch.length;
    console.log(`Added ${processed} keys to set '${SORTED_SET_KEY}'`);
  }

  console.timeEnd('buildIndex');
}

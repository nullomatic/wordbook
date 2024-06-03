import { createClient } from 'redis';

const client = createClient();
client.on('error', (err) => console.log('Redis Client Error', err)).connect();

export async function POST(request: Request) {
  const input = await request.text();

  const pattern_EN = `en:${input}`;
  const pattern_AN = `an:${input}`;
  const promises = [];
  promises.push(zRange(pattern_EN), zRange(pattern_AN));
  let [results_EN, results_AN] = await Promise.all(promises);

  results_EN = results_EN.filter((str) => !!str.startsWith(pattern_EN));
  results_AN = results_AN.filter((str) => !!str.startsWith(pattern_AN));
  const results = [...results_EN, ...results_AN]
    .sort((a, b) => a.substring(3).localeCompare(b.substring(3)))
    .slice(0, 10);

  console.log(`${pattern_EN.substring(3)}`);
  console.log(results);

  return Response.json(results);
}

function zRange(pattern: string) {
  const key = 'keys';
  return client.zRangeByLex(key, `[${pattern}`, '+', {
    LIMIT: { offset: 0, count: 10 },
  });
}

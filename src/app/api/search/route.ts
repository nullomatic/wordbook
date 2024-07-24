import { createClient } from 'redis';

const client = createClient();
client.on('error', (err) => console.log('Redis Client Error', err)).connect();

export async function POST(request: Request) {
  const input = await request.text();

  const pattern = `${input}`;
  const results = await zRange(pattern);
  const resultsFormatted = results.map((str) => {
    const [, word, parts, langs] = str.split(':');
    return { word, parts: parts.split(','), langs: langs.split(',') };
  });
  console.log('resultsFormatted:', resultsFormatted);
  return Response.json(resultsFormatted);
}

function zRange(pattern: string) {
  const key = 'search_index';
  return client.zRangeByLex(key, `[${pattern}`, '+', {
    LIMIT: { offset: 0, count: 10 },
  });
}

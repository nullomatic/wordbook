import { POS, searchIndexDelimiter } from '@/lib/constants';
import { SearchResult } from '@/lib/types';
import { createClient } from 'redis';

const client = createClient();
client.on('error', (err) => console.log('Redis Client Error', err)).connect();

export async function POST(request: Request) {
  const input = await request.text();
  const results = await zRange(input.toLowerCase());
  const resultsFormatted: SearchResult[] = results.map((str) => {
    const [_lowercase, word, parts, langs] = str.split(searchIndexDelimiter);
    return {
      word,
      parts: parts.split(',') as POS[],
      isAnglish: langs.includes('an'),
    };
  });
  return Response.json(resultsFormatted);
}

function zRange(pattern: string) {
  const key = 'search_index';
  return client.zRangeByLex(
    key,
    `[${pattern}`,
    `[${pattern}${String.fromCharCode(255)}`,
    {
      LIMIT: { offset: 0, count: 10 },
    }
  );
}

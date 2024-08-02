import * as fs from 'fs';
import _ from 'lodash';
import * as pg from 'pg';
import { DatabaseClient } from './client';
import { POS } from './types';
import { getFiles } from './util';

class Query {
  public static template: { [key: string]: string } = Query.loadTemplates();
  private constructor() {}
  private static loadTemplates() {
    const template: { [key: string]: string } = {};
    const files = getFiles('sql/query.*.sql');
    for (const { filename, path } of files) {
      const key = filename.split('.')[1];
      const text = fs.readFileSync(path, 'utf-8');
      template[key] = text;
    }
    return template;
  }
}

type WordData = {
  word: string;
  origins: string[];
  rhyme: string;
  isAnglish: boolean;
  pos: Record<POS, { forms: string[]; def: string }[]>;
};

export async function getDefinitions(word: string) {
  const client = await DatabaseClient.getClient();
  const wordClean = pg.escapeLiteral(word);
  const sql = Query.template['definitions'].replaceAll('%word', wordClean);
  const res = await client.query(sql);
  if (!res.rows.length) {
    return null;
  }
  const first = res.rows[0];
  const data: WordData = {
    word: first.word,
    origins: first.origins,
    rhyme: first.rhyme,
    isAnglish: first.is_anglish,
    pos: {} as any,
  };
  for (const sense of res.rows) {
    const pos: POS = sense.pos;
    if (!data.pos[pos]) {
      data.pos[pos] = [];
    }
    data.pos[pos].push(_.pick(sense, ['forms', 'def']));
  }
  return data;
}

export async function getAnglishSynonyms(
  entry: WordData
): Promise<{ [pos in POS]: string[] } | null> {
  const client = await DatabaseClient.getClient();
  const wordClean = pg.escapeLiteral(entry.word);
  const synonyms: { [pos in POS]: string[] } = {} as { [pos in POS]: string[] };
  for (const pos in entry.pos) {
    const posClean = pg.escapeLiteral(pos);
    const sql = Query.template['synonyms']
      .replaceAll('%word', wordClean)
      .replaceAll('%pos', posClean);
    // console.log(sql);
    const res = await client.query(sql);
    if (res.rows?.length) {
      synonyms[pos as POS] = res.rows.map(({ word }) => word);
    }
  }
  return synonyms;
}

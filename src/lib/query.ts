import _ from 'lodash';
import * as pg from 'pg';
import { DatabaseClient } from './client';
import { POS } from './constants';
import * as util from './util';

export class Query {
  public static template: Record<string, string> | null = Query.loadTemplates();

  private constructor() {}

  private static loadTemplates() {
    if (process.env.NODE_ENV === 'development') {
      // If development, reload template file on every query.
      return null;
    }
    const template: { [key: string]: string } = {};
    const files = util.getFiles('sql/query.*.sql');
    for (const { filename, path } of files) {
      const key = filename.split('.')[1];
      const text = util.readFile(path);
      template[key] = text;
    }
    return template;
  }

  public static getTemplate(id: string) {
    return this.template?.[id] || util.readFile(`sql/query.${id}.sql`);
  }

  public static async definitions(word: string) {
    const client = await DatabaseClient.getClient();
    const wordClean = pg.escapeLiteral(word);
    const template = this.getTemplate('definitions');
    const sql = template.replaceAll('%word', wordClean);
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
      data.pos[pos].push(sense);
    }
    return data;
  }

  public static async synonyms(entry: WordData) {
    type Synonyms = { [pos in POS]: { english: string[]; anglish: string[] } };

    const synonyms: Synonyms = {} as Synonyms;
    const client = await DatabaseClient.getClient();
    const wordClean = pg.escapeLiteral(entry.word);

    let pos: POS;
    for (pos in entry.pos) {
      synonyms[pos] = { english: [], anglish: [] };
      const posClean = pg.escapeLiteral(pos);
      const sqlTemplate = this.getTemplate('synonyms');
      const sql = sqlTemplate
        .replaceAll('%word', wordClean)
        .replaceAll('%pos', posClean);
      const res = await client.query(sql);
      if (res.rows?.length) {
        for (const { word, is_anglish } of res.rows) {
          synonyms[pos][is_anglish ? 'anglish' : 'english'].push(word);
        }
      }
    }
    return synonyms;
  }
}

type WordData = {
  word: string;
  origins: string[];
  rhyme: string;
  isAnglish: boolean;
  pos: Record<
    POS,
    { forms: string[]; gloss: string; sentence: string | null }[]
  >;
};

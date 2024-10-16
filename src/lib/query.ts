import _ from "lodash";
import * as pg from "pg";
import { DatabaseClient, RedisClient } from "./client";
import { POS, searchIndexDelimiter } from "./constants";
import * as util from "./util";
import { SearchResult, WordEntry, WordSchema } from "./types";

export class Query {
  public static template: Record<string, string> | null = Query.loadTemplates();

  private constructor() {}

  private static loadTemplates() {
    if (process.env.NODE_ENV === "development") {
      // If development, reload template file on every query.
      return null;
    }
    const template: { [key: string]: string } = {};
    const files = util.getFiles("sql/query.*.sql");
    for (const { filename, path } of files) {
      const key = filename.split(".")[1];
      const text = util.readFile(path);
      template[key] = text;
    }
    return template;
  }

  public static getTemplate(id: string) {
    return this.template?.[id] || util.readFile(`sql/query.${id}.sql`);
  }

  public static async search(input: string) {
    const client = await RedisClient.getClient();
    const lower = input.toLowerCase();
    const key = "search_index";
    const results = await client.zRangeByLex(
      key,
      `[${lower}`,
      `[${lower}${String.fromCharCode(255)}`,
      {
        LIMIT: { offset: 0, count: 10 },
      },
    );

    const resultsFormatted: SearchResult[] = results.map((str: string) => {
      const [_lowercase, word, parts, langs] = str.split(searchIndexDelimiter);
      return {
        word,
        parts: parts.split(",") as POS[],
        isAnglish: langs.includes("an"),
      };
    });

    return resultsFormatted;
  }

  public static async definitions(word: string) {
    const wordClean = pg.escapeLiteral(word);
    const template = this.getTemplate("definitions");
    const sql = template.replaceAll("<word>", wordClean);
    const res = await DatabaseClient.query(sql);
    if (!res.rows.length) {
      return null;
    }
    const first = res.rows[0];
    const data: WordEntry = {
      word: first.word,
      forms: first.forms,
      origins: first.origins,
      rhyme: first.rhyme,
      isAnglish: first.is_anglish,
      pos: {},
    };
    for (const sense of res.rows) {
      const pos: POS = sense.pos;
      if (!data.pos[pos]) {
        data.pos[pos] = [];
      }
      if (sense.id) {
        data.pos[pos].push(sense);
      }
    }
    return data;
  }

  public static async synonyms(entry: WordEntry) {
    type Synonyms = { [pos in POS]: { english: string[]; anglish: string[] } };

    const synonyms: Synonyms = {} as Synonyms;
    const wordClean = pg.escapeLiteral(entry.word);

    let pos: POS;
    for (pos in entry.pos) {
      synonyms[pos] = { english: [], anglish: [] };
      const posClean = pg.escapeLiteral(pos);
      const sqlTemplate = this.getTemplate("synonyms");
      const sql = sqlTemplate
        .replaceAll("<word>", wordClean)
        .replaceAll("<pos>", posClean);
      const res = await DatabaseClient.query(sql);
      if (res.rows?.length) {
        for (const { word, is_anglish } of res.rows) {
          synonyms[pos][is_anglish ? "anglish" : "english"].push(word);
        }
      }
    }
    return synonyms;
  }

  public static async words(
    word: string,
    page = 0,
    pageSize = 30,
  ): Promise<{
    results: (WordSchema & { sense_ids: string[] })[];
    totalCount: number;
    totalPages: number;
  }> {
    const wordClean = pg.escapeLiteral(word);
    const totalCount = parseInt(await this.getCount(wordClean));
    const totalPages = Math.ceil(totalCount / pageSize);
    const offset = page * pageSize;
    const results = await this.getResults(wordClean, offset);

    return { results, totalCount, totalPages };
  }

  private static async getCount(wordClean: string) {
    const template = this.getTemplate("count");
    const sql = template.replaceAll("<word>", injectStr(wordClean, "%", -1));
    const res = await DatabaseClient.query(sql);
    const count = res.rows[0]?.count;
    return count;
  }

  private static async getResults(wordClean: string, offset: number) {
    // TODO this needs refactored
    const template = this.getTemplate("words");
    const sql = template
      .replaceAll("<word>", injectStr(wordClean, "%", -1))
      .replaceAll("<offset>", offset.toString());
    const res = await DatabaseClient.query(sql);
    return res.rows;
  }
}

function injectStr(target: string, str: string, index: number) {
  return target.slice(0, index) + str + target.slice(index);
}

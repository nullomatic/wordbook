import _ from "lodash";
import pg from "pg";
import format from "pg-format";
import * as util from "../lib/util";
import { logger } from "../lib/util";
import { DatabaseClient, RedisClient } from "../lib/client";
import { WordnetSense, WordnetSynset, CompiledEntry } from "../lib/types";
import { Query } from "../lib/query";
import { Lang, POS, searchIndexDelimiter } from "../lib/constants";

const REDIS_SEARCH_INDEX_KEY = "search_index";

/**
 * Resets database and seeds it from the compiled entries and synsets files.
 */
export async function populateDatabase() {
  await resetDatabase();
  await loadSynsets();
  await loadFrames();
  await loadEntries();
}

/**
 * Rebuilds the Redis search index.
 */
export async function rebuildSearchIndex() {
  logger.info(`Rebuilding search index`);
  const redis = await RedisClient.getClient();
  await redis.flushAll();

  const sql = Query.getTemplate("searchIndex");

  const result = await DatabaseClient.query(sql);
  const promises = [];
  for (const { word, pos, langs } of result.rows) {
    const index = buildWordIndex(word, pos, langs);
    promises.push(
      redis.zAdd(REDIS_SEARCH_INDEX_KEY, { score: 0, value: index }),
    );
  }

  await Promise.all(promises);
}

/**
 * Completely resets Postgres and Redis.
 */
async function resetDatabase() {
  logger.info(`Resetting database`);
  const redis = await RedisClient.getClient();
  const sql = util.readFile("/sql/setup.sql");
  await DatabaseClient.query(sql);
  await redis.flushAll();
}

/**
 * Inserts synsets and synset relations into database in two passes.
 * The first pass adds all synsets; the second adds hypernym, similar, and attribute relations.
 */
async function loadSynsets() {
  const synsets: { [id: string]: WordnetSynset } = {};
  const dir = "/data/assets/wordnet/json/";
  const pattern = `${dir}{adj,adv,noun,verb}.*.json`;
  const filenames = util.getFiles(pattern);

  logger.info(`Loading files in ${dir}`);

  // First pass: insert synsets.
  let values = [];
  for (const { filename, path } of filenames) {
    if (isSynsetFile(filename)) {
      const json = util.readJSON(path);
      for (const synsetId in json) {
        const synset = json[synsetId];
        synsets[synsetId] = synset;
        values.push([synsetId, synset.partOfSpeech, synset.definition[0]]);
      }
    }
  }

  logger.info(`Inserting ${values.length} synsets`);
  await DatabaseClient.query(
    // prettier-ignore
    format(
      `INSERT INTO synset (id, pos, gloss) ` +
      `VALUES %L`,
    values),
  );

  // Second pass: insert relations.
  values = [];
  const synsetRelations: (keyof WordnetSynset)[] = [
    "hypernym",
    "similar",
    "attribute",
  ];
  for (const synsetId in synsets) {
    const synset = synsets[synsetId];
    for (const relation of synsetRelations) {
      if (synset[relation]?.length) {
        const relations = synset[relation] as string[];
        values.push(
          ...relations.map((relationId) => [synsetId, relationId, relation]),
        );
      }
    }
  }

  logger.info(`Inserting ${values.length} synset relations`);
  await DatabaseClient.query(
    // prettier-ignore
    format(
      `INSERT INTO synset_synset (synset_id_1, synset_id_2, relation) ` +
      `VALUES %L`,
    values),
  );
}

/**
 * Coordinates entry of words, senses, and sense relations into database.
 */
async function loadEntries() {
  const entries: Record<string, CompiledEntry> = {};
  const senses: Record<string, { newSenseId: string } & WordnetSense> = {};
  const senseIndices: { [_k in number]: string } = {};

  const { rows: entryRows } = await insertEntries(entries);
  const { rows: senseRows } = await insertSenses(
    entries,
    entryRows,
    senseIndices,
    senses,
  );

  for (const index in senseIndices) {
    _.set(senses, [senseIndices[index], "newSenseId"], senseRows[index].id);
  }

  await insertSenseRelations(senses);
}

async function loadFrames() {
  const json = util.readJSON("/data/assets/wordnet/json/frames.json");
  const values = [];
  for (const frame in json) {
    const template = json[frame];
    values.push([frame, template]);
  }

  logger.info(`Inserting ${values.length} frames`);
  return DatabaseClient.query(
    // prettier-ignore
    format(
      `INSERT INTO frame (id, template) ` +
      `VALUES %L`,
    values),
  );
}

/**
 * Inserts word entries into database and search cache.
 */
async function insertEntries(
  entries: Record<string, CompiledEntry>,
): Promise<pg.QueryResult> {
  const dir = "/data/assets/compiled/";
  const pattern = `${dir}*.json`;
  const filenames = util.getFiles(pattern);
  const redis = await RedisClient.getClient();

  const values = [];
  const promises = [];

  for (const { path } of filenames) {
    // Handle file.
    const json = util.readJSON(path);
    for (const word in json) {
      const posArr = [];
      // Handle word.
      if (/:/.test(word)) {
        logger.info(`Skipping word with colon "${word}"`); // TODO: Should probably move this to compilation logic.
        continue;
      }
      const entry: CompiledEntry = json[word];
      const langArr = entry.isAnglish
        ? [Lang.English, Lang.Anglish]
        : [Lang.English];
      entries[word] = entry;
      let pos: POS;
      for (pos in entry.pos) {
        // Handle part of speech.
        posArr.push(pos);
        values.push([
          pg.escapeLiteral(word),
          pg.escapeLiteral(pos),
          escapeArray(entry.pos[pos].forms),
          escapeArray(entry.pos[pos].origins),
          pg.escapeLiteral(entry.pos[pos].rhyme),
          entry.isAnglish,
        ]);
      }
      // Add word index to Redis.
      const index = buildWordIndex(word, posArr as POS[], langArr);
      promises.push(
        redis.zAdd(REDIS_SEARCH_INDEX_KEY, { score: 0, value: index }),
      );
    }
  }

  logger.info(`Inserting ${values.length} entries`);

  const formatted = values.map((cells) => `(${cells.join(", ")})`).join(", ");

  const queryString = // prettier-ignore
    `INSERT INTO word (word, pos, forms, origins, rhyme, is_anglish) ` +
    `VALUES ${formatted} ` +
    `RETURNING id, word, pos`;

  const res = await DatabaseClient.query(queryString);
  await Promise.all(promises);

  return res;
}

/**
 * Constructs the Redis search index; starts with lowercase identifier, followed
 * by the original case-sensitive word, parts of speech, and language categories.
 * Examples: 'bat|bat|n,v|en,an', 'gandalf|Gandalf|n|en'
 */
function buildWordIndex(word: string, posArr: POS[], langArr: Lang[]) {
  const lower = word.toLowerCase();
  const parts = posArr.join(",");
  const langs = langArr.join(",");
  return [lower, word, parts, langs].join(searchIndexDelimiter);
}

/**
 * Inserts senses into database.
 */
async function insertSenses(
  entries: Record<string, CompiledEntry>,
  entryRows: pg.QueryResultRow[],
  senseIndices: { [_k in number]: string } = {},
  senses: Record<string, WordnetSense>,
): Promise<pg.QueryResult> {
  const values = [];
  for (const row of entryRows) {
    const { word, pos, id: newWordId } = row;
    for (const sense of entries[word].pos[pos as POS].senses) {
      const synsetId = sense.synset;
      const sentence = sense.sent?.[0] || null;
      values.push([newWordId, synsetId, sentence]);
      if (sense.id) {
        senseIndices[values.length - 1] = sense.id;
        senses[sense.id] = sense;
      }
    }
  }

  logger.info(`Inserting ${values.length} senses`);
  const res = await DatabaseClient.query(
    // prettier-ignore
    format(
      `INSERT INTO sense (word_id, synset_id, sentence) ` +
      `VALUES %L ` +
      `RETURNING id`,
    values),
  );
  return res;
}

/**
 * Inserts sense relations into database.
 */
async function insertSenseRelations(
  senses: Record<string, { newSenseId: string } & WordnetSense>,
) {
  const senseRelations = [
    "exemplifies",
    "pertainym",
    "derivation",
    "event",
    "antonym",
    "state",
    "agent",
    "result",
    "body_part",
    "undergoer",
    "also",
    "property",
    "location",
    "by_means_of",
    "instrument",
    "uses",
    "material",
    "vehicle",
    "participle",
    "similar",
    "destination",
  ];
  const relationValues = [];
  const frameValues = [];
  for (const sense of Object.values(senses)) {
    const dbSenseId = sense.newSenseId;
    for (const key in sense) {
      const ids = sense[key as keyof WordnetSense];
      if (ids?.length) {
        if (senseRelations.includes(key)) {
          // Add sense-sense relation.
          for (const relationId of ids) {
            const dbRelationId = senses[relationId].newSenseId;
            relationValues.push([dbSenseId, dbRelationId, key]);
          }
        } else if (key === "subcat") {
          // Add sense-frame relation.
          for (const frameId of ids) {
            frameValues.push([dbSenseId, frameId]);
          }
        }
      }
    }
  }

  if (relationValues.length) {
    logger.info(`Inserting ${relationValues.length} sense-sense relations`);
    await DatabaseClient.query(
      // prettier-ignore
      format(
      `INSERT INTO sense_sense (sense_id_1, sense_id_2, relation) ` +
      `VALUES %L`,
    relationValues),
    );
  } else {
    logger.warn(`No sense-sense relations found to insert`);
  }

  if (frameValues.length) {
    logger.info(`Inserting ${frameValues.length} sense-frame relations`);
    await DatabaseClient.query(
      // prettier-ignore
      format(
      `INSERT INTO sense_frame (sense_id, frame_id) ` +
      `VALUES %L`,
    frameValues),
    );
  } else {
    logger.warn(`No sense-frame relations found to insert`);
  }
}

/**
 * Inserts a frequency column into the `word` table.
 */
export async function insertWordFrequencyData() {
  await DatabaseClient.query(`
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'word'
            AND column_name = 'frequency'
        ) THEN
            ALTER TABLE word
            ADD COLUMN frequency BIGINT DEFAULT 0;
        END IF;
    END $$;
  `);

  const dict: Record<string, number> = {};
  const rows = await util.readCSV("/data/assets/freq/unigram_freq.csv");
  for (const { word, count } of rows) {
    if (!dict[word]) {
      dict[word] = parseInt(count);
    }
  }

  const entries = Object.entries(dict);

  const updateWordFrequency = async (batch: [string, number][]) => {
    const queryText = `
      UPDATE word
      SET frequency = CASE word
        ${batch.map((_, index) => `WHEN $${index * 2 + 1} THEN $${index * 2 + 2}::BIGINT`).join(" ")}
      END
      WHERE word IN (${batch.map((_, index) => `$${index * 2 + 1}`).join(", ")});
    `;
    await DatabaseClient.query(queryText, batch.flat());
  };

  const batchSize = 1000;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    await updateWordFrequency(batch);
    logger.verbose(`Updated word frequency batch ${i / batchSize + 1}`);
  }
}

function isSynsetFile(filename: string) {
  return /(adj|adv|noun|verb)\.\w+\.(json|yaml)$/i.test(filename);
}

function escapeArray(arr: string[]) {
  return `ARRAY[${arr.map((str) => pg.escapeLiteral(str)).join(",")}]::TEXT[]`;
}

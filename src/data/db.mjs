import * as fs from 'fs';
import _ from 'lodash';
import pg from 'pg';
import format from 'pg-format';
import * as util from './util.mjs';
import { logger } from './util.mjs';

export async function getClient() {
  const client = new pg.Client({
    user: 'postgres',
    password: 'password',
    host: '127.0.0.1',
    port: 5432,
  });
  await client.connect();
  return client;
}

let client = null;

/**
 * Resets database and seeds it from the compiled entries and synsets files.
 */
export async function populateDatabase(_options) {
  client = await getClient();
  await resetDatabase();
  await loadSynsets();
  await loadFrames();
  await loadEntries();
}

/**
 * Completely resets Postgres.
 */
async function resetDatabase() {
  logger.info(`Resetting database`);
  const fullPath = util.getPath('/setup.sql');
  const sql = fs.readFileSync(fullPath, 'utf-8');
  await client.query(sql);
}

/**
 * Inserts synsets and synset relations into database in two passes.
 * The first pass adds all synsets; the second adds hypernym, similar, and attribute relations.
 */
async function loadSynsets() {
  const synsets = {};
  const dir = util.getPath('/assets/wordnet/json');
  const filenames = util.getFilenames(dir);

  logger.info(`Loading files in ${dir}`);

  // First pass: insert synsets.
  let values = [];
  for (const [filename, fullPath] of filenames) {
    if (/(adj|adv|noun|verb)\.\w+\.json$/i.test(filename)) {
      const file = fs.readFileSync(fullPath, 'utf-8');
      const json = JSON.parse(file);
      for (const synsetId in json) {
        const synset = json[synsetId];
        synsets[synsetId] = synset;
        values.push([synsetId, synset.partOfSpeech, synset.definition[0]]);
      }
    }
  }

  logger.info(`Inserting ${values.length} synsets`);
  await client.query(
    // prettier-ignore
    format(
      `INSERT INTO synset (id, pos, def) ` +
      `VALUES %L`,
    values)
  );

  // Second pass: insert relations.
  values = [];
  const synsetRelations = ['hypernym', 'similar', 'attribute'];
  for (const synsetId in synsets) {
    const synset = synsets[synsetId];
    for (const relation of synsetRelations) {
      if (synset[relation]?.length) {
        const relations = synset[relation];
        values.push(
          ...relations.map((relationId) => [synsetId, relationId, relation])
        );
      }
    }
  }

  logger.info(`Inserting ${values.length} synset relations`);
  await client.query(
    // prettier-ignore
    format(
      `INSERT INTO synset_synset (synset_id_1, synset_id_2, relation) ` +
      `VALUES %L`,
    values)
  );
}

/**
 * Coordinates entry of words, senses, and sense relations into database.
 */
async function loadEntries() {
  const entries = {};
  const senses = {};
  const senseIndices = {};

  const { rows: entryRows } = await insertEntries(entries);
  const { rows: senseRows } = await insertSenses(
    entries,
    entryRows,
    senseIndices,
    senses
  );

  for (const index in senseIndices) {
    _.set(senses, [senseIndices[index], 'newSenseId'], senseRows[index].id);
  }

  await insertSenseRelations(senses);
}

async function loadFrames() {
  const fullPath = util.getPath('/assets/wordnet/json/frames.json');
  const file = fs.readFileSync(fullPath, 'utf-8');
  const json = JSON.parse(file);
  const values = [];
  for (const frame in json) {
    const template = json[frame];
    values.push([frame, template]);
  }

  logger.info(`Inserting ${values.length} frames`);
  return client.query(
    // prettier-ignore
    format(
      `INSERT INTO frame (id, template) ` +
      `VALUES %L`,
    values)
  );
}

/**
 * Inserts word entries into database.
 */
function insertEntries(entries) {
  const dir = util.getPath('/compiled');
  const filenames = util.getFilenames(dir);
  const values = [];
  for (const [, fullPath] of filenames) {
    const file = fs.readFileSync(fullPath, 'utf-8');
    const json = JSON.parse(file);
    for (const word in json) {
      const entry = json[word];
      entries[word] = entry;
      for (const pos in entry) {
        if (pos === 'isAnglish') continue;
        const rhymes = getRhymes(entry[pos].sounds);
        values.push([
          word,
          pos,
          entry[pos].form ? format('{%L}', entry[pos].form) : null,
          entry[pos].origin || null,
          rhymes,
          entry.isAnglish,
        ]);
      }
    }
  }

  logger.info(`Inserting ${values.length} entries`);
  return client.query(
    // prettier-ignore
    format(
      `INSERT INTO word (word, pos, forms, origin, rhymes, is_anglish) ` +
      `VALUES %L ` +
      `RETURNING id, word, pos`,
    values)
  );
}

/**
 * Inserts senses into database.
 */
function insertSenses(entries, entryRows, senseIndices, senses) {
  const values = [];
  for (const row of entryRows) {
    const { word, pos, id: newWordId } = row;
    for (const sense of entries[word][pos].senses) {
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
  return client.query(
    // prettier-ignore
    format(
      `INSERT INTO sense (word_id, synset_id, sentence) ` +
      `VALUES %L ` +
      `RETURNING id`,
    values)
  );
}

/**
 * Inserts sense relations into database.
 */
async function insertSenseRelations(senses) {
  const senseRelations = [
    'exemplifies',
    'pertainym',
    'derivation',
    'event',
    'antonym',
    'state',
    'agent',
    'result',
    'body_part',
    'undergoer',
    'also',
    'property',
    'location',
    'by_means_of',
    'instrument',
    'uses',
    'material',
    'vehicle',
    'participle',
    'similar',
    'destination',
  ];
  const relationValues = [];
  const frameValues = [];
  for (const sense of Object.values(senses)) {
    const dbSenseId = sense.newSenseId;
    for (const key in sense) {
      if (senseRelations.includes(key)) {
        // Add sense-sense relation.
        for (const relationId of sense[key]) {
          const dbRelationId = senses[relationId].newSenseId;
          relationValues.push([dbSenseId, dbRelationId, key]);
        }
      } else if (key === 'subcat') {
        // Add sense-frame relation.
        for (const frameId of sense[key]) {
          frameValues.push([dbSenseId, frameId]);
        }
      }
    }
  }

  logger.info(`Inserting ${relationValues.length} sense-sense relations`);
  await client.query(
    // prettier-ignore
    format(
      `INSERT INTO sense_sense (sense_id_1, sense_id_2, relation) ` +
      `VALUES %L`,
    relationValues)
  );

  logger.info(`Inserting ${frameValues.length} sense-frame relations`);
  await client.query(
    // prettier-ignore
    format(
      `INSERT INTO sense_frame (sense_id, frame_id) ` +
      `VALUES %L`,
    frameValues)
  );
}

/**
 * Extracts IPA rhyme from `sounds` key.
 */
function getRhymes(sounds) {
  if (sounds) {
    for (const sound of sounds) {
      if (sound.rhymes) {
        return sound.rhymes;
      }
    }
  }
  return null;
}

import * as cheerio from 'cheerio';
import axios from 'axios';
import csv from 'csvtojson';
import { createInterface } from 'node:readline/promises';
import { createReadStream, writeFileSync } from 'fs';
import { client, buildIndex } from './redis.mjs';
import { getAssetURI, replaceKeyPattern } from './util.mjs';

/**
 * Calls all loader functions with option to flush Redis first.
 **/
export default async function loadAll(flush = false) {
  console.time('loadAll');

  if (flush) {
    console.log('Flushing Redis keys...');
    await client.flushAll();
  }
  await loadWiktionaryData();
  await loadWordbookData(true);
  await loadTablesFromAnglishMoot(true);
  await buildIndex();

  console.timeEnd('loadAll');
  process.exit(); // Will async-hang if called from command line without this.
}

// TODO: Add scripts to download data assets

/**
 * Loads Wiktionary data into Redis from the Kaikki (https://kaikki.org) JSON file
 * in the /assets folder. It's big. Each line is an object and looks like this:
 *
 * {"pos": "noun", "word": "aardvark", "lang": "English", ... }
 *
 * To manage memory, we create a `readline` stream that collects entries into batches,
 * which are then passed to the Redis client. The client automatically pipelines multiple
 * commands to Redis (https://www.npmjs.com/package/redis#auto-pipelining).
 **/
export async function loadWiktionaryData() {
  console.time('loadWiktionaryData');
  console.log('Loading Wiktionary data into Redis...');

  // Adjust to keep memory under Node limit.
  // Alternatively, adjust --max-old-space-size.
  const BATCH_SIZE = 50000;

  const uri = getAssetURI('kaikki-en.json');
  const stream = createReadStream(uri);
  const rl = createInterface({ input: stream });

  const batches = []; // [ [ <promise>, <promise>, ... ], ... ]
  let currentBatch = []; // [ <promise>, <promise>, ... ]
  let iteration = 0;
  let processed = 0;

  const processBatch = async () => {
    const batch = batches.shift();
    if (batch) {
      processed += batch.length;
      await Promise.all(
        // Flatten batch array.
        batch.reduce((acc, cur) => acc.concat(cur))
      );
      console.log(`Processed ${processed} entries`);
    }
  };

  const unloadCurrentBatch = () => {
    if (currentBatch.length) {
      batches.push(currentBatch);
      currentBatch = [];
    }
  };

  rl.on('line', async function (line) {
    iteration++;
    const entry = JSON.parse(line);
    const key = replaceKeyPattern({
      lang: 'en',
      word: entry.word,
      pos: entry.pos,
      etym: entry.etymology_number || 1,
    });
    currentBatch.push([
      client.set(key, line),
      client.zAdd('terms', { score: 0, value: key }),
    ]);

    if (currentBatch.length === BATCH_SIZE) {
      rl.pause();
      unloadCurrentBatch();
      await processBatch();
      rl.resume();
    }
  });

  await new Promise((resolve) =>
    rl.on('close', async () => {
      // Process any remaining batches.
      unloadCurrentBatch();
      while (batches.length) {
        await processBatch();
      }
      resolve();
    })
  );

  if (iteration !== processed) {
    console.warn(`Warning: Missed ${iteration - processed} entries`);
  }

  console.timeEnd('loadWiktionaryData');
}

/**
 * Loads data from the Anglish Wordbook CSV into Redis.
 * https://docs.google.com/spreadsheets/d/1y8_11RDvuCRyUK_MXj5K7ZjccgCUDapsPDI5PjaEkMw
 **/
export async function loadWordbookData(saveToDisk = false) {
  console.time('loadWordbookData');
  console.log('Loading Anglish Wordbook data into Redis...');

  let uri = getAssetURI('wordbook.csv');
  const data = await csv().fromFile(uri);
  const formatted = [];
  const promises = [];

  for (const entry of data) {
    const obj = {
      word: entry['WORD'],
      angSpelling: entry['ANG. SPEL.'],
      meanings: entry['MEANING']
        .split('᛫')
        .map((str) => str.trim())
        .filter((str) => !!str),
      kind: entry['KIND'],
      forebear: entry['FOREBEAR'],
      from: entry['FROM'],
      notes: entry['NOTES'],
      tags: entry['TAGS'],
    };

    formatted.push(obj);

    const key = replaceKeyPattern({
      lang: 'an',
      word: obj.word,
      pos: obj.kind,
      etym: 1, // TODO
    });
    promises.push(
      client.set(key, JSON.stringify(obj)),
      client.zAdd('terms', { score: 0, value: key })
    );
  }

  await Promise.all(promises);

  if (saveToDisk) {
    uri = getAssetURI('wordbook.json');
    writeFileSync(uri, JSON.stringify(formatted, null, 2));
  }

  console.timeEnd('loadWordbookData');
}

/**
 * Loads table data from The Anglish Moot website.
 * https://anglish.fandom.com/wiki/English_Wordbook/
 *
 * TODO: This function need work
 **/
export async function loadTablesFromAnglishMoot(saveToDisk = false) {
  console.time('loadTablesFromAnglishMoot');
  console.log('Loading table data from The Anglish Moot...');

  /*
   * Dictionary Object
   * {
   *   A: [<entry>, <entry>, ...],
   *   B: [<entry>, <entry>, ...],
   *   C: [<entry>, <entry>, ...],
   *   ...
   *   Z: [<entry>, <entry>, ...]
   * }
   */
  const dict = {};

  /*
   * Table Column Descriptors
   * eng: English
   * pos: Part of Speech
   * att: Anglish (attested)
   * una: Anglish (unattested)
   */
  const cols = ['eng', 'pos', 'att', 'una'];

  const promises = [];

  console.log('Fetching tables...');

  // Fetch tables for every letter.
  for (let n = 0; n < 26; n++) {
    const letter = String.fromCharCode(65 + n);
    console.time(letter);

    dict[letter] = [];

    const url = `https://anglish.fandom.com/wiki/English_Wordbook/${letter}`;
    const { data } = await axios.get(url);

    const $ = cheerio.load(data);
    $('table > tbody > tr').each((_, el) => {
      const cells = $(el).children('td');
      if (cells.length === 4) {
        const entry = {};
        const text = cells.each((i, cell) => {
          entry[cols[i]] = $(cell).text().trim();
        });
        dict[letter].push(entry);

        // TODO: Should be 'en', but don't overwrite Wiktionary entries
        const key = `an:${entry.eng}:${entry.pos}`;
        promises.push(client.set(key, JSON.stringify(entry)));
      }
    });

    console.timeEnd(letter);
  }

  await Promise.all(promises);

  if (saveToDisk) {
    const uri = getAssetURI('moot.json');
    writeFileSync(uri, JSON.stringify(dict, null, 2));
  }

  console.timeEnd('loadTablesFromAnglishMoot');
}

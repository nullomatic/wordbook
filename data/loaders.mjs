import * as cheerio from 'cheerio';
import axios from 'axios';
import csv from 'csvtojson';
import { createInterface } from 'node:readline/promises';
import {
  createReadStream,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'fs';
import { redis, buildIndex } from './redis.mjs';
import { getPath, replaceKeyPattern } from './util.mjs';
import byteSize from 'byte-size';
import YAML from 'yaml';

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
export class WiktionaryLoader {
  constructor() {
    this.data = null;
    this.uri = getPath('/assets/kaikki-en.json');
  }

  /**
   * Loads Wiktionary data into memory.
   *
   * @param options Options to store loaded data in memory or load into Redis.
   * @param callback An optional callback to process each line.
   **/
  async load(options, callback) {
    console.time('loadWiktionary');
    console.log('Loading Wiktionary data...');

    if (options?.store) {
      this.data = [];
    }

    await this.#loadWithStream((line) => {
      const callbacks = [];
      if (options?.store) {
        this.data.push(JSON.parse(line));
      }
      if (options?.redis) {
        cbs.concat(this.#redisCallback(line));
      }
      if (callback) {
        callbacks.concat(callback(line) || []);
      }
      return callbacks;
    });

    console.timeEnd('loadWiktionary');
    return this;
  }

  /**
   * Loads file via read stream and processes lines in batches.
   *
   * @param callback Callback to process each line. Return type should
   * be an array of Promises, which are then passed to Promise.all().
   **/
  async #loadWithStream(callback) {
    // Adjust BATCH_SIZE to keep memory under Node limit.
    // Alternatively, adjust --max-old-space-size.
    const BATCH_SIZE = 50000;
    const stream = createReadStream(this.uri);
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
        console.log(`Processed ${processed} lines`);
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
      currentBatch.push(callback(line) || []);
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
      console.warn(`WARN: Missed ${iteration - processed} entries`);
    }
  }

  /**
   * Loads Wiktionary data into Redis.
   *
   * @param line A single line string from the read stream.
   **/
  #redisCallback(line) {
    const entry = JSON.parse(line);
    const key = replaceKeyPattern({
      lang: 'en',
      word: entry.word,
      pos: entry.pos,
      etym: entry.etymology_number || 1,
    });
    return [
      redis.set(key, line),
      redis.zAdd('terms', { score: 0, value: key }),
    ];
  }
}

/**
 * Loads data from The Anglish Wordbook CSV into Redis.
 * https://docs.google.com/spreadsheets/d/1y8_11RDvuCRyUK_MXj5K7ZjccgCUDapsPDI5PjaEkMw
 **/
export class WordbookLoader {
  constructor() {
    this.data = null;
    this.uri = getPath('/assets/wordbook.csv');
  }

  async load(options) {
    console.time('loadWordbook');
    console.log('Loading Anglish Wordbook data...');

    try {
      // Attempt to read JSON from disk before parsing CSV.
      const file = readFileSync(getPath('/assets/wordbook.json'));
      this.data = JSON.parse(file);
      console.timeEnd('loadWordbook');
      return this;
    } catch (e) {}

    this.data = [];
    const data = await csv().fromFile(this.uri);
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

      this.data.push(obj);

      if (options?.redis) {
        const key = replaceKeyPattern({
          lang: 'an',
          word: obj.word,
          pos: obj.kind,
          etym: 1, // TODO
        });
        promises.push(
          redis.set(key, JSON.stringify(obj)),
          redis.zAdd('terms', { score: 0, value: key })
        );
      }
    }

    await Promise.all(promises);

    if (options?.save) {
      const uri = getPath('/assets/wordbook.json');
      writeFileSync(uri, JSON.stringify(this.data, null, 2));
    }

    console.timeEnd('loadWordbook');
    return this;
  }
}

/**
 * Loads table data from The Anglish Moot website.
 * https://anglish.fandom.com/wiki/English_Wordbook/
 *
 * TODO: This needs work
 **/
export class MootLoader {
  constructor() {
    /*
     * {
     *   A: [{
     *     eng: "literature",
     *     pos: "noun",
     *     att: "bookcraft, wordlore",
     *     una: "<crazy Old English word>"
     *   }, ...],
     *   B: [...],
     *   C: [...],
     *   ...
     *   Z: [...]
     * }
     */
    this.data = null;
    this.uri = getPath('/assets/moot.json');
  }

  async load(options) {
    console.time('loadMoot');
    console.log('Loading Anglish Moot data...');

    try {
      // Attempt to read the file from disk before fetching from web.
      const file = readFileSync(this.uri);
      this.data = JSON.parse(file);
      console.timeEnd('loadMoot');
      return this;
    } catch (e) {}

    /*
     * Table Column Descriptors
     * eng: English
     * pos: Part of Speech
     * att: Anglish (attested)
     * una: Anglish (unattested)
     */
    const cols = ['eng', 'pos', 'att', 'una'];
    const dict = {};
    const promises = [];

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
          promises.push(redis.set(key, JSON.stringify(entry)));
        }
      });

      console.timeEnd(letter);
    }

    await Promise.all(promises);
    this.data = dict;

    if (options?.save) {
      writeFileSync(this.uri, JSON.stringify(dict, null, 2));
    }

    console.timeEnd('loadMoot');
    return this;
  }
}

export class WordNetLoader {
  constructor() {
    /*
     * {
     *   entries: {
     *     craft: {
     *       n: { ... },
     *       v: { ... },
     *       ...
     *     }
     *   },
     *   synsets: {
     *     "123456789-n": {
     *       definition: "some meaningful definition",
     *       members: [ "craft", "make", "construct", ... ]
     *     }
     *   },
     * }
     */
    this.data = null;
    this.dirYAML = '/assets/yaml';
    this.dirJSON = '/assets/json';
  }

  async load(options) {
    console.time('loadWordNet');
    console.log('Loading WordNet data...');

    this.data = {
      entries: {},
      synsets: {},
    };

    let uris, filenames, isYAML;
    try {
      // Attempt to load JSON files before loading and parsing YAML.
      // (Parsing YAML files is much slower than loading directly from JSON.)
      [uris, filenames] = this.#getFilenames(this.dirJSON);
    } catch (e) {
      [uris, filenames] = this.#getFilenames(this.dirYAML);
      isYAML = true;
    }

    if (options?.save) {
      mkdirSync(getPath(this.dirJSON), { recursive: true });
    }

    for (const [uri, filename] of uris.map((uri, i) => [uri, filenames[i]])) {
      const file = readFileSync(uri, 'utf-8');
      const json = isYAML ? YAML.parse(file) : JSON.parse(file);
      await this.#processFile(filename, json, isYAML, options);
    }
    return this;

    const addSimilar = function (synsetIds, arr) {
      if (synsetIds?.length) {
        for (const id of synsetIds) {
          if (synsets[id].members?.length) {
            arr.concat(synsets[id].members);
          }
        }
      }
    };

    const promises = [];
    for (const key in synsets) {
      const synset = synsets[key];
      const similarKey = `synset:${key}:similar`;
      const similarWords = synset.members || [];
      addSimilar(synset.hypernym, similarWords);
      addSimilar(synset.similar, similarWords);
      const command = redis.set(similarKey, JSON.stringify(similarWords));
      promises.push(command);
    }
    await Promise.all(promises);

    console.timeEnd('loadWordNet');
    return this;
  }

  #getFilenames(dir) {
    const filenames = readdirSync(getPath(dir));
    const uris = filenames.map((filename) => getPath(`${dir}/${filename}`));
    return [uris, filenames];
  }

  async #processFile(filename, json, isYAML, options) {
    console.log(`Loading ${filename}`);

    if (isYAML && options?.save) {
      writeFileSync(
        getPath(`${this.dirJSON}/${filename.replace('yaml', 'json')}`),
        JSON.stringify(json, null, 2)
      );
    }

    if (/^entries/.test(filename)) {
      const promises = [];
      for (const k in json) {
        // TODO: set all to lowercase, handle collisions
        const wordKey = `word:${k}`;
        const data = json[k];
        this.data.entries[k] = data;
        // const command = redis.set(wordKey, JSON.stringify(data));
        // promises.push(command);
      }
      await Promise.all(promises);
    }

    if (/^(adj|adv|noun|verb)/.test(filename)) {
      const promises = [];
      for (const key in json) {
        const synsetKey = `synset:${key}`;
        const synonymsKey = `synset:${key}:similar`;
        const data = json[key];
        this.data.synsets[key] = data;

        // const command = redis.set(synsetKey, JSON.stringify(data));
        // promises.push(command);
      }
      await Promise.all(promises);
    }

    if (/^frames/.test(filename)) {
      // handle frames file
    }
  }
}

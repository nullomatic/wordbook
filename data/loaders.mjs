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
import {
  cleanStr,
  formatPoS,
  formatSenses,
  getPath,
  replaceKeyPattern,
} from './util.mjs';
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
    this.uri = getPath('/assets/kaikki/kaikki-en.json');
  }

  /**
   * Loads Wiktionary data into memory.
   *
   * @param options Options to store loaded data in memory or load into Redis.
   * @param callback An optional callback to process each line.
   **/
  async load(options) {
    if (!options?.save) {
      // Attempt to read JSON from disk before parsing JSON.
      // If `options.save` is specified, assume we want to reload the data.
      try {
        console.log('Loading kaikki-an.json');
        const file = readFileSync(getPath('/assets/kaikki/kaikki-an.json'));
        this.data = JSON.parse(file);
        return this;
      } catch (e) {}
    }

    this.data = {};

    // God this is messy.
    const extractSenses = (senses) => {
      const _a = senses
        .map(({ glosses }) =>
          glosses.map((str) => {
            const _b = str
              .replace(/\([^)]*\)/g, '')
              .replace(/\[[^\]]*\]/g, '')
              .split(';')
              .map((s) =>
                s
                  .trim()
                  .replace(/^(a|an|to)\s/gi, '')
                  .replace(/\./g, '')
              )
              .join('; ');
            return _b;
          })
        )
        .reduce((acc, cur) => acc.concat(cur));
      return _a;
    };

    const handler = (line) => {
      const json = JSON.parse(line);
      let isAnglish = false;
      if (/(old english|germanic)/i.test(json.etymology_text)) {
        isAnglish = true;
      }
      if (/(french|latin|greek)/i.test(json.etymology_text)) {
        isAnglish = false;
      }
      if (isAnglish) {
        if (!this.data[json.word]) {
          this.data[json.word] = {
            [json.pos]: {
              senses: extractSenses(json.senses),
            },
          };
        } else {
          this.data[json.word][json.pos] = {
            senses: extractSenses(json.senses),
          };
        }
      }
    };

    await this.#loadWithStream((line) => [handler(line)]);

    if (options?.save) {
      console.log('Saving kaikki-an.json');
      const uri = getPath('/assets/kaikki/kaikki-an.json');
      writeFileSync(uri, JSON.stringify(this.data, null, 2));
    }

    return this;
  }

  async _load(options, callback) {
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
  async #loadWithStream(handler, callback) {
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
      currentBatch.push(handler(line) || []);
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

    if (callback) {
      await callback();
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
 * Loads data from The Anglish Wordbook CSV.
 * https://docs.google.com/spreadsheets/d/1y8_11RDvuCRyUK_MXj5K7ZjccgCUDapsPDI5PjaEkMw
 **/
export class WordbookLoader {
  constructor() {
    this.data = null;
  }

  async load(options) {
    if (!options.save) {
      // Attempt to read JSON from disk before parsing CSV.
      // If `options.save` is specified, assume we want to reload the data.
      try {
        console.log('Loading wordbook.json');
        const file = readFileSync(getPath('/assets/wordbook/wordbook.json'));
        this.data = JSON.parse(file);
        return this;
      } catch (e) {}
    }

    this.data = {};
    const data = await csv().fromFile(getPath('/assets/wordbook/wordbook.csv'));

    for (const item of data) {
      const posArr = this.#formatPoSArr(item['KIND']);
      const senses = formatSenses(item['MEANING']);

      for (const pos of posArr) {
        const word = cleanStr(item['WORD']);
        const entry = {
          angSpelling: item['ANG. SPEL.'],
          senses: senses,
          forebear: item['FOREBEAR'],
          from: item['FROM'],
          notes: item['NOTES'],
          tags: item['TAGS'],
        };
        if (!this.data[word]) {
          this.data[word] = { [pos]: entry };
        } else {
          this.data[word][pos] = entry;
        }
      }
    }

    if (options?.save) {
      console.log('Saving wordbook.json');
      const uri = getPath('/assets/wordbook/wordbook.json');
      writeFileSync(uri, JSON.stringify(this.data, null, 2));
    }

    return this;
  }

  #formatPoSArr(str) {
    const s = new Set();
    const arr = str
      .toLowerCase()
      .split(/[^\w\s]/)
      .filter((s) => !!s);
    for (let pos of arr) {
      pos = formatPoS(pos);
      s.add(pos);
    }
    return Array.from(s);
  }
}

/**
 * Loads table data from The Anglish Moot website.
 * https://anglish.fandom.com/wiki/
 **/
export class MootLoader {
  constructor() {
    this.baseURL = 'https://anglish.fandom.com';
    this.english = null;
    this.anglish = null;

    this.jsonPathAnglish = getPath('/assets/moot/moot-an.json');
    this.jsonPathEnglish = getPath('/assets/moot/moot-en.json');
    this.dirtyEntries = null;
  }

  async load(options) {
    if (!options.save) {
      // Attempt to read the file from disk before fetching from web.
      // If `options.save` is specified, assume we want to reload the data.
      try {
        console.log('Loading moot-an.json');
        const file = readFileSync(this.jsonPathAnglish);
        this.anglish = JSON.parse(file);
      } catch (e) {
        await this.scrapeAnglish({ save: true });
      }
      try {
        console.log('Loading moot-en.json');
        const file = readFileSync(this.jsonPathEnglish);
        this.english = JSON.parse(file);
      } catch (e) {
        await this.scrapeEnglish({ save: true });
      }
    } else {
      await this.scrapeAnglish(options);
      await this.scrapeEnglish(options);
    }
  }

  async scrapeAnglish(options) {
    console.time('scrapeMootAnglish');
    console.log('Scraping Anglish Moot data...');

    if (!options.save) {
      // Attempt to read the file from disk before fetching from web.
      // If `options.save` is specified, assume we want to reload the data.
      try {
        const file = readFileSync(this.uri);
        this.data = JSON.parse(file);
        console.timeEnd('scrapeMootAnglish');
        return this;
      } catch (e) {}
    }

    this.anglish = {};
    let $, data;

    data = await this.#fetchURL(`${this.baseURL}/wiki/Anglish_Wordbook`);
    $ = cheerio.load(data);
    const hrefs = Array.from(
      $('tbody')
        .first()
        .find('a')
        .map((i, el) => $(el).attr('href'))
    );

    for (const href of hrefs) {
      console.time(href);

      const url = this.baseURL + href;
      let data = await this.#fetchURL(url);
      if (!data) {
        continue;
      }
      $ = cheerio.load(data);

      main: for (const el of Array.from($('table > tbody'))) {
        if ($(el).children.length > 1) {
          continue;
        }

        const cells = $(el).find('td');
        let [word, pos, def] = Array.from(cells).map((cell) => $(cell).text());
        if (!/anglish/i.test(word)) {
          word = cleanStr(word);
          if (!/^([\w'-]+\s?)+$/.test(word)) continue main;
          if (!this.anglish[word]) {
            this.anglish[word] = {};
          }

          pos = cleanStr(pos)
            .split(/[^\w\s-']/)
            .filter((s) => !!s)[0];
          if (!pos || !/^\w+$/.test(pos)) {
            delete this.anglish[word];
            continue main;
          }
          pos = formatPoS(pos);
          if (!this.anglish[word][pos]) {
            this.anglish[word][pos] = {
              def: '',
            };
          }

          this.anglish[word][pos].def = def.trim();
        }
      }

      console.timeEnd(href);
    }

    if (options?.save) {
      console.log('Saving moot-an.json');
      writeFileSync(
        this.jsonPathAnglish,
        JSON.stringify(this.anglish, null, 2)
      );
    }

    console.timeEnd('scrapeMootAnglish');
    return this;
  }

  async scrapeEnglish(options) {
    console.time('scrapeMootEnglish');
    console.log('Scraping English Moot data...');

    if (!options.save) {
      // Attempt to read the file from disk before fetching from web.
      // If `options.save` is specified, assume we want to reload the data.
      try {
        const file = readFileSync(this.uri);
        this.data = JSON.parse(file);
        console.timeEnd('scrapeMootEnglish');
        return this;
      } catch (e) {}
    }

    this.english = {};
    let $, data;

    data = await this.#fetchURL(`${this.baseURL}/wiki/English_Wordbook`);
    $ = cheerio.load(data);
    const hrefs = Array.from(
      $('big')
        .first()
        .find('a')
        .map((i, el) => $(el).attr('href'))
    );

    for (const href of hrefs) {
      console.time(href);

      const url = this.baseURL + href;
      let data = await this.#fetchURL(url);
      if (!data) {
        continue;
      }
      $ = cheerio.load(data);

      main: for (const el of Array.from($('table > tbody > tr'))) {
        const cells = $(el).children('td');
        if (cells.length === 4) {
          let [word, pos, att, una] = Array.from(cells).map((cell) =>
            $(cell).text()
          );

          word = cleanStr(word);
          if (!this.english[word]) {
            this.english[word] = {};
          }

          pos = cleanStr(pos)
            .split(/[^\w\s-']/)
            .filter((s) => !!s)[0];
          if (!pos || !/^\w+$/.test(pos)) {
            delete this.english[word];
            continue main;
          }
          pos = formatPoS(pos);
          if (!this.english[word][pos]) {
            this.english[word][pos] = {
              senses: [],
            };
          }

          att = cleanStr(att)
            .split(/[^a-z\s\-']/i)
            .map((s) => s.trim())
            .filter((s) => !!s && s !== '-');
          this.english[word][pos].senses.push(...att);

          una = cleanStr(una)
            .split(/[^a-z\s\-']/i)
            .map((s) => s.trim())
            .filter((s) => !!s && s !== '-');
          this.english[word][pos].senses.push(...una);
        }
      }

      console.timeEnd(href);
    }

    if (options?.save) {
      console.log('Saving moot-en.json');
      writeFileSync(
        this.jsonPathEnglish,
        JSON.stringify(this.english, null, 2)
      );
    }

    console.timeEnd('scrapeMootEnglish');
    return this;
  }

  async #fetchURL(url) {
    let data;
    try {
      ({ data } = await axios.get(url));
    } catch (error) {
      const res = error?.response || {};
      console.error(res.status, res.statusText);
    }
    return data;
  }

  addAnglishWordsFromEnglishDefs() {
    for (const englishWord in this.english) {
      const entry = this.english[englishWord];
      for (const pos in entry) {
        for (const anglishWord of entry[pos].senses) {
          if (!this.anglish[anglishWord]) {
            this.anglish[anglishWord] = { [pos]: { senses: [] } };
          } else if (!this.anglish[anglishWord][pos]) {
            this.anglish[anglishWord][pos] = { senses: [] };
          } else if (!this.anglish[anglishWord][pos].senses) {
            this.anglish[anglishWord][pos].senses = [];
          }
          this.anglish[anglishWord][pos].senses.push(englishWord);
        }
      }
    }
    return this;
  }

  #processEntry(entry, type) {
    // Clean `att` or `una` field.
    const anglishWordsStr = cleanStr(entry[type]);
    if (!anglishWordsStr || /^\s?-\s?$/.test(anglishWordsStr)) {
      return;
    }
    const anglishWords = anglishWordsStr
      .split(/[,;]/g)
      .map((word) => word.trim());

    // Clean `eng` field.
    let englishWord = cleanStr(entry.eng);
    if (/,/.test(englishWord)) {
      englishWord = englishWord.split(',').shift();
    }
    const partOfSpeech = entry.pos;

    for (const word of anglishWords) {
      if (
        /^\w+([-\s]\w+)*$/.test(word) && // word has format 'word' or 'word-word'
        /^(n|v|a|r)$/.test(partOfSpeech) // `pos` is clean abbreviation
      ) {
        if (!this.senses[word]) {
          this.senses[word] = {};
        }
        if (!this.senses[word][partOfSpeech]) {
          this.senses[word][partOfSpeech] = [];
        }
        this.senses[word][partOfSpeech].push(englishWord);
      } else {
        // TODO: Handle sus word
        this.dirtyEntries.push(entry);
      }
    }
  }
}

/**
 * Loads data from the Global WordNet.
 * https://globalwordnet.github.io/
 **/
export class WordNetLoader {
  // TODO: Make types for this shit
  constructor() {
    /*
     * {
     *   craft: {
     *     n: { ... },
     *     v: { ... },
     *     ...
     *   },
     *   ...
     * }
     */
    this.entries = null;
    /*
     * {
     *   "123456789-n": {
     *     definition: "some meaningful definition",
     *     members: [ "craft", "make", "construct", ... ]
     *   },
     *   ...
     * }
     */
    this.synsets = null;
    this.dirYAML = '/assets/wordnet/yaml';
    this.dirJSON = '/assets/wordnet/json';
  }

  async load(options) {
    this.entries = {};
    this.synsets = {};

    let uris, filenames, isYAML;
    try {
      // Attempt to load JSON files before loading and parsing YAML.
      // (Parsing YAML files is much slower than loading directly from JSON.)
      // If `options.save` is specified, assume we want to reload the data.
      if (options?.save) {
        throw new Error();
      }
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
  }

  async addSimilar() {
    const add = function (synsetIds, arr) {
      if (synsetIds?.length) {
        for (const id of synsetIds) {
          if (synsets[id].members?.length) {
            arr.concat(synsets[id].members);
          }
        }
      }
    };

    const promises = [];
    for (const key in this.synsets) {
      const synset = this.synsets[key];
      const similarKey = `synset:${key}:similar`;
      const similarWords = synset.members || [];
      add(synset.hypernym, similarWords);
      add(synset.similar, similarWords);
      const command = redis.set(similarKey, JSON.stringify(similarWords));
      promises.push(command);
    }
    await Promise.all(promises);
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
      const _filename = filename.replace('yaml', 'json');
      console.log(`Saving ${_filename}`);
      writeFileSync(
        getPath(`${this.dirJSON}/${_filename}`),
        JSON.stringify(json, null, 2)
      );
    }

    if (/^entries/.test(filename)) {
      const promises = [];
      for (const word in json) {
        const data = json[word];
        data.languages = ['English'];
        this.entries[word] = data;
      }
    }

    if (/^(adj|adv|noun|verb)/.test(filename)) {
      for (const word in json) {
        const data = json[word];
        this.synsets[word] = data;
      }
    }

    if (/^frames/.test(filename)) {
      // TODO: Handle frames file
    }
  }
}

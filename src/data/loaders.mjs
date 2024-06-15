import * as fs from 'fs';
import { createInterface } from 'node:readline/promises';
import axios from 'axios';
import * as cheerio from 'cheerio';
import csv from 'csvtojson';
import _ from 'lodash';
import prompt from 'prompt';
import YAML from 'yaml';
import * as util from './util.mjs';
import { logger } from './util.mjs';

const WORD_PATTERN = `\\b\\p{L}+([-\\s']\\p{L}+)*\\b`;
const WORD_REGEXP = new RegExp(`^${WORD_PATTERN}$`, 'iu');

/**
 * Loads Wiktionary data into Redis from the Kaikki (https://kaikki.org) JSON file
 * in the /assets/kaikki folder. It's big. Each line is an object and looks like this:
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
    this.uri = util.getPath('/assets/kaikki/kaikki-en.json');
  }

  async load(options) {
    if (!options?.save) {
      // Attempt to read JSON from disk before parsing JSON.
      // If `options.save` is specified, assume we want to reload the data.
      try {
        logger.info('Loading kaikki-an.json');
        const file = fs.readFileSync(
          util.getPath('/assets/kaikki/kaikki-an.json')
        );
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
        const pos = util.formatPoS(json.pos);
        if (!this.data[json.word]) {
          this.data[json.word] = {
            [pos]: {
              senses: extractSenses(json.senses),
            },
          };
        } else {
          this.data[json.word][pos] = {
            senses: extractSenses(json.senses),
          };
        }
      }
    };

    await this.#loadWithStream((line) => [handler(line)]);

    if (options?.save) {
      logger.info('Saving kaikki-an.json');
      const uri = util.getPath('/assets/kaikki/kaikki-an.json');
      fs.writeFileSync(uri, JSON.stringify(this.data, null, 2));
    }

    return this;
  }

  async _load(options, callback) {
    logger.info('Loading Wiktionary data...');

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

    return this;
  }

  /**
   * Loads file via read stream and processes lines in batches.
   * @param handler Handler function to process each line. Return type is array of Promises.
   * @param callback Callback that is called after read stream finishes.
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
        logger.info(`Processed ${processed} lines`);
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
   * Callback to load Wiktionary data into Redis.
   * @param line A single line string from the read stream.
   **/
  #redisCallback(line) {
    const entry = JSON.parse(line);
    const key = util.replaceKeyPattern({
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
        logger.info('Loading wordbook.json');
        const file = fs.readFileSync(
          util.getPath('/assets/wordbook/wordbook.json')
        );
        this.data = JSON.parse(file);
        return this;
      } catch (e) {}
    }

    this.data = {};
    const data = await csv().fromFile(
      util.getPath('/assets/wordbook/wordbook.csv')
    );

    for (const item of data) {
      const posArr = this.#formatPoSArr(item['KIND']);
      const senses = formatSenses(item['MEANING']);

      for (const pos of posArr) {
        const word = util.cleanStr(item['WORD']);
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
      logger.info('Saving wordbook.json');
      const uri = util.getPath('/assets/wordbook/wordbook.json');
      fs.writeFileSync(uri, JSON.stringify(this.data, null, 2));
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
      pos = util.formatPoS(pos);
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

    this.jsonPathAnglish = util.getPath('/assets/moot/moot-an.json');
    this.jsonPathEnglish = util.getPath('/assets/moot/moot-en.json');
    this.htmlDirAnglish = util.getPath('/assets/moot/html/anglish/');
    this.htmlDirEnglish = util.getPath('/assets/moot/html/english/');

    if (!fs.existsSync(this.htmlDirAnglish)) {
      fs.mkdirSync(this.htmlDirAnglish, { recursive: true });
    }
    if (!fs.existsSync(this.htmlDirEnglish)) {
      fs.mkdirSync(this.htmlDirEnglish, { recursive: true });
    }
  }

  async load(options) {
    if (!options.save) {
      // Attempt to read the files from disk before fetching from web.
      // If `options.save` is specified, assume we want to reload the data.
      try {
        logger.info('Loading moot-an.json');
        const file = fs.readFileSync(this.jsonPathAnglish);
        this.anglish = JSON.parse(file);
      } catch (e) {
        await this.scrapeAnglish({ save: true });
      }
      try {
        logger.info('Loading moot-en.json');
        const file = fs.readFileSync(this.jsonPathEnglish);
        this.english = JSON.parse(file);
      } catch (e) {
        await this.scrapeEnglish({ save: true });
      }
    } else {
      await this.scrapeAnglish(options);
      await this.scrapeEnglish(options);
    }

    this.#addAnglishWordsFromEnglishDefs();
    return this;
  }

  async fetchAnglishHTML() {
    logger.info('Local HTML not found. Fetching Anglish HTML...');
    let data = await this.#fetch(`${this.baseURL}/wiki/Anglish_Wordbook`);
    const $ = cheerio.load(data);
    const hrefs = Array.from(
      $('tbody')
        .first()
        .find('a')
        .map((i, el) => $(el).attr('href'))
    );
    await this.#saveHTML(hrefs, this.htmlDirAnglish);
  }

  async fetchEnglishHTML() {
    logger.info('Local HTML not found. Fetching English HTML...');
    let data = await this.#fetch(`${this.baseURL}/wiki/English_Wordbook`);
    const $ = cheerio.load(data);
    const hrefs = Array.from(
      $('big')
        .first()
        .find('a')
        .map((i, el) => $(el).attr('href'))
    );
    await this.#saveHTML(hrefs, this.htmlDirEnglish);
  }

  async #saveHTML(hrefs, dir) {
    for (const href of hrefs) {
      const url = this.baseURL + href;
      const data = await this.#fetch(url);
      const filename = `${href.split('/').pop()}.html`;
      const fullPath = dir + filename;
      logger.info(`Saving ${fullPath}`);
      fs.writeFileSync(fullPath, data);
    }
  }

  async scrapeAnglish(options) {
    logger.info('Scraping Anglish Moot data...');

    this.anglish = {};

    let filenames = util.getFilenames('/assets/moot/html/anglish');

    if (!filenames.length) {
      await this.fetchAnglishHTML();
      filenames = util.getFilenames('/assets/moot/html/anglish');
    }

    for (const [, fullPath] of filenames) {
      logger.verbose(`Scraping ${fullPath}`);

      const data = fs.readFileSync(fullPath, 'utf-8');
      const $ = cheerio.load(data);

      for (const el of Array.from($('table > tbody > tr'))) {
        if ($(el).children('td').length !== 3) {
          continue;
        }

        const cells = $(el).find('td');
        let [_word, _pos, _def] = Array.from(cells).map((cell) =>
          $(cell).text()
        );

        const word = this.#cleanWord(_word);
        if (!word) {
          continue;
        } else if (!this.anglish[word]) {
          this.anglish[word] = {};
        }

        const posArr = [];
        _pos = _pos
          .replace(/[\s\n]/g, '')
          .split(/[^\w]/)
          .filter((s) => s);

        for (const str of _pos) {
          switch (str.toLowerCase()) {
            case 'noun':
            case 'n':
              posArr.push('n'); // noun
              break;
            case 'verb':
            case 'vb':
            case 'vt':
            case 'v':
              posArr.push('v'); // verb
              break;
            case 'adj':
              posArr.push('a'); // adjective
              break;
            case 'adv':
              posArr.push('r'); // adverb
              break;
            case 'conj':
              posArr.push('c'); // conjunction
              break;
            case 'prep':
              posArr.push('p'); // adposition
              break;
            default:
              if (options?.interactive) {
                // Prompt schema for correcting parts of speech.
                const schema = {
                  properties: {
                    pos: {
                      description: `Part of speech for '${word}:${str}'`,
                      type: 'string',
                      pattern: /^(n|v|a|r|s|c|p|x|u)$/,
                      message:
                        'Part of speech must be of selection (n|v|a|r|s|c|p|x|u)',
                    },
                  },
                };
                prompt.start();
                const input = await new Promise((resolve, reject) => {
                  prompt.get(schema, (error, result) => {
                    resolve(result);
                  });
                });
                if (input) {
                  posArr.push(input);
                }
              }
          }
        }

        for (const pos of posArr) {
          _.set(this.anglish, `${word}.${pos}.def`, _def.trim());
        }
      }
    }

    // TODO:
    // 1) Have ChatGPT create an array of sense words out of each definition
    // 2) Have ChatGPT extract word origin from definition

    if (options?.save) {
      logger.info('Saving moot-an.json');
      fs.writeFileSync(
        this.jsonPathAnglish,
        JSON.stringify(this.anglish, null, 2)
      );
    }

    return this;
  }

  async scrapeEnglish(options) {
    logger.info('Scraping English Moot data...');

    this.english = {};

    const originRegExp = new RegExp(
      `(?<!\\()(?<words>${WORD_PATTERN}(, ${WORD_PATTERN})*)(?!\\))(\\s?\\((?<origin>[^\\)]*)\\))?`,
      'iug'
    );

    let filenames = util.getFilenames('/assets/moot/html/english');

    if (!filenames.length) {
      await this.fetchEnglishHTML();
      filenames = util.getFilenames('/assets/moot/html/english');
    }

    for (const [, fullPath] of filenames) {
      logger.verbose(`Scraping ${fullPath}`);

      const data = fs.readFileSync(fullPath, 'utf-8');
      const $ = cheerio.load(data);

      for (const el of Array.from($('table > tbody > tr'))) {
        const cells = $(el).children('td');
        if (cells.length === 4) {
          let [_word, _pos, _att, _una] = Array.from(cells).map((cell, i) => {
            if (i < 3) {
              return $(cell).text();
            } else {
              return $(cell).text();
            }
          });

          const word = this.#cleanWord(_word);

          if (!word) {
            continue;
          } else if (!this.english[word]) {
            this.english[word] = {};
          }

          const matches = _una.matchAll(originRegExp);
          if (matches) {
            for (const match of matches) {
              for (const w of match.groups.words.split(',')) {
                const entry = {
                  word: w.trim(),
                  english: word,
                  origin: match.groups.origin,
                };
                console.log(entry);
              }
            }
          }

          const anglishWords = [];

          _pos = _pos
            .replace(/\n/g, ';')
            .replace(/\([^)]*\)/g, '')
            .replace(/\[[^\]]*\]/g, '')
            .split(/[^a-z\s\-']/i)
            .map((str) => str.trim())
            .filter((s) => !!s && s !== '-')[0];
          if (!_pos || !/^\w+$/.test(_pos)) {
            delete this.english[word];
            continue;
          }
          _pos = util.formatPoS(_pos);
          if (!this.english[word][_pos]) {
            this.english[word][_pos] = {
              senses: [],
            };
          }

          _att = _att
            .replace(/\n/g, ';')
            .replace(/\([^)]*\)/g, '')
            .replace(/\[[^\]]*\]/g, '')
            .split(/[^a-z\s\-']/i)
            .map((str) => str.trim())
            .filter((s) => !!s && s !== '-');
          this.english[word][_pos].senses.push(..._att);

          _una = _una
            .replace(/\n/g, ';')
            .replace(/\([^)]*\)/g, '')
            .replace(/\[[^\]]*\]/g, '')
            .split(/[^a-z\s\-']/i)
            .map((str) => str.trim())
            .filter((s) => !!s && s !== '-');
          this.english[word][_pos].senses.push(..._una);
        }
      }
    }

    if (options?.save) {
      logger.info('Saving moot-en.json');
      fs.writeFileSync(
        this.jsonPathEnglish,
        JSON.stringify(this.english, null, 2)
      );
    }

    return this;
  }

  async #fetch(url) {
    let data;
    try {
      ({ data } = await axios.get(url));
    } catch (error) {
      throw new Error(error.message);
    }
    return data;
  }

  #cleanWord(word) {
    word = word
      .replace(/\([^)]*\)/g, '') // Remove (parentheses)
      .replace(/\[[^\]]*\]/g, '') // Remove [square brackets]
      .replace(/\n.*$/g, '') // Remove anything that comes after a newline
      .replace(/\s+/g, ' ') // Remove extra spaces between words
      .trim(); // Trim

    // If word does not have form "word" or "word word" or "word-word"...
    if (!WORD_REGEXP.test(word)) {
      // Take the first match before a "/" or ",".
      const match = word.match(
        new RegExp(`^${WORD_PATTERN}(?=\s*[\/,])`, 'iu')
      );
      if (!match) {
        // No word could be extracted.
        logger.verbose(`abandoned:\t"${word}"`);
        return null;
      }
      const clean = match[0];
      logger.verbose(`cleaned:\t"${word}" -> "${clean}"`);
      word = clean;
    }

    return word;
  }

  /*
   * Takes Anglish words from English->Anglish definitions and
   * adds them to the unified Anglish word object.
   */
  #addAnglishWordsFromEnglishDefs() {
    for (const englishWord in this.english) {
      const entry = this.english[englishWord];
      for (const pos in entry) {
        for (const anglishWord of entry[pos].senses) {
          // TODO: This could be replaced with lodash fn
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
  }

  /*
   * Cleans text entries found by scraper.
   */
  #processEntry(entry, type) {
    // Clean `att` or `una` field.
    const anglishWordsStr = util.cleanStr(entry[type]);
    if (!anglishWordsStr || /^\s?-\s?$/.test(anglishWordsStr)) {
      return;
    }
    const anglishWords = anglishWordsStr
      .split(/[,;]/g)
      .map((word) => word.trim());

    // Clean `eng` field.
    let englishWord = util.cleanStr(entry.eng);
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

    let filenames, isYAML;
    try {
      // Attempt to load JSON files before loading and parsing YAML.
      // (Parsing YAML files is much slower than loading directly from JSON.)
      // If `options.save` is specified, assume we want to reload the data.
      if (options?.save) {
        throw new Error();
      }
      filenames = util.getFilenames(this.dirJSON);
    } catch (e) {
      filenames = util.getFilenames(this.dirYAML);
      isYAML = true;
    }

    if (options?.save) {
      await mkdir(util.getPath(this.dirJSON), { recursive: true });
    }

    for (const [, fullPath] of filenames) {
      const file = fs.readFileSync(fullPath, 'utf-8');
      const json = isYAML ? YAML.parse(file) : JSON.parse(file);
      await this.#processFile(fullPath, json, isYAML, options);
    }

    return this;
  }

  /*
   * Adds similar words by mutual synset or `similar` array.
   * TODO: Do I need this?
   */
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

  async #processFile(fullPath, json, isYAML, options) {
    logger.info(`Loading ${fullPath}`);

    if (isYAML && options?.save) {
      fullPath = fullPath.replace(/(?<=\.)yaml$/, 'json');
      logger.info(`Saving ${fullPath}`);
      fs.writeFileSync(fullPath, JSON.stringify(json, null, 2));
    }

    if (/entries-\w\.(json|yaml)$/i.test(fullPath)) {
      for (const word in json) {
        const data = json[word];
        data.languages = ['English'];
        this.entries[word] = data;
        // Rename all `sense` keys to `senses`.
        for (const pos of _.without(Object.keys(data), 'languages')) {
          data[pos].senses = data[pos].sense;
          delete data[pos].sense;
        }
      }
    }

    if (/(adj|adv|noun|verb)\.\w+\.(json|yaml)$/i.test(fullPath)) {
      for (const word in json) {
        const data = json[word];
        this.synsets[word] = data;
      }
    }

    if (/frames(json|yaml)$/i.test(fullPath)) {
      // TODO: Handle frames file
    }
  }
}

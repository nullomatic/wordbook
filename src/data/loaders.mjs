import * as fs from 'fs';
import { createInterface } from 'node:readline/promises';
import axios from 'axios';
import * as cheerio from 'cheerio';
import csv from 'csvtojson';
import _ from 'lodash';
import YAML from 'yaml';
import * as util from './util.mjs';
import { logger } from './util.mjs';

const Sources = Object.freeze({
  WIKTIONARY: 1,
  HURLEBATTE: 2,
  MOOT_ENGLISH: 3,
  MOOT_ANGLISH: 4,
});

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
    this.anglish = {};
    this.dataPath = util.getPath('/assets/kaikki/kaikki-en.json');
    this.jsonPath = util.getPath('/assets/kaikki/wikt-anglish.json');
  }

  async load(options) {
    if (options?.save) {
      await this.#loadWiktData(options);
      logger.info(`Saving ${this.jsonPath}`);
      fs.writeFileSync(this.jsonPath, JSON.stringify(this.anglish, null, 2));
    } else {
      try {
        logger.info(`Loading ${this.jsonPath}`);
        const file = fs.readFileSync(this.jsonPath, 'utf-8');
        this.anglish = JSON.parse(file);
      } catch (error) {
        return this.load({ ...options, save: true });
      }
    }
    return this;
  }

  async #loadWiktData(options) {
    const handler = async (line) => {
      const json = JSON.parse(line);
      const word = json.word;

      let hasGermanic = false;
      let hasLatin = false;

      if (Array.isArray(json.etymology_templates)) {
        for (const etym of json.etymology_templates) {
          if (etym.name === 'inh') {
            if (
              /(Old English|Germanic|Norse|Saxon|Frankish)/i.test(
                etym.expansion
              )
            ) {
              hasGermanic = true;
            } else if (/(French|Latin|Greek)/i.test(etym.expansion)) {
              hasLatin = true;
            }
          }
        }
      }

      const isAnglish = hasGermanic && !hasLatin;

      if (isAnglish) {
        if (!util.WORD_REGEXP.test(word)) {
          return;
        }
        const pos = await this.#formatPartOfSpeech(word, json.pos);
        if (!pos) {
          return;
        }

        this.#createEntry(word, pos);
        this.anglish[word][pos].origin = json.etymology_text;

        for (const sense of json.senses) {
          for (const gloss of sense.glosses) {
            this.anglish[word][pos].senses.push({
              english: gloss,
              source: Sources.WIKTIONARY,
            });
          }
        }
        if (_.isEmpty(this.anglish[word])) {
          delete this.anglish[word];
        }
      }
    };

    await this.#loadWithStream((line) => [handler(line)]);
  }

  async #formatPartOfSpeech(word, _pos) {
    switch (_pos.toLowerCase()) {
      case 'noun':
        return 'n'; // noun
        break;
      case 'verb':
        return 'v'; // verb
        break;
      case 'adj':
        return 'a'; // adjective
        break;
      case 'adv':
        return 'r'; // adverb
        break;
      case 'conj':
        return 'c'; // conjunction
        break;
      case 'prep':
      case 'prep_phrase':
        return 'p'; // adposition
        break;
      case 'article':
      case 'det':
      case 'intj':
      case 'num':
      case 'phrase':
      case 'pron':
      case 'contraction':
        return 'x'; // other
        break;
      case 'particle':
      case 'character':
      case 'symbol':
        return null; // discard
      default:
        return null;
    }
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
    const stream = fs.createReadStream(this.dataPath);
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

  #createEntry(word, pos) {
    if (!Object.hasOwn(this.anglish, word)) {
      this.anglish[word] = {};
    }
    if (!Object.hasOwn(this.anglish[word], pos)) {
      this.anglish[word][pos] = {};
    }
    if (!Object.hasOwn(this.anglish[word][pos], 'senses')) {
      this.anglish[word][pos].senses = [];
    }
    if (!Object.hasOwn(this.anglish[word][pos], 'origin')) {
      this.anglish[word][pos].origin = null;
    }
  }
}

/**
 * Loads data from Hurlebatte's Anglish Wordbook CSV.
 * https://docs.google.com/spreadsheets/d/1y8_11RDvuCRyUK_MXj5K7ZjccgCUDapsPDI5PjaEkMw
 **/
export class HurlebatteLoader {
  constructor() {
    this.anglish = {};
    this.jsonPath = util.getPath('/assets/hurlebatte/hb-anglish.json');
  }

  async load(options) {
    if (options?.save) {
      await this.loadCSV();
      logger.info(`Saving ${this.jsonPath}`);
      fs.writeFileSync(this.jsonPath, JSON.stringify(this.anglish, null, 2));
    } else {
      try {
        logger.info(`Loading ${this.jsonPath}`);
        const file = fs.readFileSync(this.jsonPath, 'utf-8');
        this.anglish = JSON.parse(file);
      } catch (error) {
        return this.load({ ...options, save: true });
      }
    }
    return this;
  }

  async loadCSV(options) {
    const rows = await csv().fromFile(
      util.getPath('/assets/hurlebatte/wordbook.csv')
    );

    for (const row of rows) {
      const word = util.cleanWord(row['WORD']);
      if (!word) {
        continue;
      }

      const posArr = await this.#getPartsOfSpeech(
        row['KIND'],
        word,
        options?.interactive
      );

      const senses = row['MEANING']
        .replace(/\([^)]*\)/g, ',')
        .split(/[^\w\s'\-]/g)
        .map((s) => s.trim().replace(/^(a|an|to) /g, ''))
        .filter((s) => s);

      let origin = row['FROM'];
      if (row['FOREBEAR'] && row['FOREBEAR'] !== '~') {
        origin += `, ${row['FOREBEAR']}`;
      }
      if (row['NOTES']) {
        origin += `; ${row['NOTES']}`;
      }

      for (const pos of posArr) {
        this.#createEntry(word, pos);
        this.anglish[word][pos].origin = origin;
        for (const sense of senses) {
          this.anglish[word][pos].senses.push({
            english: sense,
            source: Sources.HURLEBATTE,
          });
        }
      }

      if (_.isEmpty(this.anglish[word])) {
        delete this.anglish[word];
      }
    }

    return this;
  }

  #createEntry(word, pos) {
    if (!Object.hasOwn(this.anglish, word)) {
      this.anglish[word] = {};
    }
    if (!Object.hasOwn(this.anglish[word], pos)) {
      this.anglish[word][pos] = {};
    }
    if (!Object.hasOwn(this.anglish[word][pos], 'senses')) {
      this.anglish[word][pos].senses = [];
    }
    if (!Object.hasOwn(this.anglish[word][pos], 'origin')) {
      this.anglish[word][pos].origin = null;
    }
  }

  async #getPartsOfSpeech(_pos, word, interactive) {
    const posArr = [];
    _pos = _pos
      .replace(/[\s\n]/g, '') // Remove all spaces and newlines
      .split(/[^\w]/) // Split on any non-word character
      .filter((s) => s);

    for (const pos of _pos) {
      switch (pos.toLowerCase()) {
        case 'n':
          posArr.push('n'); // noun
          break;
        case 'v':
          posArr.push('v'); // verb
          break;
        case 'aj':
          posArr.push('a'); // adjective
          break;
        case 'av':
          posArr.push('r'); // adverb
          break;
        case 'c':
          posArr.push('c'); // conjunction
          break;
        case 'p':
          posArr.push('p'); // adposition
          break;
        default:
          if (interactive) {
            return await util.promptPartOfSpeech(word, pos);
          }
      }
    }

    return posArr;
  }
}

/**
 * Loads table data from The Anglish Moot website.
 * https://anglish.fandom.com/wiki/
 **/
export class MootLoader {
  constructor() {
    this.baseURL = 'https://anglish.fandom.com';
    this.anglish = {};

    this.jsonPath = util.getPath('/assets/moot/moot-anglish.json');
    this.htmlDirAnglish = util.getPath('/assets/moot/html/anglish/');
    this.htmlDirEnglish = util.getPath('/assets/moot/html/english/');
  }

  async load(options) {
    if (options?.save) {
      await this.scrapeEnglish(options);
      await this.scrapeAnglish(options);
      this.#sortEntries();
      logger.info(`Saving ${this.jsonPath}`);
      fs.writeFileSync(this.jsonPath, JSON.stringify(this.anglish, null, 2));
    } else {
      try {
        logger.info(`Loading ${this.jsonPath}`);
        const file = fs.readFileSync(this.jsonPath, 'utf-8');
        this.anglish = JSON.parse(file);
      } catch (error) {
        return this.load({ ...options, save: true });
      }
    }

    return this;
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

  async #saveHTML(hrefs, dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    for (const href of hrefs) {
      const url = this.baseURL + href;
      const data = await this.#fetch(url);
      const filename = `${href.split('/').pop()}.html`;
      const fullPath = dir + filename;
      logger.info(`Saving ${fullPath}`);
      fs.writeFileSync(fullPath, data);
    }
  }

  async scrapeEnglish(options) {
    logger.info('Scraping English Moot data...');

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

          const englishWord = util.cleanWord(_word);
          if (!englishWord) {
            continue;
          }

          const posArr = await this.#getPartsOfSpeech(
            _pos,
            englishWord,
            options?.interactive
          );

          this.#reverseEnglish(_att, englishWord, posArr);
          this.#reverseEnglish(_una, englishWord, posArr);
        }
      }
    }

    return this;
  }

  async scrapeAnglish(options) {
    logger.info('Scraping Anglish Moot data...');

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

        const anglishWord = util.cleanWord(_word);
        if (!anglishWord) {
          continue;
        }

        const [words, origin] = _def.split(/[\[\]]/g);
        const senses = words
          .replace(/\([^)]*\)/g, ',')
          .split(/[^\w\s'\-]/g)
          .map((s) => s.trim().replace(/^(a|an|to) /g, ''))
          .filter((s) => s);

        const posArr = await this.#getPartsOfSpeech(_pos, anglishWord);
        for (const pos of posArr) {
          this.#createEntry(anglishWord, pos);
          if (origin) {
            this.anglish[anglishWord][pos].origin = origin;
          }
          for (const sense of senses) {
            this.anglish[anglishWord][pos].senses.push({
              english: sense,
              source: Sources.MOOT_ANGLISH,
            });
          }
        }

        if (_.isEmpty(this.anglish[anglishWord])) {
          delete this.anglish[anglishWord];
        }
      }
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

  async #getPartsOfSpeech(str, word, interactive) {
    const posArr = [];
    str = str
      .replace(/[\s\n]/g, '') // Remove all spaces and newlines
      .split(/[^\w]/) // Split on any non-word character
      .filter((s) => s);

    for (const _pos of str) {
      switch (_pos.toLowerCase()) {
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
          if (interactive) {
            return await util.promptPartOfSpeech(word, _pos);
          }
      }
    }

    return posArr;
  }

  /**
   * Reverses one english->anglish[] entry to multiple anglish->english entries.
   */
  #reverseEnglish(str, englishWord, posArr) {
    str = str
      .replace(/(?:^|\n).*?:/g, '') // Remove text coming before a colon
      .trim(); // Trim

    // Sometimes the regular expression wrongly extracts an origin acronym.
    const originRegExp = new RegExp(`^${util.MOOT_ORIGINS_PATTERN}`);

    const matches = str.matchAll(util.MOOT_ENGLISH_REGEXP);
    if (matches) {
      for (const match of matches) {
        const origin = match.groups.origin || null;
        for (const _word of match.groups.words.split(/[,;]/)) {
          const anglishWord = util.cleanWord(_word);
          if (!anglishWord || originRegExp.test(anglishWord)) {
            continue;
          } else if (!this.anglish[anglishWord]) {
            this.anglish[anglishWord] = {};
          }
          for (const pos of posArr) {
            this.#createEntry(anglishWord, pos);
            if (origin) {
              this.anglish[anglishWord][pos].origin = origin;
            }
            this.anglish[anglishWord][pos].senses.push({
              english: englishWord,
              source: Sources.MOOT_ENGLISH,
            });
          }
          if (_.isEmpty(this.anglish[anglishWord])) {
            delete this.anglish[anglishWord];
          }
        }
      }
    }
  }

  #createEntry(word, pos) {
    if (!Object.hasOwn(this.anglish, word)) {
      this.anglish[word] = {};
    }
    if (!Object.hasOwn(this.anglish[word], pos)) {
      this.anglish[word][pos] = {};
    }
    if (!Object.hasOwn(this.anglish[word][pos], 'senses')) {
      this.anglish[word][pos].senses = [];
    }
    if (!Object.hasOwn(this.anglish[word][pos], 'origin')) {
      this.anglish[word][pos].origin = null;
    }
  }

  #sortEntries() {
    const sorted = {};
    for (const key of Object.keys(this.anglish).sort()) {
      sorted[key] = this.anglish[key];
    }
    this.anglish = sorted;
  }
}

/**
 * Loads data from the Global WordNet.
 * https://globalwordnet.github.io/
 **/
export class WordNetLoader {
  constructor() {
    this.entries = {};
    this.synsets = {};
    this.dirYAML = util.getPath('/assets/wordnet/yaml');
    this.dirJSON = util.getPath('/assets/wordnet/json');
  }

  async load(options) {
    if (options?.save) {
      await this.#loadYAML();
    } else {
      await this.#loadJSON();
    }
    return this;
  }

  async #loadYAML() {
    fs.mkdirSync(this.dirJSON, { recursive: true });

    for (const [filename, fullPath] of util.getFilenames(this.dirYAML)) {
      logger.info(`Loading ${fullPath}`);

      const file = fs.readFileSync(fullPath, 'utf-8');
      const json = YAML.parse(file);

      if (/entries-\w\.yaml$/i.test(filename)) {
        for (const word in json) {
          const entry = json[word];
          // Rename all `sense` keys to `senses`.
          for (const pos of Object.keys(entry)) {
            entry[pos].senses = entry[pos].sense;
            delete entry[pos].sense;
          }
          entry.isAnglish = false;
          this.entries[word] = entry;
        }
      }

      if (/(adj|adv|noun|verb)\.\w+\.yaml$/i.test(filename)) {
        for (const synsetId in json) {
          const synset = json[synsetId];
          this.synsets[synsetId] = synset;
        }
      }

      if (/frames\.yaml$/i.test(filename)) {
        // TODO: Handle frames file
      }

      const filenameJSON = filename.replace(/yaml$/, 'json');
      const jsonFullPath = `${this.dirJSON}/${filenameJSON}`;
      logger.info(`Saving ${jsonFullPath}`);
      fs.writeFileSync(jsonFullPath, JSON.stringify(json, null, 2));
    }
  }

  async #loadJSON() {
    if (!fs.existsSync(this.dirJSON)) {
      return this.#loadYAML();
    }
    const filenames = util.getFilenames(this.dirJSON);
    if (!filenames.length) {
      return this.#loadYAML();
    }

    for (const [filename, fullPath] of filenames) {
      logger.info(`Loading ${fullPath}`);

      const file = fs.readFileSync(fullPath, 'utf-8');
      const json = JSON.parse(file);

      if (/entries-\w\.json$/i.test(filename)) {
        for (const word in json) {
          this.entries[word] = json[word];
        }
      }

      if (/(adj|adv|noun|verb)\.\w+\.json$/i.test(filename)) {
        for (const synsetId in json) {
          this.synsets[synsetId] = json[synsetId];
        }
      }

      if (/frames\.json$/i.test(filename)) {
        // TODO: Handle frames file
      }
    }
  }
}

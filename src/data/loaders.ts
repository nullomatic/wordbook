import { createInterface } from "node:readline/promises";
import axios from "axios";
import * as cheerio from "cheerio";
import _ from "lodash";
import prompt from "prompt";
import {
  AnglishEntries,
  AnglishEntry,
  WordnetEntry,
  WordnetSynset,
  CompiledEntry,
} from "../lib/types";
import * as util from "../lib/util";
import { logger } from "../lib/util";
import { OptionValues } from "commander";
import { AnglishSource, POS } from "../lib/constants";

const WORD_PATTERN = `\\p{L}+([-\\s']\\p{L}+){0,4}`;
const WORD_REGEXP = new RegExp(`^${WORD_PATTERN}$`, "iu");

/**
 * Loads Wiktionary data into Redis from the Kaikki (https://kaikki.org) JSON file
 * in the /assets/kaikki folder. It's big. Each line is an object and looks like this:
 *
 * {"pos": "noun", "word": "aardvark", "lang": "English", ... }
 *
 * To manage memory, we create a `readline` stream that processes entries in batches.
 **/
export class WiktionaryLoader {
  public static anglish: AnglishEntries = {};
  public static size: number;
  private static dataPath: string = "/data/assets/kaikki/kaikki-en.json";
  private static jsonPath: string = "/data/assets/kaikki/wikt-anglish.json";

  private constructor() {}

  public static async load(options: OptionValues): Promise<void> {
    if (options?.save) {
      logger.info(`Loading ${this.dataPath}`);
      await this.loadWithStream(this.lineHandler.bind(this));
      logger.info(`Writing ${this.jsonPath}`);
      util.writeJSON(this.anglish, this.jsonPath);
    } else {
      try {
        logger.info(`Loading ${this.jsonPath}`);
        this.anglish = util.readJSON(this.jsonPath);
      } catch (error) {
        await this.load({ ...options, save: true });
      }
    }
    this.size = Object.keys(this.anglish).length;
  }

  private static async lineHandler(line: string) {
    const json = JSON.parse(line);
    const word = json.word;
    const pos = this.formatPartOfSpeech(word, json.pos);
    if (!pos) {
      // If unwanted part of speech (null), skip.
      return;
    }
    const isWord = WORD_REGEXP.test(word);
    const isAnglish = this.isAnglish(json.etymology_templates, json);
    if (isWord && isAnglish) {
      this.createOrUpdateEntry(word, pos, json);
    }
  }

  public static isAnglish(templates: any[], word: string) {
    if (this.anglish[word]) {
      // If word has already been set to Anglish, return true.
      return true;
    }

    let hasGermanic = false;
    let hasLatin = false;

    if (Array.isArray(templates)) {
      let foundSource = false;
      for (const template of templates) {
        if (
          template.name === "inh" ||
          template.name === "der" ||
          template.name === "bor"
        ) {
          foundSource = true;
          if (
            /(English|Germanic|Norse|Saxon|Frankish)/i.test(template.expansion)
          ) {
            hasGermanic = true;
          } else if (/(French|Latin|Greek)/i.test(template.expansion)) {
            hasLatin = true;
          }
        }
      }

      if (!foundSource) {
        for (const template of templates) {
          if (template.name === "cog") {
            if (
              /(English|German|Norse|Saxon|Frankish|Danish)/i.test(
                template.expansion,
              )
            ) {
              hasGermanic = true;
            } else if (/(French|Latin|Greek)/i.test(template.expansion)) {
              hasLatin = true;
            }
          }
        }
      }
    }

    return hasGermanic && !hasLatin;
  }

  public static isAnglishCompound(
    templates: any[],
    word: string,
    compoundSource: Record<string, CompiledEntry>,
  ) {
    for (const template of templates) {
      if (compoundSource && template.name === "compound") {
        for (const key in template.args) {
          if (key === "1" || isNaN(parseInt(key))) continue;
          const part = template.args[key];
          if (!compoundSource[part]?.isAnglish) {
            return false;
          }
        }
      }
    }
    logger.verbose(`Setting compound word "${word}" to Anglish`);
    return true;
  }

  /**
   * Loads file via read stream and processes lines in batches.
   * @param handler Handler function to process each line. Return type is array of Promises.
   **/
  public static async loadWithStream(handler: (line: string) => Promise<void>) {
    // Adjust BATCH_SIZE to keep memory under Node limit.
    // Alternatively, adjust --max-old-space-size.
    const BATCH_SIZE = 50000;
    const stream = util.stream(this.dataPath);
    const rl = createInterface({ input: stream });
    const batches: Promise<void>[][] = [];
    let currentBatch: Promise<void>[] = [];
    let iteration = 0;
    let processed = 0;

    const processBatch = async () => {
      const batch = batches.shift();
      if (batch) {
        processed += batch.length;
        await Promise.all(batch);
        logger.info(`Processed ${processed} lines`);
      }
    };

    const unloadCurrentBatch = () => {
      if (currentBatch.length) {
        batches.push(currentBatch);
        currentBatch = [];
      }
    };

    rl.on("line", async function (line) {
      iteration++;
      currentBatch.push(handler(line));
      if (currentBatch.length === BATCH_SIZE) {
        rl.pause();
        unloadCurrentBatch();
        await processBatch();
        rl.resume();
      }
    });

    await new Promise<void>((resolve) =>
      rl.on("close", async () => {
        // Process any remaining batches.
        unloadCurrentBatch();
        while (batches.length) {
          await processBatch();
        }
        resolve();
      }),
    );

    if (iteration !== processed) {
      logger.warn(`WARN: Missed ${iteration - processed} entries`);
    }
  }

  public static formatPartOfSpeech(word: string, _pos: string): POS | null {
    switch (_pos.toLowerCase()) {
      case "noun":
        return POS.Noun;
      case "verb":
        return POS.Verb;
      case "adj":
        return POS.Adjective;
      case "adv":
        return POS.Adverb;
      case "conj":
        return POS.Conjunction;
      case "prep":
      case "prep_phrase":
        return POS.Adposition;
      case "article":
      case "det":
      case "intj":
      case "num":
      case "phrase":
      case "pron":
      case "contraction":
        return POS.Other;
      case "particle":
      case "character":
      case "symbol":
        return null;
      default:
        return null;
    }
  }

  private static createOrUpdateEntry(word: string, pos: POS, json: any) {
    const defaultPOS = {
      [pos]: {
        senses: [],
        origins: [],
      },
    } as AnglishEntry["pos"];
    const defaultEntry = {
      pos: defaultPOS,
      isAnglish: true,
    } as AnglishEntry;
    this.anglish[word] = _.defaultsDeep(this.anglish[word], defaultEntry);
    const entry = this.anglish[word];

    if (json.etymology_text) {
      entry.pos[pos]!.origins.push(json.etymology_text);
    }

    for (const sense of json.senses) {
      for (const gloss of sense.glosses) {
        entry.pos[pos]!.senses.push({
          english: gloss,
          source: AnglishSource.Wiktionary,
        });
      }
    }
  }
}

/**
 * Loads data from Hurlebatte's Anglish Wordbook CSV.
 * https://docs.google.com/spreadsheets/d/1y8_11RDvuCRyUK_MXj5K7ZjccgCUDapsPDI5PjaEkMw
 **/
export class HurlebatteLoader {
  public static anglish: AnglishEntries = {};
  public static size: number;
  private static dataPath: string = "/data/assets/hurlebatte/wordbook.csv";
  private static jsonPath: string = "/data/assets/hurlebatte/hb-anglish.json";

  private constructor() {}

  public static async load(options: OptionValues): Promise<void> {
    if (options?.save) {
      await this.loadCSV(options);
      logger.info(`Writing ${this.jsonPath}`);
      util.writeJSON(this.anglish, this.jsonPath);
    } else {
      try {
        logger.info(`Loading ${this.jsonPath}`);
        this.anglish = util.readJSON(this.jsonPath);
      } catch (error) {
        await this.load({ ...options, save: true });
      }
    }
    this.size = Object.keys(this.anglish).length;
  }

  private static async loadCSV(options: OptionValues) {
    const rows = await util.readCSV(this.dataPath);
    for (const row of rows) {
      const word = cleanWord(row["WORD"]);
      if (!word) {
        continue;
      }

      const posArr = await this.getPartsOfSpeech(
        row["KIND"],
        word,
        options?.interactive,
      );

      if (!posArr.length) {
        continue;
      }

      const senses = row["MEANING"]
        .replace(/\([^)]*\)/g, ",") // Remove square brackets
        .split(/[^\w\s'\-]/g) // Split on non-word characters
        .map((str: string) => str.trim().replace(/^(a|an|to) /g, "")) // Remove a/an/to at start
        .filter((str: string) => str);

      let origin: string = row["FROM"];
      if (row["FOREBEAR"] && row["FOREBEAR"] !== "~") {
        origin += `, ${row["FOREBEAR"]}`;
      }
      if (row["NOTES"]) {
        origin += `; ${row["NOTES"]}`;
      }

      this.createOrUpdateEntry(word, posArr, senses, origin);
    }

    return this;
  }

  private static createOrUpdateEntry(
    word: string,
    posArr: POS[],
    senses: string[],
    origin: string,
  ) {
    const defaultPOS = posArr.reduce(
      (acc, pos) => {
        acc[pos] = {
          senses: [],
          origins: [],
        };
        return acc;
      },
      {} as AnglishEntry["pos"],
    );
    const defaultEntry = {
      pos: defaultPOS,
      isAnglish: true,
    } as AnglishEntry;
    this.anglish[word] = _.defaultsDeep(this.anglish[word], defaultEntry);
    const entry = this.anglish[word];

    for (const pos of posArr) {
      if (origin) {
        entry.pos[pos]!.origins.push(origin);
      }
      for (const sense of senses) {
        entry.pos[pos]!.senses.push({
          english: sense,
          source: AnglishSource.Hurlebatte,
        });
      }
    }
  }

  private static async getPartsOfSpeech(
    posString: string,
    word: string,
    interactive: boolean,
  ) {
    const posArr: POS[] = [];
    const posArrRaw = posString
      .replace(/[\s\n]/g, "") // Remove spaces and newlines
      .split(/[^\w]/) // Split on non-word characters
      .filter((str: string) => str);

    for (const posRaw of posArrRaw) {
      switch (posRaw.toLowerCase()) {
        case "n":
          posArr.push(POS.Noun);
          break;
        case "v":
          posArr.push(POS.Verb);
          break;
        case "aj":
          posArr.push(POS.Adjective);
          break;
        case "av":
          posArr.push(POS.Adverb);
          break;
        case "c":
          posArr.push(POS.Conjunction);
          break;
        case "p":
          posArr.push(POS.Adposition);
          break;
        default:
          if (interactive) {
            const pos = await promptPartOfSpeech(word, posRaw);
            posArr.push(pos);
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
  public static anglish: AnglishEntries = {};
  public static size: number;
  private static baseURL: string = "https://anglish.fandom.com";
  private static htmlDirEnglish: string = "/data/assets/moot/html/english/";
  private static htmlDirAnglish: string = "/data/assets/moot/html/anglish/";
  private static jsonPath: string = "/data/assets/moot/moot-anglish.json";

  private static originsPattern: string = (() => {
    const json = util.readJSON("/data/assets/moot/abbreviations.json");
    const pattern = `(${Object.keys(json)
      .map((s) => s.replace(".", ""))
      .join("|")})`;
    return pattern;
  })();
  private static englishRegExp = new RegExp(
    `(?<!\\()(?<words>${WORD_PATTERN}(, (${WORD_PATTERN})?)*)(?!\\))(\\s?\\((?<origin>[^\\)]*)\\))?`,
    "iug",
  );

  private constructor() {}

  public static async load(options: OptionValues): Promise<void> {
    if (options?.save) {
      await this.scrapeEnglish(options);
      await this.scrapeAnglish(options);
      this.anglish = util.sortObj(this.anglish);
      logger.info(`Writing ${this.jsonPath}`);
      util.writeJSON(this.anglish, this.jsonPath);
    } else {
      try {
        logger.info(`Loading ${this.jsonPath}`);
        this.anglish = util.readJSON(this.jsonPath);
      } catch (error) {
        await this.load({ ...options, save: true });
      }
    }
    this.size = Object.keys(this.anglish).length;
  }

  private static async fetchEnglishHTML() {
    logger.info("Local HTML not found. Fetching English HTML...");
    let data = await this.fetch(`${this.baseURL}/wiki/English_Wordbook`);
    const $ = cheerio.load(data);
    const hrefs = Array.from(
      $("big")
        .first()
        .find("a")
        .map((i, el) => $(el).attr("href")),
    );
    await this.saveHTML(hrefs, this.htmlDirEnglish);
  }

  private static async fetchAnglishHTML() {
    logger.info("Local HTML not found. Fetching Anglish HTML...");
    let data = await this.fetch(`${this.baseURL}/wiki/Anglish_Wordbook`);
    const $ = cheerio.load(data);
    const hrefs = Array.from(
      $("tbody")
        .first()
        .find("a")
        .map((i, el) => $(el).attr("href")),
    );
    await this.saveHTML(hrefs, this.htmlDirAnglish);
  }

  private static async saveHTML(hrefs: string[], dir: string) {
    util.makeDir(dir);
    for (const href of hrefs) {
      const url = this.baseURL + href;
      const data = await this.fetch(url);
      const filename = `${href.split("/").pop()}.html`;
      logger.info(`Writing ${dir}${filename}`);
      util.writeFile(data, dir, filename);
    }
  }

  private static async scrapeEnglish(options: OptionValues) {
    logger.info("Scraping English Moot data...");

    let files = util.getFiles(`${this.htmlDirEnglish}*`);
    if (!files.length) {
      await this.fetchEnglishHTML();
      files = util.getFiles(`${this.htmlDirEnglish}*`);
    }

    for (const { path } of files) {
      logger.verbose(`Scraping ${path}`);

      const data = util.readFile(path);
      const $ = cheerio.load(data);

      for (const el of Array.from($("table > tbody > tr"))) {
        const cells = $(el).children("td");
        if (cells.length === 4) {
          let [_word, _pos, _att, _una] = Array.from(cells).map((cell, i) => {
            if (i < 3) {
              return $(cell).text();
            } else {
              return $(cell).text();
            }
          });

          const englishWord = cleanWord(_word);
          if (!englishWord) {
            continue;
          }

          const posArr = await this.getPartsOfSpeech(
            _pos,
            englishWord,
            options?.interactive,
          );

          this.reverseEnglish(_att, englishWord, posArr);
          this.reverseEnglish(_una, englishWord, posArr);
        }
      }
    }

    return this;
  }

  private static async scrapeAnglish(options: OptionValues) {
    logger.info("Scraping Anglish Moot data...");

    let files = util.getFiles(`${this.htmlDirAnglish}*`);
    if (!files.length) {
      await this.fetchAnglishHTML();
      files = util.getFiles(`${this.htmlDirAnglish}*`);
    }

    for (const { path } of files) {
      logger.verbose(`Scraping ${path}`);

      const data = util.readFile(path);
      const $ = cheerio.load(data);

      for (const el of Array.from($("table > tbody > tr"))) {
        if ($(el).children("td").length !== 3) {
          continue;
        }

        const cells = $(el).find("td");
        let [_word, _pos, _def] = Array.from(cells).map((cell) =>
          $(cell).text(),
        );

        const anglishWord = cleanWord(_word);
        if (!anglishWord) {
          continue;
        }

        const [words, origin] = _def.split(/[\[\]]/g);
        const senses = words
          .replace(/\([^)]*\)/g, ",") // Remove square brackets
          .split(/[^\w\s'\-]/g) // Split on non-word characters
          .map((s) => s.trim().replace(/^(a|an|to) /g, "")) // Remove a/an/to at start
          .filter((s) => s);

        const posArr = await this.getPartsOfSpeech(
          _pos,
          anglishWord,
          options?.interactive,
        );

        this.createOrUpdateEntry(
          anglishWord,
          posArr,
          senses,
          AnglishSource.MootAnglish,
        );
      }
    }

    return this;
  }

  private static async fetch(url: string) {
    let data;
    try {
      ({ data } = await axios.get(url));
    } catch (error: any | unknown) {
      throw new Error(error.message);
    }
    return data;
  }

  private static async getPartsOfSpeech(
    posString: string,
    word: string,
    interactive: boolean,
  ) {
    const posArr: POS[] = [];
    const posArrRaw = posString
      .replace(/[\s\n]/g, "") // Remove spaces and newlines
      .split(/[^\w]/) // Split on non-word characters
      .filter((str) => str);

    for (const posRaw of posArrRaw) {
      switch (posRaw.toLowerCase()) {
        case "noun":
        case "n":
          posArr.push(POS.Noun);
          break;
        case "verb":
        case "vb":
        case "vt":
        case "v":
          posArr.push(POS.Verb);
          break;
        case "adj":
          posArr.push(POS.Adjective);
          break;
        case "adv":
          posArr.push(POS.Adverb);
          break;
        case "conj":
          posArr.push(POS.Conjunction);
          break;
        case "prep":
          posArr.push(POS.Adposition);
          break;
        default:
          if (interactive) {
            const pos = await promptPartOfSpeech(word, posRaw);
            posArr.push(pos);
          }
      }
    }

    return posArr;
  }

  /**
   * Reverses one english->anglish[] entry to multiple (anglish->english)[] entries.
   */
  private static reverseEnglish(
    str: string,
    englishWord: string,
    posArr: POS[],
  ) {
    str = str
      .replace(/(?:^|\n).*?:/g, "") // Remove text coming before a colon
      .trim();

    // Sometimes the regular expression wrongly extracts an origin acronym.
    const originRegExp = new RegExp(`^${this.originsPattern}`);

    const matches = str.matchAll(this.englishRegExp);
    if (matches) {
      for (const match of matches) {
        const origin = match.groups?.origin;
        const words = match.groups?.words;
        if (words) {
          for (const _word of words.split(/[,;]/)) {
            const anglishWord = cleanWord(_word);
            if (!anglishWord || originRegExp.test(anglishWord)) {
              continue;
            }
            this.createOrUpdateEntry(
              anglishWord,
              posArr,
              [englishWord],
              AnglishSource.MootEnglish,
              origin,
            );
          }
        }
      }
    }
  }

  private static createOrUpdateEntry(
    word: string,
    posArr: POS[],
    senses: string[],
    source: AnglishSource,
    origin?: string,
  ) {
    const defaultPOS = posArr.reduce(
      (acc, pos) => {
        acc[pos] = {
          senses: [],
          origins: [],
        };
        return acc;
      },
      {} as AnglishEntry["pos"],
    );
    const defaultEntry = {
      pos: defaultPOS,
      isAnglish: true,
    } as AnglishEntry;
    this.anglish[word] = _.defaultsDeep(this.anglish[word], defaultEntry);
    const entry = this.anglish[word];

    for (const pos of posArr) {
      if (origin) {
        entry.pos[pos]!.origins.push(origin);
      }
      for (const sense of senses) {
        entry.pos[pos]!.senses.push({
          english: sense,
          source,
        });
      }
    }
  }
}

/**
 * Loads data from the Global WordNet.
 * https://globalwordnet.github.io/
 **/
export class WordnetLoader {
  public static entries: Record<string, WordnetEntry> = {};
  public static synsets: Record<string, WordnetSynset> = {};
  public static sizeEntries: number;
  public static sizeSynsets: number;
  private static dirYAML: string = "/data/assets/wordnet/yaml/";
  private static dirJSON: string = "/data/assets/wordnet/json/";

  private constructor() {}

  public static async load(options: OptionValues): Promise<void> {
    if (options?.save) {
      await this.loadYAML();
    } else {
      await this.loadJSON();
    }
    this.sizeEntries = Object.keys(this.entries).length;
    this.sizeSynsets = Object.keys(this.synsets).length;
  }

  private static async loadYAML() {
    util.makeDir(this.dirJSON);
    const files = util.getFiles(`${this.dirYAML}*.yaml`);
    logger.info(`Loading files in ${this.dirYAML}`);

    for (const { filename, path } of files) {
      logger.verbose(`Loading ${path}`);

      const json = util.readYAML(path);

      if (/entries-\w\.yaml$/i.test(filename)) {
        for (const word in json) {
          const entry: WordnetEntry = json[word];
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

      const filenameJSON = filename.replace(/yaml$/, "json");
      logger.info(`Writing ${this.dirJSON}${filenameJSON}`);
      util.writeJSON(json, this.dirJSON, filenameJSON);
    }
  }

  private static async loadJSON() {
    const files = util.getFiles(`${this.dirJSON}*`);
    if (!files.length) {
      return this.loadYAML();
    }

    logger.info(`Loading files in ${this.dirJSON}`);

    for (const { filename, path } of files) {
      logger.verbose(`Loading ${path}`);

      const json = util.readJSON(path);

      if (/entries-\w\.json$/i.test(filename)) {
        for (const word in json) {
          const entry: WordnetEntry = json[word];
          this.entries[word] = entry;
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

function cleanWord(word: string) {
  word = word
    .replace(/\([^)]*\)/g, "") // Remove (parentheses)
    .replace(/\[[^\]]*\]/g, "") // Remove [square brackets]
    .replace(/\n.*$/g, "") // Remove anything that comes after a newline
    .replace(/\s+/g, " ") // Remove extra spaces between words
    .trim(); // Trim

  // If word does not have form "word" or "word word" or "word-word"...
  if (!WORD_REGEXP.test(word)) {
    // Take the first match before a "/" or ",".
    const match = word.match(new RegExp(`^${WORD_PATTERN}(?=\s*[\/,])`, "iu"));
    if (!match) {
      // No word could be extracted.
      if (word) {
        logger.verbose(`abandoned:\t"${word}"`);
      }
      return null;
    }
    const clean = match[0];
    logger.verbose(`cleaned:\t"${word}" -> "${clean}"`);
    word = clean;
  }

  return word;
}

async function promptPartOfSpeech(word: string, _pos: string): Promise<POS> {
  const schema: prompt.Schema = {
    properties: {
      pos: {
        description: `Part of speech for '${word}:${_pos}'`,
        type: "string",
        pattern: /^(n|v|a|r|s|c|p|x|u)$/,
        message: "Part of speech must be of selection (n|v|a|r|s|c|p|x|u)",
      },
    },
  };
  prompt.start();
  const input = await new Promise((resolve, reject) => {
    prompt.get(schema, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
  return input as POS;
}

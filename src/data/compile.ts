import * as fs from 'fs';
import _ from 'lodash';
// import * as gpt from './gpt';
import {
  MootLoader,
  WiktionaryLoader,
  WordnetLoader,
  HurlebatteLoader,
} from './loaders';
import { logger } from '../lib/util';
import * as util from '../lib/util';
import { OptionValues } from 'commander';
import {
  AnglishEntries,
  AnglishEntry,
  AnglishSource,
  CompiledEntry,
  MatchedSenses,
  POS,
  Sound,
} from '../lib/types';

class Compiler {
  public static entries: Record<string, CompiledEntry> = {};
  private static matchedSenses: MatchedSenses = {};
  private constructor() {}
  public static async compile(options: OptionValues) {
    await WiktionaryLoader.load({
      ...options,
      save: options?.save?.includes('wikt'),
    });
    await HurlebatteLoader.load({
      ...options,
      save: options?.save?.includes('hb'),
    });
    await MootLoader.load({
      ...options,
      save: options?.save?.includes('moot'),
    });
    await WordnetLoader.load({
      ...options,
      save: options?.save?.includes('wordnet'),
    });

    logger.info(`Hurlebatte entries:\t${HurlebatteLoader.size}`);
    logger.info(`Moot entries:\t\t${MootLoader.size}`);
    logger.info(`Wiktionary entries:\t${WiktionaryLoader.size}`);
    logger.info(`WordNet entries:\t\t${WordnetLoader.sizeEntries}`);
    logger.info(`WordNet synsets:\t\t${WordnetLoader.sizeSynsets}`);

    this.cloneWordnetEntries();
    this.loadMatchedSenses();
    this.mergeAnglishSource(HurlebatteLoader.anglish);
    this.mergeAnglishSource(MootLoader.anglish);
    this.mergeAnglishSource(WiktionaryLoader.anglish);
    await this.addWiktionaryData();
    this.setAnglishByWordParts();
    this.entries = util.sortObj(this.entries);
    this.writeMasterWordNet();
  }

  private static cloneWordnetEntries() {
    for (const word in WordnetLoader.entries) {
      const entry = WordnetLoader.entries[word];
      this.entries[word] = { pos: {}, isAnglish: false } as CompiledEntry;
      let pos: POS;
      for (pos in entry) {
        _.set(this.entries, [word, 'pos', pos], {
          senses: entry[pos].sense,
          pronunciation: entry[pos].pronunciation,
          rhyme: entry[pos].rhymes,
          forms: entry[pos].form,
          sounds: entry[pos].sounds,
          origins: [],
        });
      }
    }
  }

  private static loadMatchedSenses() {
    const file = util.readFile('/data/gpt/gpt-matched.out');
    const lines = file.split('\n');
    for (const line of lines) {
      if (!line) continue;
      const { word, ...pos } = JSON.parse(line);
      this.matchedSenses[word] = { pos };
    }
  }

  private static async mergeAnglishSource(source: AnglishEntries) {
    for (const word in source) {
      const sourceEntry = source[word];
      const defaultPOS = Object.keys(sourceEntry.pos).reduce((acc, pos) => {
        acc[pos as POS] = {
          senses: [],
          origins: [],
        };
        return acc;
      }, {} as CompiledEntry['pos']);
      const defaultEntry = {
        pos: defaultPOS,
        isAnglish: true,
      } as CompiledEntry;
      this.entries[word] = _.defaultsDeep(this.entries[word], defaultEntry);
      const entry = this.entries[word];

      let pos: POS;
      for (pos in sourceEntry.pos) {
        const matchedSenses = this.matchedSenses[word]?.pos[pos]?.map(
          (synsetId) => ({
            synset: synsetId,
          })
        );
        if (matchedSenses?.length) {
          entry.pos[pos].senses!.push(...matchedSenses);
        } else {
          const sourceSenses = sourceEntry.pos[pos]!.senses;
          const relatedSenses = this.getRelatedSenses(pos, sourceSenses);
          entry.pos[pos].senses!.push(...relatedSenses);
        }
        const origins = source[word].pos[pos]!.origins;
        if (origins) {
          entry.pos[pos].origins!.push(...origins);
        }
      }
    }
  }

  private static getRelatedSenses(
    pos: POS,
    senses: { english: string; source: AnglishSource }[]
  ) {
    const relatedSenses = [];
    for (const { english: word } of senses) {
      const wordnetSenses = WordnetLoader.entries[word]?.[pos]?.sense;
      if (wordnetSenses) {
        relatedSenses.push(...wordnetSenses);
      }
    }
    return relatedSenses;
  }

  private static async addWiktionaryData() {
    logger.info(`Adding Wiktionary metadata...`);
    // There is a lot of good information in the Kaikki data, like comprehensive
    // word origins, pronunciation, translations... Extract and link some of it.
    const handler = async (line: string) => {
      const json = JSON.parse(line);
      const word = json.word;
      const pos = await WiktionaryLoader.formatPartOfSpeech(word, json.pos);
      if (!pos) {
        return;
      }
      const entry = this.entries[word];
      if (entry) {
        this.entries[word].isAnglish = WiktionaryLoader.isAnglish(
          json.etymology_templates
        );
        if (entry.pos[pos]) {
          if (json.etymology_text) {
            // This avoids adding duplicate origin information.
            const uniqueOrigins = new Set(entry.pos[pos].origins);
            uniqueOrigins.add(json.etymology_text);
            entry.pos[pos].origins = Array.from(uniqueOrigins);
          }
          if (json.sounds) {
            entry.pos[pos].sounds = json.sounds;
            const rhyme = this.extractRhyme(json.sounds);
            if (rhyme) {
              entry.pos[pos].rhyme = rhyme;
            }
          }
        }
      }
    };

    await WiktionaryLoader.loadWithStream(handler);
  }

  /**
   * Extracts IPA rhyme from `sounds` key.
   */
  private static extractRhyme(sounds: Sound[]) {
    for (const sound of sounds) {
      if (sound.rhymes) {
        return sound.rhymes;
      }
    }
  }

  private static setAnglishByWordParts() {
    main: for (const word in this.entries) {
      if (!this.entries[word].isAnglish) {
        const parts = word.split(/[\s-]/);
        if (parts.length > 1) {
          for (const part of parts) {
            if (!this.entries[part]?.isAnglish) {
              continue main;
            }
          }
          logger.verbose(`Setting compound word "${word}" to Anglish`);
          this.entries[word].isAnglish = true;
        }
      }
    }
  }

  private static writeMasterWordNet() {
    const countTotal = Object.keys(this.entries).length;
    const countAnglish = Object.keys(this.entries).filter(
      (word) => this.entries[word].isAnglish
    ).length;

    logger.info(`Total entries (AN+EN):\t${countTotal}`);
    logger.info(`Total entries (AN):\t${countAnglish}`);

    const master = new Array(26)
      .fill(null)
      .reduce((acc, cur, i) => ((acc[String.fromCharCode(i + 97)] = {}), acc), {
        0: {},
      });
    for (const word in this.entries) {
      this.entries[word] = util.sortObj(this.entries[word]);
      this.entries[word].pos = util.sortObj(this.entries[word].pos);

      const code = word.toLowerCase().charCodeAt(0);
      const letter = String.fromCharCode(code);
      if (code >= 97 && code <= 122) {
        // a-z
        master[letter][word] = this.entries[word];
      } else {
        // 0
        master['0'][word] = this.entries[word];
      }
    }

    const dir = '/data/compiled/';
    util.makeDir(dir);
    for (const key in master) {
      const filename = `entries-${key}.json`;
      const path = dir + filename;
      logger.info(`Saving ${path}`);
      util.writeJSON(util.sortObj(master[key]), path);
    }
  }
}

/**
 * Loads Anglish words from all sources and compiles them into a single
 * unified dictionary object, which is then sent to ChatGPT to refine.
 **/
export default Compiler.compile.bind(Compiler);

// async function condenseSenses() {
//   const toCondense = {};
//   for (const word in WordnetLoader.entries) {
//     for (const pos in WordnetLoader.entries[word]) {
//       if (pos === 'isAnglish') continue;
//       addToCondense(word, pos, toCondense);
//     }
//   }
//   const reqCount = Object.keys(toCondense).length;
//   gpt.estimateReqTime(reqCount, 'Condense senses');
//   await gpt.matchSenses(toMatch, reqCount);
// }

// async function matchSenses() {
//   const toMatch = {};
//   for (const word in WordnetLoader.entries) {
//     if (WordnetLoader.entries[word].isAnglish) {
//       for (const pos in WordnetLoader.entries[word]) {
//         if (pos === 'isAnglish') continue;
//         addToMatch(word, pos, wordnet, toMatch);
//       }
//     }
//   }
//   const reqCount = Object.keys(toMatch).length;
//   gpt.estimateReqTime(reqCount, 'Match senses');
//   await gpt.matchSenses(toMatch, reqCount);
// }

// function addToCondense(word, pos, toCondense) {
//   let willCondense = false;
//   for (const sense of WordnetLoader.entries[word].pos[pos].senses) {
//     if (sense.english?.split(/\s/).length > 2) {
//       willCondense = true;
//     }
//   }
//   if (willCondense) {
//     _.set(
//       toCondense,
//       `${word}.${pos}`,
//       WordnetLoader.entries[word].pos[pos].senses.map(({ english }) => english)
//     );
//   }
// }

// function loadCondensed() {
//   const file = fs.readFileSync(getPath('/gpt/gpt-condensed.out'), 'utf-8');
//   const lines = file.split('\n');
//   for (const line of lines) {
//     if (!line) continue;
//     const { word, ...entry } = JSON.parse(line);
//     for (const pos in entry) {
//       WordnetLoader.entries[word].pos[pos].senses = entry[pos].map((str) => ({
//         english: str,
//       }));
//     }
//   }
// }

// function addToMatch(word, pos, toMatch) {
//   const senses = WordnetLoader.entries[word].pos[pos].senses
//     .map(({ english }) => english)
//     .filter((s) => s);
//   const candidates = [];
//   for (const sense of senses) {
//     if (WordnetLoader.entries[sense]?.[pos]) {
//       for (const { synset: id } of WordnetLoader.entries[sense][pos].senses) {
//         if (id) {
//           candidates.push({ id, def: WordnetLoader.synsets[id].definition[0] });
//         }
//       }
//     }
//   }
//   // Matching every sense would take forever, so we triage.
//   if (candidates.length > SYNSET_CANDIDATES_THRESHOLD) {
//     _.set(toMatch, `${word}.${pos}`, { senses, candidates });
//   }
// }

// async function fixCondenseErrors() {
//   const file = fs.readFileSync(getPath('/gpt/gpt-condensed.err'), 'utf-8');
//   const lines = file.split('\n');
//   const toCondense = {};
//   for (const line of lines) {
//     if (!line) continue;
//     const [word, pos] = line.split(':');
//     addToCondense(word, pos, toCondense);
//   }
//   const reqCount = Object.keys(toCondense).length;
//   gpt.estimateReqTime(reqCount, 'Condense senses');
//   await gpt.condenseSenses(toCondense, reqCount);
// }

// async function fixMatchErrors() {
//   const file = fs.readFileSync(getPath('/gpt/gpt-matched.err'), 'utf-8');
//   const lines = file.split('\n');
//   const toMatch = {};
//   for (const line of lines) {
//     if (!line) continue;
//     const [word, pos] = line.split(':');
//     addToMatch(word, pos, toMatch);
//   }
//   const reqCount = Object.keys(toMatch).length;
//   gpt.estimateReqTime(reqCount, 'Match senses');
//   await gpt.matchSenses(toMatch, reqCount);
// }

function formatSenseId(word: string, pos: POS) {
  const ss_type =
    ['n', 'v', 'a', 'r', 's', 'c', 'p', 'x', 'u'].indexOf(pos) + 1;
  const lex_filenum = '';
  const lex_id = '';
  const head_word = '';
  const head_id = '';
  return `${word
    .replace(' ', '_')
    .toLowerCase()}%${ss_type}:${lex_filenum}:${lex_id}:${head_word}:${head_id}`;
}

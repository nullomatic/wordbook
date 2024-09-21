import _ from 'lodash';
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
  CompiledEntry,
  MatchedSenses,
  Sound,
} from '../lib/types';
import { AnglishSource, POS } from '@/lib/constants';

class Compiler {
  public static entries: Record<string, CompiledEntry> = {};
  private static matchedSenses: MatchedSenses = {};

  private constructor() {}

  /**
   * TODO
   */
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
    // This merge order is important. Wiktionary has the most comprehensive data;
    // merge it first, so that subsequent sources do not overwrite its entries.
    this.mergeAnglishSource(WiktionaryLoader.anglish);
    this.mergeAnglishSource(HurlebatteLoader.anglish);
    this.mergeAnglishSource(MootLoader.anglish);
    await this.addWiktionaryData();
    this.iteratePartsOfSpeech();
    this.setAnglishByWordParts();
    this.entries = util.sortObj(this.entries);
    this.writeMasterWordNet();
  }

  private static getDefaultEntry(isAnglish: boolean) {
    return {
      pos: {},
      isAnglish,
    } as CompiledEntry;
  }

  private static getDefaultPOS() {
    return {
      senses: [],
      pronunciation: [],
      rhyme: '',
      forms: [],
      sounds: [],
      origins: [],
    };
  }

  private static cloneWordnetEntries() {
    for (const word in WordnetLoader.entries) {
      const wordnetEntry = WordnetLoader.entries[word];
      const entry = (this.entries[word] = this.getDefaultEntry(false));
      let pos: POS;
      for (pos in wordnetEntry) {
        entry.pos[pos] = {
          senses: wordnetEntry[pos].sense || [],
          pronunciation: wordnetEntry[pos].pronunciation || [],
          rhyme: wordnetEntry[pos].rhymes || '',
          forms: wordnetEntry[pos].form || [],
          sounds: wordnetEntry[pos].sounds || [],
          origins: [],
        };
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
      if (WordnetLoader.entries[word]) {
        this.entries[word].isAnglish = true;
        continue;
      }

      if (!this.entries[word]) {
        this.entries[word] = this.getDefaultEntry(true);
      }

      const entry = this.entries[word];
      const sourceEntry = source[word];

      let pos: POS;
      for (pos in sourceEntry.pos) {
        entry.pos[pos] = entry.pos[pos] || this.getDefaultPOS();
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
          entry.pos[pos].senses.push(...relatedSenses);
        }

        // I've commented this out to allow addWiktionaryData() to add only its
        // origins. Others can be added later with parsing help from ChatGPT.

        // const origins = source[word].pos[pos]!.origins;
        // if (origins) {
        //   entry.pos[pos].origins.push(...origins);
        // }
      }
    }
  }

  /*
   * This is not a great way to match senses.
   * If we have a word, like "dough", and on that word are a bunch of unmatched senses like
   * [{ english: "change (as in $)" ...}], and we pull from { "change": { n: { senses: [<"altered condition" + other unwanted senses>...] }}},
   * we are potentially going to match a lot of unrelated senses.
   * TODO: Use ChatGPT API to match better.
   */
  private static getRelatedSenses(
    pos: POS,
    sourceSenses: { english: string; source: AnglishSource }[]
  ) {
    const relatedSenses: any[] = [];
    return relatedSenses;
    for (const { english: word } of sourceSenses) {
      const wordnetSenses = WordnetLoader.entries[word]?.[pos]?.sense;
      if (wordnetSenses) {
        relatedSenses.push(...wordnetSenses);
      }
    }
    return relatedSenses;
  }

  private static async addWiktionaryData() {
    // There is a lot of good information in the Kaikki data, like comprehensive
    // word origins, pronunciation, translations... Extract and link some of it.
    const parseLine = async (line: string) => {
      const json = JSON.parse(line);
      const word = json.word;
      const pos: POS | null = await WiktionaryLoader.formatPartOfSpeech(
        word,
        json.pos
      );
      const entry = this.entries[word];
      return { word, pos, entry, json };
    };

    const firstPass = async (line: string) => {
      const { word, pos, entry, json } = await parseLine(line);
      if (!pos) {
        return;
      }
      if (entry) {
        if (!entry.isAnglish) {
          this.entries[word].isAnglish = WiktionaryLoader.isAnglish(
            json.etymology_templates,
            word
          );
        }
        if (entry.pos[pos]) {
          if (json.etymology_text) {
            entry.pos[pos].origins.push(json.etymology_text);
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

    const secondPass = async (line: string) => {
      const { word, pos, entry, json } = await parseLine(line);
      if (!pos) {
        return;
      }
      if (entry) {
        if (!entry.isAnglish) {
          if (
            json.etymology_templates?.some(
              (template: any) => template.name === 'compound'
            )
          ) {
            // This must run on the second pass, after all single-part
            // words have had their `isAnglish` field set.
            this.entries[word].isAnglish = WiktionaryLoader.isAnglishCompound(
              json.etymology_templates,
              word,
              this.entries
            );
          }
        }
      }
    };

    logger.info(`Adding Wiktionary metadata (pass 1)...`);
    await WiktionaryLoader.loadWithStream(firstPass);
    logger.info(`Adding Wiktionary metadata (pass 2)...`);
    await WiktionaryLoader.loadWithStream(secondPass);
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

    const dir = '/data/assets/compiled/';
    util.makeDir(dir);
    for (const key in master) {
      const filename = `entries-${key}.json`;
      const path = dir + filename;
      logger.info(`Writing ${path}`);
      util.writeJSON(util.sortObj(master[key]), path);
    }
  }

  private static iteratePartsOfSpeech() {
    for (const word in this.entries) {
      const entry = this.entries[word];
      let pos: POS;
      for (pos in entry.pos) {
        const part = entry.pos[pos];
        if (!part.senses.length) {
          // logger.verbose(`Removing part "${word}:${pos}" (no senses)`);
          // delete entry.pos[pos];
          // continue;
        }
        part.senses = _.uniqBy(part.senses, (sense) => sense.synset);
        part.origins = _.uniq(part.origins);
      }
      if (!Object.keys(entry.pos).length) {
        // logger.verbose(`Removing word "${word}" (no parts of speech)`);
        // delete this.entries[word];
      }
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

/**
 * TODO
 */
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

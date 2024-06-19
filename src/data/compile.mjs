import * as fs from 'fs';
import _ from 'lodash';
import * as gpt from './gpt.mjs';
import {
  MootLoader,
  WiktionaryLoader,
  WordNetLoader,
  HurlebatteLoader,
} from './loaders.mjs';
import { logger, getPath, sortObj } from './util.mjs';

/**
 * Loads Anglish words from all sources and compiles them into a single
 * unified dictionary object, which is then sent to ChatGPT to refine.
 **/
export default async function compileSources(options) {
  console.time('compileSources');

  let saveWikt, saveWordbook, saveMoot, saveWordNet;
  if (options?.save) {
    for (const source of options.save) {
      if (source === 'wikt') {
        saveWikt = true;
      }
      if (source === 'wordbook') {
        saveWordbook = true;
      }
      if (source === 'moot') {
        saveMoot = true;
      }
      if (source === 'wordnet') {
        saveWordNet = true;
      }
    }
  }

  const wikt = await new WiktionaryLoader().load({
    ...options,
    save: options?.save?.includes('wikt'),
  });
  const hb = await new HurlebatteLoader().load({
    ...options,
    save: options?.save?.includes('hb'),
  });
  const moot = await new MootLoader().load({
    ...options,
    save: options?.save?.includes('moot'),
  });
  const wordnet = await new WordNetLoader().load({
    ...options,
    save: options?.save?.includes('wordnet'),
  });

  logger.info(`Hurlebatte entries:\t${Object.keys(hb.anglish).length}`);
  logger.info(`Moot entries:\t\t${Object.keys(moot.anglish).length}`);
  logger.info(`Wiktionary entries:\t${Object.keys(wikt.anglish).length}`);
  logger.info(`WordNet entries:\t\t${Object.keys(wordnet.entries).length}`);
  logger.info(`WordNet synsets:\t\t${Object.keys(wordnet.synsets).length}`);

  // Merge sources into WordNet. Skip existing words.
  const originalWords = new Set(Object.keys(wordnet.entries));
  mergeSource(hb.anglish, wordnet, originalWords);
  mergeSource(moot.anglish, wordnet, originalWords);
  mergeSource(wikt.anglish, wordnet, originalWords);

  // Set `isAnglish = true` for compound words whose parts are Anglish.
  setAnglishByWordParts(wordnet);
  countAnglishEntries(wordnet);

  wordnet.entries = sortObj(wordnet.entries);

  const condense = false;
  if (condense) {
    await condenseSenses(wordnet);
  }

  const match = false;
  if (match) {
    loadCondensed(wordnet);
    await matchSenses(wordnet);
  }

  const fix = false;
  if (fix) {
    await fixCondenseErrors(wordnet);
    await fixMatchErrors(wordnet);
  }

  mergeMatchedSenses(wordnet);
  await overwriteWithWiktOrigin(wikt, wordnet);
  writeMasterWordNet(wordnet);
}

function mergeSource(source, wordnet, originalWords) {
  for (const word in source) {
    if (originalWords.has(word)) {
      wordnet.entries[word].isAnglish = true;
      for (const pos in source[word]) {
        if (wordnet.entries[word][pos] && source[word][pos].origin) {
          wordnet.entries[word][pos].origin = source[word][pos].origin;
        }
      }
    } else if (!wordnet.entries[word]) {
      wordnet.entries[word] = { ...source[word], isAnglish: true };
    } else {
      for (const pos in source[word]) {
        if (!wordnet.entries[word][pos]) {
          wordnet.entries[word][pos] = source[word][pos];
        } else {
          wordnet.entries[word][pos].senses.push(...source[word][pos].senses);
        }
      }
    }
  }
}

function setAnglishByWordParts(wordnet) {
  main: for (const word in wordnet.entries) {
    if (!wordnet.entries[word].isAnglish) {
      const parts = word.split(/[\s-]/);
      if (parts.length > 1) {
        for (const part of parts) {
          if (!wordnet.entries[part]?.isAnglish) {
            continue main;
          }
        }
        logger.verbose(`Setting "${word}" to Anglish`);
        wordnet.entries[word].isAnglish = true;
      }
    }
  }
}

function countAnglishEntries(wordnet) {
  let count = 0;
  for (const word in wordnet.entries) {
    if (wordnet.entries[word].isAnglish) {
      count++;
    }
  }
  logger.info(`Total Anglish entries:\t${count}`);
}

async function condenseSenses(wordnet) {
  const toCondense = {};

  for (const word in wordnet.entries) {
    for (const pos in wordnet.entries[word]) {
      if (pos === 'isAnglish') continue;
      addToCondense(word, pos, wordnet, toCondense);
    }
  }

  const reqCount = Object.keys(toCondense).length;
  gpt.estimateReqTime(reqCount, 'Condense senses');
  await gpt.matchSenses(toMatch, reqCount);
}

async function matchSenses(wordnet) {
  const toMatch = {};

  for (const word in wordnet.entries) {
    if (wordnet.entries[word].isAnglish) {
      for (const pos in wordnet.entries[word]) {
        if (pos === 'isAnglish') continue;
        addToMatch(word, pos, wordnet, toMatch);
      }
    }
  }

  const reqCount = Object.keys(toMatch).length;
  gpt.estimateReqTime(reqCount, 'Match senses');
  await gpt.matchSenses(toMatch, reqCount);
}

function addToCondense(word, pos, wordnet, toCondense) {
  let willCondense = false;
  for (const sense of wordnet.entries[word][pos].senses) {
    if (sense.english?.split(/\s/).length > 2) {
      willCondense = true;
    }
  }
  if (willCondense) {
    _.set(
      toCondense,
      `${word}.${pos}`,
      wordnet.entries[word][pos].senses.map(({ english }) => english)
    );
  }
}

function loadCondensed(wordnet) {
  const file = fs.readFileSync(getPath('/gpt/gpt-condensed.out'), 'utf-8');
  const lines = file.split('\n');
  for (const line of lines) {
    if (!line) continue;
    const { word, ...entry } = JSON.parse(line);
    for (const pos in entry) {
      wordnet.entries[word][pos].senses = entry[pos].map((str) => ({
        english: str,
      }));
    }
  }
}

function addToMatch(word, pos, wordnet, toMatch) {
  const senses = wordnet.entries[word][pos].senses
    .map(({ english }) => english)
    .filter((s) => s);
  const candidates = [];
  for (const sense of senses) {
    if (wordnet.entries[sense]?.[pos]) {
      for (const { synset: id } of wordnet.entries[sense][pos].senses) {
        if (id) {
          candidates.push({ id, def: wordnet.synsets[id].definition[0] });
        }
      }
    }
  }
  // Matching every sense would take forever, so we triage.
  // If there are 3 or more candidate synsets, we boil them down.
  // Otherwise, we stick with what is already there.
  if (candidates.length > 3) {
    _.set(toMatch, `${word}.${pos}`, { senses, candidates });
  }
}

async function fixCondenseErrors(wordnet) {
  const file = fs.readFileSync(getPath('/gpt/gpt-condensed.err'), 'utf-8');
  const lines = file.split('\n');
  const toCondense = {};

  for (const line of lines) {
    if (!line) continue;
    const [word, pos] = line.split(':');
    addToCondense(word, pos, wordnet, toCondense);
  }

  const reqCount = Object.keys(toCondense).length;
  gpt.estimateReqTime(reqCount, 'Condense senses');
  await gpt.condenseSenses(toCondense, reqCount);
}

async function fixMatchErrors(wordnet) {
  const file = fs.readFileSync(getPath('/gpt/gpt-matched.err'), 'utf-8');
  const lines = file.split('\n');
  const toMatch = {};

  for (const line of lines) {
    if (!line) continue;
    const [word, pos] = line.split(':');
    addToMatch(word, pos, wordnet, toMatch);
  }

  const reqCount = Object.keys(toMatch).length;
  gpt.estimateReqTime(reqCount, 'Match senses');
  await gpt.matchSenses(toMatch, reqCount);
}

function mergeMatchedSenses(wordnet) {
  const file = fs.readFileSync(getPath('/gpt/gpt-matched.out'), 'utf-8');
  const lines = file.split('\n');

  // Add matched synsets to word senses.
  for (const line of lines) {
    if (!line) continue;
    const { word, ...entry } = JSON.parse(line);
    for (const pos in entry) {
      const senses = entry[pos].map((synsetId) => ({
        synset: synsetId,
      }));
      wordnet.entries[word][pos].senses.push(...senses);
    }
  }

  // Link all synsets not caught by matchSenses.
  for (const word in wordnet.entries) {
    for (const pos in wordnet.entries[word]) {
      if (pos === 'isAnglish') continue;
      replaceStringSensesWithSynsets(word, pos, wordnet);
    }
  }

  // Filter out remaining string senses.
  for (const word in wordnet.entries) {
    for (const pos in wordnet.entries[word]) {
      if (pos === 'isAnglish') continue;
      wordnet.entries[word][pos].senses = wordnet.entries[word][
        pos
      ].senses.filter(({ synset }) => synset);
    }
  }
}

function replaceStringSensesWithSynsets(word, pos, wordnet) {
  const senses = wordnet.entries[word][pos].senses
    .map(({ english }) => english)
    .filter((s) => s);
  const candidates = [];
  for (const sense of senses) {
    if (wordnet.entries[sense]?.[pos]) {
      const _senses = wordnet.entries[sense][pos].senses;
      for (const { synset } of _senses) {
        if (synset) {
          candidates.push({ synset });
        }
      }
    }
  }
  if (candidates.length <= 3) {
    wordnet.entries[word][pos].senses.push(...candidates);
  }
}

function writeMasterWordNet(wordnet) {
  const master = new Array(26)
    .fill()
    .reduce((acc, cur, i) => ((acc[String.fromCharCode(i + 97)] = {}), acc), {
      0: {},
    });
  for (const word in wordnet.entries) {
    const code = word.toLowerCase().charCodeAt(0);
    const letter = String.fromCharCode(code);
    if (code >= 97 && code <= 122) {
      // a-z
      master[letter][word] = wordnet.entries[word];
    } else {
      // 0
      master['0'][word] = wordnet.entries[word];
    }
  }

  for (const key in master) {
    const dir = '/master/';
    const dirFullPath = getPath(dir);
    const filename = `entries-${key}.json`;
    const fullPath = dirFullPath + filename;
    if (!fs.existsSync(dirFullPath)) {
      fs.mkdirSync(dirFullPath, { recursive: true });
    }
    logger.info(`Saving ${fullPath}`);
    fs.writeFileSync(fullPath, JSON.stringify(sortObj(master[key]), null, 2));
  }
}

async function overwriteWithWiktOrigin(wikt, wordnet) {
  const handler = async (line) => {
    const json = JSON.parse(line);
    const word = json.word;
    const pos = await wikt.formatPartOfSpeech(word, json.pos);
    if (!pos) {
      return;
    }
    if (wordnet.entries[word]?.[pos]) {
      wordnet.entries[word][pos].origin = json.etymology_text;
    }
  };

  await wikt.loadWithStream((line) => [handler(line)]);
}

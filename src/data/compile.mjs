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

  wordnet.entries = sortObj(wordnet.entries);

  countAnglishEntries(wordnet);

  const condense = false;
  if (condense) {
    const [toCondense, batchCount] = getSensesToCondense(wordnet);
    await gpt.condenseSenses(toCondense, batchCount);
  }

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

  const match = true;
  if (match) {
    const [toMatch, matchCount] = getSensesToMatch(wordnet);
    await gpt.matchSenses(toMatch, matchCount);
  }

  return;

  updateSenses(wordnet, anglishWords);

  // write total updated wordnet to final files
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
    const filename = `entries-${key}.json`;
    fs.writeFileSync(
      getPath(`/assets/wordnet/all/${filename}`),
      JSON.stringify(util.sortObj(master[key]), null, 2)
    );
  }
}

function mergeSource(source, wordnet, originalWords) {
  for (const word in source) {
    if (originalWords.has(word)) {
      wordnet.entries[word].isAnglish = true;
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

function getSensesToCondense(wordnet) {
  let count = 0;
  let batchCount = 0;
  const toCondense = {};

  for (const word in wordnet.entries) {
    for (const pos in wordnet.entries[word]) {
      if (pos === 'isAnglish') continue;
      let willCondense = false;
      for (const sense of wordnet.entries[word][pos].senses) {
        if (sense.english?.split(/\s/).length > 2) {
          count++;
          willCondense = true;
        }
      }
      if (willCondense) {
        _.set(
          toCondense,
          `${word}.${pos}`,
          wordnet.entries[word][pos].senses.map(({ english }) => english)
        );
        batchCount++;
      }
    }
  }

  const batchesPerSecond = 1.5;
  const minutes = Math.round(batchCount / (60 * batchesPerSecond));
  const hours = (minutes / 60).toFixed(1);
  logger.verbose(
    `${count} total senses to be condensed in ${batchCount} batches (${hours} hours)`
  );

  return [toCondense, batchCount];
}

function getSensesToMatch(wordnet) {
  let count = 0;
  const toMatch = {};

  for (const word in wordnet.entries) {
    if (wordnet.entries[word].isAnglish) {
      for (const pos in wordnet.entries[word]) {
        if (pos === 'isAnglish') continue;
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
          count++;
          _.set(toMatch, `${word}.${pos}`, { senses, candidates });
        }
      }
    }
  }

  const matchesPerSecond = 1.5;
  const minutes = Math.round(count / (60 * matchesPerSecond));
  const hours = (minutes / 60).toFixed(1);
  logger.verbose(`${count} total senses to be matched (${hours} hours)`);

  return [toMatch, count];
}

async function matchSenses(wordnet) {
  const file = fs.readFileSync(getPath('/log/gpt-condensed2.out'), 'utf-8');
  const lines = file.split('\n');

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const index = line.indexOf('{');
    const word = line.slice(0, index - 1);
    let json;
    try {
      json = JSON.parse(line.slice(index));
    } catch (error) {
      continue;
    }

    if (
      !wordnet.entries[word] ||
      (Object.keys(json).length === 1 && Object.hasOwn(json, 'x'))
    ) {
      continue;
    }

    for (const pos in json) {
      if (!wordnet.entries[word][pos]) {
        continue;
      }
      wordnet.entries[word][pos].senses = json[pos];
      const senses = wordnet.entries[word][pos].senses;

      for (let i = 0; i < senses.length; i++) {
        const sense = senses[i];
        if (!wordnet.entries[sense]?.[pos]?.senses?.length) {
          continue; // Nothing to match.
        }
        const _senses = wordnet.entries[sense][pos].senses;
        if (_senses.length === 1) {
          if (_senses[0].synset) {
            senses[i] = {
              synset: _senses[0].synset,
            };
          }
          continue;
        }

        // Match sense word to synset.
        await gpt.matchSense(word, pos, sense, _senses, wordnet);
      }
    }
  }
}

function updateSenses(wordnet, anglishWords) {
  // Match senses from GPT output file.
  const file = fs.readFileSync(getPath('/log/gpt-matched.out'), 'utf-8');
  const lines = file.split('\n');
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const index = line.indexOf('[');
    if (index === -1) {
      continue;
    }
    const [word, pos, sense] = line.slice(0, index - 1).split(':');
    const senses = JSON.parse(line.slice(index));
    anglishWords.delete(word);
    if (
      !wordnet.entries[word]?.[pos]?.senses ||
      wordnet.entries[word][pos].senses.some((o) => typeof o === 'string')
    ) {
      _.set(
        wordnet.entries,
        `${word}.${pos}.senses`,
        _.uniqBy(senses, 'synset')
      );
    } else {
      wordnet.entries[word][pos].senses = _.uniqBy(
        wordnet.entries[word][pos].senses.concat(senses),
        'synset'
      );
    }
  }

  // Match single senses.
  for (const word of anglishWords) {
    for (const pos in wordnet.entries[word]) {
      if (pos === 'languages' || !wordnet.entries[word][pos]) {
        continue;
      }
      const senses = wordnet.entries[word][pos].senses;
      for (let i = 0; i < senses.length; i++) {
        const sense = senses[i];
        if (!wordnet.entries[sense]?.[pos]?.senses?.length) {
          continue; // Nothing to match.
        }
        const _senses = wordnet.entries[sense][pos].senses;
        if (_senses.length === 1 && _senses[0]?.synset) {
          anglishWords.delete(word);
          senses[i] = {
            synset: _senses[0].synset,
          };
        }
      }
    }
  }
}

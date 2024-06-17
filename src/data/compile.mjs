import * as fs from 'fs';
import _ from 'lodash';
import * as gpt from './gpt.mjs';
import {
  MootLoader,
  WiktionaryLoader,
  WordNetLoader,
  HurlebatteLoader,
} from './loaders.mjs';
import * as util from './util.mjs';

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

  console.log(`\nHurlebatte entries: ${Object.keys(hb.anglish).length}`);
  console.log(`Moot entries: ${Object.keys(moot.anglish).length}`);
  console.log(`Wiktionary entries: ${Object.keys(wikt.anglish).length}`);
  console.log(`WordNet entries: ${Object.keys(wordnet.entries).length}`);
  console.log(`WordNet synsets: ${Object.keys(wordnet.synsets).length}\n`);

  let sensesCount = 0;

  const mergeSourceIntoWordNet = (source) => {
    for (const word in source) {
      if (!wordnet.entries[word]) {
        wordnet.entries[word] = { ...source[word], isAnglish: true };
      } else {
        wordnet.entries[word].isAnglish = true;

        for (const pos in source[word]) {
          if (!wordnet.entries[word][pos]) {
            wordnet.entries[word][pos] = source[word][pos];
          } else {
            wordnet.entries[word][pos].senses.push(...source[word][pos].senses);
          }

          // for (const sense of source[word][pos].senses) {
          //   wordnet.entries[word][pos].senses.push(sense)
          //   if (sense.english.split(' ').length < 2) {
          //     continue;
          //   }
          //   // convert sense longer than 2+ words to one English word
          //   // see if that word/pos exists in WordNet
          //   // if yes, map its senses to their synset/definition
          //   // filter those by which make sense in context of original word
          //   sensesCount++;
          // }
        }
      }
    }
  };

  mergeSourceIntoWordNet(hb.anglish);
  mergeSourceIntoWordNet(moot.anglish);
  mergeSourceIntoWordNet(wikt.anglish);

  main: for (const word in wordnet.entries) {
    if (!wordnet.entries[word].isAnglish) {
      const parts = word.split(/[\s-]/);
      if (parts.length > 1) {
        for (const part of word.split(/\s-/)) {
          if (!wordnet.entries[part]?.isAnglish) {
            continue main;
          }
        }
        console.log(`setting "${word}" to Anglish`);
        wordnet.entries[word].isAnglish = true;
      }
    }
  }

  return;

  const anglishWords = new Set();
  addToWordNet(moot.anglish, wordnet, anglishWords);
  addToWordNet(wordbook.data, wordnet, anglishWords);
  addToWordNet(wikt.data, wordnet, anglishWords);

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
      util.getPath(`/assets/wordnet/all/${filename}`),
      JSON.stringify(util.sortObj(master[key]), null, 2)
    );
  }
}

/*
 * Adds words from the given sources to WordNet.
 */
function addToWordNet(data, wordnet, anglishWords) {
  for (const word in data) {
    const inWordNet = Object.hasOwn(wordnet.entries, word);
    if (inWordNet) {
      // Word is both valid Anglish and a modern English word,
      // already in WordNet. Update language and continue.
      if (!wordnet.entries[word].languages.includes('Anglish')) {
        wordnet.entries[word].languages.push('Anglish');
      }
      continue;
    } else {
      // Word is Anglish only. Add new WordNet entry.

      if (Object.keys(data[word]).includes('name')) {
        // Skip proper nouns from Kaikki; they add bloat.
        continue;
      }

      anglishWords?.add(word);
      wordnet.entries[word] = {
        languages: ['Anglish'],
      };

      for (const pos in data[word]) {
        if (!wordnet.entries[word][pos]) {
          wordnet.entries[word][pos] = { senses: [] };
        }
        wordnet.entries[word][pos].senses = Array.from(
          new Set(
            wordnet.entries[word][pos].senses.concat(
              data[word][pos].senses || []
            )
          )
        );
      }
    }
  }
}

async function fixSenses(wordnet) {
  const file = fs.readFileSync(util.getPath('/log/gpt-condensed.err'), 'utf-8');
  const lines = file.split('\n');
  const toFix = {};

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const index = line.indexOf('{');
    const word = line.slice(0, index - 1);
    if (!wordnet.entries[word]) {
      throw new Error(`Word '${word}' not found`);
    }
    toFix[word] = wordnet.entries[word];
  }

  await gpt.condenseSenses(toFix);
}

async function fixSenses2(wordnet, anglishWords) {
  let haveSeenAston = false;
  for (const word of anglishWords) {
    const entry = wordnet.entries[word];
    let willProcess = false;
    for (const pos in entry) {
      if (
        pos === 'languages' ||
        pos === 'x' ||
        !entry[pos].senses.length ||
        entry[pos].senses.some((sense) => Object.hasOwn(wordnet.entries, sense))
      ) {
        continue;
      }
      willProcess = true;
    }
    if (willProcess && haveSeenAston) {
      await gpt.condenseSense(wordnet, word, entry);
    }
    if (word === 'Aston') {
      haveSeenAston = true;
    }
  }
}

async function fixSenses3(wordnet) {
  const file = fs.readFileSync(util.getPath('/log/gpt-matched2.err'), 'utf-8');
  const lines = file.split('\n');

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const [word, pos, sense] = line.split(':').map((s) => s.trim());
    if (!wordnet.entries[word]?.[pos] || !wordnet.entries[sense]?.[pos]) {
      continue;
    }

    const _senses = wordnet.entries[sense][pos].senses;
    if (_senses.length === 1) {
      continue;
    }

    // Match sense word to synset.
    await gpt.matchSense(word, pos, sense, _senses, wordnet);
  }
}

async function fixSenses4(wordnet, anglishWords) {
  // Match senses from GPT output file.
  const words = new Set();
  const file = fs.readFileSync(util.getPath('/log/gpt-matched.out'), 'utf-8');
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
    words.add(word);
  }

  main: for (const word of anglishWords) {
    if (words.has(word)) continue;
    for (const pos in wordnet.entries[word]) {
      if (pos === 'languages' || !wordnet.entries[word][pos]) {
        continue;
      }
      if (
        Object.keys(wordnet.entries[word]).length === 2 &&
        Object.hasOwn(wordnet.entries[word], 'x')
      ) {
        continue main;
      }
      const senses = wordnet.entries[word][pos].senses;
      for (let i = 0; i < senses.length; i++) {
        const sense = senses[i];
        if (!wordnet.entries[sense]?.[pos]?.senses?.length) {
          continue; // Nothing to match.
        }
        const _senses = wordnet.entries[sense][pos].senses;
        if (_senses.length === 1 && _senses[0]?.synset) {
          senses[i] = {
            synset: _senses[0].synset,
          };
        } else {
          await gpt.matchSense(word, pos, sense, _senses, wordnet);
        }
      }
    }
  }
}

async function matchSenses(wordnet) {
  const file = fs.readFileSync(
    util.getPath('/log/gpt-condensed2.out'),
    'utf-8'
  );
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
  const file = fs.readFileSync(util.getPath('/log/gpt-matched.out'), 'utf-8');
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

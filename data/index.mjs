import { Command } from 'commander';
import {
  MootLoader,
  WiktionaryLoader,
  WordNetLoader,
  WordbookLoader,
} from './loaders.mjs';
import { redis } from './redis.mjs';
import * as gpt from './gpt.mjs';
import _ from 'lodash';
import { appendFile } from 'fs/promises';
import { getPath } from './util.mjs';

const program = new Command();

program.option('--flush', 'flush Redis before loading');
program.option('--wordbook', 'load data from The Anglish Wordbook');
program.parse(process.argv);
const options = program.opts();

await compile();

/**
 * Calls all loader functions with option to flush Redis first.
 **/
export default async function compile(flush = false) {
  console.time('loadAll');

  if (flush) {
    console.log('Flushing Redis keys...');
    await redis.flushAll();
  }

  const wikt = new WiktionaryLoader();
  await wikt.load({ save: false });

  const wordbook = new WordbookLoader();
  await wordbook.load({ save: false });

  const moot = new MootLoader();
  await moot.load({ save: false });
  moot.addAnglishWordsFromEnglishDefs();

  const wordnet = new WordNetLoader();
  await wordnet.load({ save: false });

  console.log();
  console.log(`Wordbook entries: ${Object.keys(wordbook.data).length}`);
  console.log(`Moot English entries: ${Object.keys(moot.english).length}`);
  console.log(`Moot Anglish entries: ${Object.keys(moot.anglish).length}`);
  console.log(`WordNet entries: ${Object.keys(wordnet.entries).length}`);
  console.log(`WordNet synsets: ${Object.keys(wordnet.synsets).length}`);
  console.log();

  const wordsAdded = new Set();

  const addToWordNet = (data) => {
    for (const word in data) {
      const inWordNet = Object.hasOwn(wordnet.entries, word);
      if (inWordNet) {
        // Word is a modern English word, already in WordNet.
        // Also valid Anglish; update language and continue.
        if (!wordnet.entries[word].languages.includes('Anglish')) {
          wordnet.entries[word].languages.push('Anglish');
        }
        continue;
      } else {
        if (Object.keys(data[word]).includes('name')) {
          // Skip proper nouns from Kaikki; they add bloat.
          continue;
        }
        // Word is Anglish only. Add WordNet entry.
        wordsAdded.add(word);
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
  };

  addToWordNet(moot.anglish);
  addToWordNet(wordbook.data);
  addToWordNet(wikt.data);

  const wordsToProcess = _.pick(wordnet.entries, Array.from(wordsAdded));

  for (const word in wordsToProcess) {
    // Skip words that have only one sense.
    let willProcess = false;
    for (const pos of Object.keys(wordsToProcess[word]).filter(
      (s) => s !== 'languages'
    )) {
      if (wordsToProcess[word][pos].senses.length > 1) {
        willProcess = true;
      }
    }
    if (!willProcess) {
      continue;
    }

    try {
      const res = await gpt.curateSenses(word, wordsToProcess[word]);
      const data = `${word} ${JSON.stringify(res)}\n`;
      await appendFile(getPath('output.txt'), data);
    } catch (error) {
      console.log('Error:', error);
      const data = `${word} ${JSON.stringify(wordsToProcess[word])}\n`;
      await appendFile(getPath('errors.txt'), data);
    }
  }

  // Will async-hang if called from command line without this.
  process.exit();
}

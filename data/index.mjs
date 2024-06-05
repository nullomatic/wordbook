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

const program = new Command();

program.option('--flush', 'flush Redis before loading');
program.option('--wordbook', 'load data from The Anglish Wordbook');
program.parse(process.argv);
const options = program.opts();

await loadAll();

/**
 * Calls all loader functions with option to flush Redis first.
 **/
export default async function loadAll(flush = false) {
  console.time('loadAll');

  if (flush) {
    console.log('Flushing Redis keys...');
    await redis.flushAll();
  }

  const wikt = new WiktionaryLoader();
  await wikt.load({ save: false });
  return;

  const wordbook = new WordbookLoader();
  await wordbook.load({ save: true });

  const moot = new MootLoader();
  await moot.load({ save: true });
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

  const anglish = moot.anglish;

  console.log(anglish);
  return;

  // Parse Wordbook anglish.
  for (const word in wordbook.data) {
    for (const pos in wordbook.data[word]) {
      if (!anglish[word]) {
        anglish[word] = {};
      }
    }
    const { word, pos } = item;
    if (!anglish[word]) {
      anglish[word] = {};
    }
    const entry = anglish[word];
    if (!entry[item.pos]) {
      entry[pos] = {
        senses: item.senses.map((sense) => ({
          sense: sense,
          source: 'wordbook',
        })),
      };
    } else {
      entry[pos].senses.push(
        ...item.senses.map((sense) => ({
          sense: sense,
          source: 'wordbook',
        }))
      );
    }
  }

  // Update WordNet data with Anglish anglish.
  for (const word in anglish) {
    const entry = anglish[word];
    const inWordNet = Object.hasOwn(wordnet.entries, word);

    if (inWordNet) {
      // Word is a modern English word, already in WordNet.
      // Update language and remove.
      wordnet.entries[word].languages.push('Anglish');
      delete anglish[word];
      continue;
    } else {
      // Word is Anglish. Add WordNet entry.
      wordnet.entries[word] = {
        languages: ['Anglish'],
      };
      const wn = wordnet.entries[word];

      for (const pos in entry) {
        // Remove duplicates by string match.
        entry[pos].senses = _.uniqBy(entry[pos].senses, 'sense');
      }

      continue;

      // For each part of speech, link synsets based on senses.
      for (const pos in entry) {
        wn[pos] = {};
        const senses = entry[pos].senses;

        for (const { sense } of senses) {
          // TODO: Remove senses that are basically identical.
          // eg: craft:n:vehicle, craft:n:conveyance
          // Use ChatGPT.
          // eg: const deduped = await removeDuplicateSenses(senses)

          // Then, loop over them and select the sense/synset from wordnet[word][pos] that matches this sense.
          // eg: selectMatchingSense(sense, _senses);

          // Keep a record of senses with no synset, errors. Fix manually.

          const _entry = wordnet.entries[sense];
          if (!_entry?.[pos]) {
            // Entry for this sense not found. Could be a typo or
            // a poorly formatted string.
            continue;
          }

          const _senses = _entry[pos].sense;
          //console.log(word, sense, _senses);
        }
      }
    }
  }

  const words = Object.keys(anglish);

  const gptWords = [];
  for (const word of words) {
    const entry = anglish[word];
    // If there is only one `pos` and one `sense`, skip.
    const keys = Object.keys(entry);
    for (const pos of Object.keys(entry)) {
      if (entry[pos].senses.length > 1) {
        gptWords.push(word);
        break;
      }
    }
  }

  for (const word of gptWords) {
    const entry = anglish[word];
    await gpt.removeDuplicateSenses(word, entry);
  }

  // const total = gptWords.length;
  // let processed = 0;
  // const promises = [];

  // await new Promise((resolve) => {
  //   setInterval(() => {
  //     const word = gptWords.shift();
  //     const entry = anglish[word];
  //     if (!word) {
  //       return resolve();
  //     }
  //     promises.push(gpt.removeDuplicateSenses(word, entry));
  //     processed++;
  //     console.log(`${word} ${processed}/${total}`);
  //   }, 800);
  // });

  // await Promise.all(promises);

  // await buildIndex();

  console.timeEnd('loadAll');

  // Will async-hang if called from command line without this.
  process.exit();
}

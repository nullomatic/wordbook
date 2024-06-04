import { Command } from 'commander';
import {
  MootLoader,
  WiktionaryLoader,
  WordNetLoader,
  WordbookLoader,
} from './loaders.mjs';
import { redis } from './redis.mjs';

const program = new Command();

program.option('--flush', 'flush Redis before loading');
program.option('--wordbook', 'load data from The Anglish Wordbook');
program.parse(process.argv);
const options = program.opts();

await loadAll(true);

/**
 * Calls all loader functions with option to flush Redis first.
 **/
export default async function loadAll(flush = false) {
  console.time('loadAll');

  if (flush) {
    console.log('Flushing Redis keys...');
    await redis.flushAll();
  }
  //const wikt = await new WiktionaryLoader().load();

  const save = false;

  const wordbook = await new WordbookLoader().load({ save });
  const moot = await new MootLoader().load({ save });
  const wordnet = await new WordNetLoader().load({ save });

  //console.log('wikt.data.length:', wikt.data.length);
  console.log('wordbook.data.length:', wordbook.data.length);
  console.log('Object.keys(moot.data).length:', Object.keys(moot.data).length);
  console.log(
    'Object.keys(wordnet.data.entries).length:',
    Object.keys(wordnet.data.entries).length
  );

  moot.orderByAnglish();

  console.log(
    'Object.keys(moot.senses).length',
    Object.keys(moot.senses).length
  );
  console.log('moot.dirtyEntries.length', moot.dirtyEntries.length);

  const entries = {};

  // Parse Moot entries.
  for (const word in moot.senses) {
    if (!entries[word]) {
      entries[word] = {};
    }
    const entry = entries[word];
    for (const pos in moot.senses[word]) {
      if (!entry[pos]) {
        entry[pos] = {
          senses: moot.senses[word][pos].map((meaning) => ({
            meaning: meaning,
            source: 'moot',
          })),
        };
      } else {
        entry[pos].senses.push(
          ...moot.senses[word][pos].map((meaning) => ({
            meaning: meaning,
            source: 'moot',
          }))
        );
      }
    }
  }

  // Parse Wordbook entries.
  for (const item of wordbook.data) {
    const { word, pos } = item;
    if (!entries[word]) {
      entries[word] = {};
    }
    const entry = entries[word];
    if (!entry[item.pos]) {
      entry[pos] = {
        senses: item.meanings.map((meaning) => ({
          meaning: meaning,
          source: 'wordbook',
        })),
      };
    } else {
      entry[pos].senses.push(
        ...item.meanings.map((meaning) => ({
          meaning: meaning,
          source: 'wordbook',
        }))
      );
    }
  }

  // Update WordNet data with Anglish entries.
  for (const key in entries) {
    const entry = entries[key];

    const inWordNet = Object.hasOwn(wordnet.data.entries, key);
    if (/abyss/.test(key)) {
      console.log(key, inWordNet);
      process.exit();
    }

    if (inWordNet) {
      // Word is a modern English word, already in WordNet.
      wordnet.data.entries[key].languages.push('Anglish');
    } else {
      // Word is Anglish. Add WordNet entry.

      //console.log(`Processing: ${key}`);

      // Create new WordNet entry.
      wordnet.data.entries[key] = {
        languages: ['Anglish'],
      };
      const wn = wordnet.data.entries[key];
      console.log(key, JSON.stringify(entry, null, 2));

      // For each part of speech, link synsets based on senses.
      for (const pos in entry) {
        wn[pos] = {};
        const senses = entry[pos].senses;

        for (const { meaning: sense } of senses) {
          // TODO: Remove senses that are basically identical.
          // eg: craft:n:vehicle, craft:n:conveyance
          // Use ChatGPT.
          // eg: const deduped = await removeDuplicateSenses(senses)

          // Then, loop over them and select the sense/synset from wordnet[word][pos] that matches this sense.
          // eg: selectMatchingSense(sense, _senses);

          const _entry = wordnet.data.entries[sense];
          if (!_entry) {
            // Entry for this sense not found. Could be a typo or
            // a poorly formatted string.
            continue;
          }

          // There is just one sense to match this meaning.
          const _senses = _entry[pos].sense;
          for (const _sense of _senses) {
            // Match _sense to sense
            console.log(key, pos, sense, _sense.id.split('%')[0]);
          }
        }
      }
    }
  }

  const word = 'ship';
  const entry = entries[word];
  console.log(word, JSON.stringify(entry, null, 2));

  // await buildIndex();

  console.timeEnd('loadAll');
  process.exit(); // Will async-hang if called from command line without this.
}

async function main() {
  console.log('options', options);
}

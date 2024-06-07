import {
  MootLoader,
  WiktionaryLoader,
  WordNetLoader,
  WordbookLoader,
} from './loaders.mjs';
import * as gpt from './gpt.mjs';
import _ from 'lodash';

/**
 * Loads Anglish words from all sources and compiles them into a single
 * unified dictionary object, which is then sent to ChatGPT to refine.
 **/
export default async function compileSources(options) {
  console.time('compileSources');

  let saveWikt, saveWordbook, saveMoot, saveWordNet;
  if (options?.reload) {
    for (const source of options.reload) {
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

  const wikt = await new WiktionaryLoader().load({ save: saveWikt });
  const wordbook = await new WordbookLoader().load({ save: saveWordbook });
  const moot = await new MootLoader().load({ save: saveMoot });
  const wordnet = await new WordNetLoader().load({ save: saveWordNet });

  console.log(`\nWordbook entries: ${Object.keys(wordbook.data).length}`);
  console.log(`Moot English entries: ${Object.keys(moot.english).length}`);
  console.log(`Moot Anglish entries: ${Object.keys(moot.anglish).length}`);
  console.log(`WordNet entries: ${Object.keys(wordnet.entries).length}`);
  console.log(`WordNet synsets: ${Object.keys(wordnet.synsets).length}\n`);

  const wordsForGPT = new Set();

  addToWordNet(moot.anglish, wordnet, wordsForGPT);
  addToWordNet(wordbook.data, wordnet, wordsForGPT);
  addToWordNet(wikt.data, wordnet, wordsForGPT);

  if (options.condenseSenses) {
    await gpt.condenseSenses(_.pick(wordnet.entries, Array.from(wordsForGPT)));
  }
  if (options.matchSenses) {
    await gpt.matchSenses();
  }
}

/*
 * Adds words from the given sources to WordNet.
 */
function addToWordNet(data, wordnet, wordsForGPT) {
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

      wordsForGPT.add(word);
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

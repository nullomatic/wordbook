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
  const wordbook = await new WordbookLoader().load();
  const moot = await new MootLoader().load();
  const wordnet = await new WordNetLoader().load({ save: true });

  //console.log('wikt.data.length:', wikt.data.length);
  console.log('wordbook.data.length:', wordbook.data.length);
  console.log('Object.keys(moot.data).length:', Object.keys(moot.data).length);
  console.log(
    'Object.keys(wordnet.data.entries).length:',
    Object.keys(wordnet.data.entries).length
  );

  // await buildIndex();

  console.timeEnd('loadAll');
  process.exit(); // Will async-hang if called from command line without this.
}

async function main() {
  console.log('options', options);
}

import { Command } from 'commander';
import compileSources from './compile.mjs';
import { populateDatabase } from './db.mjs';
import query from './query.mjs';
import { logger } from './util.mjs';

const program = new Command();

program.option('--query <input>', 'delete this');
program.option('-v, --verbose', 'Verbose logging level');
program.option('-i, --interactive', 'Prompt for user-corrected word input');
program.option('--compile', 'Compile all word sources');
program.option('--populate', 'Populate database');
program.option('--save <sources>', 'Save <sources> to disk');
program.option('--condense-senses', 'Condense word senses with ChatGPT');
program.option('--match-senses', 'Match word senses with ChatGPT');
program.option('--fix-senses', 'Fix words in ChatGPT error log');
program.option('--from-disk', 'Load sources from disk');
program.parse(process.argv);
const options = program.opts();
console.log(options);

if (options.verbose) {
  logger.transports[0].level = 'verbose';
}

if (options.save) {
  options.save = options.save.split(',');
}

if (options.compile) {
  await compileSources(options);
}

if (options.populate) {
  await populateDatabase(options);
}

if (options.query) {
  const [word, pos] = options.query.split(',');
  await query(word, pos);
}

process.exit();

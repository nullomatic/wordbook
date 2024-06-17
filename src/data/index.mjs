import { Command } from 'commander';
import compileSources from './compile.mjs';
import { logger } from './util.mjs';

const program = new Command();

program.option('-f, --flush', 'flush all Redis keys');
program.option('-c, --compile', 'Compile all word sources');
program.option('-s, --save <sources>', 'Save <sources> to disk');
program.option('-cs, --condense-senses', 'Condense word senses with ChatGPT');
program.option('-ms, --match-senses', 'Match word senses with ChatGPT');
program.option('-fs, --fix-senses', 'Fix words in ChatGPT error log');
program.option('-v, --verbose', 'Verbose logging level');
program.option('-d, --from-disk', 'Load sources from disk');
program.option('-i, --interactive', 'Prompt for user-corrected word input');
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

process.exit();

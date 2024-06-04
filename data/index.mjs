import { Command } from 'commander';

const program = new Command();

program.option('--flush', 'flush Redis before loading');
program.option('--wordbook', 'load data from The Anglish Wordbook');
program.parse(process.argv);
const options = program.opts();

async function main() {
  console.log('options', options);
}

main();

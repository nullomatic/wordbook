import { Command, OptionValues } from "commander";
import compileSources from "./compile";
import {
  insertWordFrequencyData,
  populateDatabase,
  rebuildSearchIndex,
} from "./db";
import { logger } from "../lib/util.js";

main()
  .then(() => process.exit())
  .catch((error: Error) => {
    logger.error(error.message);
    console.error(error.stack);
    process.exit();
  });

async function main() {
  const options = parseOptions();
  if (options.verbose) {
    logger.transports[0].level = "verbose";
  }
  if (options.save) {
    options.save = options.save.split(",");
  }
  if (options.compile) {
    await compileSources(options);
  }
  if (options.populate) {
    await populateDatabase();
  }
  if (options.rebuildSearchIndex) {
    await rebuildSearchIndex();
  }
  if (options.insertFreqData) {
    await insertWordFrequencyData();
  }
}

function parseOptions(): OptionValues {
  const program = new Command();
  program.option("-v, --verbose", "Verbose logging level");
  program.option("-i, --interactive", "Prompt for user-corrected word input");
  program.option("--compile", "Compile all word sources");
  program.option("--populate", "Populate database");
  program.option("--rebuild-search-index", "Rebuild Redis search index");
  program.option("--insert-freq-data", "Rebuild Redis search index");
  program.option("--save <sources>", "Save <sources> to disk");
  program.option("--condense-senses", "Condense word senses with ChatGPT");
  program.option("--match-senses", "Match word senses with ChatGPT");
  program.option("--fix-senses", "Fix words in ChatGPT error log");
  program.option("--from-disk", "Load sources from disk");
  program.parse(process.argv);
  return program.opts();
}

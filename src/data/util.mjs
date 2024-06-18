import { readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import _ from 'lodash';
import prompt from 'prompt';
import * as winston from 'winston';

const DIRNAME = dirname(fileURLToPath(import.meta.url));
const logFormat = winston.format.printf(function (info) {
  return `${info.timestamp}-${info.level}: ${info.message}`;
});

export const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        logFormat
      ),
    }),
  ],
});

export const WORD_PATTERN = `\\p{L}+([-\\s']\\p{L}+){0,4}`;
export const WORD_REGEXP = new RegExp(`^${WORD_PATTERN}$`, 'iu');
export const MOOT_ENGLISH_REGEXP = new RegExp(
  `(?<!\\()(?<words>${WORD_PATTERN}(, (${WORD_PATTERN})?)*)(?!\\))(\\s?\\((?<origin>[^\\)]*)\\))?`,
  'iug'
);
export const MOOT_ORIGINS_PATTERN = (() => {
  const file = readFileSync(
    getPath('/assets/moot/abbreviations.json'),
    'utf-8'
  );
  const json = JSON.parse(file);
  const pattern = `(${Object.keys(json)
    .map((s) => s.replace('.', ''))
    .join('|')})`;
  return pattern;
})();

export function getFilenames(dir) {
  const filenames = readdirSync(dir);
  const fullPaths = filenames.map((filename) => join(dir, filename));
  return _.zip(filenames, fullPaths);
}

export function getPath(suffix) {
  return join(DIRNAME, suffix);
}

export function cleanWord(word) {
  word = word
    .replace(/\([^)]*\)/g, '') // Remove (parentheses)
    .replace(/\[[^\]]*\]/g, '') // Remove [square brackets]
    .replace(/\n.*$/g, '') // Remove anything that comes after a newline
    .replace(/\s+/g, ' ') // Remove extra spaces between words
    .trim(); // Trim

  // If word does not have form "word" or "word word" or "word-word"...
  if (!WORD_REGEXP.test(word)) {
    // Take the first match before a "/" or ",".
    const match = word.match(new RegExp(`^${WORD_PATTERN}(?=\s*[\/,])`, 'iu'));
    if (!match) {
      // No word could be extracted.
      if (word) {
        logger.verbose(`abandoned:\t"${word}"`);
      }
      return null;
    }
    const clean = match[0];
    logger.verbose(`cleaned:\t"${word}" -> "${clean}"`);
    word = clean;
  }

  return word;
}

export async function promptPartOfSpeech(word, _pos) {
  const schema = {
    properties: {
      pos: {
        description: `Part of speech for '${word}:${_pos}'`,
        type: 'string',
        pattern: /^(n|v|a|r|s|c|p|x|u)$/,
        message: 'Part of speech must be of selection (n|v|a|r|s|c|p|x|u)',
      },
    },
  };
  prompt.start();
  const input = await new Promise((resolve, reject) => {
    prompt.get(schema, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
  return input;
}

export function sortObj(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
}

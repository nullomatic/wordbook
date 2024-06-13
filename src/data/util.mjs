import { readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import _ from 'lodash';
import * as winston from 'winston';

const DIRNAME = dirname(fileURLToPath(import.meta.url));

// This pattern determines the shape of word entry keys in Redis.
// e.g., `en:aardvark:noun:1`, where `1` represents the etymological
// index of the word for words that have multiple meanings.
const KEY_PATTERN = '<lang>:<word>:<pos>:<etym>';

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

export function getFilenames(dir) {
  const filenames = readdirSync(getPath(dir));
  const fullPaths = filenames.map((filename) => getPath(`${dir}/${filename}`));
  return _.zip(filenames, fullPaths);
}

export function replaceKeyPattern(options) {
  return KEY_PATTERN.replace(/<(\w+)>/g, (match, key) => {
    if (!Object.hasOwn(options, key)) {
      throw new TypeError(`Missing key '${key}' in replacement options`);
    }
    if (key === 'etym') {
      return options[key] || 1;
    }
    return options[key];
  });
}

export function getPath(suffix) {
  return join(DIRNAME, suffix);
}

export function cleanStr(str) {
  // TODO: This could be optimized
  return str
    .trim()
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .split('\n')
    .find((s) => !!s)
    ?.trim();
}

export function formatPoS(pos) {
  switch (pos.toLowerCase()) {
    case 'noun':
    case 'n':
    case 'nm':
    case 'num':
    case 'pro':
    case 'pron':
      pos = 'n'; // noun
      break;
    case 'v':
    case 'vb':
    case 'vt':
    case 'vb phr':
    case 'verb':
      pos = 'v'; // verb
      break;
    case 'a':
    case 'aj':
    case 'ad':
    case 'adj':
      pos = 'a'; // adjective
      break;
    case 'r':
    case 'av':
    case 'avb':
    case 'adv':
      pos = 'r'; // adverb
      break;
    case 'c':
    case 'conj':
      pos = 'c'; // conjunction
    case 'p':
    case 'pp':
    case 'd':
    case 'prep':
    case 'prp':
    case 'prep_phrase':
      pos = 'p'; // preposition
      break;
    case 'i':
    case 'int':
    case 'interj':
      pos = 'i'; // interjection
      break;
    case 'abbr':
    case 'abbrev':
    case 'phrase':
    case 'phr':
    case 'pre':
    case 'pvb':
    case 'prefix':
    case 'pfx':
    case 'pref':
    case 'suffix':
    case 'sfx':
    case 'suf':
    case 'suff':
    case 'afx':
    case 'pn':
    case 'ac':
    case 'pt':
    case 'letter':
    case 'name':
    case 'prefix':
    case 'phrase':
    case 'intj':
    case 'adv_phrase':
    case 'interfix':
    case 'affix':
    case 'circumfix':
    case 'suffix':
    case 'particle':
    case 'num':
    case 'det':
    case 'article':
    case 'character':
    case 'symbol':
    case 'proverb':
    case 'contraction':
    case 'punct':
    case 'infix':
    case 'abbrev':
    case 'postp':
      pos = 'x'; // other
      break;
    default:
      throw new Error(`Unknown part of speech '${pos}'`);
  }
  return pos;
}

export function formatSenses(str) {
  return str
    .split(/[^a-z\s\-']/i)
    .map((str) => {
      return cleanStr(str).replace(/^(a|an|to)\s/gi, ''); // Replace 'a/an <word>' and 'to <word>'
    })
    .filter((str) => !!str);
}

export function sortObj(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
}

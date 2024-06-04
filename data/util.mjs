import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// This pattern determines the shape of word entry keys in Redis.
// e.g., `en:aardvark:noun:1`, where `1` represents the etymological
// index of the word for words that have multiple meanings.
const KEY_PATTERN = '<lang>:<word>:<pos>:<etym>';

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

export function getAssetURI(filename) {
  return join(dirname(fileURLToPath(import.meta.url)), `/assets/${filename}`);
}

export function getDirname(path) {
  return join(dirname(fileURLToPath(import.meta.url)), path);
}

import { createReadStream, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { client } from './redis.mjs';
import { getAssetURI } from './util.mjs';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

await fn();

function clean(str) {
  return str
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .trim();
}

async function fn() {
  const file = readFileSync('./data/assets/moot.json');
  const obj = JSON.parse(file);
  const words = {};

  const sus = []; // todo

  const h = function (entry, type) {
    const str = clean(entry[type]);
    if (!str || /^\s?-\s?$/.test(str)) {
      return;
    }
    const eng = clean(entry.eng);
    const pos = entry.pos;
    const arr = str.split(/[,;]/g);
    for (let word of arr) {
      word = word.trim();
      if (/^\w+([-\s]\w+)*$/.test(word) && /^(n|vb|adj|adv)$/.test(pos)) {
        if (!words[word]) {
          words[word] = [];
        }
        words[word].push({
          en: eng,
          pos: pos,
        });
      } else {
        // TODO handle sus word
        sus.push(entry);
      }
    }
  };

  for (const letter in obj) {
    const entries = obj[letter];
    for (const entry of entries) {
      h(entry, 'att');
      h(entry, 'una');
    }
  }
  const ordered = Object.keys(words)
    .sort()
    .reduce((obj, key) => {
      obj[key] = words[key];
      return obj;
    }, {});

  console.log(words);
}

/**
 * TODO
 **/
export default async function loadYAML(flush = false) {
  console.time('loadYAML');

  const dirname = '../english-wordnet/src/yaml';
  const filenames = readdirSync(dirname);
  const synsets = {};

  for (const filename of filenames) {
    const uri = join(dirname, filename);
    const file = readFileSync(uri, 'utf-8');
    const yaml = YAML.parse(file);

    console.log(filename);

    if (/^entries/.test(filename)) {
      const promises = [];
      for (const k in yaml) {
        const wordKey = `word:${k}`;
        const obj = yaml[k];
        const command = client.set(wordKey, JSON.stringify(obj));
        promises.push(command);
      }
      await Promise.all(promises);
    }

    if (/^(adj|adv|noun|verb)/.test(filename)) {
      const promises = [];
      for (const key in yaml) {
        const synsetKey = `synset:${key}`;
        const synonymsKey = `synset:${key}:similar`;
        const obj = yaml[key];
        synsets[key] = obj;
        const command = client.set(synsetKey, JSON.stringify(obj));
        promises.push(command);
      }
      await Promise.all(promises);
    }

    if (filename.startsWith('frames')) {
      // handle frames file
    }
  }

  const addSimilar = function (synsetIds, arr) {
    if (synsetIds?.length) {
      for (const id of synsetIds) {
        if (synsets[id].members?.length) {
          arr.concat(synsets[id].members);
        }
      }
    }
  };

  const promises = [];
  for (const key in synsets) {
    const synset = synsets[key];
    const similarKey = `synset:${key}:similar`;
    const similarWords = synset.members || [];
    addSimilar(synset.hypernym, similarWords);
    addSimilar(synset.similar, similarWords);
    const command = client.set(similarKey, JSON.stringify(similarWords));
    promises.push(command);
  }
  await Promise.all(promises);

  console.timeEnd('loadYAML');
}

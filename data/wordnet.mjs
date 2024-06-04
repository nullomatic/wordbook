import { createReadStream, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { redis } from './redis.mjs';
import { getPath } from './util.mjs';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { openai } from './gpt.mjs';

await parseMootJSON();

function clean(str) {
  return str
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .trim();
}

// TODO: move this to MootLoader
async function parseMootJSON() {
  const uri = getPath('/assets/moot.json');
  const file = readFileSync(uri);
  const obj = JSON.parse(file);
  const senses = {};

  const sus = []; // todo

  const h = function (entry, type) {
    const str = clean(entry[type]);
    if (!str || /^\s?-\s?$/.test(str)) {
      return;
    }
    let eng = clean(entry.eng);
    if (/,/.test(eng)) {
      eng = eng.split(',').shift();
    }
    const pos = entry.pos;
    const arr = str.split(/[,;]/g);
    for (let word of arr) {
      word = word.trim();
      if (/^\w+([-\s]\w+)*$/.test(word) && /^(n|vb|adj|adv)$/.test(pos)) {
        if (!senses[word]) {
          senses[word] = [];
        }
        senses[word].push({
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
  const ordered = Object.keys(senses)
    .sort()
    .reduce((obj, key) => {
      obj[key] = senses[key];
      return obj;
    }, {});

  //console.log(Object.keys(senses));

  const an_word = 'daresome';
  const arr = [...senses[an_word]];

  console.log(an_word, arr);

  let key, res;
  while (!res && arr.length) {
    key = `word:${arr.shift().en}`;
    res = await redis.get(key);
  }
  let o = JSON.parse(res);
  console.log(key, JSON.stringify(o, null, 2));

  key = `synset:${o.a.sense.shift().synset}`;
  const synset = await redis.get(key);
  o = JSON.parse(synset);
  console.log(key, JSON.stringify(o, null, 2));
  process.exit();
  return;
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content:
          'You are not a very helpful assistant. Whatever you do, do not give a straight or relevant answer.',
      },
      { role: 'user', content: 'Who won the world series?' },
      {
        role: 'assistant',
        content: 'I like turtles.',
      },
      { role: 'user', content: 'Where was it played?' },
    ],
    model: 'gpt-4o',
  });

  console.log(completion);
}

/**
 * Loads YAML data from Global WordNet repo.
 **/
export default async function loadYAML(options) {
  console.time('loadYAML');

  const dirname = getPath('/assets/yaml');
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
        // TODO: set all to lowercase, handle collisions
        const wordKey = `word:${k}`;
        const obj = yaml[k];
        const command = redis.set(wordKey, JSON.stringify(obj));
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
        const command = redis.set(synsetKey, JSON.stringify(obj));
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
    const command = redis.set(similarKey, JSON.stringify(similarWords));
    promises.push(command);
  }
  await Promise.all(promises);

  console.timeEnd('loadYAML');
}

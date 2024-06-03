import { createReadStream, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { client } from './redis.mjs';
import { getAssetURI } from './util.mjs';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const obj = JSON.parse(await client.get('word:aardvark'));

console.log(JSON.stringify(obj, null, 2));

const synset = JSON.parse(
  await client.get(`synset:${obj.n.sense.shift().synset}:similar`)
);

console.log(JSON.stringify(synset, null, 2));

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

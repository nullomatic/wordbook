import * as fs from 'fs/promises';
import { glob } from 'glob';
import pg from 'pg';
import * as util from './util.mjs';
const { Client } = pg;
const client = new Client({
  user: 'postgres',
  password: 'password',
  host: '127.0.0.1',
  port: 5432,
});
await client.connect();

const entryFiles = await glob('src/data/assets/wordnet/json/entries-*.json');
const synsetFiles = await glob('src/data/assets/wordnet/json/*.*.json');
const frameFile = await fs.readFile('src/data/assets/wordnet/json/frames.json');

// Inspect entries
const entryKeys = new Set();
const posKeys = new Set();
const senseKeys = new Set();
const senseKeyMaxLength = {};
for (const uri of entryFiles) {
  const data = JSON.parse(await fs.readFile(uri));
  for (const word in data) {
    const entry = data[word];
    const isAnglish = entry.languages?.includes('Anglish');
    for (const entryKey in entry) {
      entryKeys.add(entryKey);
      for (const posKey in entry[entryKey]) {
        posKeys.add(posKey);
        if (posKey === 'sense') {
          for (const sense of entry[entryKey][posKey]) {
            for (const senseKey in sense) {
              senseKeys.add(senseKey);
              if (Array.isArray(sense[senseKey])) {
                if (
                  !senseKeyMaxLength[senseKey] ||
                  sense[senseKey].length > senseKeyMaxLength[senseKey].length
                ) {
                  senseKeyMaxLength[senseKey] = sense[senseKey].length;
                }
              }
            }
          }
        }
      }
      // if (pos === 'languages') continue;
      // const str = `INSERT INTO word VALUES ('${word}', '${pos}', ${isAnglish})`;
      // await client.query('INSERT INTO word VALUES', [word, pos, isAnglish]);
    }
  }
}
console.log('entryKeys', entryKeys);
console.log('posKeys', posKeys);
console.log('senseKeys', senseKeys);
console.log('senseKeyMaxLength', senseKeyMaxLength);

// Inspect synsets
const synsetKeys = new Set();
const synsetKeyMaxLength = {};
for (const uri of synsetFiles) {
  const data = JSON.parse(await fs.readFile(uri));
  for (const synsetId in data) {
    const synset = data[synsetId];
    for (const synsetKey in synset) {
      synsetKeys.add(synsetKey);
      if (Array.isArray(synset[synsetKey])) {
        if (
          !synsetKeyMaxLength[synsetKey] ||
          synset[synsetKey].length > synsetKeyMaxLength[synsetKey].length
        ) {
          synsetKeyMaxLength[synsetKey] = synset[synsetKey].length;
        }
      }
    }
  }
}

console.log('synsetKeys', synsetKeys);
console.log('synsetKeyMaxLength', synsetKeyMaxLength);

await client.end();

function getURIs(dir) {
  return fs
    .readdirSync(util.getPath(dir))
    .map((filename) => util.getPath(`${dir}/${filename}`));
}

async function resetDatabase() {
  await client.query('DROP TABLE IF EXISTS word, sense, word_sense');
  await client.query('C');
}

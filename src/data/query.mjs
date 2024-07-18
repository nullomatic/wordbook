import * as fs from 'fs';
import format from 'pg-format';
import { getClient } from './db.mjs';
import { getPath } from './util.mjs';

const client = await getClient();

const fullPath = getPath('/synonyms.sql');
const q = fs.readFileSync(fullPath, 'utf-8');

export default async function main(word, pos) {
  const wordClean = format('%L', word);
  const posClean = format('%L', pos || 'n');
  const sql = q.replaceAll('%word', wordClean).replace('%pos', posClean);
  //console.log(sql.replace(/\s+/g, ' '));
  const res = await client.query(sql);
  console.log(res.rows);

  // QUERY: Get Anglish synonyms
  // get word
  // get senses where word_id = id
  // get synsets where id = synset_id
  // optional: get synsets where id = similar
  // optional: get hypernym, then get children = !this
  // get senses where synset_id = id
  // get words where id = word_id and is_anglish = true
}

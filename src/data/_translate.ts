import nlp from "compromise";
import { POS } from "@/lib/constants";
import { DatabaseClient } from "@/lib/client";
import pg from "pg";
import { Query } from "@/lib/query";
import csv from "csvtojson";
import { readCSV } from "@/lib/util";

const SENTENCE = `We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness.—That to secure these rights, governments are instituted among Men, deriving their just powers from the consent of the governed,—That whenever any Form of government becomes destructive of these ends, it is the Right of the People to alter or to abolish it, and to institute new government, laying its foundation on such principles and organizing its powers in such form, as to them shall seem most likely to effect their Safety and Happiness. Prudence, indeed, will dictate that governments long established should not be changed for light and transient causes; and accordingly all experience hath shewn, that mankind are more disposed to suffer, while evils are sufferable, than to right themselves by abolishing the forms to which they are accustomed. But when a long train of abuses and usurpations, pursuing invariably the same Object evinces a design to reduce them under absolute Despotism, it is their right, it is their duty, to throw off such government, and to provide new Guards for their future security.`;
const freq = await loadCSV();

await runCompromise();

/*
 * Compromise
 */
async function runCompromise() {
  const doc = nlp(SENTENCE);
  const json = doc.json();
  const dict = {} as any;

  let translation = "";

  for (const sentence of json) {
    for (const term of sentence.terms) {
      let word = term.normal;
      let pos = convertPOS(term.tags[0]);
      let key = `${word}|${pos}`;
      let termDoc = nlp(word);
      let isPlural = termDoc.has("#Noun") && termDoc.has("#Plural");

      if (isPlural) {
        termDoc = termDoc.nouns().toSingular() as any;
        console.log(`Converting "${word}" to "${termDoc.out()}"`);
        word = termDoc.out();
      }

      if (!dict[key]) {
        dict[key] = {
          english: [],
          anglish: [],
        };
        const wordData = await queryWord(word, pos);
        if (wordData) {
          term.isAnglish = wordData.is_anglish;
          const synonyms = await querySynonyms(word, pos);
          if (isPlural) {
            synonyms.english = convertToPlural(synonyms.english);
            synonyms.anglish = convertToPlural(synonyms.anglish);
          }
          dict[key] = synonyms;
        }
      }

      term.synonyms = dict[key];

      translation += term.pre;
      if (term.isAnglish) {
        // Term itself is Anglish.
        translation += term.text;
      } else if (term.synonyms.anglish.length) {
        // Term has Anglish synonyms.
        translation += `(${term.synonyms.anglish.join("|")})`;
      } else {
        // No replacements found.
        translation += term.text;
      }
      translation += term.post;
    }
  }

  console.log();
  console.log("Before:\n", SENTENCE);
  console.log();
  console.log("After:\n", translation);
  console.log();

  process.exit();
}

function convertPOS(tag: string) {
  if (!tag) {
    throw new Error("Missing tag");
  }
  switch (tag) {
    case "Noun":
      return POS.Noun;
    case "Verb":
      return POS.Verb;
    case "Adjective":
      return POS.Adjective;
    case "Adverb":
      return POS.Adverb;
    case "Preposition":
      return POS.Adposition;
    case "Conjunction":
      return POS.Conjunction;
    default:
      return POS.Other;
  }
}

async function queryWord(word: string, pos: POS) {
  const escaped = pg.escapeLiteral(word);
  const sql = `SELECT * FROM word WHERE word = ${escaped} AND pos = '${pos}'`;
  const result = await DatabaseClient.query(sql);
  const wordData = result.rows?.[0];
  return wordData;
}

async function querySynonyms(word: string, pos: POS) {
  const synonyms = { anglish: [], english: [] } as any;
  const template = Query.getTemplate("synonyms");
  const sql = template
    .replaceAll("<word>", pg.escapeLiteral(word))
    .replaceAll("<pos>", pg.escapeLiteral(pos));

  const result = await DatabaseClient.query(sql);
  if (result.rows?.length) {
    for (const { word: synonym, is_anglish } of result.rows) {
      synonyms[is_anglish ? "anglish" : "english"].push(synonym);
    }
  }

  const sortSynonyms = (words: string[]) =>
    words.sort((a: string, b: string) => (freq[b] || 0) - (freq[a] || 0));

  sortSynonyms(synonyms.english);
  sortSynonyms(synonyms.anglish);

  return synonyms;
}

function convertToPlural(words: string[]) {
  return words.map((word) => {
    return nlp(word).nouns().toPlural().out();
  });
}

async function loadCSV() {
  const dict = {} as any;
  const rows = await readCSV("/data/assets/freq/unigram_freq.csv");
  for (const { word, count } of rows) {
    if (!dict[word]) {
      dict[word] = count;
    }
  }
  return dict;
}

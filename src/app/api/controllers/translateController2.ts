import nlp from "compromise";
import { POS } from "@/lib/constants";
import { DatabaseClient } from "@/lib/client";
import pg from "pg";
import { Query } from "@/lib/query";
import { readCSV } from "@/lib/util";
import _ from "lodash";

const freq = await loadCSV(); // TODO: Add this data to postgres

export async function translateText(input: string) {
  const doc = nlp(input);
  const json = doc.json();
  const dict = {} as any;
  const results = [];

  let translation = "";

  for (const sentence of json) {
    for (const term of sentence.terms) {
      let word = term.normal;
      let pos = convertPOS(term.tags);
      let key = `${word}|${pos}`;

      let termDoc: any = nlp(word);
      let transform: ((synonyms: string[]) => string[]) | null = null;

      const isPlural = termDoc.has("#Noun") && termDoc.has("#Plural");
      if (isPlural) {
        termDoc = termDoc.nouns().toSingular() as any;
        console.log(`Converting "${word}" to "${termDoc.out()}"`);
        word = termDoc.out();
      }

      let isVerb = termDoc.has("#Verb");
      if (isVerb) {
        const tags = termDoc.out("tags")[0][word];
        const infinitive = termDoc.verbs().toInfinitive().out();

        if (word === infinitive || infinitive === "be") {
          isVerb = false;
        } else {
          console.log(`Converting "${word}" to "${infinitive}"`);
          console.log("tags:", tags);
          word = infinitive;
          transform = (synonyms: string[]) => {
            // TODO: Refactor all this, make less convoluted
            // also: handle gerunds and other tags
            // also: do we want to handle live-typing translation? or is that too expensive?
            if (tags?.includes("PresentTense")) {
              return synonyms.map((synonym) => {
                return nlp(synonym).verbs().toPresentTense().out();
              });
            } else if (tags?.includes("PastTense")) {
              return synonyms.map((synonym) => {
                return nlp(synonym).verbs().toPastTense().out();
              });
            } else if (tags?.includes("FutureTense")) {
              return synonyms.map((synonym) => {
                return nlp(synonym).verbs().toFutureTense().out();
              });
            } else {
              return synonyms;
            }
          };
        }
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
          if (isVerb && transform) {
            synonyms.english = transform(synonyms.english);
            synonyms.anglish = transform(synonyms.anglish);
          }
          dict[key] = synonyms;
        }
      }

      term.synonyms = dict[key];

      results.push({
        text: term.text,
        pre: term.pre,
        post: term.post,
        synonyms: term.synonyms.anglish,
        isAnglish: term.isAnglish,
      });

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

  //console.log(JSON.stringify(results, null, 2));

  return results;
}

function convertPOS(tags: string[]) {
  if (!tags.length) throw new Error("Missing tags");
  if (tags.includes("Noun")) return POS.Noun;
  if (tags.includes("Verb")) return POS.Verb;
  if (tags.includes("Adjective")) return POS.Adjective;
  if (tags.includes("Adverb")) return POS.Adverb;
  if (tags.includes("Preposition")) return POS.Adposition;
  if (tags.includes("Conjunction")) return POS.Conjunction;
  return POS.Other;
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

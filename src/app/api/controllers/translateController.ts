import nlp from "compromise";
import { POS } from "@/lib/constants";
import { DatabaseClient } from "@/lib/client";
import pg from "pg";
import { Query } from "@/lib/query";
import { logger, readCSV } from "@/lib/util";
import _ from "lodash";
import View from "compromise/view/one";

type RestoreFunctionType = (word: string) => string;

const skipWords = [
  // Pronouns
  "i",
  "you",
  "we",
  "he",
  "she",
  "it",
  "they",
  "me",
  "him",
  "her",
  "us",
  "them",

  // Demonstratives
  "these",
  "those",
  "this",
  "that",

  // Determiners
  "a",
  "an",
  "the",
  "my",
  "your",
  "his",
  "her",
  "its",
  "our",
  "their",

  // Conjunctions
  "and",
  "or",
  "but",
  "if",
  "so",
  "because",

  // Prepositions
  "in",
  "on",
  "at",
  "by",
  "for",
  "with",
  "about",
  "as",
  "of",
  "to",
  "from",
  "up",
  "down",
  "over",
  "under",

  // Auxiliary (Helping) Verbs
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "shall",
  "should",
  "can",
  "could",
  "may",
  "might",
  "must",

  // Basic Adverbs
  "not",
  "no",
  "yes",
  "now",
  "then",

  // Interrogative Words
  "who",
  "what",
  "where",
  "when",
  "why",
  "how",

  // Other Basic Words
  "there",
  "here",
  "all",
  "some",
  "none",
  "each",
  "every",
  "either",
  "neither",
];

export async function translateText(input: string, options: POS[]) {
  const dict: Record<
    string,
    {
      lemma: string;
      pos: POS;
      restoreFn?: RestoreFunctionType;
    }
  > = {};
  const terms: {
    normal: string;
    pos: POS;
    text: string;
    pre: string;
    post: string;
    synonyms: { word: string }[];
    isAnglish: boolean;
    willTranslate: boolean;
  }[] = [];

  let translation = "";

  for (const sentence of nlp(input).json()) {
    for (const term of sentence.terms) {
      const normal = term.normal;
      const pos = convertPOS(term.tags);
      const termDoc: View = nlp(normal);
      const { lemma, restoreFn } = getLemma(termDoc, normal);

      const willTranslate = options.includes(pos) && !skipWords.includes(lemma);

      if (willTranslate) {
        if (!dict[normal]) {
          dict[normal] = {
            lemma,
            pos,
            restoreFn,
          };
        }
      }

      terms.push({
        normal,
        pos,
        text: term.text,
        pre: term.pre,
        post: term.post,
        synonyms: [],
        isAnglish: false,
        willTranslate,
      });
    }
  }

  const wordPairs = Object.values(dict)
    .map(({ lemma }: any) => pg.escapeLiteral(lemma) as any)
    .join(",");
  const sql = Query.getTemplate("synonymsMultiple").replaceAll(
    "<words>",
    wordPairs,
  );

  // TODO: The synonym matcher fails where words have multiple of the same POS, like n-1/n-2

  //console.log("wordPairs:", wordPairs);

  const results = await DatabaseClient.query(sql);
  const synonymsCache: any = {};

  for (const result of results.rows) {
    const { source_word } = result;
    if (!synonymsCache[source_word]) {
      synonymsCache[source_word] = [];
    }
    synonymsCache[source_word].push(result);
  }

  for (const term of terms) {
    if (term.willTranslate) {
      const cached = dict[term.normal];
      const synonymsData = synonymsCache[cached.lemma];
      if (synonymsData) {
        term.isAnglish = synonymsData.find(
          ({ synonym }: any) => synonym === cached.lemma,
        )?.is_anglish;

        term.synonyms = synonymsData.filter(
          ({ is_anglish, pos }: any) => pos[0] === term.pos[0] && is_anglish,
        );

        if (!term.synonyms.length) {
          // If there were no matches on POS, Compromise may have mislabeled the POS.
          term.synonyms = synonymsData.filter(
            ({ is_anglish }: any) => is_anglish,
          );
        }

        term.synonyms = term.synonyms
          .map(({ synonym }: any) => ({
            word: cached.restoreFn?.(synonym) || synonym,
          }))
          .sort((a: any, b: any) => {
            const aMatches = a.word === term.normal ? -1 : 1;
            const bMatches = b.word === term.normal ? -1 : 1;
            if (aMatches !== bMatches) {
              return aMatches - bMatches;
            }
            return parseInt(b.frequency) - parseInt(a.frequency);
          });
      }
    }

    // if (!term.synonyms.length) {
    //   console.log(`No synonyms found for ${term.normal}|${term.pos}`);
    // }

    // translation += term.pre;
    // if (term.isAnglish) {
    //   // Term itself is Anglish.
    //   translation += term.text;
    // } else if (term.synonyms.anglish.length) {
    //   // Term has Anglish synonyms.
    //   translation += `(${term.synonyms.anglish.join("|")})`;
    // } else {
    //   // No replacements found.
    //   translation += term.text;
    // }
    // translation += term.post;
  }

  return terms;
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

type GetLemmaReturnType = {
  lemma: string;
  restoreFn?: RestoreFunctionType;
};

/*
 * This function converts a word to its lemma or base form, if it exists.
 * It also supplies a callback to restore matched words to the original form.
 */
function getLemma(termDoc: any, word: string): GetLemmaReturnType {
  const lemma = word;

  // Word is a plural noun.
  const isPlural = termDoc.has("#Noun") && termDoc.has("#Plural");
  if (isPlural) {
    return getLemmaPluralNoun(termDoc, word);
  }

  // TODO: possessive noun

  // Word is a verb.
  const isVerb = termDoc.has("#Verb");
  if (isVerb) {
    return getLemmaVerb(termDoc, word);
  }

  // Default: Don't transform.
  return { lemma, restoreFn: undefined };
}

function getLemmaPluralNoun(termDoc: any, word: string): GetLemmaReturnType {
  termDoc = termDoc.nouns().toSingular() as any;
  logger.info(`Converting "${word}" to "${termDoc.out()}"`); // TODO: change log level
  const lemma = termDoc.out();
  return {
    lemma,
    restoreFn: (_lemma: string) => {
      let restored = nlp(_lemma).nouns().toPlural().out();
      if (!restored) {
        logger.verbose(
          `Unknown lemma '${_lemma}', converting to plural manually`,
        );
        restored = _lemma.endsWith("s") ? `${_lemma}es` : `${_lemma}s`;
      }
      return restored;
    },
  };
}

function getLemmaVerb(termDoc: any, word: string): GetLemmaReturnType {
  const tags = termDoc.out("tags")[0][word];
  const infinitive = termDoc.verbs().toInfinitive().out();

  if (word === infinitive) {
    return { lemma: word, restoreFn: undefined };
  }

  logger.verbose(`Converting "${word}" to "${infinitive}"`);

  const lemma = infinitive;
  let restoreFn;

  // TODO: Implement more sophisticated conjucation logic for Anglish words not known to Compromise NLP
  if (tags?.includes("Gerund")) {
    // The order is important here; "Gerund" must be checked first,
    // because "Gerund" and "PresentTense" always occur together.
    restoreFn = (lemma: string) =>
      nlp(lemma).verbs().toGerund().out()?.slice(3) || // Slice off "is ".
      (lemma.endsWith("e")
        ? `${lemma.slice(0, lemma.length - 1)}ing`
        : `${lemma}ing`);
  } else if (tags?.includes("PresentTense")) {
    restoreFn = (lemma: string) =>
      nlp(lemma).verbs().toPresentTense().out() || lemma;
  } else if (tags?.includes("PastTense")) {
    restoreFn = (lemma: string) => {
      return (
        nlp(lemma).verbs().toPastTense().out() ||
        (lemma.endsWith("e") ? `${lemma}d` : `${lemma}ed`)
      );
    };
  } else if (tags?.includes("FutureTense")) {
    restoreFn = (lemma: string) =>
      nlp(lemma).verbs().toFutureTense().out() || `will ${lemma}`;
  }

  return { lemma, restoreFn };
}

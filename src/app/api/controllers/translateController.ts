import nlp from "compromise";
import { POS } from "@/lib/constants";
import { DatabaseClient } from "@/lib/client";
import pg from "pg";
import { Query } from "@/lib/query";
import { logger, readCSV } from "@/lib/util";
import _ from "lodash";
import View from "compromise/view/one";

type RestoreFunctionType = (word: string) => string;

export async function translateText(input: string) {
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
    lemma: string;
    text: string;
    pre: string;
    post: string;
    synonyms: string[];
    isAnglish: boolean;
  }[] = [];

  let translation = "";

  for (const sentence of nlp(input).json()) {
    for (const term of sentence.terms) {
      const normal = term.normal;
      const pos = convertPOS(term.tags);
      const termDoc: View = nlp(normal);
      const { lemma, restoreFn } = getLemma(termDoc, normal);

      if (!dict[normal]) {
        dict[normal] = {
          lemma,
          pos,
          restoreFn,
        };
      }

      terms.push({
        normal,
        pos,
        lemma,
        text: term.text,
        pre: term.pre,
        post: term.post,
        synonyms: [],
        isAnglish: false,
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
    const cached = dict[term.normal];
    const synonymsData = synonymsCache[term.lemma];
    if (synonymsData) {
      term.isAnglish = synonymsData.find(
        ({ synonym }: any) => synonym === term.lemma,
      )?.is_anglish;

      term.synonyms = synonymsData.filter(
        ({ synonym, is_anglish, pos }: any) =>
          term.normal !== synonym && pos[0] === term.pos[0] && is_anglish,
      );

      if (!term.synonyms.length) {
        // If there were no matches on POS, Compromise may have mislabeled the POS.
        term.synonyms = synonymsData.filter(
          ({ synonym, is_anglish }: any) =>
            term.normal !== synonym && is_anglish,
        );
      }

      term.synonyms = term.synonyms
        .sort((a: any, b: any) => parseInt(b.frequency) - parseInt(a.frequency))
        .map(({ synonym }: any) => cached.restoreFn?.(synonym) || synonym);
    }

    if (!term.synonyms.length) {
      console.log(`No synonyms found for ${term.normal}|${term.pos}`);
    }

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
    restoreFn: (word: string) => nlp(word).nouns().toPlural().out(),
  };
}

function getLemmaVerb(termDoc: any, word: string): GetLemmaReturnType {
  const tags = termDoc.out("tags")[0][word];
  const infinitive = termDoc.verbs().toInfinitive().out();

  if (word === infinitive) {
    return { lemma: word, restoreFn: undefined };
  }

  logger.info(`Converting "${word}" to "${infinitive}"`); // TODO: change log level
  //logger.info("tags:", tags);

  const lemma = infinitive;
  let restoreFn;

  // TODO: Implement more sophisticated conjucation logic for Anglish words not known to Compromise NLP
  if (tags?.includes("PresentTense")) {
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
  } else if (tags?.includes("Gerund")) {
    restoreFn = (lemma: string) =>
      nlp(lemma).verbs().toGerund().out() || lemma.endsWith("e")
        ? `${lemma.slice(0, lemma.length - 1)}ing`
        : `${lemma}ing`;
  }

  return { lemma, restoreFn };
}

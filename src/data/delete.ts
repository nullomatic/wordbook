import Tokenizer from 'wink-tokenizer';
import Tagger from 'wink-pos-tagger';
import nlp from 'compromise';
import natural from 'natural';

const SENTENCE = `Why do you do this? I like cinnamon bagels, but not a mustard.`;

/* WINK */

const tokenize = new Tokenizer().tokenize;
const tag = new Tagger().tag;

const foo = tag(tokenize(SENTENCE));

const mod = foo.map((token) => {
  if (token.pos === 'NN') {
    return 'COCK';
  }
  if (token.pos === 'NNS') {
    return 'BALLS';
  }
  return token.value;
});

//console.log(mod.join(' '));

/* COMPROMISE */

const doc = nlp(SENTENCE);

const nouns = doc
  .nouns()
  .filter((noun) => !noun.has('#Pronoun') && !noun.has('#ProperNoun'));

nouns.forEach((noun) => {
  //console.log(noun.json());
  if (noun.wordCount() > 1) {
    const terms = noun
      .terms()
      .filter((term) => !noun.has('#Negative') && !noun.has('#Determiner'));
    terms.forEach((term) => {
      replaceTerm(term.terms[0]);
    });
  } else {
    replaceTerm(noun);
  }
});

function replaceTerm(term: any) {
  console.log(JSON.stringify(term.json(), null, 2));
  const isSingular = (term as any).isSingular().found;
  const isPlural = (term as any).isPlural().found;
  const article = term.text().match(/^(a|an|the|some|every)\s/)?.[0] || '';
  if (isSingular) {
    term.replaceWith(article + 'COCK');
  } else if (isPlural) {
    term.replaceWith(article + 'BALLS');
  }
}

console.log(doc.text());

/* NATURAL */

const toke = new natural.WordTokenizer();
const lexicon = new natural.Lexicon('EN', 'N', 'NNP');
const ruleset = new natural.RuleSet('EN');
const tagger = new natural.BrillPOSTagger(lexicon, ruleset);

const tokens = toke.tokenize(SENTENCE);
const taggedTokens = tagger.tag(tokens);

function isSingularNoun(tag: string) {
  return tag === 'NN';
}

// Process and replace singular nouns
let modifiedTokens = taggedTokens.taggedWords.map((taggedWord) => {
  if (isSingularNoun(taggedWord.tag)) {
    return taggedWord.token + '-singular';
  }
  return taggedWord.token;
});

// Join the tokens back into a modified sentence
let modifiedSentence = modifiedTokens.join(' ');

//console.log(taggedTokens);
//console.log(modifiedSentence);

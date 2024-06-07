import 'dotenv/config';
import { appendFile } from 'fs/promises';
import OpenAI from 'openai';
import _ from 'lodash';
import { getPath } from './util.mjs';

export const openai = new OpenAI();

const MSG_CONDENSE_SENSES = `
  "Anglish" is a linguistically pure, Germanic version of English - how English would be without foreign influence. \
  Given an Anglish context word and JSON object following it, replace the English array elements with each possible \
  sense of the context word. You may need to condense longer sentences down to one word. Leave at least one array element \
  in each array. Return the filtered JSON object, without Markdown or backticks, such that the entire response can be passed \
  directly to JSON.parse().

  For example, given the following word and object...
  
  light {
    "noun": [
      "context",
      "lamp"
    ],
    "adjective": [
      "easy",
      "given to gentle behavior or treatment",
      "pale",
      "scarce"
    ],
    "verb": [
      "kindle",
      "torch",
      "come upon",
      "discover by chance"
    ]
  }

  ...The response should be:

  {
    "noun": [
      "lamp"
    ],
    "adjective": [
      "easy",
      "gentle",
      "pale",
      "scarce"
    ],
    "verb": [
      "kindle",
      "torch"
    ]
  }  
`;

const MSG_MATCH_SENSE = `

`;

export async function condenseSenses(entries) {
  for (const word in entries) {
    // Skip words that have only one sense.
    let willProcess = false;
    for (const pos of Object.keys(entries[word]).filter(
      (s) => s !== 'languages'
    )) {
      if (entries[word][pos].senses.length > 1) {
        willProcess = true;
      }
    }
    if (!willProcess) {
      continue;
    }

    try {
      const res = await gpt.condenseSenses(word, entries[word]);
      const data = `${word} ${JSON.stringify(res)}\n`;
      await appendFile(getPath('gpt.out'), data);
    } catch (error) {
      console.log('Error:', error);
      const data = `${word} ${JSON.stringify(entries[word])}\n`;
      await appendFile(getPath('gpt.err'), data);
    }
  }
}

export async function matchSenses() {
  console.log('ello');
  // TODO:
  // - Load from gpt.log, replace senses with condensed versions
  // - For every sense (English) of every word (Anglish) that is not linked to a synset, look up that sense in WordNet,
  //   get its matching sense, then link the matched sense's synset to this sense.
}

async function createCompletion(word, entry) {
  const formatted = formatForGPT(word, entry);
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: MSG_CONDENSE_SENSES,
      },
      {
        role: 'user',
        content: formatted,
      },
    ],
    model: 'gpt-4o',
  });

  const res = JSON.parse(completion.choices[0].message.content);
  return res;
}

function formatForGPT(word, entry) {
  const obj = {};
  for (const pos of _.without(Object.keys(entry), 'languages')) {
    const arr = entry[pos].senses;
    switch (pos) {
      case 'noun':
      case 'n':
        obj.noun = arr;
        break;
      case 'v':
        obj.verb = arr;
        break;
      case 'a':
        obj.adjective = arr;
        break;
      case 'r':
        obj.adverb = arr;
        break;
      case 'p':
        obj.preposition = arr;
      case 'i':
        obj.interjection = arr;
        break;
      case 'x':
        obj.other = arr;
        break;
      default:
        throw new Error(`Unrecognized part of speech: ${pos}`);
    }
  }
  return `${word} ${JSON.stringify(obj)}`;
}

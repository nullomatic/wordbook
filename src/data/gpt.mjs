import 'dotenv/config';
import { appendFile } from 'fs/promises';
import _ from 'lodash';
import OpenAI from 'openai';
import { getPath } from './util.mjs';

export const openai = new OpenAI();

const MSG_CONDENSE_SENSES = `
  "Anglish" is a linguistically pure, Germanic version of English - how English would be without foreign influence. \
  Given an Anglish context word and JSON object following it, replace the English array elements with each possible \
  sense of the context word. Condense longer sentences down to a single word or compound word. Leave at least one array \
  element in each array. Return the filtered JSON object, without Markdown or backticks, such that the entire response \
  can be passed directly to JSON.parse().

  For example, given the following word and object...
  
  light {
    "noun": [
      "context",
      "lamp"
    ],
    "adjective": [
      "easy",
      "given to gentle behavior or treatment; soft",
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
  "Anglish" is a linguistically pure, Germanic version of English - how English would be without foreign influence. \
  Given 1) a JSON object that contains an Anglish word, its part of speech, and its sense, and 2) an array of potential \
  matching sense objects, select the indices of all objects from the senses array that match the sense of the first object. \
  Return the indices (zero-based) as a comma-delimited string, like '0,3,11'. Return ONLY the indicies, with no additional text. \
  Make sure the indices are zero-based, meaning the first index starts at 0. If no objects match, return an empty string.

  For example, given the following object and array...

  { word: 'wortwale', pos: 'noun', sense: 'plant' }
  [
    {
      id: '00017402-n',
      def: '(botany) a living organism lacking the power of locomotion'
    },
    {
      id: '03963198-n',
      def: 'buildings for carrying on industrial labor'
    },
    {
      id: '10458237-n',
      def: 'an actor situated in the audience whose acting is rehearsed but seems spontaneous to the audience'
    },
    {
      id: '05914674-n',
      def: 'something planted secretly for discovery by another'
    }
  ]

  ...The response should be: 0
`;

export async function condenseSense(wordnet, word, entry) {
  try {
    let res = await createCompletion(
      MSG_CONDENSE_SENSES,
      formatMessage(word, entry)
    );
    res = unformat(JSON.parse(res));
    const data = `${word} ${JSON.stringify(res)}`;
    console.log('data', data);
    await appendFile(getPath('/log/gpt-condensed2.out'), data + '\n');
  } catch (error) {
    console.error('Error:', error);
    const data = `${word} ${JSON.stringify(entry)}\n`;
    await appendFile(getPath('/log/gpt-condensed2.err'), data + '\n');
  }
}

export async function condenseSenses(wordnetEntries, wordsForGPT) {
  const entries = _.pick(wordnetEntries, Array.from(wordsForGPT));
  for (const word in entries) {
    try {
      let res = await createCompletion(
        MSG_CONDENSE_SENSES,
        formatMessage(word)
      );
      res = unformat(JSON.parse(res));
      const data = `${word} ${JSON.stringify(res)}`;
      console.log(data);
      await appendFile(getPath('/log/gpt-condensed.out'), data + '\n');
    } catch (error) {
      console.error('Error:', error);
      const data = `${word} ${JSON.stringify(entries[word])}\n`;
      await appendFile(getPath('/log/gpt-condensed.err'), data + '\n');
    }
  }
}

export async function matchSense(word, pos, sense, _senses, wordnet) {
  // TODO:
  // - Load from gpt.log, replace senses with condensed versions
  // - For every sense (English) of every word (Anglish) that is not linked to a synset, look up that sense in WordNet,
  //   get its matching sense, then link the matched sense's synset to this sense.
  const obj = {
    anglish: word,
    pos: longFormPoS(pos),
    sense: sense,
  };
  const selection = _senses.map((s) => {
    if (typeof s === 'string') {
      return null;
    }
    const synsetId = s.synset;
    const synset = wordnet.synsets[s.synset];
    return { id: synsetId, def: synset.definition[0] };
  });

  let data = `${word}:${pos}:${sense} `;

  try {
    const formatted = `${JSON.stringify(obj)} ${JSON.stringify(selection)}`;
    const res = await createCompletion(MSG_MATCH_SENSE, formatted);
    let indices = (res ? res.split(',') : [])
      .filter((s) => !!s)
      .map((i) => parseInt(i));
    if (indices[indices.length - 1] === selection.length) {
      indices = indices.map((i) => i - 1); // Correct zero-based indices
    }
    const after = indices.map((i) => {
      const sense = selection[i];
      if (!sense) {
        throw new Error(
          `ChatGPT parsing error. No word sense at index '${i}'\n` +
            `${data}${res} in ${selection.length}`
        );
      }
      return { synset: sense.id };
    });
    data += JSON.stringify(after);
    console.log(data);
    await appendFile(getPath('/log/gpt-matched.out'), data + '\n');
  } catch (error) {
    console.error('Error:', error);
    await appendFile(getPath('/log/gpt-matched.err'), data + '\n');
  }
}

async function createCompletion(systemMessage, userMessage) {
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: systemMessage,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ],
    model: 'gpt-4o',
  });
  return completion.choices[0].message.content;
}

function longFormPoS(pos, obj) {
  switch (pos) {
    case 'n':
      return 'noun';
    case 'v':
      return 'verb';
    case 'a':
      return 'adjective';
    case 'r':
      return 'adverb';
    case 'p':
      return 'preposition';
    case 'i':
      return 'interjection';
    case 'x':
      return 'other';
    default:
      throw new Error(`Unrecognized part of speech: ${pos}`);
  }
}

function formatMessage(word, entry) {
  const obj = {};
  for (const pos in entry) {
    if (pos === 'languages') continue;
    const arr = entry[pos].senses;
    obj[longFormPoS(pos)] = arr;
  }
  return `${word} ${JSON.stringify(obj)}`;
}

function unformat(json) {
  const obj = {};
  for (const pos of Object.keys(json)) {
    const senses = json[pos];
    switch (pos) {
      case 'noun':
        obj.n = senses;
        break;
      case 'verb':
        obj.v = senses;
        break;
      case 'adjective':
        obj.a = senses;
        break;
      case 'adverb':
        obj.r = senses;
        break;
      case 'preposition':
        obj.p = senses;
      case 'interjection':
        obj.i = senses;
        break;
      case 'other':
        obj.x = senses;
        break;
      default:
        throw new Error(`Unrecognized part of speech: ${pos}`);
    }
  }
  return obj;
}

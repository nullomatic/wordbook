import 'dotenv/config';
import { appendFile } from 'fs/promises';
import cliProgress from 'cli-progress';
import OpenAI from 'openai';
import { getPath, logger } from './util.mjs';

export const openai = new OpenAI();

const GPT_CONDENSED_PATH_OUT = getPath('/gpt/gpt-condensed.out');
const GPT_CONDENSED_PATH_ERR = getPath('/gpt/gpt-condensed.err');
const GPT_MATCHED_PATH_OUT = getPath('/gpt/gpt-matched.out');
const GPT_MATCHED_PATH_ERR = getPath('/gpt/gpt-matched.err');

const MSG_CONDENSE_SENSES = `
  "Anglish" is a linguistically pure, Germanic version of English - how English would be without Latin influence. \
  Given an Anglish context word, its part of speech, and the array of senses following it, create a new array with all \
  possible English synonyms, if any, of the context word. Return the array in JSON format without Markdown or backticks, \
  such that the entire response can be passed directly to JSON.parse().

  For example, given the following...
  
  wordlore:noun [
    "The study of words",
    "Branch of science that deals with the origin of words",
    "etymology"
  ]

  ...The response should be:

  [
    "lexicology",
    "philology",
    "linguistics",
    "etymology"
  ]  
`;

const MSG_MATCH_SENSES = `
  "Anglish" is a linguistically pure, Germanic version of English - how English would be without Latin influence. \
  You will be given 1) an Anglish word and its part of speech, 2) an array of English senses, and 3) an array of synsets. \
  Create a new array of the IDs of all synsets (max 10) that best define the word. Return the array in JSON format without Markdown or \
  backticks, such that the entire response can be passed directly to JSON.parse().

  For example, given the following...

  wortwale:noun
  ["plant", "herb", "weed"]
  [
    {
      "id": "03963198-n",
      "def": "buildings for carrying on industrial labor"
    },
    {
      "id": "00017402-n",
      "def": "(botany) a living organism lacking the power of locomotion"
    },
    {
      "id": "10458237-n",
      "def": "an actor situated in the audience whose acting is rehearsed but seems spontaneous to the audience"
    }
  ]

  ...The response should be: ["00017402-n"]
`;

export async function condenseSenses(toCondense, batchCount) {
  const bar = new cliProgress.SingleBar(
    {
      format:
        'senses:condensed [{bar}] {percentage}% | ETA: {eta_formatted} | {value}/{total}',
    },
    cliProgress.Presets.legacy
  );

  let batchesProcessed = 0;
  bar.start(batchCount, batchesProcessed);
  for (const word in toCondense) {
    for (const pos in toCondense[word]) {
      const _pos = longForm(pos);
      const message = `${word} ${JSON.stringify({ [_pos]: senses })}`;
      try {
        let res = await createCompletion(MSG_CONDENSE_SENSES, message);
        res = JSON.parse(res);
        const data = JSON.stringify({ word, [pos]: res });
        logger.verbose(data);
        await appendFile(GPT_CONDENSED_PATH_OUT, data + '\n');
      } catch (error) {
        const data = `${word}:${pos}\n`;
        await appendFile(GPT_CONDENSED_PATH_ERR, data);
      }
      bar.update(++batchesProcessed);
    }
  }
  bar.stop();
}

export async function matchSenses(toMatch, matchCount) {
  const bar = new cliProgress.SingleBar(
    {
      format:
        'senses:matched [{bar}] {percentage}% | ETA: {eta_formatted} | {value}/{total}',
    },
    cliProgress.Presets.legacy
  );

  let matchesProcessed = 0;
  bar.start(matchCount, matchesProcessed);
  for (const word in toMatch) {
    for (const pos in toMatch[word]) {
      const _pos = longForm(pos);
      const { senses, candidates } = toMatch[word][pos];
      const message = `${word}:${_pos}\n${JSON.stringify(
        senses
      )}\n${JSON.stringify(candidates)}`;
      try {
        let res = await createCompletion(MSG_MATCH_SENSES, message);
        res = JSON.parse(res);
        const data = JSON.stringify({ word, [pos]: res });
        for (const synsetId of res) {
          if (!candidates.some(({ id }) => id === synsetId)) {
            throw new Error();
          }
        }
        logger.verbose(data);
        await appendFile(GPT_MATCHED_PATH_OUT, data + '\n');
      } catch (error) {
        const data = `${word}:${pos}\n`;
        await appendFile(GPT_MATCHED_PATH_ERR, data);
      }
      bar.update(++matchesProcessed);
    }
  }
  bar.stop();
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

function longForm(pos) {
  switch (pos) {
    case 'n':
      return 'noun';
    case 'v':
      return 'verb';
    case 'a':
      return 'adjective';
    case 'r':
      return 'adverb';
    case 's':
      return 'satellite';
    case 'c':
      return 'conjunction';
    case 'p':
      return 'preposition';
    case 'x':
      return 'other';
    case 'u':
      return 'unknown';
    default:
      throw new Error(`Unrecognized part of speech: ${pos}`);
  }
}

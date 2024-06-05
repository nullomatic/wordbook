import 'dotenv/config';
import { appendFile } from 'fs/promises';
import OpenAI from 'openai';

export const openai = new OpenAI();

export async function removeDuplicateSenses(word, entry) {
  const formatted = formatObj(word, entry);
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `"Anglish" is a linguistically pure, Germanic version of English - how English would be without foreign influence. \
          Given an Anglish context word and JSON object following it, remove any English array elements that do not describe the Anglish \
          context word (according to their part of speech, denoted by the key). Remove any words that are close synonyms of another, that \
          redundantly duplicate meaning. Remove any long array elements that are not a single word or compound word. If you don't recognize \
          the Anglish context word, err on the side of leaving array elements in, rather than taking them out. Leave at least one array element \
          in each array. Return the filtered JSON object, without Markdown or backticks, such that the entire response can be passed directly \
          to JSON.parse().

          For example, given the following word and object...
          
          light {
            "noun": [
              "context",
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
        `,
      },
      {
        role: 'user',
        content: formatted,
      },
    ],
    model: 'gpt-4o',
  });

  const res = JSON.parse(completion.choices[0].message.content);
  const data = `${word} ${JSON.stringify(res)}\n`;
  console.log(data);
  await appendFile('./test.txt', data);
  return res;
}

function formatObj(word, entry) {
  const obj = {};
  for (const key in entry) {
    const arr = entry[key].senses.map(({ sense }) => sense);
    switch (key) {
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
      default:
        throw new Error(`Unrecognized PoS: ${key}`);
    }
  }
  return `${word} ${JSON.stringify(obj)}`;
}

import 'dotenv/config';
import OpenAI from 'openai';

export const openai = new OpenAI();

//await main();

async function main() {
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `Given the word preceding the array, select all array elements that could, even loosely, be a synonym of the word and return \
          the filtered array. The word in each array element is indicated by the key 'en', and the part of speech by the key 'pos'. \
          Return a JSON array, without Markdown, such that the entire response can be passed directly to JSON.parse().`,
      },
      {
        role: 'user',
        content: `
          craft [ \ 
            { en: 'ability', pos: 'n' }, \ 
            { en: 'art', pos: 'n' }, \ 
            { en: 'artisanal art', pos: 'adj' }, \ 
            { en: 'art', pos: 'n' }, \ 
            { en: 'create', pos: 'vb' }, \ 
            { en: 'engine', pos: 'n' }, \ 
            { en: 'force', pos: 'n' }, \ 
            { en: 'power', pos: 'n' }, \ 
            { en: 'technology', pos: 'n' }, \ 
            { en: 'vehicle', pos: 'n' } \ 
          ]
      `,
      },
      {
        role: 'assistant',
        content: `
        [ \ 
          { en: 'ability', pos: 'n' }, \ 
          { en: 'art', pos: 'n' }, \ 
          { en: 'create', pos: 'vb' }, \ 
          { en: 'vehicle', pos: 'n' } \ 
        ]
        `,
      },
      {
        role: 'user',
        content: `
        house [
          { en: 'ancestry', pos: 'n' },
          { en: 'clan', pos: 'n' },
          { en: 'dynasty', pos: 'n' },
          { en: 'edifice', pos: 'n' },
          { en: 'lineage', pos: 'n' }
        ]
        `,
      },
    ],
    model: 'gpt-4o',
  });

  console.log(completion.choices[0].message.content);
}

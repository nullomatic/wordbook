import { notFound } from 'next/navigation';
import { getDefinitions } from '@/lib/query';
import { Shorthand } from '@/lib/types';

export default async function Page({ params }: { params: { word: string } }) {
  const word = await getDefinitions(decodeURIComponent(params.word));
  if (!word) {
    return notFound();
  }
  const senses = [];
  let pos: keyof typeof word.pos;
  for (pos in word.pos) {
    senses.push(
      <div key={pos}>
        <div className='text-xl font-bold'>{Shorthand[pos].long}</div>
        {word.pos[pos].map((o, i) => (
          <div className='ml-2' key={`${pos}-${i}`}>
            {i + 1}. {o.def}
          </div>
        ))}
      </div>
    );
  }

  //const html = word.map((d) => <div>d.word</div>);

  //const json = await res.json();
  return (
    <div className='grow space-y-3'>
      <h1 className='text-5xl font-bold'>{word.word}</h1>
      <div className=''>Origin: {word.origin || 'unknown'}</div>
      <div className=''>Rhymes: {word.rhymes || 'none'}</div>
      <div className=''>Is Anglish: {`${word.isAnglish}`}</div>
      <div>{senses}</div>
    </div>
  );
}

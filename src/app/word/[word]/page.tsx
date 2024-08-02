import { notFound } from 'next/navigation';
import { getAnglishSynonyms, getDefinitions } from '@/lib/query';
import { Longhand } from '@/lib/types';

export default async function Page({ params }: { params: { word: string } }) {
  const word = decodeURIComponent(params.word);
  const entry = await getDefinitions(word);
  if (!entry) {
    return notFound();
  }
  const anglishSynonyms = await getAnglishSynonyms(entry);
  const senses = [];
  let pos: keyof typeof entry.pos;
  for (pos in entry.pos) {
    senses.push(
      <div key={pos}>
        <div className='text-xl text-center font-bold tracking-wide'>
          {Longhand[pos].long}
        </div>
        {entry.pos[pos].map((o, i) => (
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
    <div className='grow'>
      <h1 className='text-5xl text-center font-bold mb-6'>{entry.word}</h1>
      <div className='flex justify-center space-x-1.5 mb-6'>
        <div className='rounded bg-blue-700 px-1 py-0.5 text-xs uppercase text-white font-bold tracking-wide'>
          English
        </div>
        {entry.isAnglish ? (
          <div className='rounded bg-green-700 px-1 py-0.5 text-xs uppercase text-white font-bold tracking-wide'>
            Anglish
          </div>
        ) : (
          ''
        )}
      </div>
      <div className='border rounded-lg border-stone-400 p-3 text-sm text-center space-y-2 mb-6'>
        <div className='uppercase tracking-wider font-bold text-stone-400'>
          Origin
        </div>
        <div>
          {entry.origins.length
            ? entry.origins.map((str, i) => (
                <div key={`origin-${i}`}>{str}</div>
              ))
            : 'unknown'}
        </div>
      </div>
      <div className=''>Rhymes: {entry.rhyme || 'none'}</div>
      <div className=''>Is Anglish: {`${entry.isAnglish}`}</div>
      <div>{JSON.stringify(anglishSynonyms, null, 2)}</div>
      <div>{senses}</div>
    </div>
  );
}

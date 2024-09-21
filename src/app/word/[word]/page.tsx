import { notFound } from 'next/navigation';
import { Query } from '@/lib/query';
import { Longhand, POS } from '@/lib/constants';
import OriginWidget from '@/app/components/OriginWidget';
import SynonymCard from '@/app/components/SynonymCard';

export default async function Page({ params }: { params: { word: string } }) {
  const word = decodeURIComponent(params.word);
  const entry = await Query.definitions(word);
  if (!entry) {
    return notFound();
  }
  const synonyms = await Query.synonyms(entry);

  return (
    <div>
      {/* Word */}
      <section className='py-20 px-3 lg:px-0 space-y-3 dot-pattern mb-3'>
        <div className='text-[3.3rem] leading-none text-center font-bold'>
          {entry.word}
        </div>
        <div className='flex justify-center space-x-1.5'>
          <div className='rounded bg-sky-700 px-1.5 py-0.5 text-xs uppercase text-white font-bold tracking-wide'>
            English
          </div>
          {entry.isAnglish && (
            <div className='rounded bg-green-700 px-1.5 py-0.5 text-xs uppercase text-white font-bold tracking-wide'>
              Anglish
            </div>
          )}
        </div>
      </section>

      <div className='px-3 lg:px-0'>
        {/* Rhyme */}
        <section className='mt-4 mb-8 border rounded-lg border-stone-300 p-3 text-center space-y-2'>
          <div className='uppercase tracking-wider font-bold text-stone-400 text-sm'>
            Rhyme
          </div>
          {entry.rhyme ? (
            <div className='text-2xl'>{entry.rhyme}</div>
          ) : (
            <button className='my-1 px-3 py-2 rounded bg-stone-200 text-xs text-stone-900 uppercase tracking-wide font-bold'>
              Add Rhyme
            </button>
          )}
        </section>

        <div className='space-y-12'>
          {/* Parts of Speech & Senses */}
          <>
            {Object.keys(entry.pos).map((_pos) => {
              let pos: POS, index;
              if (_pos.length > 1) {
                [pos, index] = _pos.split('-') as [POS, string];
              } else {
                pos = _pos as POS;
              }
              return (
                <section className='space-y-8' key={`part-${_pos}`}>
                  <div className='flex justify-center items-center'>
                    <div className='h-[0.27rem] grow bg-stone-200 rounded-tl rounded-bl'></div>
                    <div className='h-8 text-3xl text-center font-bold tracking-wide bg-white px-4 leading-none'>
                      {Longhand[pos].long}
                      {index !== undefined && <sup>{index}</sup>}
                    </div>

                    <div className='h-[0.27rem] grow bg-stone-200 rounded-tr rounded-br'></div>
                  </div>

                  {/* Synonym Cards */}
                  <div className='space-y-3'>
                    {synonyms[pos].anglish?.length ? (
                      <SynonymCard
                        title='Anglish Synonyms'
                        color='green'
                        synonyms={synonyms[pos].anglish}
                      />
                    ) : null}
                    {synonyms[pos].english?.length ? (
                      <SynonymCard
                        title='English Synonyms'
                        color='blue'
                        synonyms={synonyms[pos].english}
                      />
                    ) : null}
                  </div>

                  {/* Definitions */}
                  <div className='w-full md:max-w-2xl mx-auto space-y-4'>
                    <div className='uppercase tracking-wider font-bold text-center text-stone-400 text-sm'>
                      Definitions
                    </div>

                    <div className='px-3 space-y-2 -mt-1'>
                      {entry.pos[_pos as POS].map((o, i) => (
                        <div
                          className='text-lg leading-normal flex'
                          key={`${pos}-${i}`}
                        >
                          <div className=''>
                            <div className='font-bold w-10'>{i + 1}</div>
                          </div>
                          <div>
                            <div className=''>{o.gloss}</div>
                            {o.sentence && (
                              <div className='italic border-l-4 pl-3 text-sm mt-2'>
                                {o.sentence}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}
          </>

          {/* Origins */}
          <section className='space-y-3'>
            {entry.origins.length ? (
              entry.origins.map((str, i) => (
                <OriginWidget
                  text={str}
                  rank={
                    entry.origins.length > 1
                      ? `${i + 1}/${entry.origins.length}`
                      : ''
                  }
                  key={`origin-${i}`}
                />
              ))
            ) : (
              <OriginWidget />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

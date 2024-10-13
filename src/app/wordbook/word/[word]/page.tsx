import { notFound } from "next/navigation";
import { Query } from "@/lib/query";
import { Longhand, POS } from "@/lib/constants";
import OriginWidget from "@/components/OriginWidget";
import SynonymCard from "@/components/SynonymCard";

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
      <section className="dot-pattern mb-3 space-y-3 px-3 py-20 lg:px-0">
        <div className="text-center text-[3.3rem] font-bold leading-none">
          {entry.word}
        </div>
        <div className="flex justify-center space-x-1.5">
          <div className="rounded bg-sky-700 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            English
          </div>
          {entry.isAnglish && (
            <div className="rounded bg-green-700 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              Anglish
            </div>
          )}
        </div>
      </section>

      <div className="px-3 lg:px-0">
        {/* Rhyme */}
        <section className="mb-8 mt-4 space-y-2 rounded-lg border border-stone-300 p-3 text-center">
          <div className="text-sm font-bold uppercase tracking-wider text-stone-400">
            Rhyme
          </div>
          {entry.rhyme ? (
            <div className="text-2xl">{entry.rhyme}</div>
          ) : (
            <button className="my-1 rounded bg-stone-200 px-3 py-2 text-xs font-bold uppercase tracking-wide text-stone-900">
              Add Rhyme
            </button>
          )}
        </section>

        <div className="space-y-12">
          {/* Parts of Speech & Senses */}
          <>
            {Object.keys(entry.pos).map((_pos) => {
              let pos: POS, index;
              if (_pos.length > 1) {
                [pos, index] = _pos.split("-") as [POS, string];
              } else {
                pos = _pos as POS;
              }
              return (
                <section className="space-y-8" key={`part-${_pos}`}>
                  {/* Part of Speech */}
                  <div className="flex items-center justify-center">
                    <div className="h-[0.27rem] grow rounded-bl rounded-tl bg-stone-200"></div>
                    <div className="h-8 bg-white px-4 text-center text-3xl font-bold leading-none tracking-wide">
                      {Longhand[pos].long}
                      {index !== undefined && <sup>{index}</sup>}
                    </div>
                    <div className="h-[0.27rem] grow rounded-br rounded-tr bg-stone-200"></div>
                  </div>

                  {/* Synonym Cards */}
                  <div className="space-y-3">
                    {synonyms[pos].anglish?.length ? (
                      <SynonymCard
                        title="Anglish Synonyms"
                        color="green"
                        synonyms={synonyms[pos].anglish}
                      />
                    ) : null}
                    {synonyms[pos].english?.length ? (
                      <SynonymCard
                        title="English Synonyms"
                        color="blue"
                        synonyms={synonyms[pos].english}
                      />
                    ) : null}
                  </div>

                  {/* Definitions */}
                  <div className="mx-auto w-full space-y-4 md:max-w-2xl">
                    <div className="text-center text-sm font-bold uppercase tracking-wider text-stone-400">
                      Definitions
                    </div>

                    <div className="-mt-1 space-y-2 px-3">
                      {entry.pos[_pos as POS]?.length ? (
                        entry.pos[_pos as POS]?.map((o, i) => (
                          <div
                            className="flex text-lg leading-normal"
                            key={`${pos}-${i}`}
                          >
                            <div className="">
                              <div className="w-10 font-bold">{i + 1}</div>
                            </div>
                            <div>
                              <div className="">{o.gloss}</div>
                              {o.sentence && (
                                <div className="mt-2 border-l-4 pl-3 text-sm italic">
                                  {o.sentence}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-center">
                          <button className="my-1 rounded bg-stone-200 px-3 py-2 text-xs font-bold uppercase tracking-wide text-stone-900">
                            Add Definition
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </>

          {/* Origins */}
          <section className="space-y-3">
            {entry.origins.length ? (
              entry.origins.map((str, i) => (
                <OriginWidget
                  text={str}
                  rank={
                    entry.origins.length > 1
                      ? `${i + 1}/${entry.origins.length}`
                      : ""
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

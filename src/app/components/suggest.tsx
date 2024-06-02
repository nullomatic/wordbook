'use client';

import { debounce } from 'lodash';
import Link from 'next/link';
import { useState } from 'react';

export default function Counter() {
  const results: any = [];
  const [list, setList] = useState(results);
  const _suggest = debounce(suggest, 200);
  async function suggest(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event?.target?.value;
    if (!input) {
      setList([]);
      return;
    }

    const res = await fetch('/api/', {
      method: 'post',
      body: input,
    });
    const json = await res.json();
    const results = json.map((key: string) => {
      const [lang, word, pos, etym] = key.split(':');
      return { lang, word, pos, etym };
    });

    setList(results);
  }

  return (
    <div className='w-full h-16 relative'>
      <input
        className='border border-stone-300 rounded-lg p-4 w-full focus:shadow-md focus:border-stone-400 ring-pink-300 outline-none mb-3'
        placeholder='Type English here...'
        onChange={_suggest}
      />
      <div className='absolute right-3 top-3 w-8 h-8 bg-stone-200 rounded-lg' />
      {list.map((result: any, i: number) => (
        <Link
          key={i}
          href={`/word/${result.lang}/${result.word}`}
          className='flex items-center space-x-12 px-6 py-3 hover:bg-stone-100 rounded-lg'
        >
          <div className='uppercase text-sm font-bold text-stone-800'>
            {result.lang}
          </div>
          <div className=''>{result.word}</div>
          <div className=''>{result.pos}</div>
        </Link>
      ))}
    </div>
  );
}

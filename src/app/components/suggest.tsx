'use client';

import { debounce } from 'lodash';
import Link from 'next/link';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMagnifyingGlass,
  faCircleXmark,
} from '@fortawesome/free-solid-svg-icons';

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
    <div className='w-full relative'>
      <div className='absolute left-4 top-5 flex items-center h-4 w-4'>
        <FontAwesomeIcon icon={faMagnifyingGlass} className='text-sm' />
      </div>
      <input
        className='border border-stone-300 h-14 rounded-lg px-11 py-4 w-full focus:shadow-md focus:border-stone-400 ring-pink-300 outline-none'
        placeholder='Enter a word...'
        onChange={_suggest}
      />
      <div className='absolute right-4 top-5 flex items-center h-4 w-4'>
        <FontAwesomeIcon icon={faCircleXmark} className='text-sm' />
      </div>
      {list.length && (
        <div className='mt-3 bg-white rounded-lg border border-stone-300 divide-y overflow-hidden'>
          {list.map((result: any, i: number) => (
            <Link
              key={i}
              href={`/word/${result.lang}/${result.word}`}
              className='flex items-center py-3 hover:bg-lime-100'
            >
              <div className='uppercase text-sm font-bold text-stone-800 px-5'>
                {result.lang}
              </div>
              <div className='grow'>{result.word}</div>
              <div className='px-5'>{result.pos}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

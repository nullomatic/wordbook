'use client';

import {
  faMagnifyingGlass,
  faCircleXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
    <div className='w-full relative'>
      <div className='absolute left-4 top-4 flex items-center h-4 w-4 z-20'>
        <FontAwesomeIcon icon={faMagnifyingGlass} className='text-sm' />
      </div>
      <input
        className='dark:bg-stone-800 z-10 dark:placeholder:text-stone-400 relative border dark:border-stone-800 h-12 rounded-lg px-11 py-4 w-full shadow-inner focus:border-stone-400 ring-pink-300 outline-none'
        placeholder='Search for a word...'
        onChange={_suggest}
      />
      <div className='h-12 w-full rounded-lg dark:bg-stone-600 absolute top-1 left-1'></div>
      <div className='absolute right-3 top-4 flex items-center h-4 w-4 z-20'>
        <FontAwesomeIcon icon={faCircleXmark} className='text-sm' />
      </div>
      {
        <div
          className={`mt-3 bg-white rounded-lg border dark:border-stone-300 divide-y overflow-hidden ${
            !list.length ? 'hidden' : ''
          }`}
        >
          {list.map((result: any, i: number) => (
            <Link
              key={i}
              href={`/word/${result.lang}/${result.word}`}
              className='flex items-center py-3 hover:bg-lime-100'
            >
              <div className='uppercase text-sm font-bold dark:text-stone-800 px-5'>
                {result.lang}
              </div>
              <div className='grow'>{result.word}</div>
              <div className='px-5'>{result.pos}</div>
            </Link>
          ))}
        </div>
      }
    </div>
  );
}

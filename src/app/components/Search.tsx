'use client';

import {
  faMagnifyingGlass,
  faCircleXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { debounce } from 'lodash';
import Link from 'next/link';
import { useState } from 'react';
import { Lang, POS, Longhand } from '@/lib/types';

export default function Search() {
  const results: any = [];
  const [list, setList] = useState(results);
  const _search = debounce(search, 200);
  async function search(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event?.target?.value;
    if (!input) {
      setList([]);
      return;
    }
    const res = await fetch('/api/search', {
      method: 'post',
      body: input,
    });
    const entries = await res.json();
    setList(entries);
  }

  return (
    <div className='w-full relative'>
      <div className='absolute left-4 top-4 flex items-center h-4 w-4 z-20'>
        <FontAwesomeIcon icon={faMagnifyingGlass} className='text-sm' />
      </div>
      <input
        className='dark:bg-stone-800 z-10 dark:placeholder:text-stone-400 relative border dark:border-stone-800 h-12 rounded-lg px-11 py-4 w-full shadow-inner focus:border-stone-400 ring-pink-300 outline-none'
        placeholder='Search for a word...'
        onChange={_search}
      />
      <div className='h-12 w-full rounded-lg dark:bg-stone-600 absolute top-1 left-1'></div>
      <div className='absolute right-3 top-4 flex items-center h-4 w-4 z-20'>
        <FontAwesomeIcon icon={faCircleXmark} className='text-sm' />
      </div>
      {
        <div
          className={`mt-3 bg-white rounded-lg border dark:border-stone-300 divide-y overflow-hidden absolute top-10 w-full ${
            !list.length ? 'hidden' : ''
          }`}
        >
          {list.map((entry: any, i: number) => (
            <Link
              key={`search-result-${i}`}
              href={`/word/${entry.word}`}
              className='flex items-center py-3 hover:bg-lime-100 px-3 space-x-4 bg-stone-800'
              onClick={() => setList([])}
            >
              <div className='grow font-bold'>{entry.word}</div>
              <div className='space-x-1 flex justify-end text-sm text-stone-800 dark:text-stone-200'>
                {entry.parts.map((pos: POS, j: number) => (
                  <div className='' key={`search-result-${i}-pos-${j}`}>
                    {Longhand[pos].short}
                  </div>
                ))}
              </div>
              <div className='space-x-1 flex justify-end text-sm uppercase font-bold text-gray-800 dark:text-gray-200'>
                {entry.langs.map((lang: Lang, j: number) => (
                  <div className={``} key={`search-result-${i}-lang-${j}`}>
                    {lang}
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      }
    </div>
  );
}

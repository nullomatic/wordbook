'use client';

import Link from 'next/link';
import Search from './Search';

export default function HeaderTabs() {
  return (
    <div className='w-full shadow-lg z-50'>
      <div className='grid grid-cols-2 text-center font-bold bg-stone-200 dark:bg-stone-900 tracking-wide'>
        <Link
          href='/'
          className='space-x-1.5 p-3 rounded-tr-lg bg-white dark:bg-stone-700 border-b-2 border-dashed border-stone-200 dark:border-stone-600'
        >
          <span>📚</span>
          <span>Wordbook</span>
        </Link>
        <Link
          href='/translator'
          className='space-x-1.5 p-3 opacity-70 grayscale'
        >
          <span>🧙‍♂️</span>
          <span>Translator</span>
          <span className='uppercase text-xs border border-stone-400 rounded px-1 text-stone-400'>
            Beta
          </span>
        </Link>
      </div>
      <div className='w-full lg:max-w-4xl mx-auto flex flex-col bg-white dark:bg-stone-700 px-3 lg:px-0 lg:pr-1 py-3'>
        <Search />
      </div>
    </div>
  );
}

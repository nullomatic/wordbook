'use client';

import Link from 'next/link';
import Search from './Search';

export default function HeaderTabs() {
  return (
    <div className='w-full'>
      <div className='grid grid-cols-2 w-full text-center font-bold'>
        <Link
          href='/'
          className='p-3 rounded-tr-lg dark:bg-stone-700 border-b-2 border-dashed dark:border-stone-600'
        >
          🌲 Thesaurus
        </Link>
        <Link href='/translator' className='p-3 opacity-70'>
          🧙‍♂️ Translator
        </Link>
      </div>
      <div className='flex flex-col w-full dark:bg-stone-700 px-3 py-3'>
        <Search />
      </div>
    </div>
  );
}

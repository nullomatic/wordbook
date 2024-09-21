'use client';

import Link from 'next/link';
import Search from './Search';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBook,
  faFeather,
  faFlask,
  faHatWizard,
  faTree,
} from '@fortawesome/free-solid-svg-icons';

export default function HeaderTabs() {
  return (
    <div className='w-full shadow-lg z-50'>
      <div className='flex justify-center bg-stone-300'>
        <div className='shrink w-full flex grid grid-cols-1 text-center p-3 bg-stone-200'>
          <Link
            href='/'
            className='font-bold texl-xl tracking-tight text-stone-600 hover:text-black space-x-1.5'
          >
            <FontAwesomeIcon icon={faTree} className='' />
            <span>anglish.wiki</span>
          </Link>
        </div>

        <div className='w-full lg:max-w-[59rem] mx-auto shrink-0 bg-stone-200 rounded-tr-lg'>
          <div className='grid grid-cols-2 text-center font-bold'>
            <Link
              href='/wordbook'
              className='space-x-1.5 p-3 rounded-tr-lg lg:rounded-t-lg bg-white dark:bg-stone-700 border-b-2 border-dashed border-stone-200 dark:border-stone-600'
            >
              <FontAwesomeIcon icon={faBook} className='text-orange-600' />
              <span>Wordbook</span>
            </Link>
            <Link
              href='/translator'
              className='p-3 rounded-tr-lg text-stone-600 group hover:text-black space-x-1.5'
            >
              <FontAwesomeIcon icon={faHatWizard} className='' />
              <span>Translator</span>
              <span className='uppercase text-xs border text-stone-500 border-stone-500 group-hover:border-stone-800 group-hover:text-stone-800 rounded px-1'>
                Beta
              </span>
            </Link>
          </div>
        </div>

        <div className='shrink w-full flex grid grid-cols-1 text-center p-3 bg-stone-300'>
          <Link
            href='/editor'
            className='font-bold texl-xl text-stone-600 hover:text-black space-x-1.5'
          >
            <FontAwesomeIcon icon={faFeather} className='' />
            <span>Editor</span>
          </Link>
        </div>
      </div>

      <div className='w-full lg:max-w-4xl mx-auto flex flex-col bg-white dark:bg-stone-700 px-3 lg:px-0 lg:pr-1 py-3'>
        <Search />
      </div>
    </div>
  );
}

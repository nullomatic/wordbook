'use client';

import { faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Link from 'next/link';

export default function Widget() {
  return (
    <div className='relative rounded-lg border-2 border-stone-700 p-6 w-full shadow-lg bg-stone-800'>
      <Link href='/word/bookcraft' className='text-sm absolute right-6 top-6'>
        <FontAwesomeIcon icon={faUpRightFromSquare} />
      </Link>

      <div className='uppercase tracking-wide mb-4 dark:text-stone-200 leading-none'>
        <div className=''>Word of the Day</div>
        <div className='text-sm dark:text-stone-500'>June 8, 2024</div>
      </div>
      <div className='text-4xl mb-2'>bookcraft</div>
      <div className='mb-4'>
        <span className='italic dark:text-stone-400 mr-2'>noun</span>
        <span className='dark:text-stone-200 break-words'>
          Written works, especially those considered of superior or lasting
          artistic merit
        </span>
      </div>
      <Link
        href='/word/bookcraft'
        className='block rounded-lg border-2 border-stone-600 bg-stone-700 uppercase tracking-wider text-sm font-bold text-center p-3'
      >
        See Synonyms
      </Link>
    </div>
  );
}

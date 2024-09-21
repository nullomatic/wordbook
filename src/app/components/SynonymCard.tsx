'use client';

import Link from 'next/link';
import { POS } from '@/lib/constants';
import classNames from 'classnames';

export default function SynonymCard({
  title,
  color,
  synonyms,
}: {
  title: string;
  color: 'green' | 'blue';
  synonyms: string[];
}) {
  return (
    <div
      className={classNames(
        {
          'from-emerald-200 to-lime-100': color === 'green',
          'from-blue-200 to-sky-100': color === 'blue',
        },
        'rounded-lg p-3 text-center space-y-2 bg-gradient-to-tr'
      )}
    >
      <div
        className={classNames(
          {
            'text-lime-800': color === 'green',
            'text-sky-800': color === 'blue',
          },
          'uppercase tracking-wider font-bold text-sm'
        )}
      >
        {title}
      </div>
      <div className='flex flex-wrap justify-center gap-2 py-1'>
        {synonyms.map((synonym: string) => (
          <Link
            href={`/word/${synonym}`}
            className='rounded-lg bg-white px-3 py-2 shadow-inner'
          >
            {synonym}
          </Link>
        ))}
      </div>
    </div>
  );
}

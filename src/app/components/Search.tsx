'use client';

import {
  faMagnifyingGlass,
  faCircleXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { debounce } from 'lodash';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Lang, POS, Longhand } from '@/lib/constants';
import classNames from 'classnames';
import { useRouter } from 'next/navigation';
import { SearchResult } from '@/lib/types';

export default function Search() {
  const [input, setInput] = useState('');
  const [hasFocus, setHasFocus] = useState(false);
  const [resultList, setResultList]: [SearchResult[], any] = useState([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const isMobile = isMobileDevice();

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      // Check if 'Ctrl' or 'Meta' (Command on Mac) + 'K' are pressed
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  const handleFocus = () => {
    setHasFocus(true);
  };

  const handleBlur = () => {
    setHasFocus(false);
  };

  const debouncedSearch = useCallback(
    debounce((nextValue) => search(nextValue), 250),
    []
  );

  async function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event?.target?.value;
    setInput(input);
    debouncedSearch(input);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && resultList.length) {
      const entry = resultList[selectedResultIndex] as SearchResult;
      router.push(`/word/${entry.word}`);
      inputRef.current?.blur();
      setInput(entry.word);
      setResultList([]);
      setSelectedResultIndex(0);
    }
    if (event.key === 'Escape') {
      inputRef.current?.blur();
      setResultList([]);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (selectedResultIndex > 0) {
        setSelectedResultIndex(selectedResultIndex - 1);
      }
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (selectedResultIndex < resultList.length - 1) {
        setSelectedResultIndex(selectedResultIndex + 1);
      }
    }
  }

  async function search(input: string) {
    if (!input) {
      setResultList([]);
      setSelectedResultIndex(0);
      return;
    }
    const res = await fetch('/api/search', {
      method: 'post',
      body: input,
    });
    const entries = await res.json();
    setResultList(entries);
    setSelectedResultIndex(0);
  }

  return (
    <div className='w-full relative z-20'>
      <div className='absolute left-4 top-4 flex items-center h-4 w-4 z-20'>
        <FontAwesomeIcon icon={faMagnifyingGlass} className='text-sm' />
      </div>
      <input
        className='bg-white dark:bg-stone-800 z-10 dark:placeholder:text-stone-400 relative border border-stone-300 dark:border-stone-800 h-12 rounded-lg px-11 py-4 w-full shadow-inner focus:border-stone-400 ring-pink-300 outline-none'
        placeholder='Search for a word...'
        ref={inputRef}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        value={input}
      />
      <div className='h-12 w-full rounded-lg bg-stone-200 dark:bg-stone-600 absolute top-1 left-1'></div>
      <div className='absolute h-4 w-10 right-3 top-4 flex justify-end items-center z-20'>
        {isMobile ? (
          // Mobile 'X' icon to clear search
          <div
            className={classNames(
              `text-sm text-stone-500 dark:text-stone-200 hover:text-black cursor-pointer`,
              { hidden: !input }
            )}
            onClick={() => {
              setInput('');
              setResultList([]);
            }}
          >
            <FontAwesomeIcon icon={faCircleXmark} />
          </div>
        ) : (
          // Desktop 'Ctrl K' and 'Esc' indicators
          <div
            className={classNames(
              `uppercase font-bold whitespace-nowrap text-xs text-stone-400 dark:text-stone-200 hover:text-black cursor-pointer border rounded px-1 py-0.5`
            )}
            onClick={() => {
              setInput('');
              setResultList([]);
            }}
          >
            {hasFocus ? 'Esc' : 'Ctrl K'}
          </div>
        )}
      </div>
      {
        <div
          className={classNames(
            'mt-3 bg-white rounded-bl-lg rounded-br-lg border border-stone-300 w-full shadow-lg dark:border-stone-300 divide-y divide-stone-200 dark:divide-stone-500 overflow-hidden absolute top-7 w-full',
            {
              hidden: !resultList.length,
            }
          )}
        >
          {resultList.map((entry: SearchResult, i: number) => (
            <Link
              key={`search-result-${i}`}
              href={`/word/${entry.word}`}
              className={classNames('flex items-center py-3 px-4 space-x-3', {
                'pt-5': i === 0,
                'bg-green-50 dark:bg-stone-800':
                  selectedResultIndex === i && entry.isAnglish,
                'bg-sky-50 dark:bg-stone-800':
                  selectedResultIndex === i && !entry.isAnglish,
                'hover:bg-green-100': entry.isAnglish,
                'hover:bg-sky-100': !entry.isAnglish,
                'bg-white dark:bg-stone-800': selectedResultIndex !== i,
              })}
              onClick={() => {
                setInput(entry.word);
                setResultList([]);
                setSelectedResultIndex(0);
              }}
            >
              <div className='font-bold'>{entry.word}</div>
              <div className='grow space-x-0.5 flex font-bold text-xs uppercase text-white dark:text-gray-200'>
                <div className='bg-sky-700 rounded h-3.5 w-5 flex items-center justify-center'>
                  {Lang.English.toUpperCase()}
                </div>
                {entry.isAnglish ? (
                  <div className='bg-green-700 rounded h-3.5 w-5 flex items-center justify-center'>
                    {Lang.Anglish.toUpperCase()}
                  </div>
                ) : null}
              </div>
              <div className='font-medium space-x-1 flex justify-end text-sm text-stone-800 dark:text-stone-200'>
                <div className=''>
                  {entry.parts
                    .map((pos: POS, j: number) => Longhand[pos].short)
                    .join(', ')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      }
    </div>
  );
}

function isMobileDevice() {
  return (
    typeof window !== 'undefined' &&
    /Mobi|Android|iPhone/i.test(navigator?.userAgent)
  );
}

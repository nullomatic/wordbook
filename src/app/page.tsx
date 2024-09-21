import Image from 'next/image';
import Link from 'next/link';
import adPic from '../../public/girl.jpg';
import WordWidget from './components/WordWidget';

export default function Home() {
  return (
    <div className='w-full space-y-6'>
      {/* Welcome Section */}
      <section className='text-center py-12 px-3 lg:px-0 dot-pattern'>
        <div className='italic mb-6'>Welcome to</div>
        <div className='uppercase tracking-widest text-[2.5rem] lg:text-[3.2rem] font-bold shadow-stone-400 drop-shadow-[0_0_48px_var(--tw-shadow-color)]'>
          The Wordbook
        </div>
        <div className='mb-6'>🍃📚🍄🌱🔥🌿🔮🌾</div>
        <p className='w-full max-w-2xl mx-auto dark:text-stone-400'>
          <i>The Wordbook</i> is a resource for translating English to Anglish,
          a linguistically pure version of English&mdash;how English would have
          been without the Norman invasion of 1066.{' '}
          <Link href='/wiki' className='dark:text-stone-300 underline'>
            Learn more
          </Link>
        </p>
      </section>
      {/* Site Links */}
      <section className='flex space-x-2 my-9 justify-center px-3 lg:px-0'>
        <Link
          href='/wiki'
          className='rounded-lg dark:bg-stone-800 px-4 py-2 uppercase tracking-wide text-sm shadow w-full text-center'
        >
          Wiki
        </Link>
        <Link
          href='/browse'
          className='rounded-lg dark:bg-stone-800 px-4 py-2 uppercase tracking-wide text-sm shadow w-full text-center'
        >
          Browse
        </Link>
        <Link
          href='/about'
          className='rounded-lg dark:bg-stone-800 px-4 py-2 uppercase tracking-wide text-sm shadow w-full text-center'
        >
          About
        </Link>
      </section>
      {/* Word of the Day Widget */}
      <section className='px-3 lg:px-0'>
        <WordWidget />
      </section>
    </div>
  );
}

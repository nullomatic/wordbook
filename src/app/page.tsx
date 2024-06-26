import Image from 'next/image';
import Link from 'next/link';
import adPic from '../../public/girl.jpg';
import HeaderTabs from './components/HeaderTabs';
import WordWidget from './components/WordWidget';

export default function Home() {
  return (
    <main className='flex min-h-screen flex-col items-center'>
      <HeaderTabs />
      <div className='grow space-y-6'>
        {/* Welcome Section */}
        <section className='text-center my-12 px-3'>
          <div className='italic mb-6'>Welcome to</div>
          <div className='uppercase tracking-widest text-4xl font-bold shadow-stone-400 drop-shadow-[0_0_48px_var(--tw-shadow-color)]'>
            The Wordbook
          </div>
          <div className='mb-6'>🍃📚🍄🌱🔥🌿🔮🌾</div>
          <p className='dark:text-stone-400'>
            <i>The Wordbook</i> is a resource for translating English to
            Anglish, a linguistically pure version of English&mdash;how English
            would have been without the Norman invasion of 1066.{' '}
            <Link href='/wiki' className='dark:text-stone-300 underline'>
              Learn more
            </Link>
          </p>
        </section>
        {/* Site Links */}
        <section className='flex space-x-2 my-9 justify-center px-3'>
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
        <section className='px-3'>
          <WordWidget />
        </section>
        <section className='px-3'>
          <div className='w-full rounded-[20px] border-2 dark:border-stone-600 backdrop-blur-sm px-6 pt-6 pb-9'>
            <div className='rounded-[14px] bg-stone-400/50 px-3 py-6 space-y-3 relative'>
              <div className='text-xl dark:text-white uppercase font-bold tracking-wide text-center'>
                Ents hate him!
              </div>
              <Image alt='girl' src={adPic} />
              <div className='dark:text-white text-center'>
                Local man uses one magical trick to woo beautiful maidens...
              </div>
              <div className='absolute left-0 right-0 -bottom-7 text-center text-xs dark:text-stone-500 uppercase tracking-wider'>
                Advertisement
              </div>
            </div>
          </div>
        </section>
      </div>
      <footer className='w-full max-w-xl text-center dark:text-stone-600 py-8 px-3 text-xs'>
        <div>&copy; {new Date().getFullYear()}</div>
        <div>
          Like the site? Contribute on{' '}
          <a
            className='underline dark:text-stone-400'
            href='https://github.com/nullomatic/wordbook'
            target='_blank'
          >
            GitHub
          </a>
          &nbsp;or support my{' '}
          <a
            className='underline dark:text-stone-400'
            href='https://patreon.com/nullomatic'
            target='_blank'
          >
            Patreon
          </a>
        </div>
      </footer>
    </main>
  );
}

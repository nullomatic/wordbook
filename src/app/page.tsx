import Link from 'next/link';
import Suggest from './components/Suggest';
import Widget from './components/Widget';

export default function Home() {
  return (
    <main className='flex min-h-screen flex-col items-center px-3'>
      <div className='grow'>
        <div className='flex flex-col w-full'>
          <div className='flex flex-col space-y-3 items-center py-6'>
            <div className='text-3xl font-bold text-center'>
              🍃 Anglish Thesaurus
            </div>
          </div>
          <Suggest />
        </div>
        <div className='text-center space-y-6 my-6'>
          <div className='italic'>Welcome to</div>
          <div className='uppercase tracking-widest text-4xl font-bold'>
            The Wordbook
          </div>
          <p className='text-stone-400'>
            <i>The Wordbook</i> is a resource for translating English to
            Anglish, a linguistically pure version of English&mdash;how English
            would have been without the Norman invasion of 1066.
          </p>
        </div>
        <div className='flex space-x-2 my-9 justify-center'>
          <Link
            href='/faq'
            className='rounded-lg bg-stone-800 px-4 py-2 uppercase tracking-wide text-sm shadow w-full text-center'
          >
            FAQ
          </Link>
          <Link
            href='/about'
            className='rounded-lg bg-stone-800 px-4 py-2 uppercase tracking-wide text-sm shadow w-full text-center'
          >
            About
          </Link>
          <Link
            href='/directory'
            className='rounded-lg bg-stone-800 px-4 py-2 uppercase tracking-wide text-sm shadow w-full text-center'
          >
            Directory
          </Link>
        </div>
        <Widget />
      </div>
      <div className='flex flex-col w-full max-w-xl text-center text-stone-600 py-6'>
        footer
      </div>
    </main>
  );
}

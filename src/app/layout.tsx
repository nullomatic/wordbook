import { config } from '@fortawesome/fontawesome-svg-core';
import type { Metadata } from 'next';
import { Source_Sans_3 } from 'next/font/google';
import './globals.css';
import '@fortawesome/fontawesome-svg-core/styles.css';
import HeaderTabs from './components/HeaderTabs';
import Link from 'next/link';
import Image from 'next/image';
config.autoAddCss = false;

const font = Source_Sans_3({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Anglish Wiki',
  description: 'An Anglish-to-English thesaurus and translator',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' className='light'>
      <body
        className={`flex min-h-screen flex-col items-center bg-white text-black dark:bg-stone-900 dark:text-white ${font.className}`}
      >
        <HeaderTabs />
        <main className='pb-8 flex justify-center w-full'>
          <div className='hidden xl:block shrink w-full sticky top-0 h-screen p-3'>
            <div className='p-3 space-y-3'>
              <div className='text-xl font-bold'>Side Panel 1</div>
              {new Array(3).fill(0).map((el, i) => (
                <div>
                  <Image
                    src={`https://picsum.photos/seed/${Math.round(
                      Math.random() * (i + 1) * 10000
                    )}/600/400`}
                    alt=''
                    width={600}
                    height={400}
                    className='w-full rounded-lg'
                  />
                </div>
              ))}
            </div>
          </div>
          <div className='w-full lg:max-w-4xl shrink-0'>{children}</div>
          <div className='hidden xl:block shrink w-full sticky top-0 h-screen p-3'>
            <div className='p-3 space-y-3'>
              <div className='text-xl font-bold'>Side Panel 2</div>
              {new Array(3).fill(0).map((el, i) => (
                <div>
                  <Image
                    src={`https://picsum.photos/seed/${Math.round(
                      Math.random() * (i + 1) * 10000
                    )}/600/400`}
                    alt=''
                    width={600}
                    height={400}
                    className='w-full rounded-lg'
                  />
                </div>
              ))}
            </div>
          </div>
        </main>
        <footer className='w-full text-center bg-stone-700 text-white dark:text-stone-600 pt-12 pb-16 px-3'>
          <div className='uppercase tracking-widest text-xl font-bold mb-10'>
            The Wordbook
          </div>
          <div className='space-y-3 my-8'>
            <Link href='/wiki' className='block'>
              Wiki
            </Link>
            <Link href='/browse' className='block'>
              Browse
            </Link>
            <Link href='/about' className='block'>
              About
            </Link>
          </div>

          <div className='text-xs my-3'>
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

          <div>&copy; {new Date().getFullYear()}</div>
        </footer>
      </body>
    </html>
  );
}

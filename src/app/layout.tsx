import { config } from '@fortawesome/fontawesome-svg-core';
import type { Metadata } from 'next';
import { Source_Sans_3 } from 'next/font/google';
import './globals.css';
import '@fortawesome/fontawesome-svg-core/styles.css';
import HeaderTabs from './components/HeaderTabs';
import Link from 'next/link';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleRight, faLink } from '@fortawesome/free-solid-svg-icons';
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

        <main className='flex justify-center w-full'>
          {/* Left Panel */}
          <div className='hidden xl:block shrink w-full sticky top-0 h-screen'>
            <div className='p-6 pt-9 space-y-3 border-r-2 h-full'>
              <Link
                href='/'
                className='flex items-center justify-between group'
              >
                <div className='text-2xl font-bold'>Anglish Wiki</div>
                <FontAwesomeIcon
                  className='text-stone-400 group-hover:text-black'
                  icon={faLink}
                />
              </Link>

              <section>
                <div className='font-semibold text-stone-900 mb-2 mt-6'>
                  Getting Started
                </div>
                <div className='space-y-2 text-stone-600 list-none border-l border-stone-300'>
                  <li className='group'>
                    <Link
                      className='flex items-center justify-between pl-3 -ml-px border-l border-transparent group-hover:text-black group-hover:border-black'
                      href='/wiki/what-is-anglish'
                    >
                      <div>What is Anglish?</div>
                      <FontAwesomeIcon
                        icon={faAngleRight}
                        className='text-xs text-stone-400 group-hover:text-black'
                      />
                    </Link>
                  </li>
                  <li className='group'>
                    <Link
                      className='flex items-center justify-between pl-3 -ml-px border-l border-transparent group-hover:text-black group-hover:border-black'
                      href='/wiki/what-is-anglish'
                    >
                      <div>Learning to speak</div>
                      <FontAwesomeIcon
                        icon={faAngleRight}
                        className='text-xs text-stone-400 group-hover:text-black'
                      />
                    </Link>
                  </li>
                  <li className='group'>
                    <Link
                      className='flex items-center justify-between pl-3 -ml-px border-l border-transparent group-hover:text-black group-hover:border-black'
                      href='/wiki/what-is-anglish'
                    >
                      <div>Burning large wicker effigies</div>
                      <FontAwesomeIcon
                        icon={faAngleRight}
                        className='text-xs text-stone-400 group-hover:text-black'
                      />
                    </Link>
                  </li>
                </div>
              </section>

              <section>
                <div className='font-semibold text-stone-900 mb-2 mt-6'>
                  Diving Deeper
                </div>
                <div className='space-y-2 text-stone-600 list-none border-l border-stone-300'>
                  <li className='group'>
                    <Link
                      className='flex items-center justify-between pl-3 -ml-px border-l border-transparent group-hover:text-black group-hover:border-black'
                      href='/wiki/what-is-anglish'
                    >
                      <div>What is Anglish?</div>
                      <FontAwesomeIcon
                        icon={faAngleRight}
                        className='text-xs text-stone-400 group-hover:text-black'
                      />
                    </Link>
                  </li>
                  <li className='group'>
                    <Link
                      className='flex items-center justify-between pl-3 -ml-px border-l border-transparent group-hover:text-black group-hover:border-black'
                      href='/wiki/what-is-anglish'
                    >
                      <div>Learning to speak</div>
                      <FontAwesomeIcon
                        icon={faAngleRight}
                        className='text-xs text-stone-400 group-hover:text-black'
                      />
                    </Link>
                  </li>
                  <li className='group'>
                    <Link
                      className='flex items-center justify-between pl-3 -ml-px border-l border-transparent group-hover:text-black group-hover:border-black'
                      href='/wiki/what-is-anglish'
                    >
                      <div>Burning large wicker effigies</div>
                      <FontAwesomeIcon
                        icon={faAngleRight}
                        className='text-xs text-stone-400 group-hover:text-black'
                      />
                    </Link>
                  </li>
                </div>
              </section>

              <div className='py-6'>
                {new Array(1).fill(0).map((el, i) => (
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
          </div>
          {/* Main Panel */}
          <div className='w-full lg:max-w-4xl lg:mx-6 shrink-0 pb-8'>
            {children}
          </div>
          {/* Right Panel */}
          <div className='hidden xl:block shrink w-full sticky top-0 h-screen'>
            <div className='p-6 pt-9 space-y-3 border-l-2 h-full'>
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

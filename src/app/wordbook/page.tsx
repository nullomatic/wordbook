import Link from "next/link";
import WordWidget from "@/components/WordWidget";

export default function WordbookHome() {
  return (
    <div className="w-full space-y-6">
      {/* Welcome Section */}
      <section className="dot-pattern px-3 py-12 text-center lg:px-0">
        <div className="mb-6 italic">Welcome to</div>
        <div className="text-[2.5rem] font-bold uppercase tracking-widest shadow-stone-400 drop-shadow-[0_0_48px_var(--tw-shadow-color)] lg:text-[3.2rem]">
          The Wordbook
        </div>
        <div className="mb-6">🍃📚🍄🌱🔥🌿🔮🌾</div>
        <p className="mx-auto w-full max-w-2xl dark:text-stone-400">
          <i>The Wordbook</i> is a resource for translating English to Anglish,
          a linguistically pure version of English&mdash;how English would have
          been without the Norman invasion of 1066.{" "}
          <Link href="/wiki" className="underline dark:text-stone-300">
            Learn more
          </Link>
        </p>
      </section>
      {/* Site Links */}
      <section className="my-9 flex justify-center space-x-2 px-3 lg:px-0">
        <Link
          href="/wiki"
          className="w-full rounded-lg px-4 py-2 text-center text-sm uppercase tracking-wide shadow dark:bg-stone-800"
        >
          Wiki
        </Link>
        <Link
          href="/browse"
          className="w-full rounded-lg px-4 py-2 text-center text-sm uppercase tracking-wide shadow dark:bg-stone-800"
        >
          Browse
        </Link>
        <Link
          href="/about"
          className="w-full rounded-lg px-4 py-2 text-center text-sm uppercase tracking-wide shadow dark:bg-stone-800"
        >
          About
        </Link>
      </section>
      {/* Word of the Day Widget */}
      <section className="px-3 lg:px-0">
        <WordWidget />
      </section>
    </div>
  );
}

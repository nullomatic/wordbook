"use client";

import { faUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";

export default function WordWidget() {
  return (
    <div className="relative w-full rounded-lg p-6 shadow-lg dark:bg-stone-800">
      <Link
        href="/wordbook/word/w/bookcraft"
        className="absolute right-6 top-6 text-sm"
      >
        <FontAwesomeIcon icon={faUpRightFromSquare} />
      </Link>

      <div className="mb-4 uppercase leading-none tracking-wide dark:text-stone-200">
        <div className="">Word of the Day</div>
        <div className="text-sm dark:text-stone-500">June 8, 2024</div>
      </div>
      <div className="mb-2 text-4xl">bookcraft</div>
      <div className="mb-4">
        <span className="mr-2 italic dark:text-stone-400">noun</span>
        <span className="break-words dark:text-stone-200">
          Written works, especially those considered of superior or lasting
          artistic merit
        </span>
      </div>
      <Link
        href="/wordbook/word/w/bookcraft"
        className="block rounded-lg border-2 border-stone-200 bg-stone-100 p-3 text-center text-sm font-bold uppercase tracking-wider dark:border-stone-600 dark:bg-stone-700"
      >
        View Entry
      </Link>
    </div>
  );
}

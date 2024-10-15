"use client";

import useBreakpoint from "@/hooks/useBreakpoint";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { TranslationTerm } from "@/lib/types";
import {
  faCaretRight,
  faCheck,
  faCopy,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import classNames from "classnames";
import { Dispatch, SetStateAction, useRef, useState } from "react";

// Tried to do this dynamically, but Tailwind's purging thingy
// needs all class strings to be pre-built and not constructed.
const anglishWithSynonymsBg = "bg-green-600";
const anglishWithSynonymsText = "text-green-600";
const anglishNoSynonymsBg = "bg-yellow-700";
const anglishNoSynonymsText = "text-yellow-700";
const englishWithSynonymsBg = "bg-sky-700";
const englishWithSynonymsText = "text-sky-700";

export default function TranslationArea({
  terms,
  setTerms,
}: {
  terms: TranslationTerm[];
  setTerms: Dispatch<SetStateAction<TranslationTerm[]>>;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<null | number>(null);
  const [highlightText, setHighlightText] = useState(true);
  const translationRef = useRef<HTMLParagraphElement>(null);
  const { copied, copyToClipboard } = useCopyToClipboard();
  const breakpoint = useBreakpoint();

  const replaceSynonym = (termIndex: number, synonymIndex: number) => {
    const newTerms = [...terms];
    const newSynonyms = [...terms[termIndex].synonyms];
    const synonym = newSynonyms.splice(synonymIndex, 1)[0];
    newSynonyms.unshift(synonym);
    newTerms[termIndex] = {
      ...newTerms[termIndex],
      synonyms: newSynonyms,
    };
    setTerms(newTerms);
  };

  return (
    <div className="relative min-h-48 w-full rounded-lg bg-stone-100 p-5 md:w-1/2 lg:min-h-64">
      {/* Legend */}
      <div className="flex items-center justify-between overflow-hidden text-nowrap">
        <div className="flex items-center space-x-5">
          <div className="flex items-center space-x-1.5">
            <div
              className={classNames(
                anglishNoSynonymsBg,
                "h-2 w-2 rounded-full",
              )}
            />
            <div className="text-xs text-stone-500">
              {["xs", "md"].includes(breakpoint)
                ? "AN-"
                : "Anglish (no synonyms)"}
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            <div
              className={classNames(
                anglishWithSynonymsBg,
                "h-2 w-2 rounded-full",
              )}
            />
            <div className="text-xs text-stone-500">
              {["xs", "md"].includes(breakpoint)
                ? "AN+"
                : "Anglish (with synonyms)"}
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            <div
              className={classNames(
                englishWithSynonymsBg,
                "h-2 w-2 rounded-full",
              )}
            />
            <div className="text-xs text-stone-500">
              {["xs", "md"].includes(breakpoint) ? "EN+" : "English (replaced)"}
            </div>
          </div>
        </div>
        <div className="flex cursor-pointer items-center space-x-1.5 text-xs text-stone-600">
          <label htmlFor="highlight-text" className="cursor-pointer">
            Highlight Text
          </label>
          <input
            id="highlight-text"
            type="checkbox"
            className="cursor-pointer"
            checked={highlightText}
            onChange={() => setHighlightText(!highlightText)}
          />
        </div>
      </div>

      {/* Translation Terms */}
      <p ref={translationRef} className="pb-10 pt-6">
        {terms.length ? (
          terms.map((term: TranslationTerm, termIndex) => {
            const isHovered = hoveredIndex === termIndex;

            const core = (
              <span
                className={classNames({
                  [anglishNoSynonymsText]:
                    highlightText && term.isAnglish && !term.synonyms.length,
                  [englishWithSynonymsText]:
                    highlightText && !term.isAnglish && term.synonyms.length,
                  [anglishWithSynonymsText]:
                    highlightText && term.isAnglish && term.synonyms.length,
                  "underline decoration-dotted underline-offset-2 hover:cursor-pointer hover:text-yellow-500":
                    term.synonyms.length,
                })}
              >
                {term.synonyms.length
                  ? isCapitalized(term.text)
                    ? capitalize(term.synonyms[0].word)
                    : term.synonyms[0].word
                  : term.text}
              </span>
            );

            const pre = term.pre.length
              ? term.pre
                  .split(/\n/)
                  .map((str: string) => (str ? <span>{str}</span> : <br />))
              : [];
            const post = term.post.length
              ? term.post
                  .split(/\n/)
                  .map((str: string) => (str ? <span>{str}</span> : <br />))
              : [];

            return (
              <span
                className="relative"
                onClick={() => setHoveredIndex(termIndex)}
                onMouseEnter={() => setHoveredIndex(termIndex)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {...pre}
                {core}
                {...post}

                {/* Dropdown, visible when the term is hovered/clicked and has synonyms */}
                {isHovered && term.synonyms.length > 0 && (
                  <div className="absolute inset-x-0 top-5 z-50 flex justify-center">
                    <ul className="rounded border border-stone-300 bg-white p-1 shadow-lg">
                      <li className="cursor-default text-nowrap rounded bg-stone-50 px-2 py-1 italic text-stone-400">
                        {term.text}
                      </li>
                      {term.synonyms.map(
                        (synonym: { word: string }, synonymIndex: number) => (
                          <li
                            key={synonymIndex}
                            className="cursor-pointer space-x-1.5 text-nowrap rounded px-2 py-1 hover:bg-stone-100"
                            onClick={() =>
                              replaceSynonym(termIndex, synonymIndex)
                            }
                          >
                            {synonymIndex === 0 && (
                              <FontAwesomeIcon
                                icon={faCaretRight}
                                className="text-xs text-stone-300"
                              />
                            )}
                            <span>{synonym.word}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              </span>
            );
          })
        ) : (
          <span className="text-stone-400">Translation</span>
        )}
      </p>

      <div className="absolute bottom-0 right-0 flex h-16 w-16 items-center justify-center">
        <FontAwesomeIcon
          icon={copied ? faCheck : faCopy}
          className={classNames(
            {
              "cursor-pointer hover:text-stone-400": !copied,
              "fa-beat": copied,
            },
            "text-2xl text-stone-300",
          )}
          onClick={() =>
            copyToClipboard(translationRef.current?.innerText || "")
          }
        />
      </div>
    </div>
  );
}

function isCapitalized(str: string) {
  return str[0] === str[0].toUpperCase() && str[0] !== str[0].toLowerCase();
  // console.log(isCapitalized("A")); // true
  // console.log(isCapitalized("a")); // false
  // console.log(isCapitalized("1")); // false
  // console.log(isCapitalized("!")); // false
}

function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}

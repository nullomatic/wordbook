"use client";

import { MAX_TRANSLATION_LENGTH, POS } from "@/lib/constants";
import {
  faCaretRight,
  faCheck,
  faCopy,
  faSnowflake,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import classNames from "classnames";
import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";

// Tried to do this dynamically, but Tailwind's purging thingy
// needs all class strings to be pre-built and not constructed.
const anglishWithSynonymsBg = "bg-green-600";
const anglishWithSynonymsText = "text-green-600";
const anglishNoSynonymsBg = "bg-yellow-700";
const anglishNoSynonymsText = "text-yellow-700";
const englishWithSynonymsBg = "bg-sky-700";
const englishWithSynonymsText = "text-sky-700";

const defaultOptions = [
  {
    pos: POS.Noun,
    label: "Nouns",
    checked: true,
  },
  {
    pos: POS.Verb,
    label: "Verbs",
    checked: true,
  },
  {
    pos: POS.Adjective,
    label: "Adjectives",
    checked: true,
  },
  {
    pos: POS.Adverb,
    label: "Adverbs",
    checked: true,
  },
  {
    pos: POS.Other,
    label: "Other",
    checked: false,
  },
];

export default function Page() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [terms, setTerms] = useState([]);
  const [hoveredIndex, setHoveredIndex] = useState<null | number>(null);
  const [options, setOptions] = useState(defaultOptions);
  const [highlightText, setHighlightText] = useState(true);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const translationRef = useRef<HTMLParagraphElement>(null);

  const { copied, copyToClipboard } = useCopyToClipboard();

  async function handleInput(event: React.ChangeEvent<HTMLTextAreaElement>) {
    if (inputRef.current) {
      const newInput = event?.target?.value;
      setInput(newInput.slice(0, MAX_TRANSLATION_LENGTH));
      // This line allows the input to be set before updating the height.
      // Otherwise, the height will be based off of the untruncated input;
      // when pasting in a huge block of text, for example. (useState is async.)
      await new Promise((resolve) => setTimeout(resolve, 0));
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }

  function handleOptionsChange(index: number) {
    const updatedOptions = [...options];
    updatedOptions[index].checked = !updatedOptions[index].checked;
    setOptions(updatedOptions);
  }

  const replaceSynonym = (termIndex: number, synonymIndex: number) => {
    const newTerms = [...terms];
    const newSynonyms = [...(terms[termIndex] as any).synonyms];
    const synonym = newSynonyms.splice(synonymIndex, 1)[0];
    newSynonyms.unshift(synonym);
    (newTerms as any)[termIndex] = {
      ...(newTerms[termIndex] as any),
      synonyms: newSynonyms,
    }; // TODO
    setTerms(newTerms);
  };

  async function submit() {
    if (!input) {
      setTerms([]);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/translate", {
        method: "post",
        body: JSON.stringify({
          input,
          options: options
            .filter((option) => option.checked)
            .map((option) => option.pos),
        }),
      });
      const terms = await res.json();
      setTerms(terms);
    } catch (error) {
      toast.error("Whoops! Translator is disconnected.", {
        toastId: "translate",
      });
      setTerms([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-xl space-y-9 py-9">
      <div className="text-center font-serif text-3xl font-bold">
        Anglish-to-English Translator
      </div>

      <div className="grid min-h-64 w-full grid-cols-2 gap-6 text-lg">
        {/* Input Area */}
        <div className="flex w-full flex-col items-end space-y-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            rows={1}
            placeholder="Type something here..."
            className="w-full grow resize-none overflow-hidden rounded-lg border p-5"
          />

          <div className="flex w-full items-center">
            {/* Options */}
            <div className="flex grow space-x-6 text-sm">
              {options.map((option, index) => (
                <div className="flex cursor-pointer items-center space-x-1.5">
                  <input
                    type="checkbox"
                    id={option.pos}
                    checked={option.checked}
                    className="cursor-pointer"
                    onChange={() => handleOptionsChange(index)}
                  />
                  <label className="cursor-pointer" htmlFor={option.pos}>
                    {option.label}
                  </label>
                </div>
              ))}
            </div>

            {/* Translate Button */}
            <button
              className={classNames(
                loading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-800",
                "w-28 rounded p-3 text-white",
              )}
              onClick={submit}
              disabled={loading}
            >
              {loading ? (
                <FontAwesomeIcon icon={faSnowflake} spin />
              ) : (
                <span className="font-semibold">Translate</span>
              )}
            </button>
          </div>

          <div
            className={classNames(
              input.length >= MAX_TRANSLATION_LENGTH
                ? "text-red-600"
                : "text-stone-400",
              "text-sm",
            )}
          >
            {input.length} / {MAX_TRANSLATION_LENGTH}
          </div>
        </div>

        {/* Translation Area */}
        <div className="relative rounded-lg bg-stone-100 p-5">
          {/* Legend */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center space-x-5">
              <div className="flex items-center space-x-1.5">
                <div
                  className={classNames(
                    anglishNoSynonymsBg,
                    "h-2 w-2 rounded-full",
                  )}
                />
                <div className="text-xs text-stone-500">
                  Anglish (no synonyms)
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
                  Anglish (with synonyms)
                </div>
              </div>
              <div className="flex items-center space-x-1.5">
                <div
                  className={classNames(
                    englishWithSynonymsBg,
                    "h-2 w-2 rounded-full",
                  )}
                />
                <div className="text-xs text-stone-500">English (replaced)</div>
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

          {/* Translation */}
          <p ref={translationRef}>
            {terms.map((term: any, termIndex) => {
              const isHovered = hoveredIndex === termIndex;

              const s = (
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
                      ? capitalize(term.synonyms[0])
                      : term.synonyms[0]
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
                  onMouseEnter={() => setHoveredIndex(termIndex)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {...pre}
                  {s}
                  {...post}
                  {/* Dropdown, visible when the term is hovered and has synonyms */}
                  {isHovered && term.synonyms.length > 0 && (
                    <div className="absolute inset-x-0 top-5 z-50 flex justify-center">
                      <ul className="rounded border border-stone-300 bg-white p-1 shadow-lg">
                        <li className="cursor-default text-nowrap rounded bg-stone-50 px-2 py-1 italic text-stone-400">
                          {term.text}
                        </li>
                        {term.synonyms.map(
                          (synonym: string, synonymIndex: number) => (
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
                              <span>{synonym}</span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
                </span>
              );
            })}
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

"use client";

import {
  faMagnifyingGlass,
  faCircleXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { debounce } from "lodash";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Lang, POS, Longhand } from "@/lib/constants";
import classNames from "classnames";
import { usePathname, useRouter } from "next/navigation";
import { SearchResult } from "@/lib/types";
import { toast } from "react-toastify";

export default function Search() {
  const pathname = decodeURIComponent(usePathname());
  const word =
    pathname.match(/^\/wordbook\/word\/(?<word>.+)$/)?.groups?.word || "";
  const [input, setInput] = useState<string>(word);
  const [hasFocus, setHasFocus] = useState(false);
  const [resultList, setResultList]: [SearchResult[], any] = useState([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const isMobile = isMobileDevice();

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      // Check if 'Ctrl' or 'Meta' (Command on Mac) + 'K' are pressed
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  const handleFocus = () => {
    setHasFocus(true);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    // Allow result to be clicked by not blurring if click target is results list.
    // Otherwise, the results list is hidden before the click can go through.
    const nextFocus = event.relatedTarget as HTMLElement;
    if (
      resultsRef.current &&
      nextFocus &&
      resultsRef.current.contains(nextFocus)
    ) {
      return;
    }
    setHasFocus(false);
  };

  const debouncedSearch = useCallback(
    debounce((nextValue) => search(nextValue), 250),
    [],
  );

  async function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event?.target?.value;
    setInput(input);
    debouncedSearch(input);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && resultList.length) {
      const entry = resultList[selectedResultIndex] as SearchResult;
      router.push(`/wordbook/word/${entry.word}`);
      inputRef.current?.blur();
      setInput(entry.word);
      setResultList([]);
      setSelectedResultIndex(0);
    }
    if (event.key === "Escape") {
      inputRef.current?.blur();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (selectedResultIndex > 0) {
        setSelectedResultIndex(selectedResultIndex - 1);
      }
    }
    if (event.key === "ArrowDown") {
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
    try {
      const res = await fetch("/api/search", {
        method: "post",
        body: input,
      });
      const entries = await res.json();
      setResultList(entries);
      setSelectedResultIndex(0);
    } catch (error) {
      toast.error("Whoops! Search is disconnected.", { toastId: "search" });
      setResultList([]);
      setSelectedResultIndex(0);
    }
  }

  return (
    <div className="mx-auto w-full p-3 md:max-w-2xl lg:max-w-full lg:px-0">
      <div className="relative z-20 w-full">
        {/* Search Icon */}
        <div
          className={classNames(
            hasFocus ? "text-stone-800" : "text-stone-500",
            "absolute left-4 top-4 z-20 flex h-4 w-4 items-center",
          )}
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} className="text-sm" />
        </div>

        {/* Input */}
        <input
          className={classNames(
            "relative z-10 h-12 w-full rounded-lg border border-stone-300 bg-white px-11 py-4 shadow-inner outline-none",
            "ring-pink-300 placeholder:text-stone-400 focus:border-stone-400 dark:border-stone-800 dark:bg-stone-800 dark:placeholder:text-stone-400",
          )}
          placeholder="Search the wordbook..."
          ref={inputRef}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          value={input}
        />

        {/* Shadow */}
        <div
          className={classNames(
            hasFocus
              ? "bg-stone-300 dark:bg-stone-600"
              : "bg-stone-200 dark:bg-stone-600",
            "absolute left-1 top-1 h-12 w-full rounded-lg",
          )}
        ></div>

        {/* Right Side */}
        <div className="absolute right-3 top-4 z-20 flex h-4 w-10 items-center justify-end">
          {isMobile ? (
            // Mobile 'X' icon to clear search
            <div
              className={classNames(
                `cursor-pointer text-sm text-stone-500 hover:text-black dark:text-stone-200`,
                { hidden: !input },
              )}
              onClick={() => {
                setInput("");
                setResultList([]);
              }}
            >
              <FontAwesomeIcon icon={faCircleXmark} />
            </div>
          ) : (
            // Desktop 'Ctrl K' and 'Esc' indicators
            <div
              className={classNames(
                `cursor-pointer whitespace-nowrap rounded border border-stone-400 px-1 py-0.5 text-xs font-bold uppercase text-stone-400 hover:border-stone-800 hover:text-stone-800 dark:text-stone-200`,
              )}
              onClick={() => {
                setInput("");
                setResultList([]);
              }}
            >
              {hasFocus ? "Esc" : "Ctrl K"}
            </div>
          )}
        </div>

        {/* Search Results */}
        <div
          ref={resultsRef}
          className={classNames(
            "absolute top-7 mt-3 w-full divide-y divide-stone-200 overflow-hidden rounded-bl-lg rounded-br-lg border border-stone-300 bg-white shadow-lg dark:divide-stone-500 dark:border-stone-300",
            {
              hidden: !resultList.length || !hasFocus,
            },
          )}
        >
          {resultList.map((entry: SearchResult, i: number) => (
            <Link
              key={`search-result-${i}`}
              href={`/wordbook/word/${entry.word}`}
              className={classNames("flex items-center space-x-3 px-4 py-3", {
                "pt-5": i === 0,
                "bg-green-50 dark:bg-stone-800":
                  selectedResultIndex === i && entry.isAnglish,
                "bg-sky-50 dark:bg-stone-800":
                  selectedResultIndex === i && !entry.isAnglish,
                "hover:bg-green-100": entry.isAnglish,
                "hover:bg-sky-100": !entry.isAnglish,
                "bg-white dark:bg-stone-800": selectedResultIndex !== i,
              })}
              onClick={() => {
                setInput(entry.word);
                setResultList([]);
                setSelectedResultIndex(0);
              }}
            >
              <div className="font-bold">{entry.word}</div>
              <div className="flex grow space-x-0.5 text-xs font-bold uppercase text-white dark:text-gray-200">
                <div className="flex h-3.5 w-5 items-center justify-center rounded bg-sky-700">
                  {Lang.English.toUpperCase()}
                </div>
                {entry.isAnglish ? (
                  <div className="flex h-3.5 w-5 items-center justify-center rounded bg-green-700">
                    {Lang.Anglish.toUpperCase()}
                  </div>
                ) : null}
              </div>
              <div className="flex justify-end space-x-1 text-sm font-medium text-stone-800 dark:text-stone-200">
                <div className="">
                  {entry.parts
                    .map((pos: POS, j: number) => Longhand[pos].short)
                    .join(", ")}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function isMobileDevice() {
  return (
    typeof window !== "undefined" &&
    /Mobi|Android|iPhone/i.test(navigator?.userAgent)
  );
}

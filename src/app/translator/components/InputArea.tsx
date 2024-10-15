"use client";

import { MAX_TRANSLATION_LENGTH, POS } from "@/lib/constants";
import { TranslationTerm } from "@/lib/types";
import { faSnowflake } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import classNames from "classnames";
import { Dispatch, SetStateAction, useRef, useState } from "react";
import { toast } from "react-toastify";

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
  //   {
  //     pos: POS.Other,
  //     label: "Other",
  //     checked: false,
  //   },
];

export default function InputArea({
  initialInput = "",
  setTerms,
}: {
  initialInput?: string;
  setTerms: Dispatch<SetStateAction<TranslationTerm[]>>;
}) {
  const [input, setInput] = useState(initialInput);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState(defaultOptions);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function handleInput(event: React.ChangeEvent<HTMLTextAreaElement>) {
    if (inputRef.current) {
      const newInput = event?.target?.value;
      setInput(newInput.slice(0, MAX_TRANSLATION_LENGTH));
      // The next line allows the input to be set before updating the height.
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
    <div className="flex w-full flex-col items-end gap-6 md:w-1/2">
      <div className="relative w-full">
        {/* Input */}
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInput}
          placeholder="Type something here..."
          className="min-h-48 w-full grow resize-none overflow-hidden rounded-lg border p-5 pb-10 lg:min-h-64"
        />
        {/* Input Length */}
        <div
          className={classNames(
            input.length >= MAX_TRANSLATION_LENGTH
              ? "text-red-600"
              : "text-stone-400",
            "absolute bottom-0 right-0 p-3 text-sm",
          )}
        >
          {input.length} / {MAX_TRANSLATION_LENGTH}
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-6 sm:flex-row md:flex-col lg:flex-row">
        {/* Options */}
        <div className="flex grow flex-wrap justify-center gap-x-6 gap-y-2 text-sm sm:justify-start sm:pl-1">
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
            "flex h-14 w-full shrink-0 items-center justify-center overflow-hidden rounded text-white sm:w-40 md:w-full lg:w-40",
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
    </div>
  );
}

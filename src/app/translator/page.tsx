"use client";

import { MAX_TRANSLATION_LENGTH } from "@/lib/constants";
import { faSnowflake } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import classNames from "classnames";
import { useRef, useState } from "react";
import { toast } from "react-toastify";

export default function Page() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [terms, setTerms] = useState([]);
  const [hoveredIndex, setHoveredIndex] = useState<null | number>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function handleInput(event: React.ChangeEvent<HTMLTextAreaElement>) {
    if (inputRef.current) {
      const newInput = event?.target?.value;
      setInput(newInput.slice(0, MAX_TRANSLATION_LENGTH));
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
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
        body: input,
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
    <div className="w-full py-9">
      <div className="text-center text-2xl font-bold">Translator</div>

      <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-2 gap-6 p-6">
        {/* Input Area */}
        <div className="flex w-full flex-col items-end space-y-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            rows={1}
            placeholder="Type something here..."
            className="w-full resize-none overflow-hidden rounded-lg border p-3"
          />
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
        <div className="rounded-lg bg-stone-100 p-3">
          {terms.map((term: any, i) => {
            const isHovered = hoveredIndex === i;

            const s = (
              <span
                className={classNames({
                  "text-cyan-700": term.isAnglish && !term.synonyms.length,
                  "text-teal-700": !term.isAnglish && term.synonyms.length,
                  "text-green-600 underline decoration-dotted underline-offset-2 hover:cursor-pointer hover:text-yellow-500":
                    term.isAnglish && term.synonyms.length,
                  "underline decoration-dotted underline-offset-2 hover:cursor-pointer hover:text-yellow-500":
                    term.synonyms.length,
                })}
              >
                {term.isAnglish
                  ? term.text
                  : term.synonyms.length
                    ? term.synonyms[0]
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
                onMouseEnter={() => setHoveredIndex(i)}
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
                      {term.synonyms.map((synonym: string, idx: number) => (
                        <li
                          key={idx}
                          className="cursor-pointer text-nowrap rounded px-2 py-1 hover:bg-stone-100"
                        >
                          {synonym}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

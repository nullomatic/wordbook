"use client";

import classNames from "classnames";
import { useState } from "react";
import { toast } from "react-toastify";

export default function Page() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [terms, setTerms] = useState([]);

  async function handleInput(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const input = event?.target?.value;
    setInput(input);
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
    <div className="w-full space-y-6 py-9">
      <div className="text-center text-2xl font-bold">Translator</div>
      <button
        className="bg-blue-600 p-3 text-white"
        onClick={submit}
        disabled={loading}
      >
        Translate
      </button>
      <div className="grid grid-cols-2 gap-6 p-6">
        <textarea
          value={input}
          onChange={handleInput}
          rows={5}
          cols={50}
          placeholder="Type something here..."
          className="rounded-lg border p-3"
        />

        <div className="rounded-lg bg-stone-100 p-3">
          {terms.map((term: any, i) => {
            const s = (
              <span
                className={classNames({
                  "text-cyan-700": term.isAnglish && !term.synonyms.length,
                  "text-green-600 underline decoration-dotted underline-offset-2 hover:cursor-pointer hover:text-yellow-500":
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
              <>
                {...pre}
                {s}
                {...post}
              </>
            );
          })}
        </div>
      </div>
    </div>
  );
}

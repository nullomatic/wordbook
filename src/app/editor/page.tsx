"use client";

import { Longhand } from "@/lib/constants";
import { WordSchema } from "@/lib/types";
import {
  faAngleLeft,
  faAngleRight,
  faAnglesLeft,
  faAnglesRight,
  faArrowUpRightFromSquare,
  faTriangleExclamation,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import classNames from "classnames";
import { debounce } from "lodash";
import React, { useCallback, useState } from "react";

const PAGE_SIZE = 30;

export default function EditorPage() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState(
    [] as (WordSchema & { sense_ids: string[] })[], // todo
  );
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  async function query(input: string, page = 0) {
    if (!input) {
      setResults([]);
      setTotalCount(0);
      setTotalPages(0);
      setCurrentPage(0);
      return;
    }
    const res = await fetch("/api/editor", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        page,
        pageSize: PAGE_SIZE,
      }),
    });
    const { results, totalCount, totalPages } = await res.json();
    setResults(results);
    setTotalCount(totalCount);
    setTotalPages(totalPages);
    setCurrentPage(page);
  }

  const debouncedQuery = useCallback(
    debounce((nextValue) => query(nextValue), 250),
    [],
  );

  async function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event?.target?.value;
    setInput(input);
    debouncedQuery(input);
  }

  async function onChangePage(newPage: number) {
    if (newPage >= 0 && newPage < totalPages) {
      await query(input, newPage);
    }
  }

  return (
    <div className="grid min-h-screen w-full grid-cols-4 gap-3 p-3 lg:gap-6 lg:p-6">
      <section className="col-span-3 space-y-3">
        <div>
          <input
            className="relative z-10 h-12 w-full rounded-lg border border-stone-300 bg-white p-4 shadow-inner outline-none ring-pink-300 focus:border-stone-400 dark:border-stone-800 dark:bg-stone-800 dark:placeholder:text-stone-400"
            placeholder="Query a word..."
            onChange={handleInput}
            value={input}
          />
        </div>

        <PaginationControls
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          totalPages={totalPages}
          totalCount={totalCount}
          onChangePage={onChangePage}
        />

        <table className="w-full table-auto">
          <thead className="bg-stone-200 text-left text-sm uppercase text-stone-800">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Anglish?</th>
              <th className="px-3 py-2">Word</th>
              <th className="px-3 py-2">Part of Speech</th>
              <th className="px-3 py-2">Senses</th>
              <th className="px-3 py-2">Origins</th>
              <th className="px-3 py-2">IPA</th>
              <th className="px-3 py-2">{/* Checkbox */}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((entry, i: number) => (
              <tr
                key={`entry-${i}`}
                className="cursor-pointer border-b hover:bg-stone-100"
              >
                <td className="px-3 py-2 text-stone-400">{entry.id}</td>
                <td
                  className={classNames(
                    {
                      "text-green-700": entry.is_anglish,
                      "text-stone-400": !entry.is_anglish,
                    },
                    "px-3 py-2",
                  )}
                >
                  {entry.is_anglish ? "True" : "False"}
                </td>
                <td className="space-x-1.5 px-3 py-2">
                  <a
                    href={`/wordbook/word/${entry.word}`}
                    target="_blank"
                    rel="noopener noreferer"
                    className="-ml-2 rounded px-2 text-stone-400 hover:bg-stone-200 hover:text-black"
                  >
                    <FontAwesomeIcon
                      icon={faArrowUpRightFromSquare}
                      className="text-xs"
                    />
                  </a>
                  <span>{entry.word}</span>
                </td>
                <td className="px-3 py-2">{Longhand[entry.pos].long}</td>
                <td className="max-w-64 px-3 py-2">
                  {entry.sense_ids ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {entry.sense_ids.map((sense_id: string, j: number) => (
                        <span
                          className="rounded bg-stone-200 px-1 text-xs"
                          key={`sense-${i}-${j}`}
                        >
                          {sense_id}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="space-x-1.5">
                      <FontAwesomeIcon
                        title="High priority: word has no senses"
                        icon={faTriangleExclamation}
                        className="text-red-600"
                      />
                      <span className="text-stone-400">None</span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {entry.origins.length || (
                    <div className="space-x-1.5">
                      <span className="text-stone-400">None</span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {entry.rhyme || (
                    <div className="space-x-1.5">
                      <span className="text-stone-400">None</span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <input type="checkbox" className="cursor-pointer" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <PaginationControls
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          totalPages={totalPages}
          totalCount={totalCount}
          onChangePage={onChangePage}
        />

        <div>
          <div className="">What does the editor need to do?</div>
          <li className="">{`Query word -> senses -> synset`}</li>
          <li className="">Limit/paginate results</li>
          <li className="">Inspector pane</li>
        </div>
      </section>
      <section className="flex flex-col rounded-lg border p-3 shadow">
        <div className="text-center text-2xl font-bold">Inspector</div>
      </section>
    </div>
  );
}

type PaginationControlsProps = {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  onChangePage: (newPage: number) => void;
};

function PaginationControls({
  currentPage,
  pageSize,
  totalPages,
  totalCount,
  onChangePage,
}: PaginationControlsProps) {
  const page = currentPage + 1; // For display.

  let lowerIndex = currentPage * pageSize + 1;
  let upperIndex = (currentPage + 1) * pageSize;
  if (upperIndex > totalCount) {
    upperIndex = totalCount;
  }

  const handleFirstPage = () => onChangePage(0);
  const handlePreviousPage = () => onChangePage(currentPage - 1);
  const handleNextPage = () => onChangePage(currentPage + 1);
  const handleLastPage = () => onChangePage(totalPages - 1);

  const PaginationButton: React.FC<{
    icon: IconDefinition;
    disabled: boolean;
    onClick: () => void;
  }> = ({ icon, disabled, onClick }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        {
          "cursor-pointer text-stone-800 hover:bg-stone-200 hover:text-black":
            !disabled,
          "cursor-default bg-white text-stone-400": disabled,
        },
        "flex h-10 w-10 items-center justify-center rounded bg-stone-100",
      )}
    >
      <FontAwesomeIcon icon={icon} className="text-sm" />
    </button>
  );

  return (
    <div className="flex items-center justify-center space-x-1">
      <PaginationButton
        icon={faAnglesLeft}
        disabled={!totalCount || page === 1}
        onClick={handleFirstPage}
      />
      <PaginationButton
        icon={faAngleLeft}
        disabled={!totalCount || page === 1}
        onClick={handlePreviousPage}
      />

      <div className="w-52 text-center">
        {totalCount ? (
          <span>
            Page {page}/{totalPages} ({lowerIndex}-{upperIndex} of {totalCount})
          </span>
        ) : (
          <span className="text-stone-400">No results</span>
        )}
      </div>

      <PaginationButton
        icon={faAngleRight}
        disabled={!totalCount || page === totalPages}
        onClick={handleNextPage}
      />
      <PaginationButton
        icon={faAnglesRight}
        disabled={!totalCount || page === totalPages}
        onClick={handleLastPage}
      />
    </div>
  );
}

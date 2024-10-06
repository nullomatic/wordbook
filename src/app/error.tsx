"use client";

import { faRotateRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="flex grow flex-col items-center justify-center">
      <h2 className="mb-2 font-bold">Oops! Something went wrong.</h2>
      <p className="mb-5">Error: {error.message}</p>
      <button
        className="space-x-1 rounded-lg bg-stone-100 px-3 py-2 text-sm font-bold uppercase text-stone-800 hover:bg-stone-200 hover:text-black"
        onClick={() => reset()}
      >
        <FontAwesomeIcon icon={faRotateRight} className="text-xs" />
        <span>Retry</span>
      </button>
    </div>
  );
}

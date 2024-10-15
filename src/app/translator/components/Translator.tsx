"use client";

import { useState } from "react";
import TranslationArea from "./TranslationArea";
import InputArea from "./InputArea";
import { TranslationTerm } from "@/lib/types";

export default function Translator({ input }: { input?: string }) {
  const [terms, setTerms] = useState<TranslationTerm[]>([]);
  return (
    <div className="flex min-h-64 w-full flex-col gap-6 text-lg md:flex-row">
      <InputArea setTerms={setTerms} initialInput={input} />
      <TranslationArea terms={terms} setTerms={setTerms} />
    </div>
  );
}

import { Metadata } from "next";
import WikiLayout from "./wiki/layout";

export const metadata: Metadata = {
  title: "Anglish Wiki",
  description: "An Anglish-to-English thesaurus and translator",
};

export default function Page() {
  return (
    <WikiLayout>
      <div className="w-full space-y-6 py-9">
        <div className="text-center text-2xl font-bold">Homepage</div>
      </div>
    </WikiLayout>
  );
}

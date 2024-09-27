import ArticleContent from "@/app/components/ArticleContent";
import { getPath } from "@/lib/util";
import fs from "fs";

export default function () {
  const filePath = getPath("/app/wiki/history-of-anglish/content.english.md"); // TODO: Make relative path
  const contentEnglish = fs.readFileSync(filePath, "utf-8");
  return <ArticleContent contentEnglish={contentEnglish} />;
}

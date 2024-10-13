import ArticleContent from "@/components/ArticleContent";
import fs from "fs";
import path from "path";
import matter, { GrayMatterFile } from "gray-matter";
import generateArticlePaths from "@/lib/generateArticlePaths";

export { generateArticlePaths as generateStaticParams };

function getArticleData(slug: string) {
  console.log("getting article data", slug); // todo
  const filename = `${slug}.md`;
  const filePath = path.join(process.cwd(), "content", filename);
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { content, data } = matter(fileContent);
  return {
    content: content,
    metadata: data,
  };
}

export default async function Page({
  params,
}: {
  params: { slug: string; content: string; metadata: GrayMatterFile<string> };
}) {
  const { content, metadata } = getArticleData(params.slug);
  // TODO: Do something with metadata
  return <ArticleContent contentEnglish={content} />;
}

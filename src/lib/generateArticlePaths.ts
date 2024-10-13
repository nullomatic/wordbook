import fs from "fs";
import matter from "gray-matter";
import path from "path";

export default function generateArticlePaths() {
  const files = fs.readdirSync(path.join(process.cwd(), "content"));
  return files.map((filename) => {
    const filePath = path.join(process.cwd(), "content", filename);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(fileContent);
    return {
      slug: filename.replace(".md", ""),
      title: data.title || "Untitled",
    };
  });
}

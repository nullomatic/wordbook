import Markdown from "react-markdown";

export default function ArticleContent({
  contentEnglish,
}: {
  contentEnglish: string;
}) {
  return (
    <Markdown
      className="mx-auto max-w-3xl space-y-6"
      components={{
        h1: ({ node, ...props }) => (
          <h1
            className="py-6 text-center font-fraktur text-5xl font-bold lg:text-6xl"
            {...props}
          />
        ),
        h2: ({ node, ...props }) => (
          <h2
            className="pt-4 text-center font-sans text-lg font-bold"
            {...props}
          />
        ),
        p: ({ node, ...props }) => <p className="" {...props} />,
        a: ({ node, ...props }) => (
          <a
            className="text-blue-600 underline hover:text-blue-900"
            {...props}
          />
        ),
        blockquote: ({ node, ...props }) => (
          <blockquote className="px-6 italic text-stone-800" {...props} />
        ),
      }}
    >
      {contentEnglish}
    </Markdown>
  );
}

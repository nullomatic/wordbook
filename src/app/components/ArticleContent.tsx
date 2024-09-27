import Markdown from "react-markdown";

export default function ArticleContent({
  contentEnglish,
}: {
  contentEnglish: string;
}) {
  return (
    <div className="flex w-full flex-col items-center space-y-6 py-12">
      <Markdown
        className="w-full max-w-2xl space-y-3"
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="py-6 text-center text-5xl font-bold" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-lg font-bold" {...props} />
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
    </div>
  );
}

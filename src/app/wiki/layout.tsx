import SidebarLeft from "@/components/SidebarLeft";
import SidebarRight from "@/components/SidebarRight";
import generateArticlePaths from "@/lib/generateArticlePaths";

const articles = generateArticlePaths();

const sidebarSections = [
  {
    title: "Getting Started",
    items: articles.map(({ title, slug }) => ({
      title,
      link: `/wiki/${slug}`,
    })),
  },

  {
    title: "Wordbook",
    items: [
      {
        title: "Word of the Day",
        link: "/wordbook/word-of-the-day",
      },
      {
        title: "Style Guide",
        link: "/wordbook/style-guide",
      },
      {
        title: "Directory A-Z",
        link: "/wordbook/directory",
      },
      {
        title: "Categories",
        link: "/wordbook/categories",
      },
    ],
  },

  {
    title: "Tools",
    items: [
      {
        title: "Translator",
        link: "/tools/translator",
      },
      {
        title: "Name Generator",
        link: "/tools/generator",
      },
    ],
  },
];

export default function WikiLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <SidebarLeft title="Anglish Wiki" sections={sidebarSections} />
      <div className="grow px-5 py-24 font-serif leading-loose lg:mx-6 xl:px-16 2xl:px-24">
        {children}
      </div>
      <SidebarRight />
    </>
  );
}

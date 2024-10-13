import SidebarLeft from "@/components/SidebarLeft";
import SidebarRight from "@/components/SidebarRight";

const sidebarSections = [
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

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex w-full justify-center">
      <SidebarLeft title="Wordbook" sections={sidebarSections} />
      <div className="w-full shrink-0 pb-8 lg:mx-6 lg:max-w-4xl">
        {children}
      </div>
      <SidebarRight />
    </main>
  );
}

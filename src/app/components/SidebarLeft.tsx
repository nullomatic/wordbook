"use client";

import Link from "next/link";
import classNames from "classnames";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleRight, faLink } from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";

const sidebarSections = [
  {
    title: "Getting Started",
    items: [
      {
        title: "What is Anglish?",
        link: "/wiki/what-is-anglish",
      },
      {
        title: "History of Anglish",
        link: "/wiki/history-of-anglish",
      },
      {
        title: "How to Use This Site",
        link: "/wiki/site-tutorial",
      },
      {
        title: "For Contributors",
        link: "/wiki/contributors",
      },
      {
        title: "Resources",
        link: "/wiki/resources",
      },
    ],
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

export default function SidebarLeft() {
  return (
    <div className="sticky top-0 hidden h-screen w-full shrink xl:block">
      <div className="h-full space-y-3 border-r-2 p-6 pt-9">
        <Link href="/" className="group flex items-center justify-between">
          <div className="text-2xl font-bold">Anglish Wiki</div>
          <FontAwesomeIcon
            className="text-stone-400 group-hover:text-black"
            icon={faLink}
          />
        </Link>

        {sidebarSections.map((section, i) => (
          <section
            key={`sidebar-section-${i}`}
            className={i !== 0 ? "mb-2 mt-6" : ""}
          >
            <div className="mb-2 mt-6 font-semibold text-stone-900">
              {section.title}
            </div>
            <div className="list-none space-y-2 border-l border-stone-300 text-stone-600">
              {section.items.map((item, j) => (
                <li className="group" key={`sidebar-section-${i}-item-${j}`}>
                  <Link
                    className="-ml-px flex items-center justify-between border-l border-transparent pl-3 group-hover:border-black group-hover:text-black"
                    href={item.link}
                  >
                    <div>{item.title}</div>
                    <FontAwesomeIcon
                      icon={faAngleRight}
                      className="text-xs text-stone-400 group-hover:text-black"
                    />
                  </Link>
                </li>
              ))}
            </div>
          </section>
        ))}

        <div className="py-6">
          {new Array(1).fill(0).map((el, i) => (
            <div>
              <Image
                src={`https://picsum.photos/seed/${Math.round(
                  Math.random() * (i + 1) * 10000,
                )}/600/400`}
                alt=""
                width={600}
                height={400}
                className="w-full rounded-lg"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

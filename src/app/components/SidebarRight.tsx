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
        title: "Categories",
        link: "/wordbook/categories",
      },
      {
        title: "Directory A-Z",
        link: "/wordbook/directory",
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

export default function SidebarRight() {
  return (
    <div className="sticky top-0 hidden h-screen w-full shrink xl:block">
      <div className="h-full space-y-3 border-l-2 p-6 pt-9">
        <Link
          href="https://store.anglish.wiki/"
          className="group flex items-center justify-between"
        >
          <FontAwesomeIcon
            className="text-stone-400 group-hover:text-black"
            icon={faLink}
          />
          <div className="text-2xl font-bold">Ye Olde Shoppe</div>
        </Link>

        <div className="grid grid-cols-2 gap-3">
          {new Array(4).fill(0).map((el, i) => (
            <Link href={`https://store.anglish.wiki/product/${i}`}>
              <Image
                src={`https://picsum.photos/seed/${Math.round(
                  Math.random() * (i + 1) * 10000,
                )}/400/400`}
                alt=""
                width={400}
                height={400}
                className="w-full rounded-lg"
              />
            </Link>
          ))}
        </div>
        <p className="text-center text-sm text-stone-800">
          Support your local Anglish store by buying our delicious goods. What
          more could you possibly want? Get in here!
        </p>

        <div>
          {new Array(1).fill(0).map((el, i) => (
            <Link href="https://google.com">
              <Image
                src={`https://picsum.photos/seed/${Math.round(
                  Math.random() * (i + 1) * 10000,
                )}/600/400`}
                alt=""
                width={600}
                height={400}
                className="mb-1.5 w-full rounded-lg"
              />

              <div className="text-center text-xs uppercase text-stone-400">
                Advertisement
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

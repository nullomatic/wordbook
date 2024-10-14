"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleRight, faLink } from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
import { usePathname } from "next/navigation";
import classNames from "classnames";

type SectionType = {
  title: string;
  items: {
    title: string;
    link: string;
  }[];
};

export default function SidebarLeft({
  title,
  sections,
}: {
  title: string;
  sections: SectionType[];
}) {
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);
  return (
    <div className="sticky top-0 hidden h-screen w-1/4 max-w-sm lg:block">
      <div className="h-full space-y-3 border-r-2 p-6 pt-9">
        <Link href="/" className="group flex items-center justify-between">
          <div className="text-xl font-bold">{title}</div>
          <FontAwesomeIcon
            className="text-stone-400 group-hover:text-black"
            icon={faLink}
          />
        </Link>

        {sections.map((section, i) => (
          <section
            key={`sidebar-section-${i}`}
            className={i !== 0 ? "mb-2 mt-6" : ""}
          >
            <div className="mb-2 mt-6 font-semibold text-stone-900">
              {section.title}
            </div>
            <div className="list-none space-y-2 border-l border-stone-300">
              {section.items.map((item, j) => (
                <li className="group" key={`sidebar-section-${i}-item-${j}`}>
                  <Link
                    className={classNames(
                      isActive(item.link)
                        ? "border-blue-800 font-medium text-blue-800"
                        : "border-transparent text-stone-600 group-hover:border-stone-600 group-hover:text-black",
                      "-ml-px flex items-center justify-between border-l pl-3",
                    )}
                    href={item.link}
                  >
                    <div className="mr-6 text-nowrap">{item.title}</div>
                    <FontAwesomeIcon
                      icon={faAngleRight}
                      className={classNames(
                        isActive(item.link)
                          ? "text-blue-800"
                          : "text-stone-400 group-hover:text-black",
                        "text-xs",
                      )}
                    />
                  </Link>
                </li>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

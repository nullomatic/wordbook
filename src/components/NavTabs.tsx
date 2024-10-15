"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAddressCard,
  faBook,
  faFeather,
  faHatWizard,
  faTree,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { usePathname } from "next/navigation";
import classNames from "classnames";

const tabs = [
  {
    path: "/",
    icon: faTree,
    iconColor: "text-green-600",
    borderColor: "border-green-600",
    label: "Wiki",
  },
  {
    path: "/wordbook",
    icon: faBook,
    iconColor: "text-orange-600",
    borderColor: "border-orange-600",
    label: "Wordbook",
  },
  {
    path: "/translator",
    icon: faHatWizard,
    iconColor: "text-blue-600",
    borderColor: "border-blue-600",
    label: "Translator",
  },
  {
    path: "/editor",
    icon: faFeather,
    iconColor: "text-yellow-600",
    borderColor: "border-yellow-600",
    label: "Editor",
  },
];

export default function NavTabs() {
  const pathname = usePathname();

  const getTabBackgroundClasses = (index: number, activeTabIndex: number) => {
    if (index === activeTabIndex) return "lg:bg-stone-200";
    switch (Math.abs(index - activeTabIndex)) {
      // Add shades here.
      default:
        return "lg:bg-stone-300";
    }
  };

  const getTabForegroundClasses = (index: number, activeTabIndex: number) => {
    if (index === activeTabIndex) {
      return `${tabs[index].borderColor} ${index === 0 ? "lg:rounded-tr-lg" : "lg:rounded-tl-lg"} ${index === tabs.length - 1 ? "lg:rounded-t-lg" : "lg:rounded-tr-lg"} 2xl:rounded-t-lg lg:shadow-lg lg:z-10`;
    } else {
      const distance = index - activeTabIndex;
      const roundedClass =
        index !== 0 && index !== tabs.length - 1
          ? distance < 0
            ? "lg:rounded-tl-lg"
            : "lg:rounded-tr-lg"
          : "";
      switch (Math.abs(distance)) {
        case 1:
          return `lg:bg-stone-200 ${roundedClass}`;
        // Add shades here.
        default:
          return `lg:bg-stone-300 ${roundedClass}`;
      }
    }
  };

  let activeTabIndex =
    tabs.slice(1).findIndex((tab) => pathname.startsWith(tab.path)) + 1;
  if (activeTabIndex === -1) {
    // Default to main tab for any route prefix not explicitly defined in `tabs`.
    activeTabIndex = 0;
  }

  const leftExtensionBackground = [0, 1].includes(activeTabIndex)
    ? "bg-stone-200"
    : "bg-stone-300";
  const rightExtensionBackground = [2, 3].includes(activeTabIndex)
    ? "bg-stone-200"
    : "bg-stone-300";

  return (
    <div className="fixed inset-x-0 bottom-0 flex justify-center bg-white lg:static">
      {/* Left Extension */}
      <div
        className={classNames(leftExtensionBackground, "hidden grow 2xl:block")}
      />
      {/* Tabs */}
      <div className="flex w-full max-w-screen-2xl shrink-0">
        {tabs.map((tab, index) => (
          <div
            key={tab.path}
            className={classNames(
              getTabBackgroundClasses(index, activeTabIndex),
              "flex w-1/4",
            )}
          >
            <Link
              href={tab.path}
              className={classNames(
                getTabForegroundClasses(index, activeTabIndex),
                {
                  "lg:border-b-2 lg:border-dashed lg:border-stone-200 dark:lg:border-stone-600":
                    index === activeTabIndex,
                  "text-stone-500 lg:text-stone-600 lg:hover:text-black":
                    index !== activeTabIndex,
                },
                "group w-full space-x-1.5 border-t-2 bg-white p-4 text-center font-bold lg:border-t-0 lg:p-3",
              )}
            >
              <FontAwesomeIcon
                icon={tab.icon}
                className={index === activeTabIndex ? tab.iconColor : ""}
              />
              <span className="hidden md:inline">{tab.label}</span>
              {tab.path === "/translator" && (
                <span className="hidden rounded border border-stone-500 px-1 text-xs uppercase text-stone-500 lg:inline lg:group-hover:border-stone-800 lg:group-hover:text-stone-800">
                  Beta
                </span>
              )}
            </Link>
          </div>
        ))}

        {/* Profile Button */}
        <div
          className={classNames(
            rightExtensionBackground,
            // "border-l-2",
            // activeTabIndex !== tabs.length - 1
            //   ? [0, 1].includes(activeTabIndex)
            //     ? "border-stone-400"
            //     : "border-stone-300"
            //   : "border-transparent",
            "hidden w-24 items-center justify-center px-3 pb-0.5 lg:flex xl:w-28 2xl:justify-end",
          )}
        >
          <div
            title="Profile"
            className="flex h-7 w-7 cursor-pointer items-center justify-center border-stone-400 text-stone-400 hover:border-stone-500 hover:text-stone-500"
          >
            <FontAwesomeIcon icon={faAddressCard} className="text-xl" />
          </div>
        </div>
      </div>
      {/* Right Extension */}
      <div
        className={classNames(
          rightExtensionBackground,
          "hidden grow 2xl:block",
        )}
      />
    </div>
  );
}

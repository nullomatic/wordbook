"use client";

import Link from "next/link";
import Search from "./Search";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBook,
  faFeather,
  faHatWizard,
  faTree,
} from "@fortawesome/free-solid-svg-icons";
import { usePathname } from "next/navigation";
import classNames from "classnames";

export default function HeaderTabs() {
  const pathname = usePathname();
  const tabs = [
    {
      path: "/",
      icon: faTree,
      iconColor: "text-green-600",
      label: "anglish.wiki",
    },
    {
      path: "/wordbook",
      icon: faBook,
      iconColor: "text-orange-600",
      label: "Wordbook",
    },
    {
      path: "/translator",
      icon: faHatWizard,
      iconColor: "text-blue-600",
      label: "Translator",
    },
    {
      path: "/editor",
      icon: faFeather,
      iconColor: "text-yellow-600",
      label: "Editor",
    },
  ];

  const getTabBackground = (index: number, activeTabIndex: number) => {
    if (index === activeTabIndex) return "bg-stone-200";
    switch (Math.abs(index - activeTabIndex)) {
      // Add shades here.
      default:
        return "bg-stone-300";
    }
  };

  const getTabForeground = (
    index: number,
    activeTabIndex: number,
    rounded = true,
  ) => {
    if (index === activeTabIndex) {
      return "bg-white rounded-t-lg";
    } else {
      const distance = index - activeTabIndex;
      const lr = distance < 0 ? "l" : "r";
      const round = rounded ? `rounded-t${lr}-lg` : "";
      switch (Math.abs(distance)) {
        case 1:
          return `bg-stone-200 ${round}`;
        // Add shades here.
        default:
          return `bg-stone-300 ${round}`;
      }
    }
  };

  let activeTabIndex =
    tabs.slice(1).findIndex((tab) => pathname.startsWith(tab.path)) + 1;
  if (activeTabIndex === -1) {
    // Default to main tab for any route prefix not explicitly defined in `tabs`.
    activeTabIndex = 0;
  }

  return (
    <div className="z-50 w-full shadow-lg">
      {/* Navigation Tabs */}
      <div className="flex">
        {tabs.map((tab, index) => (
          <div
            key={tab.path}
            className={classNames(
              getTabBackground(index, activeTabIndex),
              "flex w-1/4",
            )}
          >
            <Link
              href={tab.path}
              className={classNames(
                getTabForeground(index, activeTabIndex),
                {
                  "border-b-2 border-dashed border-stone-200 dark:border-stone-600":
                    index === activeTabIndex,
                  "text-stone-600 hover:text-black": index !== activeTabIndex,
                },
                "group w-full space-x-1.5 p-3 text-center font-bold",
              )}
            >
              <FontAwesomeIcon
                icon={tab.icon}
                className={`${index === activeTabIndex ? tab.iconColor : ""}`}
              />
              <span className="hidden md:inline">{tab.label}</span>
              {tab.path === "/translator" && (
                <span className="hidden rounded border border-stone-500 px-1 text-xs uppercase text-stone-500 group-hover:border-stone-800 group-hover:text-stone-800 lg:inline">
                  Beta
                </span>
              )}
            </Link>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="mx-auto flex w-full flex-col bg-white px-3 py-3 lg:max-w-4xl lg:px-0 lg:pr-1 dark:bg-stone-700">
        <Search />
      </div>
    </div>
  );
}

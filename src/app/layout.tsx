import { config } from "@fortawesome/fontawesome-svg-core";
import type { Metadata } from "next";
import "./globals.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "react-toastify/dist/ReactToastify.css";
import HeaderTabs from "../components/HeaderTabs";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTree } from "@fortawesome/free-solid-svg-icons";
import { Bounce, ToastContainer } from "react-toastify";
config.autoAddCss = false;

export const metadata: Metadata = {
  title: "Anglish Wiki",
  description: "An Anglish-to-English thesaurus and translator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className="flex min-h-screen flex-col items-center bg-white text-black dark:bg-stone-900 dark:text-white">
        <ToastContainer
          position="bottom-center"
          autoClose={5000}
          limit={3}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
          transition={Bounce}
          className="text-sm"
        />

        <HeaderTabs />

        <main className="flex w-full grow flex-col">{children}</main>

        {/* Footer */}
        <footer className="w-full bg-stone-200 px-3 pb-16 pt-12 text-center text-stone-800 dark:text-stone-600">
          <Link href="/" className="mb-10 space-x-1.5 p-3 text-2xl font-bold">
            <FontAwesomeIcon icon={faTree} className="text-green-700" />
            <span className="hidden md:inline">anglish.wiki</span>
          </Link>

          <div className="my-8 space-y-3">
            <Link href="/wiki" className="block">
              Wiki
            </Link>
            <Link href="/browse" className="block">
              Browse
            </Link>
            <Link href="/about" className="block">
              About
            </Link>
          </div>

          <div className="my-3 text-xs">
            Like the site? Contribute on{" "}
            <a
              className="underline dark:text-stone-400"
              href="https://github.com/nullomatic/wordbook"
              target="_blank"
            >
              GitHub
            </a>
            &nbsp;or support my{" "}
            <a
              className="underline dark:text-stone-400"
              href="https://patreon.com/nullomatic"
              target="_blank"
            >
              Patreon
            </a>
          </div>

          <div>&copy; {new Date().getFullYear()}</div>
        </footer>
      </body>
    </html>
  );
}

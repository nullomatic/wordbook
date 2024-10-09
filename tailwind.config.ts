import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "selector",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ["'Source Sans 3'", "Helvetica", "Arial", "sans-serif"],
        sans: ["'Source Sans 3'", "Helvetica", "Arial", "sans-serif"],
        serif: ["'Merriweather'", "Georgia", "serif"],
      },
      backgroundImage: {
        custom: "linear-gradient(to right, #ff7e5f, #feb47b)",
        dots:
          `linear-gradient(90deg, var(--dot-bg) calc(var(--dot-space) - var(--dot-size)), transparent 1%) ` +
          `center / var(--dot-space) var(--dot-space), linear-gradient(var(--dot-bg) calc(var(--dot-space) - ` +
          `var(--dot-size)), transparent 1%) center / var(--dot-space) var(--dot-space), var(--dot-color);`,
      },
    },
  },
  plugins: [],
};
export default config;

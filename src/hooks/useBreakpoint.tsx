import { useState, useEffect } from "react";

const tailwindBreakpoints = {
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
  "2xl": "(min-width: 1536px)",
};

export default function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<string>("xs");

  useEffect(() => {
    const mediaQueryLists = {
      sm: window.matchMedia(tailwindBreakpoints["sm"]),
      md: window.matchMedia(tailwindBreakpoints["md"]),
      lg: window.matchMedia(tailwindBreakpoints["lg"]),
      xl: window.matchMedia(tailwindBreakpoints["xl"]),
      "2xl": window.matchMedia(tailwindBreakpoints["2xl"]),
    };

    const getCurrentBreakpoint = () => {
      if (mediaQueryLists["2xl"].matches) return "2xl";
      if (mediaQueryLists["xl"].matches) return "xl";
      if (mediaQueryLists["lg"].matches) return "lg";
      if (mediaQueryLists["md"].matches) return "md";
      if (mediaQueryLists["sm"].matches) return "sm";
      return "xs";
    };

    const handleResize = () => {
      setBreakpoint(getCurrentBreakpoint());
    };
    Object.values(mediaQueryLists).forEach((mql) =>
      mql.addEventListener("change", handleResize),
    );

    setBreakpoint(getCurrentBreakpoint());

    return () => {
      Object.values(mediaQueryLists).forEach((mql) =>
        mql.removeEventListener("change", handleResize),
      );
    };
  }, []);

  return breakpoint;
}

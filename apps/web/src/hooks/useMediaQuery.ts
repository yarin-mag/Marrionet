import { useEffect, useState } from "react";

/**
 * useMediaQuery hook - Matches CSS media queries
 * Useful for responsive behavior in components
 * @param query - CSS media query string
 * @returns Whether the query matches
 * @example
 * const isMobile = useMediaQuery("(max-width: 768px)");
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);

    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

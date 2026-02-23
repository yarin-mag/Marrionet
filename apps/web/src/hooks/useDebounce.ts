import { useEffect, useState } from "react";

/**
 * useDebounce hook - Debounces a value change
 * Useful for search inputs, API calls, etc.
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced value
 * @example
 * const debouncedSearch = useDebounce(searchTerm, 300);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

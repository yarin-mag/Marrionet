import { useState, useEffect } from "react";

/**
 * Interface for hook return value
 */
export interface UseHookNameReturn {
  /** Description of returned value */
  value: string;
  /** Description of returned function */
  setValue: (value: string) => void;
}

/**
 * useHookName - Brief description of what this hook does
 *
 * @param initialValue - Description of parameter
 * @returns Object with values and functions
 *
 * @example
 * ```tsx
 * const { value, setValue } = useHookName("initial");
 * ```
 */
export function useHookName(initialValue: string): UseHookNameReturn {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    // Hook logic here
  }, [value]);

  return {
    value,
    setValue,
  };
}

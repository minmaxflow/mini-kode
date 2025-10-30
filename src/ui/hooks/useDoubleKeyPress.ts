import { useEffect, useRef } from "react";
import { useInput } from "ink";

export interface UseDoubleKeyPressOptions {
  windowMs?: number; // default 500ms
  onFirstPress?: () => void; // e.g., show hint or perform first press action
  onDoublePress?: () => void; // action to perform on double press
  enabled?: boolean; // whether the double press detection is enabled
}

/**
 * Generic hook to handle double key press pattern.
 *
 * On first key press:
 * - Records timestamp in lastPressRef
 * - Starts a timer that resets lastPressRef after windowMs
 * - Optionally calls onFirstPress callback
 *
 * On second key press within windowMs:
 * - Detects the time difference is within threshold
 * - Clears the pending timer
 * - Calls onDoublePress callback
 *
 * The useEffect cleanup ensures no memory leaks by:
 * - Clearing any pending timeout when component unmounts
 * - Resetting refs to prevent stale closures
 */
export function useDoubleKeyPress(
  keyMatcher: (input: string, key: any) => boolean,
  options: UseDoubleKeyPressOptions = {},
): void {
  const {
    windowMs = 500,
    onFirstPress,
    onDoublePress,
    enabled = true,
  } = options;
  // Store timestamp of last key press to detect double press
  const lastPressRef = useRef<number | null>(null);
  // Store timeout ID to clear it on unmount or double press
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      lastPressRef.current = null;
    };
  }, []);

  useInput((input, key) => {
    if (keyMatcher(input, key) && enabled) {
      const now = Date.now();
      const last = lastPressRef.current;

      // Check if this is a double press within the time window
      if (last !== null && now - last <= windowMs) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        lastPressRef.current = null;

        // Execute double press action
        if (typeof onDoublePress === "function") {
          onDoublePress();
        }
        return;
      }

      lastPressRef.current = now;
      // Clear any existing timeout before setting a new one
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // After windowMs, reset the state so next press is treated as "first press"
      timeoutRef.current = setTimeout(() => {
        lastPressRef.current = null;
        timeoutRef.current = null;
      }, windowMs);

      // Notify parent component about first press
      if (typeof onFirstPress === "function") {
        onFirstPress();
      }
    }
  });
}

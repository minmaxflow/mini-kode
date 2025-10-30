import { useState, useEffect } from "react";

// Global state for terminal width tracking
let globalWidth = process.stdout.columns || 80;
let globalListeners = new Set<() => void>();
let isGlobalListenerSetup = false;

/**
 * Set up a single global resize listener that notifies all components
 */
function setupGlobalResizeListener() {
  if (isGlobalListenerSetup) return;

  const handleResize = () => {
    globalWidth = process.stdout.columns || 80;
    // Notify all listeners
    globalListeners.forEach((listener) => listener());
  };

  process.stdout.on("resize", handleResize);
  isGlobalListenerSetup = true;
}

/**
 * Hook to get and track terminal width changes
 *
 * Returns the current terminal width and updates when terminal is resized
 * Uses a shared resize listener to prevent memory leaks
 */
export function useTerminalWidth(): number {
  const [width, setWidth] = useState(globalWidth);

  useEffect(() => {
    // Set up global listener on first hook usage
    setupGlobalResizeListener();

    // Local update handler
    const handleUpdate = () => {
      setWidth(globalWidth);
    };

    // Add this component to the global listeners
    globalListeners.add(handleUpdate);

    // Cleanup: remove this component's listener
    return () => {
      globalListeners.delete(handleUpdate);
    };
  }, []);

  return width;
}

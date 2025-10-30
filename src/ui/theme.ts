import { ConfigManager } from "../config";

export const lightTheme = {
  brand: "#fc6e08",
  accent: "#0066cc",
  secondary: "#999",
  success: "#27ae60",
  error: "#e74c3c",
  warning: "#f39c12",
  diff: {
    added: "#7bed9f",
    removed: "#ffa8a8",
  },
};

const darkTheme = {
  brand: "#fc6e08",
  accent: "#4dabf7",
  secondary: "#b0b0b0",
  success: "#51cf66",
  error: "#ff6b6b",
  warning: "#ffd43b",
  diff: {
    added: "#a0e9aa",
    removed: "#ffb8b8",
  },
};

/**
 * Get current theme based on global configuration
 */
export function getCurrentTheme() {
  const config = ConfigManager.load();
  return config.theme === "dark" ? darkTheme : lightTheme;
}

import { describe, it, expect } from "vitest";
import { fuzzyMatch } from "../../mentions/fuzzyMatcher";
import { FileEntry } from "../../mentions/types";

describe("useFileCompletion directory path processing", () => {
  it("should add trailing slash to directory paths in suggestions", () => {
    const mockFiles: FileEntry[] = [
      { path: "src/", type: "directory" },
      { path: "src/components", type: "directory" },
      { path: "src/App.tsx", type: "file" },
    ];

    const matches = fuzzyMatch("src", mockFiles);

    // Should return all matches (fuzzyMatch may return them in different order)
    expect(matches.length).toBe(3);

    // Check that directories have trailing slashes added
    const directories = matches.filter((m) => m.type === "directory");
    directories.forEach((dir) => {
      expect(dir.path.endsWith("/")).toBe(true);
    });

    // Check that file paths remain unchanged
    const files = matches.filter((m) => m.type === "file");
    files.forEach((file) => {
      expect(file.path.endsWith("/")).toBe(false);
    });
  });

  it("should not add slash if directory already has one", () => {
    const mockFiles: FileEntry[] = [{ path: "src/", type: "directory" }];

    const matches = fuzzyMatch("src", mockFiles);
    expect(matches[0].path).toBe("src/");
  });

  it("should not modify file paths", () => {
    const mockFiles: FileEntry[] = [
      { path: "src/App.tsx", type: "file" },
      { path: "src/components/Button.tsx", type: "file" },
    ];

    const matches = fuzzyMatch("src", mockFiles);

    // Should find matches for "src" query
    expect(matches.length).toBeGreaterThan(0);

    // All returned items should be files (no trailing slashes added)
    matches.forEach((match) => {
      expect(match.type).toBe("file");
      expect(match.path.endsWith("/")).toBe(false);
    });

    // Should preserve original paths exactly
    const matchedPaths = matches.map((m) => m.path);
    expect(matchedPaths).toContain("src/App.tsx");
    expect(matchedPaths).toContain("src/components/Button.tsx");
  });
});

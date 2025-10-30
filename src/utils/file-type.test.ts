import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isTextFile,
  isTextFileByExtension,
  isTextFileByContent,
  isTextBuffer,
} from "./file-type";

describe("file-type utilities", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-type-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("isTextBuffer", () => {
    it("should return true for text buffers", () => {
      const textBuffer = Buffer.from("Hello, World!\nThis is a text file.");
      expect(isTextBuffer(textBuffer)).toBe(true);
    });

    it("should return false for binary buffers with null bytes", () => {
      const binaryBuffer = Buffer.from([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64,
      ]);
      expect(isTextBuffer(binaryBuffer)).toBe(false);
    });

    it("should return false for binary buffers with control characters", () => {
      const binaryBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      expect(isTextBuffer(binaryBuffer)).toBe(false);
    });

    it("should return true for buffers with allowed control characters", () => {
      const textBuffer = Buffer.from("\t\n\r"); // tab, newline, carriage return
      expect(isTextBuffer(textBuffer)).toBe(true);
    });
  });

  describe("isTextFileByExtension", () => {
    it("should return true for known text file extensions", () => {
      expect(isTextFileByExtension("file.ts")).toBe(true);
      expect(isTextFileByExtension("file.js")).toBe(true);
      expect(isTextFileByExtension("file.md")).toBe(true);
      expect(isTextFileByExtension("file.txt")).toBe(true);
      expect(isTextFileByExtension("file.json")).toBe(true);
    });

    it("should return false for binary file extensions", () => {
      expect(isTextFileByExtension("file.png")).toBe(false);
      expect(isTextFileByExtension("file.exe")).toBe(false);
      expect(isTextFileByExtension("file.zip")).toBe(false);
    });

    it("should return false for files without extensions", () => {
      expect(isTextFileByExtension("README")).toBe(false);
      expect(isTextFileByExtension("Dockerfile")).toBe(false);
    });
  });

  describe("isTextFileByContent", () => {
    it("should return true for text files", () => {
      const filePath = path.join(tempDir, "test.txt");
      fs.writeFileSync(filePath, "This is a text file\nwith multiple lines.\n");
      expect(isTextFileByContent(filePath)).toBe(true);
    });

    it("should return false for binary files", () => {
      const filePath = path.join(tempDir, "test.bin");
      const binaryData = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]); // PNG header
      fs.writeFileSync(filePath, binaryData);
      expect(isTextFileByContent(filePath)).toBe(false);
    });

    it("should return false for non-existent files", () => {
      const filePath = path.join(tempDir, "nonexistent.txt");
      expect(isTextFileByContent(filePath)).toBe(false);
    });
  });

  describe("isTextFile", () => {
    it("should detect text files by extension", () => {
      expect(isTextFile("file.ts")).toBe(true);
      expect(isTextFile("file.js")).toBe(true);
      expect(isTextFile("file.md")).toBe(true);
    });

    it("should reject binary files by extension", () => {
      expect(isTextFile("file.png")).toBe(false);
      expect(isTextFile("file.exe")).toBe(false);
    });

    it("should fallback to content detection for unknown extensions", () => {
      // Create a file with unknown extension but text content
      const filePath = path.join(tempDir, "test.xyz");
      fs.writeFileSync(
        filePath,
        "This is a text file with unknown extension\n",
      );

      expect(isTextFile(filePath)).toBe(true);
    });

    it("should reject files with unknown extensions and binary content", () => {
      // Create a file with unknown extension and binary content
      const filePath = path.join(tempDir, "test.bin");
      const binaryData = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]); // PNG header
      fs.writeFileSync(filePath, binaryData);

      expect(isTextFile(filePath)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle case sensitivity", () => {
      expect(isTextFile("file.TS")).toBe(true);
      expect(isTextFile("file.JS")).toBe(true);
      expect(isTextFile("file.MD")).toBe(true);
    });

    it("should handle paths with directories", () => {
      expect(isTextFile("src/app.ts")).toBe(true);
      expect(isTextFile("src/components/Button.tsx")).toBe(true);
      expect(isTextFile("assets/image.png")).toBe(false);
    });

    it("should handle files with multiple dots", () => {
      expect(isTextFile("file.test.ts")).toBe(true);
      expect(isTextFile("file.spec.js")).toBe(true);
      expect(isTextFile("archive.tar.gz")).toBe(false);
    });
  });
});

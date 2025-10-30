import fs from "fs";
import os from "os";
import path from "path";
import { spawn, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ExternalEditorOptions {
  content: string;
}

export interface ExternalEditorResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Check if a command exists on the system using 'which' (Unix) or 'where' (Windows)
 */
async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    const whichCommand = process.platform === "win32" ? "where" : "which";
    await execAsync(`${whichCommand} ${command}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the default editor based on environment variables and system availability
 */
async function getAvailableEditor(): Promise<string | null> {
  // Check EDITOR environment variable first
  const editor = process.env.EDITOR;
  if (editor && editor.trim()) {
    // For EDITOR, we trust the user's configuration but need to extract the base command
    const trimmedEditor = editor.trim();
    const editorCommand = trimmedEditor.split(" ")[0];
    return editorCommand;
  }

  // Try common editors in order of preference
  const commonEditors = ["code", "vim", "nano"];

  // Platform-specific editor detection
  if (process.platform === "win32") {
    commonEditors.unshift("notepad");
  }

  // Check each editor for actual availability
  for (const editor of commonEditors) {
    if (await isCommandAvailable(editor)) {
      return editor;
    }
  }

  return null;
}

/**
 * Open external editor with the provided content
 */
export async function openExternalEditor({
  content,
}: ExternalEditorOptions): Promise<ExternalEditorResult> {
  const editor = await getAvailableEditor();

  if (!editor) {
    return {
      success: false,
      error:
        "No editor available. Please set EDITOR environment variable or install VS Code and run 'Install code command in PATH' from VS Code Command Palette (Cmd+Shift+P)",
    };
  }

  // Check if we should use the full EDITOR command
  const fullEditorCommand = process.env.EDITOR?.trim();
  let useFullCommand = false;

  if (fullEditorCommand && fullEditorCommand.split(" ")[0] === editor) {
    useFullCommand = true;
  }

  // Create temporary file
  const tempFile = path.join(
    os.tmpdir(),
    `minicode-input-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`,
  );

  try {
    // Write initial content to temp file
    fs.writeFileSync(tempFile, content, "utf8");

    // Open editor
    await new Promise<void>((resolve, reject) => {
      let editorCommand: string;
      let editorArgs: string[];

      if (useFullCommand && fullEditorCommand) {
        // Use the full EDITOR command as provided by user
        const parts = fullEditorCommand.split(" ");
        editorCommand = parts[0];
        editorArgs = [...parts.slice(1), tempFile]; // Add temp file to the existing args
      } else if (editor === "code") {
        // VS Code needs --wait flag to block until file is closed
        editorCommand = "code";
        editorArgs = ["--wait", tempFile];
      } else {
        // For other editors, just pass the file
        editorCommand = editor;
        editorArgs = [tempFile];
      }

      const editorProcess = spawn(editorCommand, editorArgs, {
        stdio: "inherit",
      });

      editorProcess.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Editor exited with code ${code}`));
        }
      });

      editorProcess.on("error", (error) => {
        reject(error);
      });
    });

    // Read edited content
    const editedContent = fs.readFileSync(tempFile, "utf8");

    return {
      success: true,
      content: editedContent,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "unknown error occurred",
    };
  } finally {
    // Clean up temporary file
    try {
      fs.unlinkSync(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

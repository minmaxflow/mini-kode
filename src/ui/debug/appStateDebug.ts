import type { UIFeedMessage } from "../types";
import type { ToolCall } from "../../tools/runner.types";
import { formatToolResultMessage } from "../../agent/formatters";
import { SAMPLE_MARKDOWN } from "./sampleMarkdown";
import { APIUserAbortError } from "openai";

/**
 * Debug data for UI testing purposes.
 *
 * Simplified debug system that creates realistic conversation flows with common scenarios.
 *
 * IMPORTANT:
 * - Only use terminal states for TOOL CALLS in debug data
 * - Transient tool states (pending, executing, permission_required) are managed by executor
 *
 * Supported TOOL CALL states in debug data (terminal states only):
 * - "success" - Tool completed successfully
 * - "error" - Tool failed with error
 * - "abort" - Tool was interrupted by user
 * - "permission_denied" - Tool permission was rejected by user
 *
 * Note: Todo item status (pending, in_progress, completed) is separate from tool call status
 * and can be any valid todo status.
 *
 * @param showAllToolStates - Show comprehensive tool states (success, error, abort, permission_denied)
 */
export function createDebugAppState(showAllToolStates: boolean = false): {
  messages: UIFeedMessage[];
  toolCalls: ToolCall[];
} {
  // Base conversation flow
  const baseMessages: UIFeedMessage[] = [
    // 1. User message asking for markdown + file read
    {
      kind: "api",
      status: "complete",
      message: {
        role: "user",
        content:
          "Show me a sample markdown with various formatting options and then read my package.json. I'm particularly interested in seeing how the application handles long text messages with multiple paragraphs and complex formatting. Please demonstrate the text wrapping capabilities with examples that include code blocks, lists with lengthy descriptions, and detailed explanations of technical concepts. I want to test how the UI renders extensive user input that spans multiple lines and includes various markdown elements to ensure the display remains readable and properly formatted across different terminal widths.",
      },
    },
    // 2. Assistant message with sample markdown + tool calls
    {
      kind: "api",
      status: "complete",
      message: {
        role: "assistant",
        content: SAMPLE_MARKDOWN,
        tool_calls: [
          {
            id: "call_readonly_1",
            type: "function",
            function: {
              name: "fileRead",
              arguments: '{"filePath": "package.json"}',
            },
          },
        ],
      },
    },
    // 3. Tool message for read-only tool
    {
      kind: "api",
      status: "complete",
      message: {
        role: "tool",
        tool_call_id: "call_readonly_1",
        content:
          '{\n  "type": "fileRead",\n  "filePath": "package.json",\n  "content": "{\\"name\\": \\"mini-kode\\", \\"version\\": \\"1.0.0\\", \\"scripts\\": {\\"test\\": \\"vitest\\", \\"lint\\": \\"tsc\\"}}",\n  "offset": 0,\n  "limit": 1,\n  "totalLines": 1,\n  "truncated": false\n}',
      },
    },
    // 4. Command call examples
    {
      kind: "cmd",
      commandName: "/clear",
      callId: "cmd-clear-1",
      status: "success",
      startedAt: new Date(Date.now() - 5000).toISOString(),
      endedAt: new Date(Date.now() - 4950).toISOString(),
      result: undefined,
    },
    // no ui for /init cmd
    {
      kind: "cmd",
      commandName: "/init",
      callId: "cmd-init-1",
      status: "success",
      startedAt: new Date(Date.now() - 4000).toISOString(),
      endedAt: new Date(Date.now() - 3950).toISOString(),
      result: undefined,
    },
    {
      kind: "cmd",
      commandName: "/compact",
      callId: "cmd-compact-success",
      status: "success",
      startedAt: new Date(Date.now() - 3000).toISOString(),
      endedAt: new Date(Date.now() - 2500).toISOString(),
      result:
        "📊 Session Summary: This session covered comprehensive authentication system implementation, markdown rendering improvements, and command system enhancements. Key accomplishments include adding JWT token management with refresh mechanisms, implementing user registration with email verification, integrating multi-factor authentication using TOTP, enhancing markdown text wrapping capabilities for better terminal display, creating comprehensive debugging scenarios with long text content, and establishing a robust command execution framework with proper error handling and status tracking.",
    },
    {
      kind: "cmd",
      commandName: "/compact",
      callId: "cmd-compact-error",
      status: "error",
      startedAt: new Date(Date.now() - 2000).toISOString(),
      endedAt: new Date(Date.now() - 1950).toISOString(),
      error:
        "Failed to generate session summary: Insufficient conversation history - at least 3 message exchanges required for meaningful summarization. Please continue the conversation before attempting to compact the session.",
    },
  ];

  // Base tool calls (fileRead + fileEdit)
  const baseToolCalls: ToolCall[] = [
    // Read-only tool (completed)
    {
      toolName: "fileRead",
      requestId: "call_readonly_1",
      status: "success",
      input: {
        filePath: "package.json",
      },
      startedAt: new Date(Date.now() - 2000).toISOString(),
      endedAt: new Date(Date.now() - 1500).toISOString(),
      result: {
        type: "fileRead",
        filePath: "package.json",
        content:
          '{"name": "mini-kode", "version": "1.0.0", "scripts": {"test": "vitest", "lint": "tsc"}}',
        offset: 0,
        limit: 1,
        totalLines: 1,
        truncated: false,
      },
    },
  ];

  // Add interruption examples before comprehensive tool states
  const interruptionExamples: UIFeedMessage[] = [
    // Interrupted assistant message example
    {
      kind: "api",
      status: "error",
      error: new APIUserAbortError(),
      message: {
        role: "assistant",
        content:
          "Let me help you implement a comprehensive authentication system with JWT tokens, refresh mechanisms, and multi-factor authentication. First, I'll need to examine your current codebase structure and then:\n\n1. Create the authentication middleware\n2. Implement JWT token generation and validation\n3. Add refresh token rotation\n4. Set up MFA using TOTP\n5. Create secure session management\n6. Add comprehensive error handling\n7. Implement rate limiting",
      },
    },
    // Another interrupted message with different content
    {
      kind: "api",
      status: "complete",
      message: {
        role: "assistant",
        content:
          "I'll analyze the React component performance issues by examining the rendering patterns, checking for unnecessary re-renders, and implementing optimization techniques such as:\n\n- React.memo for component memoization\n- useMemo and useCallback for expensive computations\n- Virtual scrolling for large lists\n- Code splitting with React.lazy\n\nThe key areas I'll focus on are:\n\n🔍 **Component Analysis**:\n- Identify components that re-render unnecessarily\n- Check prop drilling and context usage\n- Analyze state management patterns\n\n⚡ **Performance Optimizations**:\n- Implement shouldComponentUpdate logic\n- Add memoization for expensive calculations\n- Optimize bundle size with dynamic imports\n\n📊 **Monitoring Setup**:\n- Add React DevTools Profiler integration\n- Implement performance metrics tracking\n- Set up automated performance testing",
      },
    },
    // Tool call that was interrupted during execution
    {
      kind: "api",
      status: "complete",
      message: {
        role: "assistant",
        content:
          "I'll start by reading the package.json to understand the project structure:",
        tool_calls: [
          {
            id: "call_interrupted_bash",
            type: "function",
            function: {
              name: "bash",
              arguments: '{"command": "npm run build", "timeout": 30000}',
            },
          },
        ],
      },
    },
    // Tool message for interrupted tool call
    {
      kind: "api",
      status: "complete",
      message: {
        role: "tool",
        tool_call_id: "call_interrupted_bash",
        content:
          '{"type": "bash", "command": "npm run build", "stdout": "Building...\\nCompiling TypeScript files\\nOptimizing bundles\\n", "stderr": "", "exitCode": 143, "truncated": false, "durationMs": 2500}',
      },
    },
    // User message after interruption
    {
      kind: "api",
      status: "complete",
      message: {
        role: "user",
        content:
          "Actually, let me stop the build process and try a different approach. Can you help me with something else instead?",
      },
    },
  ];

  const interruptionToolCalls: ToolCall[] = [
    // Bash tool that was interrupted during execution
    {
      toolName: "bash",
      requestId: "call_interrupted_bash",
      status: "abort",
      input: { command: "npm run build", timeout: 30000 },
      startedAt: new Date(Date.now() - 3000).toISOString(),
      endedAt: new Date(Date.now() - 500).toISOString(),
      result: {
        isError: true,
        isAborted: true,
        message: "Tool execution was aborted",
      },
    },
  ];

  // Always add interruption examples
  baseToolCalls.push(...interruptionToolCalls);
  baseMessages.push(...interruptionExamples);

  // Add comprehensive tool states (all tools with all terminal states) when requested
  if (showAllToolStates) {
    // Manual creation of tool calls with proper types
    const comprehensiveToolCalls: ToolCall[] = [
      // bash - success
      {
        toolName: "bash",
        requestId: "bash-success",
        status: "success",
        input: { command: "echo 'Success!'", timeout: 5000 },
        startedAt: new Date(Date.now() - 10000).toISOString(),
        endedAt: new Date(Date.now() - 9500).toISOString(),
        result: {
          type: "bash",
          command: "echo 'Success!'",
          stdout: "Success!\n",
          stderr: "",
          exitCode: 0,
          truncated: false,
          durationMs: 25,
        },
      },
      // bash - git commit with multiline message
      {
        toolName: "bash",
        requestId: "bash-git-commit-multiline",
        status: "success",
        input: {
          command:
            'git commit -m "feat: add comprehensive user authentication system with JWT tokens and refresh mechanism\n\nThis implementation introduces a complete authentication overhaul including user registration with email verification, secure password hashing using bcrypt, JWT-based access tokens with configurable expiration, refresh token rotation for enhanced security, role-based access control (RBAC) for fine-grained permissions, comprehensive error handling with internationalization support, audit logging for security compliance, password reset functionality with secure token validation, and multi-factor authentication (MFA) integration using TOTP\n\nKey improvements include: refactored authentication middleware to support async validation patterns, implemented proper session management with Redis backend for scalability, added comprehensive unit tests with 95% coverage, updated API documentation with OpenAPI 3.0 specifications, improved performance through strategic database query optimization and caching strategies"',
          timeout: 10000,
        },
        startedAt: new Date(Date.now() - 9500).toISOString(),
        endedAt: new Date(Date.now() - 9200).toISOString(),
        result: {
          type: "bash",
          command:
            'git commit -m "feat: add comprehensive user authentication system with JWT tokens and refresh mechanism\n\nThis implementation introduces a complete authentication overhaul including user registration with email verification, secure password hashing using bcrypt, JWT-based access tokens with configurable expiration, refresh token rotation for enhanced security, role-based access control (RBAC) for fine-grained permissions, comprehensive error handling with internationalization support, audit logging for security compliance, password reset functionality with secure token validation, and multi-factor authentication (MFA) integration using TOTP\n\nKey improvements include: refactored authentication middleware to support async validation patterns, implemented proper session management with Redis backend for scalability, added comprehensive unit tests with 95% coverage, updated API documentation with OpenAPI 3.0 specifications, improved performance through strategic database query optimization and caching strategies"',
          stdout:
            "feat: add comprehensive user authentication system with JWT tokens and refresh mechanism，Authentication system implementation completed successfully with the following major components:\n\n🔐 JWT Token Management:\n   - Access tokens with 15-minute expiration for security\n   - Refresh tokens with 7-day rotation mechanism\n   - Secure token storage using HTTP-only cookies\n   - Automatic token refresh on client-side\n\n👤 User Registration & Verification:\n   - Email verification with secure token generation\n   - Password strength validation and bcrypt hashing\n   - Account activation and deactivation workflows\n   - User profile management with customizable settings\n\n🛡️ Security Features:\n   - Rate limiting to prevent brute force attacks\n   - Session management with Redis backend\n   - Comprehensive audit logging for compliance\n   - Multi-factor authentication using TOTP\n\n📊 Performance Optimizations:\n   - Database query optimization with strategic indexing\n   - Caching layer implementation for frequently accessed data\n   - Async middleware patterns for improved throughput\n   - Memory-efficient token validation algorithms\n\n📝 Documentation Updates:\n   - OpenAPI 3.0 specification with detailed examples\n   - Integration guides for third-party authentication providers\n   - Security best practices documentation\n   - Troubleshooting guide for common authentication issues\n\nFiles modified:\n  src/auth/jwt.ts                           (new)\n  src/auth/middleware.ts                    (new)\n  src/auth/rbac.ts                          (new)\n  src/auth/mfa.ts                           (new)\n  src/controllers/auth.ts                   (refactored)\n  src/models/user.ts                        (enhanced)\n  tests/auth/integration.test.ts             (comprehensive test suite)\n  docs/authentication-guide.md              (detailed documentation)\n  package.json                              (updated dependencies)\n  README.md                                  (updated setup instructions)\n\n🧪 Testing Results:\n   - Unit test coverage: 95% (target: 90%+)\n   - Integration tests: 45 test cases passing\n   - Security audit: 0 critical vulnerabilities found\n   - Performance benchmarks: 40% faster authentication flow\n   - Load testing: 1000 concurrent users successfully authenticated\n\n✅ Ready for production deployment with monitoring and alerting configured.\n",
          stderr: "",
          exitCode: 0,
          truncated: false,
          durationMs: 320,
        },
      },
      // bash - error
      {
        toolName: "bash",
        requestId: "bash-error",
        status: "error",
        input: { command: "cat /nonexistent", timeout: 5000 },
        startedAt: new Date(Date.now() - 9000).toISOString(),
        endedAt: new Date(Date.now() - 8500).toISOString(),
        result: {
          isError: true,
          message: "Command failed: cat /nonexistent",
        },
      },
      // bash - abort
      {
        toolName: "bash",
        requestId: "bash-abort",
        status: "abort",
        input: { command: "sleep 30", timeout: 30000 },
        startedAt: new Date(Date.now() - 8000).toISOString(),
        endedAt: new Date(Date.now() - 7500).toISOString(),
        result: {
          isError: true,
          isAborted: true,
          message: "Tool execution was aborted",
        },
      },
      // bash - permission_denied
      {
        toolName: "bash",
        requestId: "bash-permission_denied",
        status: "permission_denied",
        input: { command: "rm -rf /important", timeout: 5000 },
        startedAt: new Date(Date.now() - 7000).toISOString(),
        endedAt: new Date(Date.now() - 6500).toISOString(),
        rejectionReason: "user_rejected",
      },
      // bash - timeout
      {
        toolName: "bash",
        requestId: "bash-timeout",
        status: "permission_denied",
        input: { command: "make build", timeout: 10000 },
        startedAt: new Date(Date.now() - 6800).toISOString(),
        endedAt: new Date(Date.now() - 600).toISOString(),
        rejectionReason: "timeout",
      },
      // fileRead - success
      {
        toolName: "fileRead",
        requestId: "fileRead-success",
        status: "success",
        input: { filePath: "/tmp/test.txt", offset: 0, limit: 10 },
        startedAt: new Date(Date.now() - 6000).toISOString(),
        endedAt: new Date(Date.now() - 5500).toISOString(),
        result: {
          type: "fileRead",
          filePath: "/tmp/test.txt",
          content: "Test file content\nLine 2\nLine 3",
          offset: 0,
          limit: 3,
          totalLines: 3,
          truncated: false,
        },
      },
      // fileRead - error
      {
        toolName: "fileRead",
        requestId: "fileRead-error",
        status: "error",
        input: { filePath: "/nonexistent.txt", offset: 0, limit: 10 },
        startedAt: new Date(Date.now() - 5000).toISOString(),
        endedAt: new Date(Date.now() - 4500).toISOString(),
        result: {
          isError: true,
          message: "File not found",
        },
      },
      // fileRead - abort
      {
        toolName: "fileRead",
        requestId: "fileRead-abort",
        status: "abort",
        input: { filePath: "/huge/file.txt", offset: 0, limit: 10000 },
        startedAt: new Date(Date.now() - 4000).toISOString(),
        endedAt: new Date(Date.now() - 3500).toISOString(),
        result: {
          isError: true,
          isAborted: true,
          message: "Tool execution was aborted",
        },
      },

      // fileEdit - success
      {
        toolName: "fileEdit",
        requestId: "fileEdit-success",
        status: "success",
        input: {
          filePath: "/src/components/UserProfile.tsx",
        },
        startedAt: new Date(Date.now() - 2000).toISOString(),
        endedAt: new Date(Date.now() - 1500).toISOString(),
        result: {
          type: "fileEdit",
          filePath: "/src/components/UserProfile.tsx",
          mode: "update",
          success: true,
          message: "Edit applied",
          editStartLine: 15,
          oldContent: `function UserProfile({ name, email }: { name: string; email: string }) {
  return (
    <div>
      <h2>{name}</h2>
      <p>{email}</p>
    </div>
  );
}`,
          newContent: `function UserProfile({ name, email, avatar }: { name: string; email: string; avatar?: string }) {
  return (
    <div className="user-profile">
      {avatar && <img src={avatar} alt={name} className="avatar" />}
      <div className="user-info">
        <h2>{name}</h2>
        <p>{email}</p>
      </div>
    </div>
  );
}`,
        },
      },
      // fileEdit - create (new file)
      {
        toolName: "fileEdit",
        requestId: "fileEdit-create",
        status: "success",
        input: {
          filePath: "/src/components/Avatar.tsx",
          old_string: "",
        },
        startedAt: new Date(Date.now() - 1600).toISOString(),
        endedAt: new Date(Date.now() - 1550).toISOString(),
        result: {
          type: "fileEdit",
          filePath: "/src/components/Avatar.tsx",
          mode: "create",
          success: true,
          message: "File created",
          oldContent: "",
          newContent: `import React from 'react';

interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function Avatar({ src, alt, size = 'medium', className }: AvatarProps) {
  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-12 h-12',
    large: 'w-16 h-16',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={\`\${sizeClasses[size]} rounded-full object-cover \${className || ''}\`}
      />
    );
  }

  // Default avatar with initials
  const initials = alt.split(' ').map(word => word[0]).join('').toUpperCase();
  
  return (
    <div className={\`\${sizeClasses[size]} rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold \${className || ''}\`}>
      {initials}
    </div>
  );
}`,
          editStartLine: 1,
        },
      },
      // fileEdit - error
      {
        toolName: "fileEdit",
        requestId: "fileEdit-error",
        status: "error",
        input: {
          filePath: "/nonexistent.txt",
        },
        startedAt: new Date(Date.now() - 1400).toISOString(),
        endedAt: new Date(Date.now() - 1300).toISOString(),
        result: {
          isError: true,
          message: "File not found",
        },
      },
      // fileEdit - abort
      {
        toolName: "fileEdit",
        requestId: "fileEdit-abort",
        status: "abort",
        input: { filePath: "/huge/file.txt" },
        startedAt: new Date(Date.now() - 1200).toISOString(),
        endedAt: new Date(Date.now() - 1100).toISOString(),
        result: {
          isError: true,
          isAborted: true,
          message: "Tool execution was aborted",
        },
      },
      // fileEdit - permission_denied
      {
        toolName: "fileEdit",
        requestId: "fileEdit-permission_denied",
        status: "permission_denied",
        input: { filePath: "/etc/passwd" },
        startedAt: new Date(Date.now() - 1000).toISOString(),
        endedAt: new Date(Date.now() - 900).toISOString(),
      },
      // grep - success
      {
        toolName: "grep",
        requestId: "grep-success",
        status: "success",
        input: { pattern: "TODO", glob: "*.ts", output_mode: "content" },
        startedAt: new Date(Date.now() - 800).toISOString(),
        endedAt: new Date(Date.now() - 700).toISOString(),
        result: {
          type: "grep",
          pattern: "TODO",
          include: "*.ts",
          path: ".",
          matches: [
            {
              filePath: "src/app.ts",
              line: "// TODO: implement",
              lineNumber: 5,
            },
          ],
        },
      },
      // grep - error
      {
        toolName: "grep",
        requestId: "grep-error",
        status: "error",
        input: { pattern: "[", glob: "*.ts", output_mode: "content" },
        startedAt: new Date(Date.now() - 600).toISOString(),
        endedAt: new Date(Date.now() - 500).toISOString(),
        result: {
          isError: true,
          message: "Invalid regex pattern: Unterminated character class",
        },
      },
      // grep - abort
      {
        toolName: "grep",
        requestId: "grep-abort",
        status: "abort",
        input: { pattern: "slow", glob: "**/*", output_mode: "content" },
        startedAt: new Date(Date.now() - 400).toISOString(),
        endedAt: new Date(Date.now() - 300).toISOString(),
        result: {
          isError: true,
          isAborted: true,
          message: "Tool execution was aborted",
        },
      },

      // listFiles - success
      {
        toolName: "listFiles",
        requestId: "listFiles-success",
        status: "success",
        input: { path: "/tmp" },
        startedAt: new Date(Date.now() - 50).toISOString(),
        endedAt: new Date(Date.now() - 40).toISOString(),
        result: {
          type: "listFiles",
          path: "/tmp",
          entries: [
            { name: "test.txt", kind: "file" },
            { name: "cache", kind: "dir" },
          ],
          total: 2,
        },
      },
      // listFiles - error
      {
        toolName: "listFiles",
        requestId: "listFiles-error",
        status: "error",
        input: { path: "/nonexistent" },
        startedAt: new Date(Date.now() - 30).toISOString(),
        endedAt: new Date(Date.now() - 20).toISOString(),
        result: {
          isError: true,
          message: "Directory not found",
        },
      },
      // listFiles - abort
      {
        toolName: "listFiles",
        requestId: "listFiles-abort",
        status: "abort",
        input: { path: "/huge/directory" },
        startedAt: new Date(Date.now() - 10).toISOString(),
        endedAt: new Date(Date.now() - 5).toISOString(),
        result: {
          isError: true,
          isAborted: true,
          message: "Tool execution was aborted",
        },
      },

      // glob - success
      {
        toolName: "glob",
        requestId: "glob-success",
        status: "success",
        input: { pattern: "*.ts" },
        startedAt: new Date(Date.now() - 2).toISOString(),
        endedAt: new Date(Date.now() - 1).toISOString(),
        result: {
          type: "glob",
          pattern: "*.ts",
          files: ["src/app.ts", "src/utils.ts"],
        },
      },
      // glob - error
      {
        toolName: "glob",
        requestId: "glob-error",
        status: "error",
        input: { pattern: "[invalid" },
        startedAt: new Date(Date.now() - 0.9).toISOString(),
        endedAt: new Date(Date.now() - 0.8).toISOString(),
        result: {
          isError: true,
          message: "Invalid glob pattern: Unterminated character class",
        },
      },
      // glob - abort
      {
        toolName: "glob",
        requestId: "glob-abort",
        status: "abort",
        input: { pattern: "**/*" },
        startedAt: new Date(Date.now() - 0.7).toISOString(),
        endedAt: new Date(Date.now() - 0.6).toISOString(),
        result: {
          isError: true,
          isAborted: true,
          message: "Tool execution was aborted",
        },
      },

      // fetch - success
      {
        toolName: "fetch",
        requestId: "fetch-success",
        status: "success",
        input: { url: "https://api.example.com/data" },
        startedAt: new Date(Date.now() - 0.35).toISOString(),
        endedAt: new Date(Date.now() - 0.3).toISOString(),
        result: {
          type: "fetch",
          url: "https://api.example.com/data",
          mimeType: "application/json",
          content: '{"message": "Success", "data": {"id": 1, "name": "Example"}}',
          truncated: false,
        },
      },
      // fetch - HTML content
      {
        toolName: "fetch",
        requestId: "fetch-html",
        status: "success",
        input: { url: "https://example.com" },
        startedAt: new Date(Date.now() - 0.3).toISOString(),
        endedAt: new Date(Date.now() - 0.25).toISOString(),
        result: {
          type: "fetch",
          url: "https://example.com",
          mimeType: "text/markdown",
          content: "# Example Domain\n\nThis domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.\n\n## What is Example Domain?\n\nExample Domain is a domain that has been reserved for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.\n\n## More Information\n\nThis domain is established to be used for illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.\n\n## Example Usage\n\nYou can use this domain in examples and documentation for various purposes. The domain is specifically designed for documentation and educational materials.\n\n## Important Notes\n\n- No prior coordination is needed\n- No permission is required\n- Designed for illustrative purposes\n- Perfect for documentation examples\n- Safe for educational content\n\n## Conclusion\n\nThis domain serves as a reliable example domain for all your documentation and educational needs. You can reference it freely in your materials.\n\n## Additional Details\n\nWhen creating documentation, tutorials, or technical examples, having a reliable example domain is crucial. This reserved domain provides exactly that functionality without any restrictions or complications.\n\n## Technical Implementation\n\nThe domain is managed and maintained to provide a stable, reliable example domain for developers, writers, and educators worldwide. It ensures that your examples will always work consistently across different platforms and applications.",
          truncated: false,
        },
      },
      // fetch - error
      {
        toolName: "fetch",
        requestId: "fetch-error",
        status: "error",
        input: { url: "https://nonexistent.example.com" },
        startedAt: new Date(Date.now() - 0.2).toISOString(),
        endedAt: new Date(Date.now() - 0.15).toISOString(),
        result: {
          isError: true,
          message: "Failed to fetch: ENOTFOUND",
        },
      },
      // fetch - abort
      {
        toolName: "fetch",
        requestId: "fetch-abort",
        status: "abort",
        input: { url: "https://slow.example.com/large-file" },
        startedAt: new Date(Date.now() - 0.1).toISOString(),
        endedAt: new Date(Date.now() - 0.05).toISOString(),
        result: {
          isError: true,
          isAborted: true,
          message: "Tool execution was aborted",
        },
      },

      // architect - success
      {
        toolName: "architect",
        requestId: "architect-success",
        status: "success",
        input: { prompt: "Analyze React component structure" },
        startedAt: new Date(Date.now() - 0.3).toISOString(),
        endedAt: new Date(Date.now() - 0.2).toISOString(),
        result: {
          type: "architect",
          plan: "1. Create base component\n2. Add props interface\n3. Implement lifecycle methods",
        },
      },
      // architect - error
      {
        toolName: "architect",
        requestId: "architect-error",
        status: "error",
        input: { prompt: "Invalid prompt" },
        startedAt: new Date(Date.now() - 0.15).toISOString(),
        endedAt: new Date(Date.now() - 0.1).toISOString(),
        result: {
          isError: true,
          message: "Invalid analysis request",
        },
      },
      // architect - abort
      {
        toolName: "architect",
        requestId: "architect-abort",
        status: "abort",
        input: { prompt: "Very long analysis request" },
        startedAt: new Date(Date.now() - 0.05).toISOString(),
        endedAt: new Date(Date.now() - 0.04).toISOString(),
        result: {
          isError: true,
          isAborted: true,
          message: "Tool execution was aborted",
        },
      },

      // todo_read - success
      {
        toolName: "todo_read",
        requestId: "todo_read-success",
        status: "success",
        input: {},
        startedAt: new Date(Date.now() - 0.01).toISOString(),
        endedAt: new Date(Date.now() - 0.005).toISOString(),
        result: {
          type: "todo_read",
          todos: [
            {
              id: "1",
              content: "Fix critical bug",
              status: "in_progress",
              priority: "high",
            },
            {
              id: "2",
              content: "Add unit tests",
              status: "pending",
              priority: "medium",
            },
            {
              id: "3",
              content: "Update docs",
              status: "completed",
              priority: "low",
            },
          ],
        },
      },
      // todo_read - error
      {
        toolName: "todo_read",
        requestId: "todo_read-error",
        status: "error",
        input: {},
        startedAt: new Date(Date.now() - 0.009).toISOString(),
        endedAt: new Date(Date.now() - 0.008).toISOString(),
        result: {
          isError: true,
          message: "Failed to read todo file",
        },
      },
      // todo_read - abort
      {
        toolName: "todo_read",
        requestId: "todo_read-abort",
        status: "abort",
        input: {},
        startedAt: new Date(Date.now() - 0.007).toISOString(),
        endedAt: new Date(Date.now() - 0.006).toISOString(),
        result: {
          isError: true,
          isAborted: true,
          message: "Tool execution was aborted",
        },
      },

      // todo_write - success
      {
        toolName: "todo_write",
        requestId: "todo_write-success",
        status: "success",
        input: {
          todos: [
            {
              id: "1",
              content: "Fix critical bug",
              status: "in_progress",
              priority: "high",
            },
            {
              id: "2",
              content: "Add unit tests",
              status: "pending",
              priority: "medium",
            },
            {
              id: "3",
              content: "Update docs",
              status: "completed",
              priority: "low",
            },
          ],
        },
        startedAt: new Date(Date.now() - 0.003).toISOString(),
        endedAt: new Date(Date.now() - 0.002).toISOString(),
        result: {
          type: "todo_write",
          todos: [
            {
              id: "1",
              content: "Fix critical bug",
              status: "in_progress",
              priority: "high",
            },
            {
              id: "2",
              content: "Add unit tests",
              status: "pending",
              priority: "medium",
            },
            {
              id: "3",
              content: "Update docs",
              status: "completed",
              priority: "low",
            },
          ],
        },
      },
      // todo_write - error
      {
        toolName: "todo_write",
        requestId: "todo_write-error",
        status: "error",
        input: {
          todos: [
            {
              id: "invalid",
              content: "",
              status: "pending",
              priority: "invalid",
            },
          ],
        },
        startedAt: new Date(Date.now() - 0.001).toISOString(),
        endedAt: new Date(Date.now() - 0.0005).toISOString(),
        result: {
          isError: true,
          message: "Invalid todo data",
        },
      },
      // todo_write - abort
      {
        toolName: "todo_write",
        requestId: "todo_write-abort",
        status: "abort",
        input: {
          todos: Array(1000).fill({
            id: "bulk",
            content: "Bulk todo item",
            status: "pending",
            priority: "medium",
          }),
        },
        startedAt: new Date(Date.now() - 0.0003).toISOString(),
        endedAt: new Date(Date.now() - 0.0002).toISOString(),
        result: {
          isError: true,
          isAborted: true,
          message: "Tool execution was aborted",
        },
      },

      // Unknown tools - error scenarios
      // fileWrite - error (unknown tool)
      {
        toolName: "fileWrite",
        requestId: "fileWrite-unknown",
        status: "error",
        input: { filePath: "/tmp/test.txt", content: "test content" },
        startedAt: new Date(Date.now() - 0.001).toISOString(),
        endedAt: new Date(Date.now() - 0.0005).toISOString(),
        result: {
          isError: true,
          message: "Unknown tool: fileWrite",
        },
      },
      // fileCreate - error (unknown tool)
      {
        toolName: "fileCreate",
        requestId: "fileCreate-unknown",
        status: "error",
        input: { filePath: "/tmp/new.txt", content: "new content" },
        startedAt: new Date(Date.now() - 0.0008).toISOString(),
        endedAt: new Date(Date.now() - 0.0003).toISOString(),
        result: {
          isError: true,
          message: "Unknown tool: fileCreate",
        },
      },
      // deploy - error (unknown tool)
      {
        toolName: "deploy",
        requestId: "deploy-unknown",
        status: "error",
        input: { environment: "production", service: "api" },
        startedAt: new Date(Date.now() - 0.0007).toISOString(),
        endedAt: new Date(Date.now() - 0.0002).toISOString(),
        result: {
          isError: true,
          message: "Unknown tool: deploy",
        },
      },
      // sendEmail - error (unknown tool)
      {
        toolName: "sendEmail",
        requestId: "sendEmail-unknown",
        status: "error",
        input: { to: "user@example.com", subject: "Test", body: "Test email" },
        startedAt: new Date(Date.now() - 0.0006).toISOString(),
        endedAt: new Date(Date.now() - 0.0001).toISOString(),
        result: {
          isError: true,
          message: "Unknown tool: sendEmail",
        },
      },

    ];

    // Create assistant message with comprehensive tool calls
    const comprehensiveMessages: UIFeedMessage[] = [
      {
        kind: "api",
        status: "complete",
        message: {
          role: "assistant",
          content:
            "Here are comprehensive examples of all tools with different terminal states, including unknown tools that result in errors:",
          tool_calls: [
            // bash tools
            {
              id: "bash-success",
              type: "function",
              function: {
                name: "bash",
                arguments: '{"command": "echo \'Success!\'", "timeout": 5000}',
              },
            },
            {
              id: "bash-git-commit-multiline",
              type: "function",
              function: {
                name: "bash",
                arguments:
                  '{"command": "git commit -m \\"feat: add comprehensive user authentication system with JWT tokens and refresh mechanism\\n\\nThis implementation introduces a complete authentication overhaul including user registration with email verification, secure password hashing using bcrypt, JWT-based access tokens with configurable expiration, refresh token rotation for enhanced security, role-based access control (RBAC) for fine-grained permissions, comprehensive error handling with internationalization support, audit logging for security compliance, password reset functionality with secure token validation, and multi-factor authentication (MFA) integration using TOTP\\n\\nKey improvements include: refactored authentication middleware to support async validation patterns, implemented proper session management with Redis backend for scalability, added comprehensive unit tests with 95% coverage, updated API documentation with OpenAPI 3.0 specifications, improved performance through strategic database query optimization and caching strategies\\"", "timeout": 10000}',
              },
            },
            {
              id: "bash-error",
              type: "function",
              function: {
                name: "bash",
                arguments: '{"command": "cat /nonexistent", "timeout": 5000}',
              },
            },
            {
              id: "bash-abort",
              type: "function",
              function: {
                name: "bash",
                arguments: '{"command": "sleep 30", "timeout": 30000}',
              },
            },
            {
              id: "bash-permission_denied",
              type: "function",
              function: {
                name: "bash",
                arguments: '{"command": "rm -rf /important", "timeout": 5000}',
              },
            },
            {
              id: "bash-timeout",
              type: "function",
              function: {
                name: "bash",
                arguments: '{"command": "make build", "timeout": 10000}',
              },
            },
            // fileRead tools
            {
              id: "fileRead-success",
              type: "function",
              function: {
                name: "fileRead",
                arguments:
                  '{"filePath": "/tmp/test.txt", "offset": 0, "limit": 10}',
              },
            },
            {
              id: "fileRead-error",
              type: "function",
              function: {
                name: "fileRead",
                arguments:
                  '{"filePath": "/nonexistent.txt", "offset": 0, "limit": 10}',
              },
            },
            {
              id: "fileRead-abort",
              type: "function",
              function: {
                name: "fileRead",
                arguments:
                  '{"filePath": "/huge/file.txt", "offset": 0, "limit": 10000}',
              },
            },

            // fileEdit tools
            {
              id: "fileEdit-success",
              type: "function",
              function: {
                name: "fileEdit",
                arguments: '{"filePath": "/src/components/UserProfile.tsx"}',
              },
            },
            {
              id: "fileEdit-create",
              type: "function",
              function: {
                name: "fileEdit",
                arguments: '{"filePath": "/src/components/Avatar.tsx"}',
              },
            },
            {
              id: "fileEdit-error",
              type: "function",
              function: {
                name: "fileEdit",
                arguments: '{"filePath": "/nonexistent.txt"}',
              },
            },
            {
              id: "fileEdit-abort",
              type: "function",
              function: {
                name: "fileEdit",
                arguments: '{"filePath": "/huge/file.txt"}',
              },
            },
            {
              id: "fileEdit-permission_denied",
              type: "function",
              function: {
                name: "fileEdit",
                arguments: '{"filePath": "/etc/passwd"}',
              },
            },
            // grep tools
            {
              id: "grep-success",
              type: "function",
              function: {
                name: "grep",
                arguments:
                  '{"pattern": "TODO", "glob": "*.ts", "output_mode": "content"}',
              },
            },
            {
              id: "grep-error",
              type: "function",
              function: {
                name: "grep",
                arguments:
                  '{"pattern": "[", "glob": "*.ts", "output_mode": "content"}',
              },
            },
            {
              id: "grep-abort",
              type: "function",
              function: {
                name: "grep",
                arguments:
                  '{"pattern": "slow", "glob": "**/*", "output_mode": "content"}',
              },
            },

            // listFiles tools
            {
              id: "listFiles-success",
              type: "function",
              function: { name: "listFiles", arguments: '{"path": "/tmp"}' },
            },
            {
              id: "listFiles-error",
              type: "function",
              function: {
                name: "listFiles",
                arguments: '{"path": "/nonexistent"}',
              },
            },
            {
              id: "listFiles-abort",
              type: "function",
              function: {
                name: "listFiles",
                arguments: '{"path": "/huge/directory"}',
              },
            },

            // glob tools
            {
              id: "glob-success",
              type: "function",
              function: { name: "glob", arguments: '{"pattern": "*.ts"}' },
            },
            {
              id: "glob-error",
              type: "function",
              function: { name: "glob", arguments: '{"pattern": "[invalid"}' },
            },
            {
              id: "glob-abort",
              type: "function",
              function: { name: "glob", arguments: '{"pattern": "**/*"}' },
            },

            // fetch tools
            {
              id: "fetch-success",
              type: "function",
              function: {
                name: "fetch",
                arguments: '{"url": "https://api.example.com/data"}',
              },
            },
            {
              id: "fetch-html",
              type: "function",
              function: {
                name: "fetch",
                arguments: '{"url": "https://example.com"}',
              },
            },
            {
              id: "fetch-error",
              type: "function",
              function: {
                name: "fetch",
                arguments: '{"url": "https://nonexistent.example.com"}',
              },
            },
            {
              id: "fetch-abort",
              type: "function",
              function: {
                name: "fetch",
                arguments: '{"url": "https://slow.example.com/large-file"}',
              },
            },

            // architect tools
            {
              id: "architect-success",
              type: "function",
              function: {
                name: "architect",
                arguments: '{"prompt": "Analyze React component structure"}',
              },
            },
            {
              id: "architect-error",
              type: "function",
              function: {
                name: "architect",
                arguments: '{"prompt": "Invalid prompt"}',
              },
            },
            {
              id: "architect-abort",
              type: "function",
              function: {
                name: "architect",
                arguments: '{"prompt": "Very long analysis request"}',
              },
            },

            // todo_read tools
            {
              id: "todo_read-success",
              type: "function",
              function: { name: "todo_read", arguments: "{}" },
            },
            {
              id: "todo_read-error",
              type: "function",
              function: { name: "todo_read", arguments: "{}" },
            },
            {
              id: "todo_read-abort",
              type: "function",
              function: { name: "todo_read", arguments: "{}" },
            },

            // todo_write tools
            {
              id: "todo_write-success",
              type: "function",
              function: {
                name: "todo_write",
                arguments:
                  '{"todos": [{"id": "1", "content": "Fix critical bug", "status": "in_progress", "priority": "high"}, {"id": "2", "content": "Add unit tests", "status": "pending", "priority": "medium"}, {"id": "3", "content": "Update docs", "status": "completed", "priority": "low"}]}',
              },
            },
            {
              id: "todo_write-error",
              type: "function",
              function: {
                name: "todo_write",
                arguments:
                  '{"todos": [{"id": "invalid", "content": "", "status": "pending", "priority": "invalid"}]}',
              },
            },
            {
              id: "todo_write-abort",
              type: "function",
              function: {
                name: "todo_write",
                arguments:
                  '{"todos": [{"id": "bulk", "content": "Bulk todo item", "status": "pending", "priority": "medium"}]}',
              },
            },

            // Unknown tools
            {
              id: "fileWrite-unknown",
              type: "function",
              function: {
                name: "fileWrite",
                arguments: '{"filePath": "/tmp/test.txt", "content": "test content"}',
              },
            },
            {
              id: "fileCreate-unknown",
              type: "function",
              function: {
                name: "fileCreate",
                arguments: '{"filePath": "/tmp/new.txt", "content": "new content"}',
              },
            },
            {
              id: "deploy-unknown",
              type: "function",
              function: {
                name: "deploy",
                arguments: '{"environment": "production", "service": "api"}',
              },
            },
            {
              id: "sendEmail-unknown",
              type: "function",
              function: {
                name: "sendEmail",
                arguments: '{"to": "user@example.com", "subject": "Test", "body": "Test email"}',
              },
            },

          ],
        },
      },
    ];

    // Create tool messages only for completed tool calls (terminal states)
    comprehensiveToolCalls.forEach((call) => {
      const toolMessage = formatToolResultMessage(call);
      comprehensiveMessages.push({
        kind: "api",
        status: "complete",
        message: toolMessage,
      });
    });

    // Add comprehensive tool states when requested
    if (showAllToolStates) {
      baseToolCalls.push(...comprehensiveToolCalls);
      baseMessages.push(...comprehensiveMessages);
    }
  }

  return {
    messages: baseMessages,
    toolCalls: baseToolCalls,
  };
}

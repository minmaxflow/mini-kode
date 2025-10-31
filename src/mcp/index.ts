/**
 * MCP Service
 *
 * Unified service for MCP initialization and management.
 * Handles both UI and non-interactive modes with appropriate timing.
 */

import { MCPClientManager, type MCPServerState } from "./client";
import { createMCPTools } from "./tools";
import { setMCPTools } from "../tools";
import { ConfigManager } from "../config/manager";

export class MCPService {
  private static instance: MCPService | null = null;
  private clientManager: MCPClientManager | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService();
    }
    return MCPService.instance;
  }

  /**
   * Initialize MCP service (blocking version)
   *
   * For non-interactive mode: Waits for initialization to complete
   *
   * @param cwd - Current working directory
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(cwd: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    // Create new initialization promise and wait for it
    this.initializationPromise = this.doInitialize(cwd);
    await this.initializationPromise;
  }

  /**
   * Initialize MCP service with progress callbacks (non-blocking version)
   *
   * For UI mode: Starts initialization asynchronously with progress updates
   *
   * @param cwd - Current working directory
   * @param onServerStateChange - Callback for server state updates
   * @returns Promise that resolves when initialization starts
   */
  async initializeWithProgress(
    cwd: string,
    onServerStateChange?: (serverState: MCPServerState) => void,
  ): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // If initialization is already in progress, return
    if (this.initializationPromise) {
      return;
    }

    // Create new initialization promise with progress callbacks
    this.initializationPromise = this.doInitializeWithProgress(cwd, onServerStateChange);
  }

  /**
   * Perform actual MCP initialization
   */
  private async doInitialize(cwd: string): Promise<void> {
    try {
      // Read MCP configuration
      const mcpConfig = ConfigManager.readMCPConfig(cwd);
      if (!mcpConfig) {
        // No MCP config found
        this.isInitialized = true;
        return;
      }

      // Create and initialize MCP client manager
      this.clientManager = new MCPClientManager();
      await this.clientManager.initializeFromConfig(mcpConfig);

      // Create and register MCP tools
      const mcpTools = createMCPTools(this.clientManager);
      setMCPTools(mcpTools);

      this.isInitialized = true;
    } catch (error) {
      console.error("MCP initialization failed:", error);
      // Mark as initialized even if failed to avoid repeated attempts
      this.isInitialized = true;
    }
  }

  /**
   * Perform MCP initialization with progress callbacks
   */
  private async doInitializeWithProgress(
    cwd: string,
    onServerStateChange?: (serverState: MCPServerState) => void,
  ): Promise<void> {
    try {
      // Read MCP configuration
      const mcpConfig = ConfigManager.readMCPConfig(cwd);
      if (!mcpConfig) {
        // No MCP config found
        this.isInitialized = true;
        return;
      }

      // Create MCP client manager with progress callbacks
      this.clientManager = new MCPClientManager();
      
      // Set up server state change listener if provided
      if (onServerStateChange) {
        this.clientManager.onServerStateChange = onServerStateChange;
      }

      await this.clientManager.initializeFromConfig(mcpConfig);

      // Create and register MCP tools
      const mcpTools = createMCPTools(this.clientManager);
      setMCPTools(mcpTools);

      this.isInitialized = true;
    } catch (error) {
      console.error("MCP initialization failed:", error);
      // Mark as initialized even if failed to avoid repeated attempts
      this.isInitialized = true;
    }
  }

  /**
   * Get MCP client manager
   *
   * @returns MCP client manager or null if not initialized
   */
  getClientManager(): MCPClientManager | null {
    return this.clientManager;
  }

  /**
   * Check if MCP service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get server states for UI display
   */
  getServerStates() {
    return this.clientManager?.getServerStates() || [];
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    return (
      this.clientManager?.getConnectionStats() || {
        total: 0,
        connected: 0,
        connecting: 0,
        error: 0,
        disconnected: 0,
      }
    );
  }

  /**
   * Gracefully shutdown MCP connections
   */
  async shutdown(): Promise<void> {
    if (this.clientManager) {
      await this.clientManager.shutdown();
    }
    this.clientManager = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    MCPService.instance = null;
  }
}

// Export singleton instance
export const mcpService = MCPService.getInstance();

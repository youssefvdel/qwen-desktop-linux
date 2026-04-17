/**
 * MCP Proxy — multi-server connection manager
 *
 * Manages connections to multiple MCP (Model Context Protocol) servers.
 * Provides a unified API for listing tools and calling tools across servers.
 *
 * Key features:
 * - Lazy connection: servers are connected on-demand via getClient()
 * - Client caching: stdio clients are cached and reused; HTTP/SSE are stateless
 * - HTTP proxy endpoints: /listTools and /callTool for external access (unused)
 * - Express app exposed via getApp() for custom routing
 *
 * Replaces the official app's @ali/spark-mcp with an open-source implementation
 * built on @modelcontextprotocol/sdk.
 */

import express from "express";
import cors from "cors";
import type http from "http";
import { McpServerClient } from "./server-client.js";
import type { McpConfig, ToolCallParams } from "../shared/types.js";

/** HTTP Server configuration */
export interface HttpServerConfig {
  port: number;
  enabled: boolean;
  authToken?: string; // Optional Bearer token for authentication
}

/**
 * MCP Proxy Server
 * Manages multiple MCP server connections and provides HTTP + programmatic API
 * This replaces @ali/spark-mcp with a clean, open-source implementation
 */
class McpProxy {
  private app: express.Express;
  private httpServer: http.Server | null = null;
  private mcpServers: McpConfig = {};
  private clients: Map<string, McpServerClient> = new Map();
  private httpPort: number = 3000;
  private httpEnabled: boolean = false;
  private authToken?: string;

  constructor(httpConfig?: Partial<HttpServerConfig>) {
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());

    // HTTP server configuration
    if (httpConfig) {
      this.httpPort = httpConfig.port ?? 3000;
      this.httpEnabled = httpConfig.enabled ?? false;
      this.authToken = httpConfig.authToken;
    }

    // HTTP endpoints for proxy access (same as official app)
    this.app.get("/listTools", this.listToolsByHTTP.bind(this));
    this.app.post("/callTool", this.callToolByHTTP.bind(this));
    
    // New CLI API endpoints
    this.app.get("/api/config", this.getConfig.bind(this));
    this.app.post("/api/chat", this.chatHandler.bind(this));
    this.app.get("/api/tools", this.getAllTools.bind(this));
    this.app.post("/api/tools/call", this.callToolAPI.bind(this));
  }

  /**
   * Set or update MCP server configurations
   * Resets all clients when config changes
   */
  async setMCPServers(config: McpConfig): Promise<void> {
    console.log("[MCP Proxy] === setMCPServers called ===");
    console.log("[MCP Proxy] New servers:", Object.keys(config));
    console.log("[MCP Proxy] Full config:", JSON.stringify(config, null, 2));

    // Disconnect all existing clients
    await this.disconnectAll();

    this.mcpServers = { ...config };
    this.clients.clear();

    console.log("[MCP Proxy] Servers updated successfully");
    console.log(
      "[MCP Proxy] Current mcpServers:",
      Object.keys(this.mcpServers),
    );
  }

  /**
   * Get current MCP server configurations
   */
  getMCPServers(): McpConfig {
    console.log(
      "[MCP Proxy] getMCPServers called, returning:",
      Object.keys(this.mcpServers),
    );
    return this.mcpServers;
  }

  /**
   * List tools for a specific server
   */
  async listTools(params: { serverName: string }): Promise<{ tools: any[] }> {
    console.log(`[MCP Proxy] listTools called for: "${params.serverName}"`);
    const client = await this.getClient(params.serverName);
    if (!client) {
      console.error(
        `[MCP Proxy] ❌ listTools failed - client not found for: "${params.serverName}"`,
      );
      throw new Error(`MCP client not found: ${params.serverName}`);
    }
    const result = await client.listTools();
    console.log(
      `[MCP Proxy] ✅ listTools success for: "${params.serverName}", tools:`,
      result.tools?.length || 0,
    );
    return result;
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(params: ToolCallParams): Promise<unknown> {
    console.log(
      `[MCP Proxy] callTool called: server="${params.serverName}", tool="${params.toolName}"`,
    );
    const client = await this.getClient(params.serverName);
    if (!client) {
      console.error(
        `[MCP Proxy] ❌ callTool failed - client not found for: "${params.serverName}"`,
      );
      throw new Error(`MCP client not found: ${params.serverName}`);
    }
    return client.callTool(params);
  }

  /**
   * Get or create a client for a server
   */
  private async getClient(serverName: string): Promise<McpServerClient | null> {
    console.log(`[MCP Proxy] getClient called for: "${serverName}"`);
    console.log(`[MCP Proxy] Available servers:`, Object.keys(this.mcpServers));

    const config = this.mcpServers[serverName];
    if (!config) {
      console.error(`[MCP Proxy] ❌ Server config not found: "${serverName}"`);
      console.error(
        `[MCP Proxy] Available configs:`,
        JSON.stringify(this.mcpServers, null, 2),
      );
      return null;
    }

    // Return cached client if it exists and is connected
    if (this.clients.has(serverName)) {
      const cached = this.clients.get(serverName)!;
      if (cached.getStatus() === "connected") {
        console.log(`[MCP Proxy] ✅ Using cached client for: "${serverName}"`);
        return cached;
      }
      console.log(`[MCP Proxy] Cached client not connected, reconnecting...`);
    }

    try {
      console.log(`[MCP Proxy] 🔌 Connecting to server: "${serverName}"`);
      console.log(`[MCP Proxy] Command: ${config.command}`);
      console.log(`[MCP Proxy] Args:`, config.args);
      console.log(`[MCP Proxy] Transport: ${config.transportType || "stdio"}`);

      const client = new McpServerClient(serverName, config);
      await client.connect();

      console.log(`[MCP Proxy] ✅ Connected to: "${serverName}"`);

      // Only cache stdio clients (HTTP/SSE are stateless per request)
      if (config.transportType === "stdio" || !config.url) {
        this.clients.set(serverName, client);
      }

      return client;
    } catch (error) {
      console.error(
        `[MCP Proxy] ❌ Failed to connect to "${serverName}":`,
        error,
      );
      console.error(
        `[MCP Proxy] Error details:`,
        error instanceof Error ? error.stack : error,
      );
      return null;
    }
  }

  /**
   * Start HTTP server for MCP proxy access
   */
  startHTTP(port?: number): void {
    if (port !== undefined) {
      this.httpPort = port;
    }
    this.httpEnabled = true;
    this.httpServer = this.app.listen(this.httpPort, () => {
      console.log(`[MCP] HTTP server started on port ${this.httpPort}`);
    });
  }

  /**
   * Stop HTTP server
   */
  stopHTTP(): void {
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
      this.httpEnabled = false;
      console.log("[MCP] HTTP server stopped");
    }
  }

  /**
   * Check if HTTP server is running
   */
  isHTTPEnabled(): boolean {
    return this.httpEnabled;
  }

  /**
   * Get HTTP server port
   */
  getHTTPPort(): number {
    return this.httpPort;
  }

  /**
   * Authentication middleware for CLI API endpoints
   */
  private authenticate(req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (!this.authToken) {
      // No auth required
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }

    const token = authHeader.substring(7);
    if (token !== this.authToken) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }

    next();
  }

  /**
   * Disconnect all MCP clients
   */
  async disconnectAll(): Promise<void> {
    console.log("[MCP Proxy] Disconnecting all clients");
    const promises = Array.from(this.clients.values()).map((client) =>
      client.disconnect(),
    );
    await Promise.allSettled(promises);
    this.clients.clear();
  }

  /**
   * HTTP handler for /listTools
   */
  private async listToolsByHTTP(
    req: express.Request,
    res: express.Response,
  ): Promise<void> {
    try {
      const serverName = req.query.serverName as string;
      if (!serverName) {
        res.status(400).json({ error: "Missing serverName parameter" });
        return;
      }
      const result = await this.listTools({ serverName });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * HTTP handler for /callTool
   */
  private async callToolByHTTP(
    req: express.Request,
    res: express.Response,
  ): Promise<void> {
    try {
      const params: ToolCallParams = req.body;
      if (!params.serverName || !params.toolName) {
        res.status(400).json({ error: "Missing serverName or toolName" });
        return;
      }
      const result = await this.callTool(params);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/config - Get MCP server configuration
   * Returns the current MCP server configs for CLI tools
   */
  private async getConfig(
    req: express.Request,
    res: express.Response,
  ): Promise<void> {
    try {
      const config = this.getMCPServers();
      res.json({
        success: true,
        config,
        port: this.httpPort,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/chat - Send a message to Qwen Chat
   * This is a placeholder - actual chat implementation would require
   * reverse-engineering the Qwen web API or using MCP tools
   */
  private async chatHandler(
    req: express.Request,
    res: express.Response,
  ): Promise<void> {
    try {
      const { message, conversationId } = req.body;
      
      if (!message) {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      // Note: Direct chat API requires reverse-engineering Qwen's web protocol
      // For now, we recommend using MCP tools to interact with external systems
      // The official app doesn't expose a direct chat API
      
      res.json({
        success: false,
        error: "Direct chat API not available. Use MCP tools instead.",
        suggestion: "Use /api/tools to list available tools and /api/tools/call to invoke them",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/tools - List all available MCP tools from all servers
   * Returns a flat list of tools with server information
   */
  private async getAllTools(
    req: express.Request,
    res: express.Response,
  ): Promise<void> {
    try {
      const config = this.getMCPServers();
      const allTools: Array<{
        serverName: string;
        tools: Array<{
          name: string;
          description?: string;
          inputSchema: any;
        }>;
      }> = [];

      for (const serverName of Object.keys(config)) {
        try {
          const result = await this.listTools({ serverName });
          allTools.push({
            serverName,
            tools: result.tools || [],
          });
        } catch (error: any) {
          console.error(`Failed to list tools for server "${serverName}":`, error.message);
          // Continue with other servers
        }
      }

      res.json({
        success: true,
        servers: Object.keys(config),
        tools: allTools,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/tools/call - Call an MCP tool (CLI-friendly endpoint)
   * Body: { serverName, toolName, arguments? }
   */
  private async callToolAPI(
    req: express.Request,
    res: express.Response,
  ): Promise<void> {
    try {
      const { serverName, toolName, arguments: toolArgs } = req.body;
      
      if (!serverName || !toolName) {
        res.status(400).json({ 
          error: "Missing serverName or toolName",
          example: { serverName: "Filesystem", toolName: "read_file", arguments: { path: "/path/to/file" } }
        });
        return;
      }

      const params: ToolCallParams = {
        serverName,
        toolName,
        toolArguments: toolArgs,
      };

      const result = await this.callTool(params);
      
      res.json({
        success: true,
        result,
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: error.message,
        success: false,
      });
    }
  }

  /**
   * Get Express app instance (for custom routing)
   */
  getApp(): express.Express {
    return this.app;
  }
}

export { McpProxy };

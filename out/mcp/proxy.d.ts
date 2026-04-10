import express from "express";
import type { McpConfig, ToolCallParams } from "../shared/types.js";
/**
 * MCP Proxy Server
 * Manages multiple MCP server connections and provides HTTP + programmatic API
 * This replaces @ali/spark-mcp with a clean, open-source implementation
 */
declare class McpProxy {
    private app;
    private httpServer;
    private mcpServers;
    private clients;
    private httpPort;
    constructor();
    /**
     * Set or update MCP server configurations
     * Resets all clients when config changes
     */
    setMCPServers(config: McpConfig): Promise<void>;
    /**
     * Get current MCP server configurations
     */
    getMCPServers(): McpConfig;
    /**
     * List tools for a specific server
     */
    listTools(params: {
        serverName: string;
    }): Promise<{
        tools: any[];
    }>;
    /**
     * Call a tool on a specific server
     */
    callTool(params: ToolCallParams): Promise<unknown>;
    /**
     * Get or create a client for a server
     */
    private getClient;
    /**
     * Start HTTP server for MCP proxy access
     */
    startHTTP(port?: number): void;
    /**
     * Stop HTTP server
     */
    stopHTTP(): void;
    /**
     * Disconnect all MCP clients
     */
    disconnectAll(): Promise<void>;
    /**
     * HTTP handler for /listTools
     */
    private listToolsByHTTP;
    /**
     * HTTP handler for /callTool
     */
    private callToolByHTTP;
    /**
     * Get Express app instance (for custom routing)
     */
    getApp(): express.Express;
}
export { McpProxy };
//# sourceMappingURL=proxy.d.ts.map
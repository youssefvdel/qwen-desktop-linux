import type { McpServerConfig, McpTool, ToolCallParams } from "../shared/types.js";
/**
 * MCP Client wrapper for a single server
 * Mirrors the @modelcontextprotocol/sdk Client API
 */
declare class McpServerClient {
    private serverName;
    private config;
    private client;
    private transport;
    private tools;
    private status;
    constructor(serverName: string, config: McpServerConfig);
    /**
     * Connect to the MCP server
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the MCP server
     */
    disconnect(): Promise<void>;
    /**
     * List available tools from this server
     */
    listTools(): Promise<{
        tools: McpTool[];
    }>;
    /**
     * Call a tool on this server
     */
    callTool(params: ToolCallParams): Promise<unknown>;
    /**
     * Get connection status
     */
    getStatus(): string;
    /**
     * Create the appropriate transport based on config
     */
    private createTransport;
}
export { McpServerClient };
//# sourceMappingURL=server-client.d.ts.map
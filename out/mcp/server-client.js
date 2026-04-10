"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpServerClient = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/client/sse.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
/**
 * MCP Client wrapper for a single server
 * Mirrors the @modelcontextprotocol/sdk Client API
 */
class McpServerClient {
    serverName;
    config;
    client = null;
    transport = null;
    tools = null;
    status = "disconnected";
    constructor(serverName, config) {
        this.serverName = serverName;
        this.config = config;
    }
    /**
     * Connect to the MCP server
     */
    async connect() {
        if (this.status === "connected" || this.status === "connecting") {
            return;
        }
        this.status = "connecting";
        try {
            this.client = new index_js_1.Client({ name: this.serverName, version: "1.0.0" }, {});
            this.transport = this.createTransport(this.config);
            await this.client.connect(this.transport, {
                timeout: this.config.timeout || 600000,
            });
            this.status = "connected";
            this.tools = null; // Reset cached tools
        }
        catch (error) {
            this.status = "disconnected";
            this.client = null;
            this.transport = null;
            throw error;
        }
    }
    /**
     * Disconnect from the MCP server
     */
    async disconnect() {
        try {
            if (this.client) {
                await this.client.close();
            }
            if (this.transport) {
                await this.transport.close();
            }
        }
        catch (error) {
            console.error(`[MCP] Error disconnecting from ${this.serverName}:`, error);
        }
        finally {
            this.client = null;
            this.transport = null;
            this.tools = null;
            this.status = "disconnected";
        }
    }
    /**
     * List available tools from this server
     */
    async listTools() {
        if (!this.client || this.status !== "connected") {
            await this.connect();
        }
        if (this.tools) {
            return { tools: this.tools };
        }
        const response = await this.client.listTools();
        this.tools = response.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
        }));
        return { tools: this.tools };
    }
    /**
     * Call a tool on this server
     */
    async callTool(params) {
        if (!this.client || this.status !== "connected") {
            await this.connect();
        }
        return this.client.callTool({
            name: params.toolName,
            arguments: params.toolArguments || {},
        });
    }
    /**
     * Get connection status
     */
    getStatus() {
        return this.status;
    }
    /**
     * Create the appropriate transport based on config
     */
    createTransport(config) {
        const transportType = config.transportType || "stdio";
        if (transportType === "httpStream") {
            if (!config.url) {
                throw new Error(`[MCP] URL required for httpStream transport: ${this.serverName}`);
            }
            return new streamableHttp_js_1.StreamableHTTPClientTransport(new URL(config.url));
        }
        if (transportType === "sse") {
            if (!config.url) {
                throw new Error(`[MCP] URL required for SSE transport: ${this.serverName}`);
            }
            return new sse_js_1.SSEClientTransport(new URL(config.url));
        }
        // Default: stdio
        return new stdio_js_1.StdioClientTransport({
            command: config.command,
            args: config.args || [],
            env: {
                ...process.env,
                ...config.env,
            },
            cwd: config.cwd,
        });
    }
}
exports.McpServerClient = McpServerClient;
//# sourceMappingURL=server-client.js.map
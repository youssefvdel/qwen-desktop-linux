import { BrowserWindow } from "electron";
import type { McpProxy } from "../mcp/proxy.js";
import type { McpConfig } from "../shared/types.js";
export declare const MCP_CONFIG_KEY = "mcp_config";
export interface IpcHandlerDeps {
    getMainWindow: () => BrowserWindow | null;
    mcpServer: McpProxy;
    adaptConfig: (config: McpConfig) => McpConfig;
    settings: typeof import("electron-settings");
    loadMcpConfig: () => Promise<McpConfig>;
    getDefaultMcpConfig: () => McpConfig;
    APP_VERSION: string;
}
/**
 * Register all IPC main handlers.
 */
export declare function registerIpcHandlers(deps: IpcHandlerDeps): void;
//# sourceMappingURL=ipc-handlers.d.ts.map
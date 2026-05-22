/**
 * IPC Handlers — all ipcMain handlers for renderer ↔ main communication
 *
 * Registered via registerIpcHandlers(). Uses dependency injection (IpcHandlerDeps)
 * so this module has no direct references to global state.
 *
 * Handler categories:
 * - App Management: version, platform, devtools, dialogs, file picker
 * - MCP: connect/close/listTools/callTool/getConfig/updateConfig
 * - Theme & Localization: switch theme, switch language, system theme sync
 * - Event Forwarding: renderer → main → renderer event relay
 */
import { BrowserWindow } from "electron";
import type { McpProxy } from "../mcp/proxy.js";
import type { McpConfig } from "../shared/types.js";
/** Settings key for MCP config in electron-settings */
export declare const MCP_CONFIG_KEY = "mcp_config";
/**
 * Dependencies injected from index.ts. This module has no direct access to
 * global state — everything comes through this interface.
 */
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
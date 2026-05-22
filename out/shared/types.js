"use strict";
/**
 * Shared TypeScript types — used across main, preload, and MCP modules
 *
 * Defines the shape of:
 * - MCP configuration (McpServerConfig, McpConfig)
 * - Tool definitions and call parameters (McpTool, ToolCallParams)
 * - The Electron API exposed to the renderer (ElectronAPI)
 * - Dialog options, file picker results, runtime paths
 * - Event types for the main ↔ renderer event system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppEventType = void 0;
/**
 * Event types for the event system
 */
var AppEventType;
(function (AppEventType) {
    AppEventType["MCP_SERVER_ADDED"] = "mcp_server_added";
    AppEventType["MCP_SERVER_REMOVED"] = "mcp_server_removed";
    AppEventType["MCP_SERVER_ERROR"] = "mcp_server_error";
    AppEventType["MCP_TOOL_CALLED"] = "mcp_tool_called";
    AppEventType["THEME_CHANGED"] = "theme_changed";
    AppEventType["LANGUAGE_CHANGED"] = "language_changed";
    AppEventType["WINDOW_FOCUS"] = "window_focus";
    AppEventType["WEBVIEW_READY"] = "webview_ready";
})(AppEventType || (exports.AppEventType = AppEventType = {}));
//# sourceMappingURL=types.js.map
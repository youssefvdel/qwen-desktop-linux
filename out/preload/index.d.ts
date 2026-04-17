/**
 * Preload Script — contextBridge between main process and renderer (chat.qwen.ai)
 *
 * This script runs in the webview's preload context (before page scripts).
 * It exposes `window.electronAPI` and `window.electron` to the renderer via
 * contextBridge, enabling the web page to:
 * - Call MCP tools (list, call, config)
 * - Open native dialogs and file pickers
 * - Switch themes and languages
 * - Send/receive custom events
 *
 * Security: contextIsolation is enabled, so the renderer has no direct Node.js access.
 * All communication goes through these typed IPC channels.
 */
export {};
//# sourceMappingURL=index.d.ts.map
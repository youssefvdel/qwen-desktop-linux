"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * Simple event emitter for the renderer
 */
class EventEmitter {
    listeners = {};
    on(eventName, listener) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(listener);
    }
    emit(eventName, payload) {
        const listeners = this.listeners[eventName];
        if (listeners) {
            listeners.forEach((listener) => listener(payload));
        }
    }
}
const events = new EventEmitter();
/**
 * API object exposed as window.electronAPI
 * This is what chat.qwen.ai expects when running in the desktop app
 */
const electronAPI = {
    // Preload file path (used by webview to load its own preload)
    PRELOAD_FILE_PATH: "", // Will be set dynamically
    // === App Management ===
    open_devtool: () => electron_1.ipcRenderer.invoke("open_devtool"),
    toggle_hidden_devtools: () => electron_1.ipcRenderer.invoke("toggle_hidden_devtools"),
    get_app_version: () => electron_1.ipcRenderer.invoke("get_app_version"),
    get_platform_info: () => electron_1.ipcRenderer.invoke("get_platform_info"),
    open_external_link: (url) => electron_1.ipcRenderer.invoke("open_external_link", url),
    show_native_dialog: (options) => electron_1.ipcRenderer.invoke("show_native_dialog", options),
    request_file_access: (purpose, returnFile) => electron_1.ipcRenderer.invoke("request_file_access", purpose, returnFile),
    // === MCP Methods ===
    mcp_client_connect: () => electron_1.ipcRenderer.invoke("mcp_client_connect"),
    mcp_client_close: () => electron_1.ipcRenderer.invoke("mcp_client_close"),
    mcp_client_tool_list: (serverName) => electron_1.ipcRenderer.invoke("mcp_client_tool_list", serverName),
    mcp_client_tool_call: (params) => electron_1.ipcRenderer.invoke("mcp_client_tool_call", params),
    mcp_client_get_config: () => electron_1.ipcRenderer.invoke("mcp_client_get_config"),
    mcp_client_update_config: (config) => electron_1.ipcRenderer.invoke("mcp_client_update_config", config),
    // === Theme & Localization ===
    switch_theme: (theme) => electron_1.ipcRenderer.invoke("switch_theme", theme),
    switch_ln: (language) => electron_1.ipcRenderer.invoke("switch_ln", language),
    update_title_bar_for_system_theme: (isDark) => electron_1.ipcRenderer.invoke("update_title_bar_for_system_theme", isDark),
    // === Event System ===
    on_event: (type, callback) => {
        events.on(type, callback);
    },
    send_event: (data) => {
        electron_1.ipcRenderer.send("event_to_main", data);
    },
};
/**
 * Listen for events from main process
 */
electron_1.ipcRenderer.on("event_from_main", (_, { type, payload }) => {
    events.emit(type, payload);
});
/**
 * Expose APIs to renderer
 */
console.log("[Preload] 🔍 Preload script executing...");
console.log("[Preload] contextIsolated:", process.contextIsolated);
if (process.contextIsolated) {
    try {
        console.log("[Preload] 🔧 Using contextBridge (contextIsolated=true)");
        // Expose electron API from @electron-toolkit/preload
        // This is the standard electron API (ipcRenderer, etc.)
        electron_1.contextBridge.exposeInMainWorld("electron", {
            ipcRenderer: {
                send: (channel, ...args) => electron_1.ipcRenderer.send(channel, ...args),
                invoke: (channel, ...args) => electron_1.ipcRenderer.invoke(channel, ...args),
                on: (channel, func) => {
                    electron_1.ipcRenderer.on(channel, (_, ...args) => func(...args));
                },
            },
        });
        // Expose our custom API
        electron_1.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
        console.log("[Preload] ✅ electronAPI exposed via contextBridge");
    }
    catch (error) {
        console.error("[Preload] ❌ Failed to expose APIs via contextBridge:", error);
    }
}
else {
    console.log("[Preload] 🔧 Direct assignment (contextIsolated=false)");
    // Fallback for non-context-isolated environments
    window.electron = {
        ipcRenderer: {
            send: (channel, ...args) => electron_1.ipcRenderer.send(channel, ...args),
            invoke: (channel, ...args) => electron_1.ipcRenderer.invoke(channel, ...args),
            on: (channel, func) => {
                electron_1.ipcRenderer.on(channel, (_, ...args) => func(...args));
            },
        },
    };
    window.electronAPI = electronAPI;
    console.log("[Preload] ✅ electronAPI exposed directly");
}
//# sourceMappingURL=index.js.map
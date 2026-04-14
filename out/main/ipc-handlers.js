"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCP_CONFIG_KEY = void 0;
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");
exports.MCP_CONFIG_KEY = "mcp_config";
/**
 * Register all IPC main handlers.
 */
function registerIpcHandlers(deps) {
    // === App Management ===
    electron_1.ipcMain.handle("get_app_version", async () => deps.APP_VERSION);
    electron_1.ipcMain.handle("get_platform_info", async () => ({
        platform: process.platform,
        arch: process.arch,
    }));
    electron_1.ipcMain.handle("open_devtool", async () => {
        const win = deps.getMainWindow();
        win?.webContents.openDevTools({ mode: "right" });
    });
    electron_1.ipcMain.handle("toggle_hidden_devtools", async () => {
        const win = deps.getMainWindow();
        if (!win)
            return;
        if (win.webContents.isDevToolsOpened()) {
            win.webContents.closeDevTools();
        }
        else {
            win.webContents.openDevTools({ mode: "detach" });
        }
    });
    electron_1.ipcMain.handle("open_external_link", async (_event, url) => {
        const { shell } = await Promise.resolve().then(() => __importStar(require("electron")));
        await shell.openExternal(url);
    });
    electron_1.ipcMain.handle("show_native_dialog", async (_event, options) => {
        const win = deps.getMainWindow();
        await electron_1.dialog.showMessageBox(win, {
            title: options.title || "Qwen",
            message: options.message,
            type: options.type || "info",
            buttons: options.buttons || ["OK"],
            defaultId: options.defaultId || 0,
        });
    });
    electron_1.ipcMain.handle("request_file_access", async (_event, purpose, returnFile) => {
        const win = deps.getMainWindow();
        const { filePaths } = await electron_1.dialog.showOpenDialog(win, {
            properties: ["openFile"],
            title: purpose,
        });
        if (!filePaths || filePaths.length === 0) {
            return { filePath: "" };
        }
        const result = { filePath: filePaths[0] };
        if (returnFile) {
            const fs = await Promise.resolve().then(() => __importStar(require("fs")));
            result.file = await fs.promises.readFile(filePaths[0], "utf-8");
        }
        return result;
    });
    // === MCP Handlers ===
    electron_1.ipcMain.handle("mcp_client_connect", async () => {
        try {
            const config = await deps.loadMcpConfig();
            if (Object.keys(config).length > 0) {
                const adapted = deps.adaptConfig(config);
                await deps.mcpServer.setMCPServers(adapted);
                console.log("[IPC] MCP servers connected:", Object.keys(config));
            }
        }
        catch (error) {
            console.error("[IPC] mcpClientConnect error:", error);
        }
    });
    electron_1.ipcMain.handle("mcp_client_close", async () => {
        await deps.mcpServer.disconnectAll();
    });
    electron_1.ipcMain.handle("mcp_client_tool_list", async (_event, serverName) => {
        try {
            console.log(`[IPC] Listing tools for server: "${serverName}"`);
            console.log("[IPC] Available servers:", Object.keys(deps.mcpServer.getMCPServers()));
            const list = await deps.mcpServer.listTools({ serverName });
            console.log(`[IPC] Tools for "${serverName}":`, list);
            return list;
        }
        catch (error) {
            console.error(`[IPC] mcpClientToolList error for "${serverName}":`, error);
            throw error;
        }
    });
    electron_1.ipcMain.handle("mcp_client_tool_call", async (_event, params) => {
        try {
            const result = await deps.mcpServer.callTool(params);
            return result;
        }
        catch (error) {
            console.error("[IPC] mcpClientToolCall error:", error);
            throw error;
        }
    });
    electron_1.ipcMain.handle("mcp_client_get_config", async () => {
        return deps.mcpServer.getMCPServers();
    });
    electron_1.ipcMain.handle("mcp_client_update_config", async (_event, config) => {
        try {
            console.log("[IPC] Updating MCP config:", JSON.stringify(config, null, 2));
            console.log("[IPC] Config keys:", Object.keys(config));
            for (const [name, serverConfig] of Object.entries(config)) {
                console.log(`[IPC] Server "${name}":`, {
                    command: serverConfig.command,
                    args: serverConfig.args,
                    transportType: serverConfig.transportType,
                });
            }
            const adapted = deps.adaptConfig(config);
            console.log("[IPC] Adapted config:", JSON.stringify(adapted, null, 2));
            await deps.mcpServer.setMCPServers(adapted);
            await deps.settings.set(exports.MCP_CONFIG_KEY, config);
            console.log("[IPC] MCP config saved successfully");
            return deps.mcpServer.getMCPServers();
        }
        catch (error) {
            console.error("[IPC] mcpClientUpdateConfig error:", error);
            throw error;
        }
    });
    // === Theme & Localization ===
    electron_1.ipcMain.handle("switch_theme", async (_event, theme) => {
        await deps.settings.set("app_theme", theme);
        const win = deps.getMainWindow();
        win?.webContents.send("event_from_main", {
            type: "theme_changed",
            payload: theme,
        });
    });
    electron_1.ipcMain.handle("switch_ln", async (_event, language) => {
        await deps.settings.set("app_language", language);
        const win = deps.getMainWindow();
        win?.webContents.send("event_from_main", {
            type: "language_changed",
            payload: language,
        });
    });
    electron_1.ipcMain.handle("update_title_bar_for_system_theme", async (_event, isDark) => {
        const win = deps.getMainWindow();
        if (win) {
            win.webContents.send("event_from_main", {
                type: "system_theme_changed",
                payload: isDark,
            });
        }
    });
    // === Event Forwarding ===
    electron_1.ipcMain.on("event_to_main", (_event, data) => {
        const win = deps.getMainWindow();
        win?.webContents.send("event_from_main", data);
    });
}
//# sourceMappingURL=ipc-handlers.js.map
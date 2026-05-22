"use strict";
/**
 * Qwen Desktop for Linux — Main Entry Point
 *
 * This is the Electron app bootstrap. It:
 * - Configures app flags (GPU, sandbox, etc.)
 * - Creates the main BrowserWindow loading chat.qwen.ai
 * - Registers IPC handlers for renderer ↔ main communication
 * - Sets up MCP server management
 * - Handles app lifecycle (quit, activate, deep links)
 * - Builds the application menu
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electron_settings_1 = __importDefault(require("electron-settings"));
const proxy_js_1 = require("../mcp/proxy.js");
const mcp_config_js_1 = require("./mcp-config.js");
const runtime_js_1 = require("./runtime.js");
const updater_js_1 = require("./updater.js");
const window_manager_js_1 = require("./window-manager.js");
const ipc_handlers_js_1 = require("./ipc-handlers.js");
const logger_js_1 = require("./logger.js");
const app_lifecycle_js_1 = require("./app-lifecycle.js");
const skills_manager_js_1 = require("./skills-manager.js");
// === Constants ===
const APP_VERSION = electron_1.app.getVersion();
const WEBVIEW_URL = "https://chat.qwen.ai";
// === MCP Proxy Instance ===
// Singleton that manages all MCP server connections
const mcpServer = new proxy_js_1.McpProxy();
// === Window State ===
let mainWindow = null;
/** Getter for mainWindow — used by IPC handlers and skills module */
const getMainWindow = () => mainWindow;
// === MCP Config Management ===
/**
 * Load MCP config from electron-settings.
 * If no config exists, creates default MCP servers (Desktop-Commander, Fetch, Filesystem, Sequential-Thinking).
 */
async function loadMcpConfig() {
    try {
        if (await electron_settings_1.default.has(ipc_handlers_js_1.MCP_CONFIG_KEY)) {
            const config = await electron_settings_1.default.get(ipc_handlers_js_1.MCP_CONFIG_KEY);
            const parsed = config || {};
            if (Object.keys(parsed).length > 0) {
                return parsed;
            }
        }
        console.log("[Config] No MCP config found, creating defaults...");
        const defaults = getDefaultMcpConfig();
        await electron_settings_1.default.set(ipc_handlers_js_1.MCP_CONFIG_KEY, defaults);
        console.log("[Config] ✅ Default MCP servers created:", Object.keys(defaults));
        return defaults;
    }
    catch (error) {
        console.error("[Config] Failed to load MCP config:", error);
    }
    return {};
}
/**
 * Default MCP server configuration for first-time users.
 * All servers use the bundled bun runtime.
 */
function getDefaultMcpConfig() {
    const bunPath = (0, runtime_js_1.getBunPath)();
    const homeDir = require("os").homedir();
    return {
        "Desktop-Commander": {
            command: bunPath,
            args: ["x", "-y", "@wonderwhy-er/desktop-commander"],
            transportType: "stdio",
            env: {
                PUPPETEER_SKIP_DOWNLOAD: "true",
                PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "true",
            },
        },
        Fetch: {
            command: bunPath,
            args: ["x", "-y", "@modelcontextprotocol/server-fetch"],
            transportType: "stdio",
        },
        Filesystem: {
            command: bunPath,
            args: ["x", "-y", "@modelcontextprotocol/server-filesystem", homeDir],
            transportType: "stdio",
        },
        "Sequential-Thinking": {
            command: bunPath,
            args: ["x", "-y", "@modelcontextprotocol/server-sequential-thinking"],
            transportType: "stdio",
        },
    };
}
// === MCP Connect/Close ===
/** Connect to all configured MCP servers */
async function mcpClientConnect() {
    try {
        const config = await loadMcpConfig();
        if (Object.keys(config).length > 0) {
            const adapted = (0, mcp_config_js_1.adaptConfig)(config);
            await mcpServer.setMCPServers(adapted);
            console.log("[IPC] MCP servers connected:", Object.keys(config));
        }
    }
    catch (error) {
        console.error("[IPC] mcpClientConnect error:", error);
    }
}
/** Disconnect all MCP servers */
async function mcpClientClose() {
    await mcpServer.disconnectAll();
}
// === App Bootstrap ===
// Configure app flags BEFORE ready (GPU, sandbox, platform hints)
(0, app_lifecycle_js_1.configureApp)();
electron_1.app.whenReady().then(async () => {
    logger_js_1.logger.info('🚀 Starting Qwen Desktop for Linux', { platform: (0, runtime_js_1.getPlatformName)(), version: APP_VERSION });
    try {
        // Make bundled runtimes executable (dev mode only)
        await (0, runtime_js_1.ensureRuntimesExecutable)();
        (0, skills_manager_js_1.ensureSkillsDir)();
        // Setup protocol handler (qwen:// deep links)
        (0, app_lifecycle_js_1.setupProtocolHandler)({
            onDeepLink: (url) => (0, app_lifecycle_js_1.handleDeepLink)(url, mainWindow),
            onCreateWindow: () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized())
                        mainWindow.restore();
                    mainWindow.focus();
                }
                else {
                    mainWindow = (0, window_manager_js_1.createWindow)({
                        onMcpClientConnect: mcpClientConnect,
                        onOpenDevTool: (win) => win.webContents.openDevTools({ mode: "right" }),
                        setQuitting: app_lifecycle_js_1.setQuitting,
                        isQuitting: app_lifecycle_js_1.isQuitting,
                        onDeepLink: (url) => (0, app_lifecycle_js_1.handleDeepLink)(url, mainWindow),
                    });
                }
            },
        });
        // Register IPC handlers (app management, MCP, theme, dialogs)
        (0, ipc_handlers_js_1.registerIpcHandlers)({
            getMainWindow,
            mcpServer,
            adaptConfig: mcp_config_js_1.adaptConfig,
            settings: electron_settings_1.default,
            loadMcpConfig,
            getDefaultMcpConfig,
            APP_VERSION,
        });
        // Auto-updater (production only)
        if (electron_1.app.isPackaged) {
            (0, updater_js_1.setupAutoUpdater)();
        }
        // Create main window (loads chat.qwen.ai with MCP bridge)
        mainWindow = (0, window_manager_js_1.createWindow)({
            onMcpClientConnect: mcpClientConnect,
            onOpenDevTool: (win) => win.webContents.openDevTools({ mode: "right" }),
            setQuitting: app_lifecycle_js_1.setQuitting,
            isQuitting: app_lifecycle_js_1.isQuitting,
            onDeepLink: (url) => (0, app_lifecycle_js_1.handleDeepLink)(url, mainWindow),
        });
        console.log("[App] ✅ Window created successfully");
        // macOS: re-create window on dock click
        electron_1.app.on("activate", () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                mainWindow = (0, window_manager_js_1.createWindow)({
                    onMcpClientConnect: mcpClientConnect,
                    onOpenDevTool: (win) => win.webContents.openDevTools({ mode: "right" }),
                    setQuitting: app_lifecycle_js_1.setQuitting,
                    isQuitting: app_lifecycle_js_1.isQuitting,
                    onDeepLink: (url) => (0, app_lifecycle_js_1.handleDeepLink)(url, mainWindow),
                });
            }
        });
    }
    catch (error) {
        console.error("[App] ❌ Failed to initialize:", error);
        // Retry after 1 second
        setTimeout(() => {
            mainWindow = (0, window_manager_js_1.createWindow)({
                onMcpClientConnect: mcpClientConnect,
                onOpenDevTool: (win) => win.webContents.openDevTools({ mode: "right" }),
                setQuitting: app_lifecycle_js_1.setQuitting,
                isQuitting: app_lifecycle_js_1.isQuitting,
                onDeepLink: (url) => (0, app_lifecycle_js_1.handleDeepLink)(url, mainWindow),
            });
        }, 1000);
    }
});
// All windows closed — exit only if quitting, otherwise keep alive for tray
electron_1.app.on("window-all-closed", () => {
    console.log("[App] All windows closed");
    if ((0, app_lifecycle_js_1.isQuitting)()) {
        console.log("[App] Quitting confirmed - exiting");
        electron_1.app.exit(0);
    }
    else {
        console.log("[App] Keeping app alive for tray");
    }
});
// Before quit: disconnect all MCP servers
electron_1.app.on("before-quit", () => {
    mcpServer.disconnectAll().catch(() => { });
});
// Global error handlers
process.on("uncaughtException", (error) => {
    console.error("[App] Uncaught exception:", error);
});
process.on("unhandledRejection", (reason) => {
    console.error("[App] Unhandled rejection:", reason);
});
//# sourceMappingURL=index.js.map
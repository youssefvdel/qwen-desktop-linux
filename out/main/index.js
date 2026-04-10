"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_settings_1 = __importDefault(require("electron-settings"));
const proxy_js_1 = require("../mcp/proxy.js");
const mcp_config_js_1 = require("./mcp-config.js");
const runtime_js_1 = require("./runtime.js");
const updater_js_1 = require("./updater.js");
// === Constants ===
const APP_VERSION = electron_1.app.getVersion();
const USER_AGENT_SUFFIX = `AliDesktop(QWENCHAT/${APP_VERSION})`;
const WEBVIEW_URL = "https://chat.qwen.ai";
const MCP_CONFIG_KEY = "mcp_config";
// === MCP Proxy Instance ===
const mcpServer = new proxy_js_1.McpProxy();
// === Window State (persistence) ===
let mainWindow = null;
/**
 * Get app version
 */
const getAppVersion = async () => APP_VERSION;
/**
 * Get platform info
 */
const getPlatformInfo = async () => ({
    platform: process.platform,
    arch: process.arch,
});
/**
 * Open DevTools
 */
const openDevTool = async () => {
    mainWindow?.webContents.openDevTools({ mode: "right" });
};
/**
 * Toggle hidden DevTools
 */
const toggleHiddenDevTools = async () => {
    if (mainWindow?.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
    }
    else {
        mainWindow?.webContents.openDevTools({ mode: "detach" });
    }
};
/**
 * Open external link in browser
 */
const openExternalLink = async (_event, url) => {
    await electron_1.shell.openExternal(url);
};
/**
 * Show native dialog
 */
const showNativeDialog = async (options) => {
    await electron_1.dialog.showMessageBox(mainWindow, {
        title: options.title || "Qwen",
        message: options.message,
        type: options.type || "info",
        buttons: options.buttons || ["OK"],
        defaultId: options.defaultId || 0,
    });
};
/**
 * Request file access (native file picker)
 */
const requestFileAccess = async (purpose, returnFile) => {
    const { filePaths } = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        title: purpose,
    });
    if (!filePaths || filePaths.length === 0) {
        return { filePath: "" };
    }
    const result = {
        filePath: filePaths[0],
    };
    if (returnFile) {
        result.file = await fs_1.default.promises.readFile(filePaths[0], "utf-8");
    }
    return result;
};
// === MCP IPC Handlers ===
/**
 * List tools for a server
 */
const mcpClientToolList = async (_event, serverName) => {
    try {
        console.log(`[IPC] Listing tools for server: "${serverName}"`);
        console.log("[IPC] Available servers:", Object.keys(mcpServer.getMCPServers()));
        const list = await mcpServer.listTools({ serverName });
        console.log(`[IPC] Tools for "${serverName}":`, list);
        return list;
    }
    catch (error) {
        console.error(`[IPC] mcpClientToolList error for "${serverName}":`, error);
        throw error;
    }
};
/**
 * Get MCP config
 */
const mcpClientGetConfig = async () => {
    return mcpServer.getMCPServers();
};
/**
 * Call MCP tool
 */
const mcpClientToolCall = async (_event, params) => {
    try {
        const result = await mcpServer.callTool(params);
        return result;
    }
    catch (error) {
        console.error("[IPC] mcpClientToolCall error:", error);
        throw error;
    }
};
/**
 * Update MCP config
 */
const mcpClientUpdateConfig = async (_event, config) => {
    try {
        console.log("[IPC] Updating MCP config:", JSON.stringify(config, null, 2));
        console.log("[IPC] Config keys:", Object.keys(config));
        // Log each server config before adapting
        for (const [name, serverConfig] of Object.entries(config)) {
            console.log(`[IPC] Server "${name}":`, {
                command: serverConfig.command,
                args: serverConfig.args,
                transportType: serverConfig.transportType,
            });
        }
        const adapted = (0, mcp_config_js_1.adaptConfig)(config);
        console.log("[IPC] Adapted config:", JSON.stringify(adapted, null, 2));
        await mcpServer.setMCPServers(adapted);
        await electron_settings_1.default.set(MCP_CONFIG_KEY, config);
        console.log("[IPC] MCP config saved successfully");
        return mcpClientGetConfig();
    }
    catch (error) {
        console.error("[IPC] mcpClientUpdateConfig error:", error);
        throw error;
    }
};
/**
 * Connect to MCP servers (initialize all)
 */
const mcpClientConnect = async () => {
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
};
/**
 * Close MCP connections
 */
const mcpClientClose = async () => {
    await mcpServer.disconnectAll();
};
// === Theme & Localization ===
const switchTheme = async (theme) => {
    // Store theme preference
    await electron_settings_1.default.set("app_theme", theme);
    // Notify renderer
    mainWindow?.webContents.send("event_from_main", {
        type: "theme_changed",
        payload: theme,
    });
};
const switchLn = async (language) => {
    await electron_settings_1.default.set("app_language", language);
    mainWindow?.webContents.send("event_from_main", {
        type: "language_changed",
        payload: language,
    });
};
const updateTitleBarForSystemTheme = async (isDark) => {
    // Linux: Handle GTK theme detection
    if (mainWindow) {
        mainWindow.webContents.send("event_from_main", {
            type: "system_theme_changed",
            payload: isDark,
        });
    }
};
// === Helpers ===
/**
 * Load MCP config from electron-settings
 */
async function loadMcpConfig() {
    try {
        if (await electron_settings_1.default.has(MCP_CONFIG_KEY)) {
            const config = await electron_settings_1.default.get(MCP_CONFIG_KEY);
            return config || {};
        }
    }
    catch (error) {
        console.error("[Config] Failed to load MCP config:", error);
    }
    return {};
}
/**
 * Create the main window
 * Loads chat.qwen.ai directly with MCP bridge via preload script
 */
function createWindow() {
    console.log("[Window] Creating window...");
    console.log("[Window] __dirname:", __dirname);
    console.log("[Window] cwd:", process.cwd());
    console.log("[Window] app.getAppPath():", require("electron").app.getAppPath());
    // Try multiple possible paths for preload
    const possiblePaths = [
        path_1.default.join(__dirname, "../preload/index.js"),
        path_1.default.join(__dirname, "preload/index.js"),
        path_1.default.join(process.cwd(), "out/preload/index.js"),
        path_1.default.join(process.cwd(), "src/preload/index.ts"),
    ];
    let preloadPath = possiblePaths[0];
    for (const p of possiblePaths) {
        const fs = require("fs");
        if (fs.existsSync(p)) {
            preloadPath = p;
            console.log(`[Window] ✅ Found preload at: ${p}`);
            break;
        }
        else {
            console.log(`[Window] ❌ Not found: ${p}`);
        }
    }
    console.log("[Window] Using preload path:", preloadPath);
    // Don't use windowStateKeeper for now - use defaults
    mainWindow = new electron_1.BrowserWindow({
        x: 100,
        y: 100,
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: "Qwen",
        show: false, // Don't show until ready
        webPreferences: {
            preload: preloadPath,
            sandbox: false,
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
        autoHideMenuBar: true,
    });
    console.log("[Window] ✅ BrowserWindow created");
    // Show window when ready
    mainWindow.once("ready-to-show", () => {
        console.log("[Window] 🎉 Ready to show");
        mainWindow?.show();
    });
    mainWindow.on("show", () => {
        console.log("[Window] 👁️ Window shown");
    });
    // Set custom User-Agent for desktop app detection
    // Use standard Chrome UA + desktop app suffix
    const chromeVersion = "131.0.0.0";
    const desktopUA = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36 ${USER_AGENT_SUFFIX}`;
    mainWindow.webContents.setUserAgent(desktopUA);
    console.log("[Window] User-Agent:", desktopUA);
    // Load chat.qwen.ai
    console.log("[Window] Loading:", WEBVIEW_URL);
    mainWindow.loadURL(WEBVIEW_URL);
    // Log window events for debugging
    mainWindow.webContents.on("did-start-loading", () => {
        console.log("[Window] 🔄 Started loading...");
    });
    mainWindow.webContents.on("did-stop-loading", () => {
        console.log("[Window] ⏹️ Stopped loading");
    });
    mainWindow.webContents.on("did-finish-load", () => {
        console.log("[Window] ✅ Page finished loading");
        console.log("[Window] URL:", mainWindow?.webContents.getURL());
        // Inject CSS to hide mobile download overlay
        mainWindow?.webContents
            .insertCSS(`
      #low-version-browser,
      #downLoad_app,
      #get-the-app,
      .mobile-download-overlay {
        display: none !important;
      }
      #desktop-app,
      .desktop-container {
        display: block !important;
      }
    `)
            .then(() => {
            console.log("[Window] ✅ Injected CSS to hide mobile overlay");
        })
            .catch((err) => {
            console.error("[Window] Failed to inject CSS:", err);
        });
        console.log("[IPC] Initializing MCP...");
        mcpClientConnect();
    });
    mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
        console.error("[Window] ❌ Failed to load!");
        console.error("[Window] Error code:", errorCode);
        console.error("[Window] Error:", errorDescription);
        console.error("[Window] URL:", validatedURL);
    });
    mainWindow.on("closed", () => {
        console.log("[Window] Window closed");
        mainWindow = null;
        // Force quit immediately when window closes
        process.exit(0);
    });
    mainWindow.on("close", () => {
        console.log("[Window] Window closing");
    });
    // Handle external links
    mainWindow.webContents.setWindowOpenHandler((details) => {
        electron_1.shell.openExternal(details.url);
        return { action: "deny" };
    });
    // Linux: Handle system tray
    if (process.platform === "linux") {
        setupSystemTray();
    }
    // DevTools shortcut
    mainWindow.webContents.on("before-input-event", (event, input) => {
        if (input.key === "F12" ||
            (input.control && input.shift && input.key === "I")) {
            openDevTool();
            event.preventDefault();
        }
    });
}
// === System Tray (Linux) ===
function setupSystemTray() {
    // Linux AppIndicator support would go here
    // For now, basic implementation
    console.log("[Tray] System tray setup for Linux");
}
// === IPC Registration ===
function registerIpcHandlers() {
    // App management
    electron_1.ipcMain.handle("get_app_version", getAppVersion);
    electron_1.ipcMain.handle("get_platform_info", getPlatformInfo);
    electron_1.ipcMain.handle("open_devtool", openDevTool);
    electron_1.ipcMain.handle("toggle_hidden_devtools", toggleHiddenDevTools);
    electron_1.ipcMain.handle("open_external_link", openExternalLink);
    electron_1.ipcMain.handle("show_native_dialog", (_, options) => showNativeDialog(options));
    electron_1.ipcMain.handle("request_file_access", (_, purpose, returnFile) => requestFileAccess(purpose, returnFile));
    // MCP handlers
    electron_1.ipcMain.handle("mcp_client_connect", mcpClientConnect);
    electron_1.ipcMain.handle("mcp_client_close", mcpClientClose);
    electron_1.ipcMain.handle("mcp_client_tool_list", mcpClientToolList);
    electron_1.ipcMain.handle("mcp_client_tool_call", mcpClientToolCall);
    electron_1.ipcMain.handle("mcp_client_get_config", mcpClientGetConfig);
    electron_1.ipcMain.handle("mcp_client_update_config", mcpClientUpdateConfig);
    // Theme & localization
    electron_1.ipcMain.handle("switch_theme", (_, theme) => switchTheme(theme));
    electron_1.ipcMain.handle("switch_ln", (_, language) => switchLn(language));
    electron_1.ipcMain.handle("update_title_bar_for_system_theme", (_, isDark) => updateTitleBarForSystemTheme(isDark));
    // Event forwarding
    electron_1.ipcMain.on("event_to_main", (_, data) => {
        mainWindow?.webContents.send("event_from_main", data);
    });
}
// === Deep Link / Protocol Handler ===
function setupProtocolHandler() {
    if (process.defaultApp) {
        if (process.argv.length >= 2) {
            electron_1.app.setAsDefaultProtocolClient("qwen", process.execPath, [
                process.argv[1],
            ]);
        }
    }
    else {
        electron_1.app.setAsDefaultProtocolClient("qwen");
    }
    // Handle qwen:// URLs
    electron_1.app.on("open-url", (event, url) => {
        event.preventDefault();
        handleDeepLink(url);
    });
    // Handle second instance (Linux) — always create window if none exists
    electron_1.app.on("second-instance", (_event, commandLine) => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
        else {
            createWindow();
        }
        const url = commandLine.find((arg) => arg.startsWith("qwen://"));
        if (url)
            handleDeepLink(url);
    });
}
function handleDeepLink(url) {
    console.log("[DeepLink] Handling URL:", url);
    // Parse token from qwen://open?token=xxx
    const urlObj = new URL(url);
    if (urlObj.pathname === "/open") {
        const token = urlObj.searchParams.get("token");
        if (token) {
            console.log("[DeepLink] Auth token received");
            // Send token to renderer for authentication
            mainWindow?.webContents.send("event_from_main", {
                type: "auth_token",
                payload: { token },
            });
        }
    }
}
// === App Lifecycle ===
// Disable GPU acceleration to prevent crashes on Linux
electron_1.app.commandLine.appendSwitch("disable-gpu");
electron_1.app.commandLine.appendSwitch("disable-gpu-compositing");
electron_1.app.commandLine.appendSwitch("disable-software-rasterizer");
electron_1.app.commandLine.appendSwitch("no-sandbox");
electron_1.app.commandLine.appendSwitch("disable-dev-shm-usage");
electron_1.app.commandLine.appendSwitch("disable-gpu-sandbox");
electron_1.app.commandLine.appendSwitch("use-gl", "swiftshader");
electron_1.app.commandLine.appendSwitch("ignore-gpu-blocklist");
electron_1.app.commandLine.appendSwitch("disable-features", "VizDisplayCompositor");
// Debug flags - Enable remote debugging for chrome-devtools-mcp
electron_1.app.commandLine.appendSwitch("enable-logging");
electron_1.app.commandLine.appendSwitch("v", "1");
electron_1.app.commandLine.appendSwitch("remote-debugging-port", "9222");
electron_1.app.commandLine.appendSwitch("remote-allow-origins", "*");
electron_1.app.whenReady().then(async () => {
    console.log("[App] Starting Qwen Desktop for Linux");
    console.log("[App] Platform:", (0, runtime_js_1.getPlatformName)());
    console.log("[App] Version:", APP_VERSION);
    try {
        // Ensure bundled runtimes are executable
        await (0, runtime_js_1.ensureRuntimesExecutable)();
        // Register IPC handlers
        registerIpcHandlers();
        // Setup protocol handler
        setupProtocolHandler();
        // Setup auto-updater (only in production)
        if (electron_1.app.isPackaged) {
            (0, updater_js_1.setupAutoUpdater)();
        }
        // Create main window
        createWindow();
        console.log("[App] ✅ Window created successfully");
        electron_1.app.on("activate", () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    }
    catch (error) {
        console.error("[App] ❌ Failed to initialize:", error);
        // Keep app alive even if there's an error
        setTimeout(() => {
            createWindow();
        }, 1000);
    }
});
let isQuitting = false;
electron_1.app.on("window-all-closed", () => {
    console.log("[App] All windows closed");
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("before-quit", (event) => {
    if (isQuitting)
        return;
    // Prevent default quit to do cleanup first
    event.preventDefault();
    isQuitting = true;
    console.log("[App] Cleaning up MCP servers...");
    // Clean up MCP connections synchronously where possible
    mcpServer.stopHTTP();
    // Allow app to quit now
    electron_1.app.quit();
});
// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    console.error("[App] Uncaught exception:", error);
});
process.on("unhandledRejection", (reason) => {
    console.error("[App] Unhandled rejection:", reason);
});
//# sourceMappingURL=index.js.map
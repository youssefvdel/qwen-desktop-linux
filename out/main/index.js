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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_updater_1 = require("electron-updater");
const electron_settings_1 = __importDefault(require("electron-settings"));
const proxy_js_1 = require("../mcp/proxy.js");
const mcp_config_js_1 = require("./mcp-config.js");
const runtime_js_1 = require("./runtime.js");
const updater_js_1 = require("./updater.js");
const window_manager_js_1 = require("./window-manager.js");
const ipc_handlers_js_1 = require("./ipc-handlers.js");
const qwen_proxy_js_1 = require("./qwen-proxy.js");
const logger_js_1 = require("./logger.js");
const app_lifecycle_js_1 = require("./app-lifecycle.js");
const skills_manager_js_1 = require("./skills-manager.js");
// === Constants ===
const APP_VERSION = electron_1.app.getVersion();
const WEBVIEW_URL = "https://chat.qwen.ai";
/**
 * Compare two semver strings.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 * Used for update version checks without external dependencies.
 */
function compareVersions(a, b) {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0)
            return Math.sign(diff);
    }
    return 0;
}
// === MCP Proxy Instance ===
// Singleton that manages all MCP server connections
const mcpServer = new proxy_js_1.McpProxy();
// === Window State ===
let mainWindow = null;
/** Getter for mainWindow — used by IPC handlers and skills module */
const getMainWindow = () => mainWindow;
/**
 * Load the app icon from bundled resources.
 * Tries multiple paths to support both dev and packaged modes.
 */
function getAppIcon() {
    const iconPaths = [
        path_1.default.join(process.resourcesPath, "icon.png"),
        path_1.default.join(__dirname, "../../resources/icon.png"),
        path_1.default.join(process.cwd(), "resources/icon.png"),
    ];
    for (const p of iconPaths) {
        try {
            if (fs_1.default.existsSync(p))
                return electron_1.nativeImage.createFromPath(p);
        }
        catch { }
    }
    return undefined;
}
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
// === Application Menu ===
/**
 * Build and set the application menu.
 * Includes: App menu (update check, quit), Edit, View, and Skills submenu.
 */
async function setupMenu() {
    const skillsItems = await (0, skills_manager_js_1.buildSkillsMenuTemplate)(getMainWindow);
    const template = [
        {
            label: "Qwen",
            submenu: [
                {
                    label: "Check for Updates",
                    click: async () => {
                        console.log("[Updater] Manual check triggered");
                        if (!mainWindow)
                            return;
                        try {
                            const updateInfo = await electron_updater_1.autoUpdater.checkForUpdates();
                            if (updateInfo && updateInfo.updateInfo) {
                                const currentVersion = electron_1.app.getVersion();
                                const latestVersion = updateInfo.updateInfo.version;
                                // Only offer update if latest is newer (not a downgrade)
                                if (compareVersions(latestVersion, currentVersion) > 0) {
                                    const response = electron_1.dialog.showMessageBoxSync(mainWindow, {
                                        icon: getAppIcon(),
                                        type: "info",
                                        title: "Update Available",
                                        message: `A new version (${latestVersion}) is available! Current version: ${currentVersion}.`,
                                        buttons: ["Download", "Later"],
                                        defaultId: 0,
                                    });
                                    if (response === 0)
                                        electron_updater_1.autoUpdater.downloadUpdate();
                                }
                                else {
                                    electron_1.dialog.showMessageBoxSync(mainWindow, {
                                        icon: getAppIcon(),
                                        type: "info",
                                        title: "Up to Date",
                                        message: `You are using the latest version (${currentVersion}).`,
                                    });
                                }
                            }
                            else {
                                electron_1.dialog.showMessageBoxSync(mainWindow, {
                                    icon: getAppIcon(),
                                    type: "info",
                                    title: "Up to Date",
                                    message: "You are using the latest version.",
                                });
                            }
                        }
                        catch (error) {
                            console.error("[Updater] Check failed:", error);
                            electron_1.dialog.showMessageBoxSync(mainWindow, {
                                icon: getAppIcon(),
                                type: "error",
                                title: "Update Check Failed",
                                message: `Could not check for updates.\n\nError: ${error instanceof Error ? error.message : error}`,
                            });
                        }
                    },
                },
                { type: "separator" },
                { role: "quit" },
            ],
        },
        {
            label: "Edit",
            submenu: [
                { role: "undo" },
                { role: "redo" },
                { type: "separator" },
                { role: "cut" },
                { role: "copy" },
                { role: "paste" },
                { role: "delete" },
                { role: "selectAll" },
            ],
        },
        {
            label: "View",
            submenu: [
                { role: "reload" },
                { role: "forceReload" },
                { role: "toggleDevTools" },
                { type: "separator" },
                { role: "resetZoom" },
                { role: "zoomIn" },
                { role: "zoomOut" },
                { type: "separator" },
                { role: "togglefullscreen" },
            ],
        },
        {
            label: "Skills",
            submenu: skillsItems,
        },
    ];
    const menu = electron_1.Menu.buildFromTemplate(template);
    electron_1.Menu.setApplicationMenu(menu);
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
        // === Start Qwen Web API Proxy (Direct HTTP Bridge) ===
        // Exposes OpenAI-compatible endpoint at http://localhost:11435
        logger_js_1.logger.info('🔗 Initializing QwenProxy...');
        qwen_proxy_js_1.qwenProxy.setWindow(mainWindow);
        qwen_proxy_js_1.qwenProxy.start();
        // ======================================================
        // === Force DevTools Open (for API discovery) ===
        // Auto-open detached DevTools so we can inspect network traffic
        setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.openDevTools({ mode: 'detach' });
                logger_js_1.logger.info('🔍 DevTools auto-opened in detached mode for API inspection');
            }
        }, 3000);
        // =============================================
        // === Aggressive Network Interceptor for API Discovery ===
        const ses = mainWindow.webContents.session;
        // Log ALL requests to chat.qwen.ai (XHR/fetch only)
        // Note: Electron uses 'xhr' for both XHR and fetch requests
        ses.webRequest.onBeforeRequest({ urls: ['*://chat.qwen.ai/*'] }, (details, callback) => {
            if (details.resourceType === 'xhr') {
                logger_js_1.logger.info('🌐 [API-TRACE] ' + details.method + ' ' + details.url, {
                    resourceType: details.resourceType,
                    requestId: details.id,
                    timestamp: new Date().toISOString()
                });
                // Log POST body if present
                if (details.uploadData) {
                    const body = details.uploadData.map((d) => d.bytes ? Buffer.from(d.bytes).toString('utf8') : d.text).join('');
                    if (body)
                        logger_js_1.logger.debug('📦 [API-BODY] ' + body.substring(0, 500));
                }
            }
            callback({});
        });
        // Log headers for API-like requests
        ses.webRequest.onSendHeaders({ urls: ['*://chat.qwen.ai/*'] }, (details) => {
            if (details.resourceType === 'xhr' &&
                (details.url.includes('/api') || details.url.includes('/gpts') || details.url.includes('/chat'))) {
                logger_js_1.logger.info('🔑 [API-HEADERS] ' + details.url, {
                    method: details.method,
                    headers: Object.fromEntries(Object.entries(details.requestHeaders).filter(([k]) => !['cookie', 'authorization'].includes(k.toLowerCase())))
                });
            }
        });
        // Log responses
        ses.webRequest.onCompleted({ urls: ['*://chat.qwen.ai/*'] }, (details) => {
            if (details.resourceType === 'xhr' &&
                (details.url.includes('/api') || details.url.includes('/gpts') || details.url.includes('/chat'))) {
                logger_js_1.logger.info('✅ [API-RESPONSE] ' + details.statusCode + ' ' + details.url, {
                    status: details.statusCode,
                    method: details.method,
                    size: details.responseHeaders?.['content-length']?.[0] || 'unknown'
                });
                // If error status, log more
                if (details.statusCode >= 400) {
                    logger_js_1.logger.warn('❌ [API-ERROR] ' + details.url + ' -> ' + details.statusCode);
                }
            }
        });
        // =============================================
        // Build menu after window creation (so skills menu can populate)
        await setupMenu();
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
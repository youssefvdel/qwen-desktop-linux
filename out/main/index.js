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
const electron_updater_1 = require("electron-updater");
// === Constants ===
const SKILLS_DIR = path_1.default.join(electron_1.app.getPath("userData"), "skills");
// === Constants ===
const APP_VERSION = electron_1.app.getVersion();
const USER_AGENT_SUFFIX = `AliDesktop(QWENCHAT/${APP_VERSION})`;
const WEBVIEW_URL = "https://chat.qwen.ai";
const MCP_CONFIG_KEY = "mcp_config";
// === MCP Proxy Instance ===
const mcpServer = new proxy_js_1.McpProxy();
// === Window State (persistence) ===
let mainWindow = null;
let appTray = null;
let isQuitting = false;
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
 * If no config exists, creates default MCP servers (Fetch, Filesystem, Sequential-Thinking)
 */
async function loadMcpConfig() {
    try {
        if (await electron_settings_1.default.has(MCP_CONFIG_KEY)) {
            const config = await electron_settings_1.default.get(MCP_CONFIG_KEY);
            const parsed = config || {};
            if (Object.keys(parsed).length > 0) {
                return parsed; // User has custom config, use it
            }
        }
        // First launch — create default MCP servers
        console.log("[Config] No MCP config found, creating defaults...");
        const defaults = getDefaultMcpConfig();
        await electron_settings_1.default.set(MCP_CONFIG_KEY, defaults);
        console.log("[Config] ✅ Default MCP servers created:", Object.keys(defaults));
        return defaults;
    }
    catch (error) {
        console.error("[Config] Failed to load MCP config:", error);
    }
    return {};
}
/**
 * Get default MCP server configuration for first-time users
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
// === Skills Management ===
function ensureSkillsDir() {
    if (!fs_1.default.existsSync(SKILLS_DIR)) {
        fs_1.default.mkdirSync(SKILLS_DIR, { recursive: true });
        // Create a sample skill
        const sampleSkill = "# Python Expert\n\nAct as a senior Python developer. Focus on PEP8, efficiency, and best practices.";
        fs_1.default.writeFileSync(path_1.default.join(SKILLS_DIR, "python-expert.md"), sampleSkill);
    }
}
async function getAvailableSkills() {
    ensureSkillsDir();
    try {
        const files = await fs_1.default.promises.readdir(SKILLS_DIR);
        return files.filter(f => f.endsWith('.md') || f.endsWith('.txt'));
    }
    catch (error) {
        console.error("[Skills] Error reading skills dir:", error);
        return [];
    }
}
async function injectSkill(skillName) {
    async function injectSkill(skillName) {
        if (!mainWindow)
            return;
        const skillPath = path_1.default.join(SKILLS_DIR, skillName);
        try {
            const content = await fs_1.default.promises.readFile(skillPath, 'utf-8');
            // Safely encode the content to prevent syntax errors in the injected script
            const safeContent = JSON.stringify(content);
            const jsCode = `
      (function() {
        const text = ${safeContent};
        const selectors = [
          'textarea[data-id="chat-input"]',
          'textarea',
          'div[role="textbox"]',
          'div[contenteditable="true"]'
        ];
        let el = null;
        for (const sel of selectors) {
          el = document.querySelector(sel);
          if (el) break;
        }
        
        if (el) {
          el.focus();
          if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
            el.value = text + (el.value || '');
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            el.textContent = text + (el.textContent || '');
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      })();
    `;
            await mainWindow.webContents.executeJavaScript(jsCode);
            console.log(`[Skills] Injected: ${skillName}`);
        }
        catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error(`[Skills] Failed to inject ${skillName}:`, error);
            electron_1.dialog.showErrorBox('Skill Error', `Failed to load skill: ${skillName}\n\nError: ${errMsg}\nDir: ${SKILLS_DIR}`);
        }
    }
    function openSkillsFolder() {
        ensureSkillsDir();
        electron_1.shell.openPath(SKILLS_DIR);
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
            show: false, // Don.t show until ready
            autoHideMenuBar: false,
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
        mainWindow.setMenuBarVisibility(true);
        mainWindow.setAutoHideMenuBar(false);
        mainWindow.loadURL(WEBVIEW_URL);
        // === TEMPORARY: Network Interception Logger ===
        // Captures ALL network requests to discover Qwen's API endpoints
        const ses = mainWindow.webContents.session;
        ses.webRequest.onBeforeRequest({ urls: ["*://*/*"] }, (details, callback) => {
            // Only log XHR requests (images, CSS, etc. excluded)
            if (details.resourceType === "xhr") {
                console.log(`[NET-LOG] ${details.method} ${details.url} (${details.resourceType})`);
                if (details.uploadData) {
                    try {
                        const body = details.uploadData
                            .map((d) => d.bytes?.toString() || d.file || "")
                            .join("");
                        if (body.length < 2000) {
                            console.log(`[NET-LOG] Body:`, body.substring(0, 500));
                        }
                    }
                    catch (e) { }
                }
            }
            callback({});
        });
        ses.webRequest.onSendHeaders({ urls: ["*://*/*"] }, (details) => {
            if (details.resourceType === "xhr") {
                console.log(`[NET-LOG] Headers for ${details.url}:`, JSON.stringify(details.requestHeaders, null, 2).substring(0, 500));
            }
        });
        // CDP Debugger for capturing response bodies
        mainWindow.webContents.debugger.attach("1.3");
        mainWindow.webContents.debugger.sendCommand("Network.enable");
        mainWindow.webContents.debugger.on("message", (_event, method, params) => {
            if (method === "Network.responseReceived") {
                const { requestId, response, type } = params;
                // Only log XHR/Fetch responses
                if (type === "XHR" || type === "Fetch") {
                    console.log(`[NET-RESP] ${response.status} ${response.url} (${type})`);
                    // Try to get the response body
                    const mw = mainWindow;
                    if (mw) {
                        mw.webContents.debugger.sendCommand("Network.getResponseBody", { requestId }).then((result) => {
                            if (result && result.body) {
                                const bodyPreview = result.body.substring(0, 500);
                                console.log(`[NET-RESP] Body:`, bodyPreview);
                            }
                        }).catch((err) => {
                            // Body might not be available for all requests
                        });
                    }
                }
            }
        });
        // === END TEMPORARY ===
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
        mainWindow.on("close", (event) => {
            if (!isQuitting) {
                console.log("[Window] Close event fired - hiding to tray");
                event.preventDefault();
                if (mainWindow) {
                    mainWindow.hide();
                }
            }
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
        console.log("[Tray] Setting up system tray...");
        // Get the icon path - try multiple locations
        const iconPaths = [
            path_1.default.join(process.resourcesPath, "icon.png"),
            path_1.default.join(__dirname, "../../resources/icon.png"),
            path_1.default.join(process.cwd(), "resources/icon.png"),
        ];
        let iconPath = iconPaths[0];
        for (const p of iconPaths) {
            if (fs_1.default.existsSync(p)) {
                iconPath = p;
                console.log(`[Tray] ✅ Found icon at: ${p}`);
                break;
            }
        }
        try {
            // Create tray icon
            const trayIcon = electron_1.nativeImage.createFromPath(iconPath);
            // Resize for tray (Linux typically expects 16-24px icons)
            const resizedIcon = trayIcon.resize({ width: 16, height: 16 });
            appTray = new electron_1.Tray(resizedIcon);
            appTray.setToolTip("Qwen Desktop");
            // Create context menu
            const contextMenu = electron_1.Menu.buildFromTemplate([
                {
                    label: "Show Qwen",
                    click: () => {
                        if (mainWindow) {
                            if (mainWindow.isMinimized()) {
                                mainWindow.restore();
                            }
                            mainWindow.show();
                            mainWindow.focus();
                        }
                        else {
                            createWindow();
                        }
                    },
                },
                {
                    label: "Hide Qwen",
                    click: () => {
                        mainWindow?.hide();
                    },
                },
                { type: "separator" },
                {
                    label: "Toggle DevTools",
                    click: () => {
                        openDevTool();
                    },
                },
                { type: "separator" },
                {
                    label: "Quit",
                    click: () => {
                        isQuitting = true;
                        if (appTray) {
                            appTray.destroy();
                            appTray = null;
                        }
                        mainWindow = null;
                        electron_1.app.quit();
                    },
                },
            ]);
            appTray.setContextMenu(contextMenu);
            // Click on tray icon to show/hide window
            appTray.on("click", () => {
                if (mainWindow && mainWindow.isVisible()) {
                    mainWindow.hide();
                }
                else if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
                else {
                    createWindow();
                }
            });
            // Double-click to restore window
            appTray.on("double-click", () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized()) {
                        mainWindow.restore();
                    }
                    if (!mainWindow.isVisible()) {
                        mainWindow.show();
                    }
                    mainWindow.focus();
                }
            });
            console.log("[Tray] ✅ System tray setup complete");
        }
        catch (error) {
            console.error("[Tray] ❌ Failed to setup system tray:", error);
        }
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
    // === Application Menu ===
    function setupMenu() {
        const template = [
            {
                label: 'Qwen',
                submenu: [
                    {
                        label: 'Check for Updates',
                        click: async () => {
                            console.log("[Updater] Manual check triggered");
                            if (!mainWindow)
                                return;
                            try {
                                // Show loading dialog
                                const loadingDialog = electron_1.dialog.showMessageBoxSync(mainWindow, {
                                    type: 'info',
                                    title: 'Checking for Updates',
                                    message: 'Checking for updates...',
                                    buttons: [],
                                    noLink: true
                                });
                                // Check for updates
                                const updateInfo = await electron_updater_1.autoUpdater.checkForUpdates();
                                if (updateInfo && updateInfo.updateInfo) {
                                    const currentVersion = electron_1.app.getVersion();
                                    const latestVersion = updateInfo.updateInfo.version;
                                    if (latestVersion !== currentVersion) {
                                        const { response } = electron_1.dialog.showMessageBoxSync(mainWindow, {
                                            type: 'info',
                                            title: 'Update Available',
                                            message: `A new version (${latestVersion}) is available! Current version: ${currentVersion}.`,
                                            buttons: ['Download', 'Later'],
                                            defaultId: 0
                                        });
                                        if (response === 0) {
                                            electron_updater_1.autoUpdater.downloadUpdate();
                                        }
                                    }
                                    else {
                                        electron_1.dialog.showMessageBoxSync(mainWindow, {
                                            type: 'info',
                                            title: 'Up to Date',
                                            message: `You are using the latest version (${currentVersion}).`
                                        });
                                    }
                                }
                                else {
                                    electron_1.dialog.showMessageBoxSync(mainWindow, {
                                        type: 'info',
                                        title: 'Up to Date',
                                        message: 'You are using the latest version.'
                                    });
                                }
                            }
                            catch (error) {
                                console.error("[Updater] Check failed:", error);
                                electron_1.dialog.showMessageBoxSync(mainWindow, {
                                    type: 'error',
                                    title: 'Update Check Failed',
                                    message: `Could not check for updates.\n\nError: ${error instanceof Error ? error.message : error}`
                                });
                            }
                        }
                    },
                    { type: 'separator' },
                    { role: 'quit' }
                ]
            },
            {
                label: 'Edit',
                submenu: [
                    { role: 'undo' },
                    { role: 'redo' },
                    { type: 'separator' },
                    { role: 'cut' },
                    { role: 'copy' },
                    { role: 'paste' },
                    { role: 'delete' },
                    { role: 'selectAll' }
                ]
            },
            {
                label: 'View',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                    { role: 'toggleDevTools' },
                    { type: 'separator' },
                    { role: 'resetZoom' },
                    { role: 'zoomIn' },
                    { role: 'zoomOut' },
                    { type: 'separator' },
                    { role: 'togglefullscreen' }
                ]
            },
            {
                label: 'Skills',
                id: 'skills-menu',
                submenu: [
                    { label: 'Open Skills Folder', click: openSkillsFolder },
                    { type: 'separator' }
                    // Dynamic skills will be added here
                ]
            }
        ];
        const menu = electron_1.Menu.buildFromTemplate(template);
        electron_1.Menu.setApplicationMenu(menu);
        // Update Skills submenu dynamically
        updateSkillsMenu();
    }
    async function updateSkillsMenu() {
        const menu = electron_1.Menu.getApplicationMenu();
        if (!menu)
            return;
        const skillsItem = menu.getMenuItemById('skills-menu');
        if (!skillsItem || !skillsItem.submenu)
            return;
        // Clear existing dynamic items (keep first two: Open Folder and Separator)
        while (skillsItem.submenu.items.length > 2) {
            skillsItem.submenu.items.pop();
        }
        const skills = await getAvailableSkills();
        skills.forEach(skill => {
            const item = new electron_1.MenuItem({
                label: skill.replace('.md', '').replace('.txt', ''),
                click: () => injectSkill(skill)
            });
            skillsItem.submenu?.append(item);
        });
    }
    electron_1.app.whenReady().then(async () => {
        setupMenu();
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
    electron_1.app.on("window-all-closed", () => {
        console.log("[App] All windows closed");
        if (isQuitting) {
            console.log("[App] Quitting confirmed - exiting");
            electron_1.app.exit(0);
        }
        else {
            console.log("[App] Keeping app alive for tray");
        }
    });
    electron_1.app.on("before-quit", () => {
        // Just cleanup, don't block quit
        mcpServer.disconnectAll().catch(() => { });
        mcpServer.stopHTTP();
    });
    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
        console.error("[App] Uncaught exception:", error);
    });
    process.on("unhandledRejection", (reason) => {
        console.error("[App] Unhandled rejection:", reason);
    });
}
//# sourceMappingURL=index.js.map
"use strict";
/**
 * Window Manager — BrowserWindow creation + system tray
 *
 * Responsibilities:
 * - Create the main BrowserWindow that loads chat.qwen.ai
 * - Inject CSS to hide mobile download overlay
 * - Setup Linux system tray (show/hide/quit)
 * - Intercept auth links and open them in-app (for OAuth login flow)
 * - Handle close-to-tray behavior (respects isQuitting state)
 * - Provide 5-second fallback if ready-to-show never fires
 */
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
exports.createWindow = createWindow;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const APP_VERSION = electron_1.app.getVersion();
const USER_AGENT_SUFFIX = `AliDesktop(QWENCHAT/${APP_VERSION})`;
const WEBVIEW_URL = "https://chat.qwen.ai";
/**
 * Find the preload script path.
 * Tries multiple locations to support both dev and packaged modes.
 */
function getPreloadPath() {
    const possiblePaths = [
        path.join(__dirname, "../preload/index.js"),
        path.join(__dirname, "preload/index.js"),
        path.join(process.cwd(), "out/preload/index.js"),
        path.join(process.cwd(), "src/preload/index.ts"),
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            console.log(`[Window] ✅ Found preload at: ${p}`);
            return p;
        }
        else {
            console.log(`[Window] ❌ Not found: ${p}`);
        }
    }
    console.warn("[Window] ⚠️ No preload found, using fallback");
    return possiblePaths[0];
}
/**
 * Create the main BrowserWindow loading chat.qwen.ai with MCP bridge.
 *
 * What it does:
 * 1. Finds the preload script (contextBridge for window.electronAPI)
 * 2. Creates BrowserWindow with context isolation enabled
 * 3. Sets custom User-Agent for desktop app detection by chat.qwen.ai
 * 4. Loads chat.qwen.ai
 * 5. Intercepts qwen:// deep links and auth URLs
 * 6. Injects CSS to hide mobile download overlay
 * 7. Connects MCP servers on page load
 * 8. Sets up close-to-tray behavior
 * 9. Creates system tray icon (Linux)
 * 10. Sets up F12/Ctrl+Shift+I DevTools shortcut
 */
function createWindow(deps) {
    console.log("[Window] Creating window...");
    console.log("[Window] __dirname:", __dirname);
    console.log("[Window] cwd:", process.cwd());
    console.log("[Window] app.getAppPath():", electron_1.app.getAppPath());
    const preloadPath = getPreloadPath();
    console.log("[Window] Using preload path:", preloadPath);
    const mainWindow = new electron_1.BrowserWindow({
        x: 100,
        y: 100,
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: "Qwen",
        show: false,
        webPreferences: {
            preload: preloadPath,
            sandbox: false,
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
        autoHideMenuBar: false,
    });
    console.log("[Window] ✅ BrowserWindow created");
    // Show window when ready (with 5s timeout fallback)
    let shown = false;
    const showTimeout = setTimeout(() => {
        if (!shown && !mainWindow.isDestroyed()) {
            console.log("[Window] ⏰ ready-to-show timeout, forcing show");
            mainWindow.show();
        }
    }, 5000);
    mainWindow.once("ready-to-show", () => {
        clearTimeout(showTimeout);
        shown = true;
        console.log("[Window] 🎉 Ready to show");
        mainWindow.show();
    });
    mainWindow.on("show", () => {
        console.log("[Window] 👁️ Window shown");
    });
    // Set custom User-Agent for desktop app detection
    const chromeVersion = "131.0.0.0";
    const desktopUA = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36 ${USER_AGENT_SUFFIX}`;
    mainWindow.webContents.setUserAgent(desktopUA);
    console.log("[Window] User-Agent:", desktopUA);
    // Load chat.qwen.ai
    console.log("[Window] Loading:", WEBVIEW_URL);
    mainWindow.setMenuBarVisibility(true);
    mainWindow.setAutoHideMenuBar(false);
    mainWindow.loadURL(WEBVIEW_URL);
    // Catch qwen:// deep links from the webview (login redirects)
    mainWindow.webContents.on("will-navigate", (event, url) => {
        if (url.startsWith("qwen://")) {
            event.preventDefault();
            console.log("[Window] Caught qwen:// redirect from webview:", url);
            deps.onDeepLink(url);
        }
    });
    // Catch window.open with qwen:// (OAuth popups sometimes use this)
    mainWindow.webContents.setWindowOpenHandler((details) => {
        if (details.url.startsWith("qwen://")) {
            console.log("[Window] Caught qwen:// from setWindowOpenHandler:", details.url);
            deps.onDeepLink(details.url);
            return { action: "deny" };
        }
        // Allow external links to open in system browser
        electron_1.shell.openExternal(details.url);
        return { action: "deny" };
    });
    // Log window events for debugging
    mainWindow.webContents.on("did-start-loading", () => {
        console.log("[Window] 🔄 Started loading...");
    });
    mainWindow.webContents.on("did-stop-loading", () => {
        console.log("[Window] ⏹️ Stopped loading");
    });
    mainWindow.webContents.on("did-finish-load", () => {
        console.log("[Window] ✅ Page finished loading");
        console.log("[Window] URL:", mainWindow.webContents.getURL());
        // Inject CSS to hide mobile download overlay
        mainWindow.webContents
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
        deps.onMcpClientConnect();
    });
    mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
        console.error("[Window] ❌ Failed to load!");
        console.error("[Window] Error code:", errorCode);
        console.error("[Window] Error:", errorDescription);
        console.error("[Window] URL:", validatedURL);
    });
    // Close event: hide to tray instead of quitting
    mainWindow.on("close", (event) => {
        if (!deps.isQuitting()) {
            console.log("[Window] Close event fired - hiding to tray");
            event.preventDefault();
            mainWindow.hide();
        }
    });
    // Handle external links - open auth links in-app instead of external browser
    mainWindow.webContents.setWindowOpenHandler((details) => {
        // If it's a qwen:// deep link, handle it directly
        if (details.url.startsWith("qwen://")) {
            console.log("[Window] Caught qwen:// from setWindowOpenHandler:", details.url);
            deps.onDeepLink(details.url);
            return { action: "deny" };
        }
        // If it's an auth-related URL, open it in an in-app window so we can catch redirects
        const isAuthUrl = details.url.includes("login") ||
            details.url.includes("auth") ||
            details.url.includes("oauth") ||
            details.url.includes("account");
        if (isAuthUrl) {
            console.log("[Window] Opening auth URL in-app:", details.url);
            const authWindow = new electron_1.BrowserWindow({
                width: 500,
                height: 600,
                title: "Sign in to Qwen",
                parent: mainWindow,
                modal: false,
                webPreferences: {
                    partition: "persist:auth-session",
                },
            });
            authWindow.loadURL(details.url);
            // Catch qwen:// redirects in the auth window
            authWindow.webContents.on("will-navigate", (event, url) => {
                if (url.startsWith("qwen://")) {
                    event.preventDefault();
                    console.log("[Window] Auth window caught qwen:// redirect:", url);
                    deps.onDeepLink(url);
                    authWindow.close();
                }
            });
            // Also catch will-redirect for 302 redirects to qwen://
            authWindow.webContents.on("will-redirect", (event, url) => {
                if (url.startsWith("qwen://")) {
                    event.preventDefault();
                    console.log("[Window] Auth window caught qwen:// redirect (302):", url);
                    deps.onDeepLink(url);
                    authWindow.close();
                }
            });
            return { action: "deny" };
        }
        // For all other external links, open in system browser
        electron_1.shell.openExternal(details.url);
        return { action: "deny" };
    });
    // DevTools shortcut
    mainWindow.webContents.on("before-input-event", (event, input) => {
        if (input.key === "F12" ||
            (input.control && input.shift && input.key === "I")) {
            deps.onOpenDevTool(mainWindow);
            event.preventDefault();
        }
    });
    // Linux: setup system tray
    if (process.platform === "linux") {
        setupSystemTray(mainWindow, deps);
    }
    return mainWindow;
}
/**
 * Get icon path by trying multiple locations
 */
function getIconPath() {
    const iconPaths = [
        path.join(process.resourcesPath, "icon.png"),
        path.join(__dirname, "../../resources/icon.png"),
        path.join(process.cwd(), "resources/icon.png"),
    ];
    for (const p of iconPaths) {
        if (fs.existsSync(p)) {
            console.log(`[Tray] ✅ Found icon at: ${p}`);
            return p;
        }
    }
    console.error("[Tray] ❌ No icon found");
    return null;
}
/**
 * Setup Linux system tray.
 */
function setupSystemTray(mainWindow, deps) {
    console.log("[Tray] Setting up system tray...");
    const iconPath = getIconPath();
    if (!iconPath)
        return null;
    try {
        const trayIcon = electron_1.nativeImage.createFromPath(iconPath);
        const resizedIcon = trayIcon.resize({ width: 16, height: 16 });
        const appTray = new electron_1.Tray(resizedIcon);
        appTray.setToolTip("Qwen Desktop");
        const contextMenu = electron_1.Menu.buildFromTemplate([
            {
                label: "Show Qwen",
                click: () => {
                    if (mainWindow.isMinimized()) {
                        mainWindow.restore();
                    }
                    mainWindow.show();
                    mainWindow.focus();
                },
            },
            {
                label: "Hide Qwen",
                click: () => {
                    mainWindow.hide();
                },
            },
            { type: "separator" },
            {
                label: "Toggle DevTools",
                click: () => {
                    deps.onOpenDevTool(mainWindow);
                },
            },
            { type: "separator" },
            {
                label: "Quit",
                click: () => {
                    deps.setQuitting(true);
                    appTray.destroy();
                    electron_1.app.quit();
                },
            },
        ]);
        appTray.setContextMenu(contextMenu);
        appTray.on("click", () => {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            }
            else {
                if (mainWindow.isMinimized())
                    mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();
            }
        });
        appTray.on("double-click", () => {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            if (!mainWindow.isVisible())
                mainWindow.show();
            mainWindow.focus();
        });
        console.log("[Tray] ✅ System tray setup complete");
        return appTray;
    }
    catch (error) {
        console.error("[Tray] ❌ Failed to setup system tray:", error);
        return null;
    }
}
//# sourceMappingURL=window-manager.js.map
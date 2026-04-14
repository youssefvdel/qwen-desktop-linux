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
exports.isQuitting = isQuitting;
exports.setQuitting = setQuitting;
exports.configureApp = configureApp;
exports.handleDeepLink = handleDeepLink;
exports.setupProtocolHandler = setupProtocolHandler;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
// Local HTTP server for OAuth callback fallback
let authCallbackServer = null;
const AUTH_CALLBACK_PORT = 14920;
// === Quit State ===
let _isQuitting = false;
function isQuitting() {
    return _isQuitting;
}
function setQuitting(value) {
    _isQuitting = value;
}
/**
 * Register qwen:// protocol handler for AppImage on Linux.
 * AppImage creates its .desktop file dynamically on mount, so we
 * retry registration after a delay to ensure the file exists.
 */
function registerAppImageProtocolHandler() {
    if (process.platform !== "linux")
        return;
    if (!electron_1.app.isPackaged) {
        console.log("[Protocol] Skipping registration in dev mode");
        return;
    }
    const desktopDir = path.join(os.homedir(), ".local", "share", "applications");
    console.log("[Protocol] Starting registration...");
    function tryRegister() {
        try {
            const files = fs.readdirSync(desktopDir);
            console.log("[Protocol] Found desktop files:", files.filter(f => f.toLowerCase().includes("qwen")));
            const appimageDesktop = files.find(f => f.toLowerCase().includes("qwen") || f.toLowerCase().includes("qwen-desktop"));
            if (!appimageDesktop) {
                console.log("[Protocol] No .desktop file found yet");
                return false;
            }
            const desktopFile = path.join(desktopDir, appimageDesktop);
            console.log("[Protocol] Found:", desktopFile);
            let content = fs.readFileSync(desktopFile, "utf-8");
            console.log("[Protocol] Current MimeType:", content.match(/MimeType=.*/)?.[0] || "none");
            if (content.includes("x-scheme-handler/qwen")) {
                console.log("[Protocol] Already registered");
                return true;
            }
            if (content.includes("MimeType=")) {
                content = content.replace(/(MimeType=[^;]*);/, "$1;x-scheme-handler/qwen;");
            }
            else {
                content += "\nMimeType=x-scheme-handler/qwen;\n";
            }
            fs.writeFileSync(desktopFile, content);
            console.log("[Protocol] Patched:", desktopFile);
            (0, child_process_1.execSync)(`xdg-mime default ${appimageDesktop} x-scheme-handler/qwen`, { stdio: "pipe" });
            console.log("[Protocol] xdg-mime registered");
            (0, child_process_1.execSync)(`update-desktop-database ${desktopDir}`, { stdio: "pipe" });
            console.log("[Protocol] Desktop database updated");
            const handler = (0, child_process_1.execSync)(`xdg-mime query default x-scheme-handler/qwen`, { stdio: "pipe" }).toString().trim();
            console.log("[Protocol] Verified handler:", handler);
            return true;
        }
        catch (error) {
            console.error("[Protocol] Registration attempt failed:", error);
            return false;
        }
    }
    // Try immediately, then retry every 2 seconds for 10 seconds
    if (tryRegister())
        return;
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        console.log(`[Protocol] Retry attempt ${attempts}/5...`);
        if (tryRegister() || attempts >= 5) {
            clearInterval(interval);
            if (attempts >= 5) {
                console.log("[Protocol] Giving up after 5 attempts");
            }
        }
    }, 2000);
}
/**
 * Configure app command-line flags.
 * Call this ONCE at startup before app.whenReady().
 * Replaces module-level side effects.
 */
function configureApp() {
    // Wayland/X11 platform support (Fedora KDE defaults to Wayland)
    electron_1.app.commandLine.appendSwitch("enable-features", "UseOzonePlatform");
    electron_1.app.commandLine.appendSwitch("ozone-platform-hint", "x11");
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
}
/**
 * Handle qwen:// deep link URLs.
 */
function handleDeepLink(url, mainWindow) {
    console.log("[DeepLink] Handling URL:", url);
    const urlObj = new URL(url);
    if (urlObj.pathname === "/open") {
        const token = urlObj.searchParams.get("token");
        if (token) {
            console.log("[DeepLink] Auth token received");
            mainWindow?.webContents.send("event_from_main", {
                type: "auth_token",
                payload: { token },
            });
        }
    }
}
/**
 * Setup protocol handler (qwen://) and second-instance handler (Linux).
 */
function setupProtocolHandler(handlers) {
    // FIRST: Register .desktop file and MIME handler for AppImage
    registerAppImageProtocolHandler();
    // THEN: Set as default protocol client (uses the .desktop file)
    if (process.defaultApp) {
        if (process.argv.length >= 2) {
            electron_1.app.setAsDefaultProtocolClient("qwen", process.execPath, [process.argv[1]]);
        }
    }
    else {
        electron_1.app.setAsDefaultProtocolClient("qwen");
    }
    // Handle qwen:// URLs (macOS)
    electron_1.app.on("open-url", (event, url) => {
        event.preventDefault();
        handlers.onDeepLink(url);
    });
    // Handle second instance (Linux)
    electron_1.app.on("second-instance", (_event, commandLine) => {
        handlers.onCreateWindow();
        const url = commandLine.find((arg) => arg.startsWith("qwen://"));
        if (url)
            handlers.onDeepLink(url);
    });
    // Also check for qwen:// in initial command line args (first launch)
    const qwenUrl = process.argv.find((arg) => arg.startsWith("qwen://"));
    if (qwenUrl) {
        console.log("[Protocol] Deep link found in startup args:", qwenUrl);
        handlers.onDeepLink(qwenUrl);
    }
}
//# sourceMappingURL=app-lifecycle.js.map
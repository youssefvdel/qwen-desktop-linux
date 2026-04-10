import { app, BrowserWindow, ipcMain, session, dialog, shell, Tray, Menu, nativeImage } from "electron";
import path from "path";
import fs from "fs";
import settings from "electron-settings";
import windowStateKeeper from "electron-window-state";
import { McpProxy } from "../mcp/proxy.js";
import { adaptConfig } from "./mcp-config.js";
import { getPlatformName, ensureRuntimesExecutable, getBunPath } from "./runtime.js";
import { setupAutoUpdater } from "./updater.js";
import type { McpConfig, DialogOptions } from "../shared/types.js";

// === Constants ===
const APP_VERSION = app.getVersion();
const USER_AGENT_SUFFIX = `AliDesktop(QWENCHAT/${APP_VERSION})`;
const WEBVIEW_URL = "https://chat.qwen.ai";
const MCP_CONFIG_KEY = "mcp_config";

// === MCP Proxy Instance ===
const mcpServer = new McpProxy();

// === Window State (persistence) ===
let mainWindow: BrowserWindow | null = null;
let appTray: Tray | null = null;

/**
 * Get app version
 */
const getAppVersion = async (): Promise<string> => APP_VERSION;

/**
 * Get platform info
 */
const getPlatformInfo = async (): Promise<{
  platform: string;
  arch: string;
}> => ({
  platform: process.platform,
  arch: process.arch,
});

/**
 * Open DevTools
 */
const openDevTool = async (): Promise<void> => {
  mainWindow?.webContents.openDevTools({ mode: "right" });
};

/**
 * Toggle hidden DevTools
 */
const toggleHiddenDevTools = async (): Promise<void> => {
  if (mainWindow?.webContents.isDevToolsOpened()) {
    mainWindow.webContents.closeDevTools();
  } else {
    mainWindow?.webContents.openDevTools({ mode: "detach" });
  }
};

/**
 * Open external link in browser
 */
const openExternalLink = async (_event: any, url: string): Promise<void> => {
  await shell.openExternal(url);
};

/**
 * Show native dialog
 */
const showNativeDialog = async (options: DialogOptions): Promise<void> => {
  await dialog.showMessageBox(mainWindow!, {
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
const requestFileAccess = async (
  purpose: string,
  returnFile?: boolean,
): Promise<{ filePath: string; file?: string }> => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile"],
    title: purpose,
  });

  if (!filePaths || filePaths.length === 0) {
    return { filePath: "" };
  }

  const result: { filePath: string; file?: string } = {
    filePath: filePaths[0],
  };

  if (returnFile) {
    result.file = await fs.promises.readFile(filePaths[0], "utf-8");
  }

  return result;
};

// === MCP IPC Handlers ===

/**
 * List tools for a server
 */
const mcpClientToolList = async (_event: any, serverName: string) => {
  try {
    console.log(`[IPC] Listing tools for server: "${serverName}"`);
    console.log(
      "[IPC] Available servers:",
      Object.keys(mcpServer.getMCPServers()),
    );
    const list = await mcpServer.listTools({ serverName });
    console.log(`[IPC] Tools for "${serverName}":`, list);
    return list;
  } catch (error) {
    console.error(`[IPC] mcpClientToolList error for "${serverName}":`, error);
    throw error;
  }
};

/**
 * Get MCP config
 */
const mcpClientGetConfig = async (): Promise<McpConfig> => {
  return mcpServer.getMCPServers();
};

/**
 * Call MCP tool
 */
const mcpClientToolCall = async (_event: any, params: any) => {
  try {
    const result = await mcpServer.callTool(params);
    return result;
  } catch (error) {
    console.error("[IPC] mcpClientToolCall error:", error);
    throw error;
  }
};

/**
 * Update MCP config
 */
const mcpClientUpdateConfig = async (
  _event: any,
  config: McpConfig,
): Promise<McpConfig> => {
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

    const adapted = adaptConfig(config);
    console.log("[IPC] Adapted config:", JSON.stringify(adapted, null, 2));

    await mcpServer.setMCPServers(adapted);
    await settings.set(MCP_CONFIG_KEY, config as any);
    console.log("[IPC] MCP config saved successfully");
    return mcpClientGetConfig();
  } catch (error) {
    console.error("[IPC] mcpClientUpdateConfig error:", error);
    throw error;
  }
};

/**
 * Connect to MCP servers (initialize all)
 */
const mcpClientConnect = async (): Promise<void> => {
  try {
    const config = await loadMcpConfig();
    if (Object.keys(config).length > 0) {
      const adapted = adaptConfig(config);
      await mcpServer.setMCPServers(adapted);
      console.log("[IPC] MCP servers connected:", Object.keys(config));
    }
  } catch (error) {
    console.error("[IPC] mcpClientConnect error:", error);
  }
};

/**
 * Close MCP connections
 */
const mcpClientClose = async (): Promise<void> => {
  await mcpServer.disconnectAll();
};

// === Theme & Localization ===

const switchTheme = async (theme: "light" | "dark"): Promise<void> => {
  // Store theme preference
  await settings.set("app_theme", theme);
  // Notify renderer
  mainWindow?.webContents.send("event_from_main", {
    type: "theme_changed",
    payload: theme,
  });
};

const switchLn = async (language: string): Promise<void> => {
  await settings.set("app_language", language);
  mainWindow?.webContents.send("event_from_main", {
    type: "language_changed",
    payload: language,
  });
};

const updateTitleBarForSystemTheme = async (isDark: boolean): Promise<void> => {
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
async function loadMcpConfig(): Promise<McpConfig> {
  try {
    if (await settings.has(MCP_CONFIG_KEY)) {
      const config = await settings.get(MCP_CONFIG_KEY);
      const parsed = (config as unknown as McpConfig) || {};
      if (Object.keys(parsed).length > 0) {
        return parsed; // User has custom config, use it
      }
    }

    // First launch — create default MCP servers
    console.log("[Config] No MCP config found, creating defaults...");
    const defaults = getDefaultMcpConfig();
    await settings.set(MCP_CONFIG_KEY, defaults as any);
    console.log("[Config] ✅ Default MCP servers created:", Object.keys(defaults));
    return defaults;
  } catch (error) {
    console.error("[Config] Failed to load MCP config:", error);
  }
  return {};
}

/**
 * Get default MCP server configuration for first-time users
 */
function getDefaultMcpConfig(): McpConfig {
  const bunPath = getBunPath();
  const homeDir = require("os").homedir();
  return {
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

/**
 * Create the main window
 * Loads chat.qwen.ai directly with MCP bridge via preload script
 */
function createWindow() {
  console.log("[Window] Creating window...");
  console.log("[Window] __dirname:", __dirname);
  console.log("[Window] cwd:", process.cwd());
  console.log(
    "[Window] app.getAppPath():",
    require("electron").app.getAppPath(),
  );

  // Try multiple possible paths for preload
  const possiblePaths = [
    path.join(__dirname, "../preload/index.js"),
    path.join(__dirname, "preload/index.js"),
    path.join(process.cwd(), "out/preload/index.js"),
    path.join(process.cwd(), "src/preload/index.ts"),
  ];

  let preloadPath = possiblePaths[0];
  for (const p of possiblePaths) {
    const fs = require("fs");
    if (fs.existsSync(p)) {
      preloadPath = p;
      console.log(`[Window] ✅ Found preload at: ${p}`);
      break;
    } else {
      console.log(`[Window] ❌ Not found: ${p}`);
    }
  }

  console.log("[Window] Using preload path:", preloadPath);

  // Don't use windowStateKeeper for now - use defaults
  mainWindow = new BrowserWindow({
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

  // === TEMPORARY: Network Interception Logger ===
  // Captures ALL network requests to discover Qwen's API endpoints
  const ses = mainWindow!.webContents.session;

  ses.webRequest.onBeforeRequest(
    { urls: ["*://*/*"] },
    (details, callback) => {
      // Only log XHR requests (images, CSS, etc. excluded)
      if (details.resourceType === "xhr") {
        console.log(`[NET-LOG] ${details.method} ${details.url} (${details.resourceType})`);
        if (details.uploadData) {
          try {
            const body = details.uploadData
              .map((d: any) => d.bytes?.toString() || d.file || "")
              .join("");
            if (body.length < 2000) {
              console.log(`[NET-LOG] Body:`, body.substring(0, 500));
            }
          } catch (e) {}
        }
      }
      callback({});
    }
  );

  ses.webRequest.onSendHeaders(
    { urls: ["*://*/*"] },
    (details) => {
      if (details.resourceType === "xhr") {
        console.log(`[NET-LOG] Headers for ${details.url}:`, JSON.stringify(details.requestHeaders, null, 2).substring(0, 500));
      }
    }
  );

  // CDP Debugger for capturing response bodies
  mainWindow!.webContents.debugger.attach("1.3");
  mainWindow!.webContents.debugger.sendCommand("Network.enable");

  mainWindow!.webContents.debugger.on(
    "message",
    (_event: any, method: string, params: any) => {
      if (method === "Network.responseReceived") {
        const { requestId, response, type } = params;
        // Only log XHR/Fetch responses
        if (type === "XHR" || type === "Fetch") {
          console.log(
            `[NET-RESP] ${response.status} ${response.url} (${type})`,
          );
          // Try to get the response body
          const mw = mainWindow;
          if (mw) {
            mw.webContents.debugger.sendCommand(
              "Network.getResponseBody",
              { requestId },
            ).then((result: any) => {
              if (result && result.body) {
                const bodyPreview = result.body.substring(0, 500);
                console.log(`[NET-RESP] Body:`, bodyPreview);
              }
            }).catch((err: any) => {
              // Body might not be available for all requests
            });
          }
        }
      }
    },
  );
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
      .insertCSS(
        `
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
    `,
      )
      .then(() => {
        console.log("[Window] ✅ Injected CSS to hide mobile overlay");
      })
      .catch((err) => {
        console.error("[Window] Failed to inject CSS:", err);
      });

    console.log("[IPC] Initializing MCP...");
    mcpClientConnect();
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error("[Window] ❌ Failed to load!");
      console.error("[Window] Error code:", errorCode);
      console.error("[Window] Error:", errorDescription);
      console.error("[Window] URL:", validatedURL);
    },
  );

  mainWindow.on("closed", () => {
    console.log("[Window] Window closed");
    mainWindow = null;
    // Only exit if actually quitting, otherwise stay in tray
    if (isQuitting) {
      process.exit(0);
    }
  });

  mainWindow.on("close", (event) => {
    console.log("[Window] Window closing");
    // Don't actually close, just hide to tray
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      console.log("[Window] Hidden to tray instead of closing");
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // Linux: Handle system tray
  if (process.platform === "linux") {
    setupSystemTray();
  }

  // DevTools shortcut
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (
      input.key === "F12" ||
      (input.control && input.shift && input.key === "I")
    ) {
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
    path.join(process.resourcesPath, "icon.png"),
    path.join(__dirname, "../../resources/icon.png"),
    path.join(process.cwd(), "resources/icon.png"),
  ];

  let iconPath = iconPaths[0];
  for (const p of iconPaths) {
    if (fs.existsSync(p)) {
      iconPath = p;
      console.log(`[Tray] ✅ Found icon at: ${p}`);
      break;
    }
  }

  try {
    // Create tray icon
    const trayIcon = nativeImage.createFromPath(iconPath);
    
    // Resize for tray (Linux typically expects 16-24px icons)
    const resizedIcon = trayIcon.resize({ width: 16, height: 16 });
    
    appTray = new Tray(resizedIcon);
    appTray.setToolTip("Qwen Desktop");

    // Create context menu
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show Qwen",
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) {
              mainWindow.restore();
            }
            mainWindow.show();
            mainWindow.focus();
          } else {
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
          app.quit();
        },
      },
    ]);

    appTray.setContextMenu(contextMenu);

    // Click on tray icon to show/hide window
    appTray.on("click", () => {
      if (mainWindow && mainWindow.isVisible()) {
        mainWindow.hide();
      } else if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
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
  } catch (error) {
    console.error("[Tray] ❌ Failed to setup system tray:", error);
  }
}

// === IPC Registration ===

function registerIpcHandlers() {
  // App management
  ipcMain.handle("get_app_version", getAppVersion);
  ipcMain.handle("get_platform_info", getPlatformInfo);
  ipcMain.handle("open_devtool", openDevTool);
  ipcMain.handle("toggle_hidden_devtools", toggleHiddenDevTools);
  ipcMain.handle("open_external_link", openExternalLink);
  ipcMain.handle("show_native_dialog", (_, options) =>
    showNativeDialog(options),
  );
  ipcMain.handle("request_file_access", (_, purpose, returnFile) =>
    requestFileAccess(purpose, returnFile),
  );

  // MCP handlers
  ipcMain.handle("mcp_client_connect", mcpClientConnect);
  ipcMain.handle("mcp_client_close", mcpClientClose);
  ipcMain.handle("mcp_client_tool_list", mcpClientToolList);
  ipcMain.handle("mcp_client_tool_call", mcpClientToolCall);
  ipcMain.handle("mcp_client_get_config", mcpClientGetConfig);
  ipcMain.handle("mcp_client_update_config", mcpClientUpdateConfig);

  // Theme & localization
  ipcMain.handle("switch_theme", (_, theme) => switchTheme(theme));
  ipcMain.handle("switch_ln", (_, language) => switchLn(language));
  ipcMain.handle("update_title_bar_for_system_theme", (_, isDark) =>
    updateTitleBarForSystemTheme(isDark),
  );

  // Event forwarding
  ipcMain.on("event_to_main", (_, data) => {
    mainWindow?.webContents.send("event_from_main", data);
  });
}

// === Deep Link / Protocol Handler ===

function setupProtocolHandler() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient("qwen", process.execPath, [
        process.argv[1],
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient("qwen");
  }

  // Handle qwen:// URLs
  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  // Handle second instance (Linux) — always create window if none exists
  app.on("second-instance", (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else {
      createWindow();
    }

    const url = commandLine.find((arg) => arg.startsWith("qwen://"));
    if (url) handleDeepLink(url);
  });
}

function handleDeepLink(url: string) {
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
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-dev-shm-usage");
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("use-gl", "swiftshader");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("disable-features", "VizDisplayCompositor");

// Debug flags - Enable remote debugging for chrome-devtools-mcp
app.commandLine.appendSwitch("enable-logging");
app.commandLine.appendSwitch("v", "1");
app.commandLine.appendSwitch("remote-debugging-port", "9222");
app.commandLine.appendSwitch("remote-allow-origins", "*");

app.whenReady().then(async () => {
  console.log("[App] Starting Qwen Desktop for Linux");
  console.log("[App] Platform:", getPlatformName());
  console.log("[App] Version:", APP_VERSION);

  try {
    // Ensure bundled runtimes are executable
    await ensureRuntimesExecutable();

    // Register IPC handlers
    registerIpcHandlers();

    // Setup protocol handler
    setupProtocolHandler();

    // Setup auto-updater (only in production)
    if (app.isPackaged) {
      setupAutoUpdater();
    }

    // Create main window
    createWindow();

    console.log("[App] ✅ Window created successfully");

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error("[App] ❌ Failed to initialize:", error);
    // Keep app alive even if there's an error
    setTimeout(() => {
      createWindow();
    }, 1000);
  }
});

let isQuitting = false;

app.on("window-all-closed", () => {
  console.log("[App] All windows closed");
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  if (isQuitting) return;

  // Prevent default quit to do cleanup first
  event.preventDefault();
  isQuitting = true;

  console.log("[App] Cleaning up MCP servers...");

  // Disconnect all MCP servers to kill child processes (bun/uvx)
  // This is crucial to allow the app to exit fully
  mcpServer.disconnectAll().then(() => {
    mcpServer.stopHTTP();
    console.log("[App] MCP cleanup complete, quitting...");
    
    // Destroy tray before quitting
    if (appTray) {
      appTray.destroy();
      appTray = null;
      console.log("[Tray] Tray icon destroyed");
    }
    
    app.quit();
  }).catch((err) => {
    console.error("[App] Error during MCP cleanup:", err);
    mcpServer.stopHTTP();
    
    // Destroy tray before quitting
    if (appTray) {
      appTray.destroy();
      appTray = null;
    }
    
    app.quit();
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("[App] Uncaught exception:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[App] Unhandled rejection:", reason);
});

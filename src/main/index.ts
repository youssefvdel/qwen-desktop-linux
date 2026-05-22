/**
 * Qwen Studio — Main Entry Point
 *
 * This is the Electron app bootstrap. It:
 * - Configures app flags (GPU, sandbox, etc.)
 * - Creates the main BrowserWindow loading chat.qwen.ai
 * - Registers IPC handlers for renderer ↔ main communication
 * - Sets up MCP server management
 * - Handles app lifecycle (quit, activate, deep links)
 * - Builds the application menu
 */

import {
  app,
  BrowserWindow,
} from "electron";
import path from "path";
import fs from "fs";
import settings from "electron-settings";
import { McpProxy } from "../mcp/proxy.js";
import { adaptConfig } from "./mcp-config.js";
import {
  getPlatformName,
  ensureRuntimesExecutable,
  getBunPath,
} from "./runtime.js";
import { setupAutoUpdater } from "./updater.js";
import { createWindow } from "./window-manager.js";
import { registerIpcHandlers, MCP_CONFIG_KEY } from "./ipc-handlers.js";
import { logger } from "./logger.js";
import {
  configureApp,
  setupProtocolHandler,
  handleDeepLink,
  isQuitting,
  setQuitting,
} from "./app-lifecycle.js";
import {
  ensureSkillsDir,
  getAvailableSkills,
  injectSkill,
  openSkillsFolder,
} from "./skills-manager.js";
import type { McpConfig } from "../shared/types.js";

// === Constants ===
const APP_VERSION = app.getVersion();
const WEBVIEW_URL = "https://chat.qwen.ai";

// === MCP Proxy Instance ===
// Singleton that manages all MCP server connections
const mcpServer = new McpProxy();

// === Window State ===
let mainWindow: BrowserWindow | null = null;

/** Getter for mainWindow — used by IPC handlers and skills module */
const getMainWindow = (): BrowserWindow | null => mainWindow;

// === MCP Config Management ===

/**
 * Load MCP config from electron-settings.
 * If no config exists, creates default MCP servers (Desktop-Commander, Fetch, Filesystem, Sequential-Thinking).
 */
async function loadMcpConfig(): Promise<McpConfig> {
  try {
    if (await settings.has(MCP_CONFIG_KEY)) {
      const config = await settings.get(MCP_CONFIG_KEY);
      const parsed = (config as unknown as McpConfig) || {};
      if (Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
    console.log("[Config] No MCP config found, creating defaults...");
    const defaults = getDefaultMcpConfig();
    await settings.set(MCP_CONFIG_KEY, defaults as any);
    console.log(
      "[Config] ✅ Default MCP servers created:",
      Object.keys(defaults),
    );
    return defaults;
  } catch (error) {
    console.error("[Config] Failed to load MCP config:", error);
  }
  return {};
}

/**
 * Default MCP server configuration for first-time users.
 * All servers use the bundled bun runtime.
 */
function getDefaultMcpConfig(): McpConfig {
  const bunPath = getBunPath();
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
async function mcpClientConnect(): Promise<void> {
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
}

/** Disconnect all MCP servers */
async function mcpClientClose(): Promise<void> {
  await mcpServer.disconnectAll();
}

// === App Bootstrap ===

// Configure app flags BEFORE ready (GPU, sandbox, platform hints)
configureApp();

app.whenReady().then(async () => {
  logger.info('🚀 Starting Qwen Studio', { platform: getPlatformName(), version: APP_VERSION });

  try {
    // Make bundled runtimes executable (dev mode only)
    await ensureRuntimesExecutable();
    ensureSkillsDir();

    // Setup protocol handler (qwen:// deep links)
    setupProtocolHandler({
      onDeepLink: (url) => handleDeepLink(url, mainWindow),
      onCreateWindow: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        } else {
          mainWindow = createWindow({
            onMcpClientConnect: mcpClientConnect,
            onOpenDevTool: (win) =>
              win.webContents.openDevTools({ mode: "right" }),
            setQuitting,
            isQuitting,
            onDeepLink: (url) => handleDeepLink(url, mainWindow),
          });
        }
      },
    });

    // Register IPC handlers (app management, MCP, theme, dialogs)
    registerIpcHandlers({
      getMainWindow,
      mcpServer,
      adaptConfig,
      settings,
      loadMcpConfig,
      getDefaultMcpConfig,
      APP_VERSION,
    });

    // Auto-updater (production only)
    if (app.isPackaged) {
      setupAutoUpdater();
    }

    // Create main window (loads chat.qwen.ai with MCP bridge)
    mainWindow = createWindow({
      onMcpClientConnect: mcpClientConnect,
      onOpenDevTool: (win) => win.webContents.openDevTools({ mode: "right" }),
      setQuitting,
      isQuitting,
      onDeepLink: (url) => handleDeepLink(url, mainWindow),
    });

    console.log("[App] ✅ Window created successfully");

    // macOS: re-create window on dock click
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow({
          onMcpClientConnect: mcpClientConnect,
          onOpenDevTool: (win) =>
            win.webContents.openDevTools({ mode: "right" }),
          setQuitting,
          isQuitting,
          onDeepLink: (url) => handleDeepLink(url, mainWindow),
        });
      }
    });
  } catch (error) {
    console.error("[App] ❌ Failed to initialize:", error);
    // Retry after 1 second
    setTimeout(() => {
      mainWindow = createWindow({
        onMcpClientConnect: mcpClientConnect,
        onOpenDevTool: (win) => win.webContents.openDevTools({ mode: "right" }),
        setQuitting,
        isQuitting,
        onDeepLink: (url) => handleDeepLink(url, mainWindow),
      });
    }, 1000);
  }
});

// All windows closed — exit only if quitting, otherwise keep alive for tray
app.on("window-all-closed", () => {
  console.log("[App] All windows closed");
  if (isQuitting()) {
    console.log("[App] Quitting confirmed - exiting");
    app.exit(0);
  } else {
    console.log("[App] Keeping app alive for tray");
  }
});

// Before quit: disconnect all MCP servers
app.on("before-quit", () => {
  mcpServer.disconnectAll().catch(() => { });
});

// Global error handlers
process.on("uncaughtException", (error) => {
  console.error("[App] Uncaught exception:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[App] Unhandled rejection:", reason);
});

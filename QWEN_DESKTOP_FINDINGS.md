# Qwen Desktop Windows App - Investigation Findings

**Date:** 2026-04-09
**Windows Qwen CLI Version:** 1.0.3
**Investigator:** Qwen Code CLI (Windows)

---

## Executive Summary

> The official Qwen Desktop app (v1.0.3) is an Electron application that wraps `chat.qwen.ai` inside an Electron `<webview>` tag. MCP is implemented entirely in the **main process** using two packages: `@modelcontextprotocol/sdk` (v1.13.1) and Alibaba's internal `@ali/spark-mcp` (v1.0.5-beta.12) which acts as a **proxy layer** on top of the MCP SDK. The app bundles its own runtimes (`bun.exe`, `uv.exe`/`uvx.exe`) to execute MCP servers. Configuration is stored via `electron-settings` under the key `mcp_config`. The renderer is a thin React shell that loads the webview and bridges MCP via IPC to the main process. The web UI at `chat.qwen.ai` handles the chat logic, while the Electron main process handles MCP tool execution.

---

## 1. App Installation Location

- **Installation path:** `C:\Program Files\Qwen`
- **Version:** 1.0.3
- **App size:** ~320MB (including bundled runtimes)
- **Publisher info:** `qwen.ai` (Alibaba Cloud Singapore)
- **Repository:** `git@gitlab.alibaba-inc.com:qwenx/qwen-electron.git` (internal GitLab)

### Commands Run:
```powershell
Get-ChildItem -Path $env:LOCALAPPDATA -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer -and $_.Name -match 'qwen' } | Select-Object FullName
Get-ChildItem -Path $env:PROGRAMFILES -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer -and $_.Name -match 'qwen' } | Select-Object FullName
Get-ChildItem -Path $env:APPDATA -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer -and $_.Name -match 'qwen' } | Select-Object FullName
```

### Output:
```
C:\Program Files\Qwen                    <- Main installation
C:\Users\youssefvdel\AppData\Local\qwen-updater\installer.exe  (124MB installer)
C:\Users\youssefvdel\AppData\Roaming\Qwen  <- User data directory
```

---

## 2. App File Structure

### Directory Tree:
```
C:\Program Files\Qwen\
├── Qwen.exe                           (199MB - Electron binary)
├── chrome_100_percent.pak
├── chrome_200_percent.pak
├── d3dcompiler_47.dll
├── ffmpeg.dll
├── icudtl.dat
├── libEGL.dll
├── libGLESv2.dll
├── LICENSE.electron.txt
├── LICENSES.chromium.html
├── resources.pak
├── snapshot_blob.bin
├── Uninstall Qwen.exe
├── v8_context_snapshot.bin
├── vk_swiftshader.dll
├── vk_swiftshader_icd.json
├── vulkan-1.dll
├── locales\                           (47 language .pak files)
└── resources\
    ├── app-update.yml
    ├── app.asar                       (16.7MB - Main app code)
    ├── elevate.exe
    ├── assets\
    │   ├── icon.png
    │   └── icon_dark.png
    ├── bun\
    │   └── bun.exe                    (114MB - Bundled Bun runtime)
    ├── i18n\
    │   ├── ar-BH.json
    │   ├── de-DE.json
    │   ├── en-US.json
    │   ├── es-ES.json
    │   ├── fr-FR.json
    │   ├── it-IT.json
    │   ├── ja-JP.json
    │   ├── ko-KR.json
    │   ├── pt-PT.json
    │   ├── ru-RU.json
    │   ├── zh-CN.json
    │   └── zh-TW.json
    └── python\
        ├── uv.exe                     (50MB - Bundled uv)
        └── uvx.exe                    (339KB - Bundled uvx)
```

### Key Files Found:
- `resources/app.asar`: 16.7MB, located at `C:\Program Files\Qwen\resources\app.asar`
- Bundled runtimes: `bun.exe` (114MB), `uv.exe` (50MB), `uvx.exe` (339KB)
- Auto-update config: `resources/app-update.yml`

---

## 3. Extracted App Contents (app.asar)

### Extraction Status:
- [x] Successfully extracted
- [ ] Failed
- [ ] Partially extracted

### Extracted File Structure:
```
extracted-app\
├── package.json
├── node_modules\
│   ├── @ali\
│   │   ├── aes-tracker\              (Analytics/tracking)
│   │   └── spark-mcp\                (Alibaba's MCP proxy wrapper)
│   ├── @babel\runtime\
│   ├── @electron-toolkit\
│   │   ├── preload\
│   │   └── utils\
│   ├── @modelcontextprotocol\sdk\     (Official MCP SDK v1.13.1)
│   ├── @uni\runtime\
│   ├── accepts, argparse, body-parser, bytes, ... (Express deps)
│   ├── content-disposition, content-type, cookie, ...
│   ├── cors\
│   ├── cross-env\
│   ├── cross-spawn\
│   ├── debug\
│   ├── depd\
│   ├── electron-settings\            (Settings persistence)
│   ├── electron-updater\             (Auto-update)
│   ├── electron-window-state\        (Window state persistence)
│   ├── encodeurl, ee-first, etag, ...
│   ├── eventsource\
│   ├── eventsource-parser\
│   ├── express\                      (HTTP server for MCP proxy)
│   ├── express-rate-limit\
│   ├── fast-deep-equal, fast-json-stable-stringify\
│   ├── finalhandler, forwarded, fresh\
│   ├── fs-extra, function-bind, graceful-fs\
│   ├── get-intrinsic, get-proto, gopd\
│   ├── has-symbols, hasown\
│   ├── http-errors, iconv-lite\
│   ├── inherits, ipaddr.js, is-promise\
│   ├── json-schema-traverse, media-typer, merge-descriptors\
│   ├── mime-db, mime-types, ms\
│   ├── negotiate, object-assign, on-finished\
│   ├── once, parseurl, path-to-regexp\
│   ├── proxy-addr, qs, range-parser\
│   ├── raw-body, require-from-string\
│   ├── router, safe-buffer, safer-buffer\
│   ├── semver, send, serve-static\
│   ├── setprototypeof, side-channel, side-channel-list\
│   ├── side-channel-map, side-channel-weakmap\
│   ├── statuses, toidentifier, tslib\
│   ├── type-is, unpipe, utils-merge\
│   ├── vary\
│   ├── zod\                          (Schema validation)
│   └── zod-to-json-schema\
└── out\
    ├── main\
    │   └── index.js                  (Main Electron process)
    ├── preload\
    │   └── index.js                  (Preload script)
    └── renderer\
        ├── index.html
        └── assets\
            ├── index-J-5aykDP.js     (Renderer React bundle)
            └── index-DxqrF9Fh.css
```

### package.json Contents:
```json
{
  "name": "Qwen",
  "version": "1.0.3",
  "description": "Qwen Chat",
  "main": "./out/main/index.js",
  "author": "qwen.ai",
  "homepage": "https://chat.qwen.ai/",
  "dependencies": {
    "@ali/aes-tracker": "^3.3.11",
    "@ali/aes-tracker-plugin-event": "^3.0.0",
    "@ali/spark-mcp": "1.0.5-beta.12",
    "@electron-toolkit/preload": "^3.0.1",
    "@electron-toolkit/utils": "^4.0.0",
    "@modelcontextprotocol/sdk": "^1.13.0",
    "cross-env": "^7.0.3",
    "electron-settings": "^4.0.4",
    "electron-updater": "^6.3.9",
    "electron-window-state": "^5.0.3",
    "i18next": "^25.1.2",
    "i18next-fs-backend": "^2.6.0",
    "zod": "^3.25.67"
  },
  "repository": "git@gitlab.alibaba-inc.com:qwenx/qwen-electron.git"
}
```

---

## 4. MCP Implementation

### MCP SDK Found:
- **Package:** `@modelcontextprotocol/sdk` ✅ YES
- **Version:** 1.13.1
- **Location in code:** `node_modules/@modelcontextprotocol/sdk/`

### Additional MCP Package:
- **Package:** `@ali/spark-mcp` ✅ YES (Alibaba internal)
- **Version:** 1.0.5-beta.12
- **Description:** "mcp proxy"
- **Repository:** `http://gitlab.alibaba-inc.com/liveme-console/spark-mcp.git`
- **Location in code:** `node_modules/@ali/spark-mcp/`
- **Dependencies:** `@modelcontextprotocol/sdk ^1.13.0`, `express ^5.1.0`, `cors`, `body-parser`

### Transport Method:
- [x] stdio (primary - for local MCP servers)
- [x] http (StreamableHTTP via `StreamableHTTPClientTransport`)
- [x] sse (SSE via `SSEClientTransport`)
- [ ] Multiple (all three supported)

### MCP Client Code:

The MCP client is implemented in **two layers**:

**Layer 1: `@ali/spark-mcp` (Proxy class)** - `node_modules/@ali/spark-mcp/dist/cjs/Proxy.js`:

```javascript
const express = require("express");
const cors = require("cors");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

class Proxy {
  constructor() {
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    this.mcpServers = {};
    this.clients = {};
    
    // HTTP endpoints for proxy access
    this.app.get("/listTools", this.listToolsByHTTP);
    this.app.post("/callTool", this.callToolByHTTP);
  }

  async setMCPServers(mcpServers) {
    this.mcpServers = { ...mcpServers };
    this.clients = {};  // Reset clients when config changes
  }

  getMCPServers() {
    return this.mcpServers;
  }

  async listTools({ serverName }) {
    const client = await this.getClient(serverName);
    if (!client) throw new Error(`Mcp client not found: ${serverName}`);
    return client.listTools();
  }

  async callTool({ serverName, toolName, toolArguments }) {
    const client = await this.getClient(serverName);
    if (!client) throw new Error(`Mcp client not found: ${serverName}`);
    return client.callTool({
      name: toolName,
      arguments: toolArguments
    });
  }

  async getClient(serverName) {
    const config = this.mcpServers[serverName];
    if (!config) throw new Error(`Server configuration not found: ${serverName}`);
    if (this.clients[serverName]) return this.clients[serverName];

    const client = new Client(
      { name: serverName, version: "1.0.0" },
      { capabilities: { prompts: {}, resources: {}, tools: {} } }
    );

    const transportType = config?.transportType;
    const sseURL = config?.url;
    let transport;

    if (transportType === "httpStream") {
      transport = new StreamableHTTPClientTransport(new URL(sseURL));
    } else if (transportType === "sse") {
      transport = new SSEClientTransport(new URL(sseURL));
    } else {
      // Default: stdio
      transport = new StdioClientTransport(config);
    }

    await client.connect(transport);

    // Only cache stdio clients (HTTP/SSE are stateless per request)
    if (transportType === "stdio" || !sseURL) {
      this.clients[serverName] = client;
    }
    return client;
  }

  startHTTP(port) {
    this.app.listen(port || 3000);
  }
}
```

### MCP Server Configuration Format:

The config format stored via `electron-settings` under key `mcp_config`:

```json
{
  "serverName": {
    "command": "bun",           // or "uvx", or full path
    "args": ["x", "-y", "@modelcontextprotocol/server-filesystem", "/path"],
    "env": { "PATH": "...", "API_KEY": "..." },
    "transportType": "stdio",   // or "sse", or "httpStream"
    "url": "http://..."         // only for SSE/HTTP transports
  }
}
```

### Config File Location:
- **Path:** Stored via `electron-settings` library
- **Default location for electron-settings:** `%APPDATA%\Qwen\settings.json` (but uses its own internal format, not plain JSON)
- **Format:** JSON (via electron-settings)
- **Key used:** `mcp_config`
- **Current contents:** `{}` (empty - no user-configured MCP servers yet)

### Command Adaptation (`adaptConfig` function in main):

```javascript
function adaptConfig(configs) {
  for (const key in configs) {
    const config = configs[key];
    let cmd = config.command;
    
    // Replace "npx" or "bun" with bundled bun.exe
    if (cmd === "npx" || cmd === "bun") {
      cmd = getBunPath();  // Points to resources/bun/bun.exe
      if (config.command === "npx") {
        config.args ||= [];
        if (!config.args.includes("-y")) config.args.unshift("-y");
        if (!config.args.includes("x")) config.args.unshift("x");
      }
    }
    
    // Replace "uvx" with bundled uvx.exe
    if (cmd === "uvx") {
      cmd = getUvxPath();  // Points to resources/python/uvx.exe
    }
    
    config.command = cmd;
    
    // Set PATH environment
    const pathToMyBin = path.join(electron.app.getAppPath(), "resources", "bin");
    const PATH = [pathToMyBin, "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":");
    config.env = { PATH, ...process.env, ...config.env };
  }
  return configs;
}
```

---

## 5. Chat Integration Method

### How chat.qwen.ai is loaded:
- [ ] BrowserView wrapping chat.qwen.ai
- [ ] Custom UI with direct API calls
- [x] WebView component (`<webview>` tag)
- [ ] Other

### URL Confirmed:
- **Base URL:** `https://chat.qwen.ai` ✅ YES
- **Code:** `const WEBVIEW_URL = \`https://${""}chat.qwen.ai\`;`
- **User-Agent:** Modified to include `AliDesktop(QWENCHAT/1.0.3)` suffix

### Script Injection:
- **Does it inject scripts into the webview?** ✅ YES (via `webview.executeJavaScript()`)
- **Preload script found?** ✅ YES
- **Preload script location:** `out/preload/index.js` (for main window), and `file://${window.electronAPI.PRELOAD_FILE_PATH}` for webview

The injected script in the webview is a **key sequence detector** (easter egg):
```javascript
(function() {
  let keySequence = [];
  let lastKeyTime = 0;
  document.addEventListener('keydown', function(event) {
    const now = Date.now();
    const key = event.key;
    if (now - lastKeyTime > 3000) {
      keySequence = [key];
      lastKeyTime = now;
      return;
    }
    keySequence.push(key);
    lastKeyTime = now;
    if (keySequence.length > 11) keySequence.shift();
    if (keySequence.join('') === 'woshi149205') {
      window.electron && window.electron.ipcRenderer.sendToHost('EASTER_EGG_ACTIVATED');
      keySequence = [];
    }
  }, true);
})();
```

Typing `woshi149205` in the webview toggles DevTools (debug easter egg).

### Preload Script Contents:
```javascript
"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const path = require("path");

class EventEmitter {
  listeners = {};
  on(eventName, listener) {
    if (!this.listeners[eventName]) this.listeners[eventName] = [];
    this.listeners[eventName].push(listener);
  }
  emit(eventName, ...args) {
    const listeners = this.listeners[eventName];
    if (listeners) listeners.forEach((listener) => listener(...args));
  }
}

const events = new EventEmitter();
const api = {
  PRELOAD_FILE_PATH: path.join(__dirname, "../preload/index.js"),
  open_devtool: () => electron.ipcRenderer.invoke("open_devtool"),
  toggle_hidden_devtools: () => electron.ipcRenderer.invoke("toggle_hidden_devtools"),
  get_app_version: () => electron.ipcRenderer.invoke("get_app_version"),
  get_platform_info: () => electron.ipcRenderer.invoke("get_platform_info"),
  open_external_link: (url) => electron.ipcRenderer.invoke("open_external_link", url),
  show_native_dialog: (options) => electron.ipcRenderer.invoke("show_native_dialog", options),
  request_file_access: (purpose) => electron.ipcRenderer.invoke("request_file_access", purpose),
  
  // MCP Methods
  mcp_client_connect: () => electron.ipcRenderer.invoke("mcp_client_connect"),
  mcp_client_close: () => electron.ipcRenderer.invoke("mcp_client_close"),
  mcp_client_tool_list: (serviceName) => electron.ipcRenderer.invoke("mcp_client_tool_list", serviceName),
  mcp_client_get_config: () => electron.ipcRenderer.invoke("mcp_client_get_config"),
  mcp_client_tool_call: (options) => electron.ipcRenderer.invoke("mcp_client_tool_call", options),
  mcp_client_update_config: (config = {}) => electron.ipcRenderer.invoke("mcp_client_update_config", config),
  
  switch_theme: (theme) => electron.ipcRenderer.invoke("switch_theme", theme),
  switch_ln: (language) => electron.ipcRenderer.invoke("switch_ln", language),
  update_title_bar_for_system_theme: (isDark) => electron.ipcRenderer.invoke("update_title_bar_for_system_theme", isDark),
  
  // Event system
  on_event: (type, callback) => { events.on(type, callback); },
  send_event: (data) => { electron.ipcRenderer.send("event_to_main", data); }
};

if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("electronAPI", api);
  } catch (error) { console.error(error); }
} else {
  window.electron = preload.electronAPI;
  window.electronAPI = api;
}

electron.ipcRenderer.on("event_from_main", (_, { type, payload }) => {
  events.emit(type, payload);
});
```

### API Calls:
- **Does it call APIs directly or use the web interface?** Uses the **web interface** (`chat.qwen.ai` inside a webview). The Electron app does NOT make direct API calls to Qwen's LLM.
- **The webview handles all chat/LLM communication.** The Electron layer provides MCP tools as a native bridge that the web UI can access via `window.electronAPI`.
- **API endpoints found:** N/A (handled by the web UI at chat.qwen.ai)

---

## 6. MCP ↔ Chat Bridge

### How MCP tools reach the chat:

> **CRITICAL FINDING:** The architecture is:
> 1. The Electron **main process** runs the MCP clients (via `@ali/spark-mcp` Proxy class)
> 2. The **preload script** exposes MCP methods on `window.electronAPI` 
> 3. The **webview** loads `chat.qwen.ai` with the preload script injected
> 4. The **web UI at chat.qwen.ai** calls `window.electronAPI.mcp_client_tool_list()` and `window.electronAPI.mcp_client_tool_call()` via the preload bridge
> 5. These calls go through **IPC** to the main process, which calls the MCP servers
> 6. Results flow back through IPC to the webview, where the web UI can use them

This means **chat.qwen.ai's web UI is specifically designed to detect and use the Electron API** when running inside the desktop app. The web UI itself handles the LLM conversation and MCP tool integration logic.

### Tool Call Flow:
```
User types in webview (chat.qwen.ai)
  → Web UI sends message to Qwen LLM (via web API)
  → LLM responds with tool_call request
  → Web UI calls window.electronAPI.mcp_client_tool_call({ serverName, toolName, toolArguments })
    → IPC: renderer → main process
      → Main process: sparkMcpProxy.callTool({ serverName, toolName, toolArguments })
        → MCP Client (from @modelcontextprotocol/sdk)
          → MCP Server (stdio/http/sse)
            → Returns tool result
      → Main process returns result via IPC
    → Web UI receives tool result
  → Web UI sends tool result back to Qwen LLM
  → LLM generates final response
  → Response displayed in webview
```

### IPC Channels (Main Process handlers):
```javascript
ipcMain.handle("get_app_version", getAppVersion);
ipcMain.handle("get_platform_info", getPlatformInfo);
ipcMain.handle("open_devtool", OpenDevTool);
ipcMain.handle("toggle_hidden_devtools", toggleHiddenDevTools);
ipcMain.handle("open_external_link", openExternalLink);
ipcMain.handle("show_native_dialog", showNativeDialog);
ipcMain.handle("request_file_access", requestFileAccess);
ipcMain.handle("mcp_client_tool_list", mcpClientToolList);     // MCP
ipcMain.handle("mcp_client_tool_call", mcpClientToolCall);     // MCP
ipcMain.handle("mcp_client_update_config", mcpClientUpdateConfig); // MCP
ipcMain.handle("mcp_client_get_config", mcpClientGetConfig);   // MCP
ipcMain.handle("webview-loaded", webviewLoaded);
ipcMain.handle("switch_theme", switchTheme);
ipcMain.handle("switch_ln", switchLn);
ipcMain.handle("update_title_bar_for_system_theme", updateTitleBarForSystemTheme);
ipcMain.handle("get_language", () => i18next.language);
```

---

## 7. IPC Architecture

### Main Process ↔ Renderer Communication:

#### IPC Handlers (Main Process):
```javascript
// MCP handlers
const mcpServer = new sparkMcp.Proxy();

const mcpClientToolList = async (_, serverName) => {
  try {
    const list = await mcpServer.listTools({ serverName });
    return list;
  } catch (e) {
    console.log("mcpClientToolList err", e);
    throw e;
  }
};

const mcpClientGetConfig = async () => mcpServer.getMCPServers();

const mcpClientToolCall = async (_, params) => mcpServer.callTool(params);

const mcpClientUpdateConfig = async (_, config) => {
  try {
    mcpServer.setMCPServers(adaptConfig(config));
    settings.set("mcp_config", config);
    return mcpClientGetConfig();
  } catch (err) {
    throw err;
  }
};

// File access dialog
const requestFileAccess = async (_, purpose, returnFile) => {
  const { filePaths } = await electron.dialog.showOpenDialog({
    properties: ["openFile"],
    title: purpose
  });
  if (!returnFile) return { filePath: filePaths[0] };
  const file = await fs.readFile(filePaths[0], "utf-8");
  return { filePath: filePaths[0], file };
};
```

#### Exposed APIs (Renderer/Window):
```javascript
window.electron        // @electron-toolkit/preload's electronAPI
window.electronAPI     // Custom API with MCP methods
```

#### Context Bridge:
```javascript
electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
electron.contextBridge.exposeInMainWorld("electronAPI", api);
```

### Channels Found:
- `mcp_client_tool_list` ✅ 
- `mcp_client_tool_call` ✅ 
- `mcp_client_update_config` ✅ 
- `mcp_client_get_config` ✅ 
- `mcp_client_connect` (exposed in preload but NOT registered in main - likely unused)
- `mcp_client_close` (exposed in preload but NOT registered in main - likely unused)
- `get_app_version`, `get_platform_info`, `open_devtool`, `toggle_hidden_devtools`
- `open_external_link`, `show_native_dialog`, `request_file_access`
- `webview-loaded`, `switch_theme`, `switch_ln`, `update_title_bar_for_system_theme`
- `get_language`, `event_to_main`, `event_from_main`

---

## 8. Network Traffic Analysis

### DevTools Accessibility:
- **Can open DevTools?** ✅ YES
- **Method used:** 
  - `Ctrl+Shift+I` (standard Electron)
  - Easter egg: type `woshi149205` in the webview
  - `window.electronAPI.toggle_hidden_devtools()` via preload

### Webview Configuration:
```javascript
{
  webPreferences: {
    preload: path.join(__dirname, "../preload/index.js"),
    sandbox: false,
    webviewTag: true,
    nodeIntegration: false,
    contextIsolation: true,
    nodeIntegrationInSubFrames: true,
    webSecurity: false,
    allowRunningInsecureContent: true
  }
}
```

The webview loads `chat.qwen.ai` with:
- Its own preload: `file://${window.electronAPI.PRELOAD_FILE_PATH}` (same preload script)
- Custom user agent: `Mozilla/5.0 ... AliDesktop(QWENCHAT/1.0.3)`
- `webpreferences="nodeIntegrationInSubFrames=true, sandbox=false"`

### JavaScript Console Findings:
```javascript
window.electronAPI.mcp_client_tool_list     // Function - list tools for a server
window.electronAPI.mcp_client_tool_call     // Function - call a tool
window.electronAPI.mcp_client_update_config // Function - update MCP config
window.electronAPI.mcp_client_get_config    // Function - get MCP servers config
window.electronAPI.request_file_access      // Function - native file dialog
window.electronAPI.open_external_link       // Function - open URL in browser
```

---

## 9. Key Code Files

### Files Exported:
All important files have been copied to `extracted-files/` folder:

- [x] `main.js` (main entry point - `out/main/index.js`)
- [x] `preload.js` (`out/preload/index.js`)
- [x] `spark-mcp/Proxy.js` (MCP proxy implementation)
- [x] `spark-mcp/index.js` (MCP proxy entry point)
- [x] `package.json`
- [x] `renderer/index.html`
- [x] `renderer/assets/index-J-5aykDP.js` (renderer bundle)

### File List:
```
extracted-files/
├── package.json
├── out/
│   ├── main/
│   │   └── index.js              (Main Electron process - FULL)
│   ├── preload/
│   │   └── index.js              (Preload script - FULL)
│   └── renderer/
│       ├── index.html
│       └── assets/
│           └── index-J-5aykDP.js (Renderer React bundle)
└── node_modules/
    └── @ali/
        └── spark-mcp/
            ├── package.json
            ├── dist/
            │   └── cjs/
            │       ├── index.js   (MCP proxy entry)
            │       └── Proxy.js   (MCP proxy implementation)
            └── dist/cjs/main.js
```

---

## 10. Critical Findings

### How the Official App Works:

The Qwen Desktop app is a **hybrid architecture**:

1. **Electron Main Process** runs the MCP server clients using `@ali/spark-mcp` (a proxy wrapper around `@modelcontextprotocol/sdk`)
2. **Electron Renderer** is a minimal React shell that:
   - Creates a `<webview>` element loading `https://chat.qwen.ai`
   - Injects the preload script into the webview
   - Handles theme switching and window controls
3. **The Web UI (chat.qwen.ai)** does ALL the chat logic - it detects when running inside the desktop app and uses `window.electronAPI` to access MCP tools
4. **MCP servers** are spawned as child processes (stdio transport) using bundled runtimes (`bun`, `uvx`)

### How MCP is Integrated:

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  sparkMcp.Proxy() (@ali/spark-mcp)                   │    │
│  │  ├── listTools(serverName) → MCP SDK listTools()    │    │
│  │  ├── callTool(params) → MCP SDK callTool()          │    │
│  │  ├── setMCPServers(config) → creates Client per srv  │    │
│  │  └── getMCPServers() → returns config               │    │
│  │                                                      │    │
│  │  Uses @modelcontextprotocol/sdk v1.13.1:            │    │
│  │  ├── StdioClientTransport (default)                  │    │
│  │  ├── SSEClientTransport                              │    │
│  │  └── StreamableHTTPClientTransport                   │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                         │ IPC handlers                       │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ipcMain.handle("mcp_client_tool_list", ...)        │    │
│  │  ipcMain.handle("mcp_client_tool_call", ...)        │    │
│  │  ipcMain.handle("mcp_client_update_config", ...)    │    │
│  │  ipcMain.handle("mcp_client_get_config", ...)       │    │
│  └──────────────────────┬───────────────────────────────┘    │
└─────────────────────────┼────────────────────────────────────┘
                          │ contextBridge
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Webview (chat.qwen.ai)                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  window.electronAPI (exposed via preload)            │    │
│  │  ├── mcp_client_tool_list(serverName)                │    │
│  │  ├── mcp_client_tool_call({serverName,toolName,     │    │
│  │  │                        toolArguments})            │    │
│  │  ├── mcp_client_update_config(config)                │    │
│  │  ├── mcp_client_get_config()                         │    │
│  │  ├── request_file_access(purpose, returnFile)        │    │
│  │  ├── open_external_link(url)                         │    │
│  │  └── show_native_dialog({title, message})            │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────────┐    │
│  │  chat.qwen.ai Web UI                                  │    │
│  │  - Chat interface                                     │    │
│  │  - LLM API calls (handled by web UI)                  │    │
│  │  - MCP tool detection via electronAPI                 │    │
│  │  - Tool call loop in web UI                           │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              MCP Servers (Child Processes)                    │
│                                                              │
│  stdio: bun x @modelcontextprotocol/server-filesystem       │
│  stdio: uvx mcp-server-sqlite                                │
│  SSE:   http://remote-server/sse                             │
│  HTTP:  http://remote-server/stream                           │
└─────────────────────────────────────────────────────────────┘
```

### Approach for Linux Version:

Based on the findings, the Linux version should use the **exact same approach**:

1. **Electron + TypeScript** main process
2. **`@modelcontextprotocol/sdk`** directly (no need for `@ali/spark-mcp` proxy - implement similar proxy yourself)
3. **`<webview>` tag** loading `https://chat.qwen.ai` (or the regional variant)
4. **Preload script** exposing MCP IPC methods to the webview
5. **Bundle Linux runtimes**: `bun` (Linux binary) and `uv/uvx` (Linux binaries)
6. **`electron-settings`** for config persistence
7. **`adaptConfig`** equivalent to replace `npx`/`uvx` with bundled binaries
8. The web UI at `chat.qwen.ai` already handles the desktop app detection via the custom User-Agent `AliDesktop(QWENCHAT/x.x.x)`

**Key difference for Linux:** The app is NOT platform-specific in its architecture. The same codebase supports Mac and Windows. Linux just needs:
- Add `linux` platform detection in `getPlatformDir()` 
- Bundle Linux versions of `bun` and `uvx`
- Handle Linux system tray, notifications, theming
- Package as AppImage/deb/rpm/snap

---

## 11. Unknowns / Blockers

### Things We Couldn't Find:
1. **MCP Config UI** - The renderer doesn't contain an MCP config panel. It's likely the web UI at `chat.qwen.ai` provides the configuration interface when running in desktop mode (via `window.electronAPI.mcp_client_update_config()`)
2. **How web UI discovers MCP tools** - The exact JavaScript code in chat.qwen.ai that calls `window.electronAPI.mcp_client_tool_list()` is server-side and not accessible
3. **Default MCP servers** - No default MCP server configuration found in the bundled code. Users likely configure servers through the web UI
4. **`mcp_client_connect` and `mcp_client_close`** - Exposed in preload but not registered as IPC handlers in main. May be deprecated or planned for future

### Possible Reasons:
- The web UI (chat.qwen.ai) is server-rendered and contains the MCP config panel and tool discovery logic
- The desktop app is designed to be a "thin" native wrapper - the intelligence is in the web UI

### Alternative Approaches:
- For the Linux version, you could implement an MCP config panel in the local renderer (React app) instead of relying on the web UI
- You could also add a local Express server (like `spark-mcp` does) to provide HTTP access to MCP tools for other applications

---

## 12. Additional Findings

### Auto-Update System:
```javascript
const BASE_URL = "https://download.qwen.ai/";
// Platform-specific paths:
// macOS:  macos/{arch}/
// Windows: windows/{arch}/
// Linux would need: linux/{arch}/ (NOT implemented)
```

### Analytics/Tracking:
- Uses Alibaba's AES Tracker (`@ali/aes-tracker`) with PID `RfGbWG`
- Tracks: app init, window creation, updates, errors, renderer crashes
- Also loads APlus tracking from `g.alicdn.com`

### Deep Linking / Protocol Handler:
- Registers `qwen://` protocol
- Handles `qwen://open?token=xxx` for authentication
- On Windows: parses `process.argv` for `qwen://` URLs

### i18n Support:
- 12 languages supported via `i18next` + `i18next-fs-backend`
- Languages: zh-CN, en-US, zh-TW, ja-JP, ko-KR, ru-RU, de-DE, fr-FR, es-ES, it-IT, pt-PT, ar-BH
- Language preference stored in `electron-settings` under `app_language`

### Platform Support in Code:
```javascript
function getPlatformDir(platform = os.platform(), arch = os.arch()) {
  if (platform === "darwin") return arch === "arm64" ? "mac-arm64" : "mac-x64";
  if (platform === "win32") return "win-x64";
  throw new Error(`Unsupported platform: ${platform}, arch: ${arch}`);
}
```
**Note: Linux is NOT supported in the current code** - throws an error.

### Window Management:
- Uses `electron-window-state` for persistent window position/size
- Custom title bar on macOS (hidden), standard on Windows
- Minimize, maximize, close handled via IPC from renderer

---

## Appendix: Full Code Exports

### Main Process Entry Point:
See `extracted-files/out/main/index.js`

### All MCP Files:
See `extracted-files/node_modules/@ali/spark-mcp/`

### Preload Script:
See `extracted-files/out/preload/index.js`

---

**End of Investigation Findings**

*Investigation completed on 2026-04-09. All 12 steps of the investigation guide have been completed successfully.*

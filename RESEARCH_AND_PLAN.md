# Qwen Desktop for Linux - Research & Implementation Plan

**Created:** 2026-04-09 
**Status:** Planning Phase 
**Target:** Full-featured Linux desktop app with MCP support

---

## Current State Analysis

### What Exists

| Platform | Status | Type | MCP Support | Backend | Source |
| ------------------ | -------------- | ------------- | ----------- | --------------------- | --------------------------- |
| **Mac** | Official | Electron | Yes | chat.qwen.ai (Global) | Closed source |
| **Windows** | Official | Electron | Yes | chat.qwen.ai (Global) | Closed source |
| **Linux** | No official | - | - | - | - |
| **Linux (Snap)** | Unofficial | Basic wrapper | Basic | chat.qwen.ai | `qwen-desktop` on Snapcraft |
| **Linux (GitHub)** | Unofficial | Electron | No | chat.qwen.ai | `lisniuse/qwen-desktop` |

### Existing Linux Options

#### 1. Snap Package: `qwen-desktop`
- **Publisher:** Andreas Nkansah (casbeki)
- **Version:** 0.1.0
- **Features:** Fast native UI, keyboard shortcuts, basic MCP
- **Limitations:** Basic wrapper, no advanced MCP configuration
- **Install:** `sudo snap install qwen-desktop`
- **Source:** Not (no source code link)

#### 2. GitHub: `lisniuse/qwen-desktop`
- **Type:** Unofficial Electron wrapper for chat.qwen.ai
- **Features:** Global shortcuts, code execution (Python/Node/HTML)
- **MCP:** Not implemented
- **Linux Support:** Listed as "To be implemented"
- **Stack:** Electron Forge, JavaScript (~99%), minimal repo (7 commits)
- **Status:** Early stage, not production-ready

#### 3. Official Desktop Apps (Windows/Mac)
- **Type:** Official Electron apps by Alibaba Cloud Singapore
- **Backend:** `chat.qwen.ai` (Global version)
- **Features:** File chat, screen analysis, email integration, MCP servers
- **MCP:** Full support (filesystem, browser, custom tools)
- **Source:** Closed source (not available on GitHub)
- **Download:** `https://qwen.ai/download`

---

## MCP (Model Context Protocol) Research

### What is MCP?

Model Context Protocol enables AI assistants to interact with external tools and services:
- **File System Access** - Read, write, search files
- **Browser Automation** - Control browsers, take screenshots
- **Custom Tools** - Any command-line tool or API
- **Resource Access** - Databases, APIs, local services

### MCP Architecture in Electron

#### Transport Methods

| Method | Use Case | Process | Notes |
| --------- | -------------- | ----------------- | --------------------- |
| **stdio** | Local tools | Main process only | Most common, simplest |
| **HTTP** | Remote servers | Main or renderer | Streaming support |
| **SSE** | Event streams | Main or renderer | Server-sent events |

#### Core SDK
- **Package:** `@modelcontextprotocol/sdk`
- **Client:** `Client` class with transport abstraction
- **Transports:** `StdioClientTransport`, `SSEClientTransport`, `HTTPClientTransport`

#### MCP Client Flow

```
User Input → Qwen LLM → Tool Call Request → MCP Client → MCP Server (stdio/http)
 ↓
Response ← Qwen LLM ← Tool Result ← MCP Client ← Server Response
```

### Reference Implementation (from article)

**Key Components:**

1. **Main Process** - MCP client runs here (avoids browser compatibility issues)
2. **IPC Bridge** - Expose MCP methods to renderer securely
3. **Tool Registry** - Map LLM tool calls to MCP server calls
4. **OpenAI Integration** - Pass MCP tools to OpenAI-compatible API

**Code Structure:**

```typescript
class McpClient {
 mcp: Client;
 transport: Transport;

 async connectToServer(params: { command, args, env, timeout })
 async connectToSseServer(url: string, options)
 async getTools() → Array<Tool>
 async callTool(params: { name, arguments })
 async cleanup()
}
```

**IPC Bridge:**

```typescript
// Main process
ipcMain.handle(
 "mcp:start",
 async (_, params) => await mcp.connectToServer(params),
);
ipcMain.handle("mcp:tools", () => mcp.getTools());
ipcMain.handle("mcp:callTool", (_, params) => mcp.callTool(params));

// Preload
contextBridge.exposeInMainWorld("mcpIPC", {
 startServer: (params) => ipcRenderer.invoke("mcp:start", params),
 getTools: () => ipcRenderer.invoke("mcp:tools"),
 callTool: (params) => ipcRenderer.invoke("mcp:callTool", params),
});
```

---

## What Makes Desktop MCP Powerful

### Official Desktop App Features (Mac/Windows)

1. **File Chat** - Upload and discuss documents
2. **Screen Analysis** - AI sees your screen content
3. **Email Integration** - Chat about email content
4. **MCP Server Config** - Connect custom tools
5. **Multitasking** - Multiple conversations
6. **Image/Video Generation** - Create multimedia content

### Why Web UI Lacks MCP
- Browser sandbox restrictions
- No native file system access
- No local process execution
- Security limitations for tool access
- No system tray or global shortcuts
- Desktop apps (Win/Mac) solve this via Electron + MCP SDK in main process

---

## Implementation Plan

### Architecture Overview

```

 Electron Application 

 Main Renderer (Web UI) 
 Process 
 
 Qwen Web View 
 MCP (Enhanced wrapper) 
 Client 
 User Interface 
 
 IPC 
 Bridge 
 MCP Config Panel 
 
 Runtime 
 (Node) 
 

 
 

 MCP Servers (stdio/http/sse) 
 
 Filesystem Browser Custom 
 Server Server Tools 
 

```

### Phase 1: Project Foundation

**Goal:** Set up Electron + TypeScript project
- [ ] Initialize npm project with TypeScript
- [ ] Configure Electron Forge for building
- [ ] Set up main process (main.ts)
- [ ] Set up renderer (React or vanilla TS)
- [ ] Configure ESLint + Prettier
- [ ] Add development scripts

**Deliverables:**
- Working Electron app with hot reload
- TypeScript compilation
- Basic window with dev tools

### Phase 2: MCP Core Integration

**Goal:** Full MCP client with all transports
- [ ] Install `@modelcontextprotocol/sdk`
- [ ] Implement `McpClient` class
- [ ] Add stdio transport support
- [ ] Add HTTP transport support
- [ ] Add SSE transport support
- [ ] Create tool registry
- [ ] Implement tool call loop with OpenAI API
- [ ] Add MCP server configuration UI

**Deliverables:**
- Working MCP client
- Connect to test servers
- List and call tools
- Configuration file support

### Phase 3: Qwen Integration

**Goal:** Enhanced web wrapper with MCP bridge
- [ ] Create BrowserView/WebView for chat.qwen.ai (global version)
- [ ] Inject MCP bridge script into web view
- [ ] Implement IPC communication (main ↔ renderer)
- [ ] Add MCP config panel (native UI)
- [ ] Handle authentication/session
- [ ] Add system tray integration
- [ ] Implement global shortcuts

**Deliverables:**
- Qwen web interface in desktop shell
- MCP tools accessible from chat
- Config panel for MCP servers
- Native OS integration

### Phase 4: Linux-Specific Features

**Goal:** Polish for Linux ecosystem
- [ ] System tray icon (AppIndicator)
- [ ] Global shortcuts (Ctrl+Z+Space or custom)
- [ ] File picker dialogs (native)
- [ ] Notification system (libnotify)
- [ ] Dark mode (GTK theme aware)
- [ ] Wayland/X11 compatibility
- [ ] HiDPI support

**Deliverables:**
- Native Linux feel
- Proper desktop integration
- Theme awareness
- Multi-display support

### Phase 5: Packaging & Distribution

**Goal:** Multiple Linux package formats
- [ ] Configure Electron Forge makers:
- [ ] AppImage (portable)
- [ ] deb (Debian/Ubuntu)
- [ ] rpm (Fedora/RHEL)
- [ ] snap (Snapcraft)
- [ ] flatpak (optional)
- [ ] Auto-updater integration
- [ ] Linux-specific build hooks
- [ ] Code signing (if applicable)

**Deliverables:**
- Installable packages for all major distros
- Portable AppImage
- Auto-update capability

### Phase 6: Testing & Documentation

**Goal:** Verify functionality and document
- [ ] Test MCP servers:
- [ ] Filesystem server
- [ ] Browser server (Playwright)
- [ ] Custom tool servers
- [ ] Test on multiple distros:
- [ ] Fedora 43 (your system)
- [ ] Ubuntu 24.04
- [ ] Arch Linux
- [ ] Create documentation:
- [ ] Installation guide
- [ ] MCP configuration guide
- [ ] Troubleshooting
- [ ] Development guide

**Deliverables:**
- Working app tested on 3+ distros
- Complete documentation
- Example MCP configs

---

## Proposed Project Structure

```
qwen-desktop-linux/
 src/
 main/
 index.ts # Electron main process
 mcp/
 client.ts # MCP client class
 transports/
 stdio.ts # stdio transport
 http.ts # HTTP transport
 sse.ts # SSE transport
 registry.ts # Tool registry
 config.ts # MCP config loader
 ipc/
 handlers.ts # IPC handlers
 window.ts # Window management
 preload/
 index.ts # Preload script (bridge)
 renderer/
 index.tsx # React entry point
 App.tsx # Main app component
 components/
 BrowserView.tsx # Qwen web view
 McpConfig.tsx # MCP config panel
 SystemTray.tsx # Tray menu
 styles/
 global.css
 shared/
 types.ts # Shared TypeScript types
 config/
 mcp-servers.json # Default MCP config
 resources/
 icon.png # App icon
 tray-icon.png # Tray icon
 scripts/
 build-linux.sh # Linux build script
 test-mcp.sh # MCP test script
 package.json
 tsconfig.json
 forge.config.ts # Electron Forge config
 .eslintrc.json
 .prettierrc
 README.md
```

---

## MCP Configuration Example

### User Config File (`~/.config/qwen-desktop/mcp-servers.json`)

```json
{
 "mcpServers": {
 "filesystem": {
 "command": "npx",
 "args": [
 "-y",
 "@modelcontextprotocol/server-filesystem",
 "/home/user/Documents",
 "/home/user/Desktop"
 ],
 "env": {},
 "disabled": false
 },
 "browser": {
 "command": "npx",
 "args": ["-y", "@anthropic/mcp-server-playwright"],
 "env": {},
 "disabled": false
 },
 "sqlite": {
 "command": "uvx",
 "args": ["mcp-server-sqlite", "--db-path", "/home/user/data.db"],
 "env": {},
 "disabled": true
 },
 "custom-tool": {
 "command": "python3",
 "args": ["/home/user/scripts/my-tool.py"],
 "env": {
 "API_KEY": "your-key-here"
 },
 "disabled": false
 }
 }
}
```

---

## Key Technical Decisions

### 1. Framework: Electron
- **Why:** Same as official Mac/Windows apps
- **Pros:** Cross-platform, mature, huge ecosystem
- **Cons:** Larger bundle size (~150MB)

### 2. Language: TypeScript
- **Why:** Type safety, better DX, matches official apps
- **Target:** ES2022+ for modern Node.js

### 3. Renderer: React vs Vanilla
- **Recommendation:** React (better component model for config UI)
- **Alternative:** Vanilla TS (simpler, smaller bundle)

### 4. MCP SDK Version
- **Package:** `@modelcontextprotocol/sdk`
- **Version:** Latest stable (check npm)
- **Note:** Actively maintained by Anthropic

### 5. Qwen Integration
- **Approach:** BrowserView wrapping qwen.ai
- **Enhancement:** Inject bridge script for MCP access
- **Alternative:** Full custom UI with API calls (more work, more control)

### 6. Linux Packaging
- **Primary:** AppImage (universal, portable)
- **Secondary:** deb (Ubuntu/Debian), rpm (Fedora)
- **Tertiary:** snap (auto-updates, wide support)

---

## Next Steps

1. **Scaffold Project** - Initialize Electron + TypeScript
2. **Implement MCP Client** - Core functionality first
3. **Test with Sample Server** - Verify stdio transport works
4. **Build Qwen Wrapper** - Add BrowserView + IPC
5. **Package for Linux** - Create AppImage + deb/rpm
6. **Test on Fedora 43** - Your system as primary test bed

---

## Resources

### Documentation
- [MCP Official Docs](https://modelcontextprotocol.io)
- [MCP SDK (npm)](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [Electron Docs](https://www.electronjs.org/docs)
- [Electron Forge](https://www.electronforge.io)

### Reference Implementations
- [: Electron + MCP Guide](https://juejin.cn/post/7600430748781346859)
- [: MCP Chat Room](https://juejin.cn/post/7487813517548159003)
- [ContextForge Desktop](https://github.com/contextforge-org/contextforge-desktop)
- [Electron MCP Server](https://github.com/punkpeye/awesome-mcp-servers/issues/1180)

### Existing Apps
- [Snap: qwen-desktop](https://snapcraft.io/qwen-desktop)
- [GitHub: lisniuse/qwen-desktop](https://github.com/lisniuse/qwen-desktop)

### Popular MCP Servers
- `@modelcontextprotocol/server-filesystem` - File access
- `@anthropic/mcp-server-playwright` - Browser automation
- `@modelcontextprotocol/server-github` - GitHub integration
- `@modelcontextprotocol/server-google-maps` - Maps/search

---

**End of Research & Plan Document**

This document will be updated as implementation progresses.

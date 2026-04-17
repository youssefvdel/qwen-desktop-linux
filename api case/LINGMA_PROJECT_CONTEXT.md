# Lingma Found - Project Context & Insights

## Project Identity
- **Name:** Qwen Desktop for Linux
- **Purpose:** An open-source Electron wrapper for `chat.qwen.ai` specifically designed for Linux distributions (Ubuntu, Fedora, Arch).
- **Key Differentiator:** Brings the official Windows/macOS desktop experience (including MCP support and native integrations) to Linux users.

## Tech Stack
- **Framework:** Electron 34
- **Language:** TypeScript
- **Build Tools:** Electron Forge, electron-builder
- **Runtimes:** Bundled `bun` and `uvx` binaries for cross-distro consistency.
- **MCP (Model Context Protocol):** Integrated via a custom proxy (`src/mcp/proxy.ts`) to allow the AI to interact with local tools.

## Key Architectural Components

### 1. Main Process (`src/main/`)
- **`index.ts`:** The entry point. Handles app lifecycle, IPC registration, and window creation.
- **`window-manager.ts`:** Manages the `BrowserWindow`. It loads `chat.qwen.ai`, injects CSS to hide mobile overlays, and sets up the system tray.
- **`mcp-config.ts`:** Adapts MCP server configurations to use the bundled Linux runtimes instead of system-wide `npx` or `bun`.
- **`skills-manager.ts`:** Manages "Skills" (plugins) that extend the AI's capabilities.

### 2. Preload Script (`src/preload/`)
- **Role:** Acts as the secure bridge between the renderer (web page) and the main process.
- **API Exposure:** Exposes `window.electronAPI` which provides methods like `open_devtool`, `get_app_version`, and `request_file_access`.
- **Context Isolation:** Runs in an isolated context to prevent the web page from accessing Node.js APIs directly.

### 3. Renderer (`src/renderer/`)
- **Content:** Currently a simple `index.html` that acts as a loading screen before the webview takes over.
- **Webview:** The actual UI is loaded from `https://chat.qwen.ai`.

## Current Findings for API Integration
1. **React-Based UI:** The underlying website uses React, meaning any programmatic interaction (like sending a message via API) requires triggering synthetic React events, not just DOM manipulation.
2. **Strict CSP:** The site enforces Content Security Policies that will need to be intercepted and modified in the Main process to allow for local API bridging.
3. **Electron Capabilities:** The app already uses `webContents.executeJavaScript` and `session` APIs, which are the exact tools needed to build the OpenAI-compatible bridge.

## Development Workflow
- **Dev Mode:** `npm start`
- **Build:** `npm run make` (produces AppImage, .deb, and .rpm)
- **Linting:** `npm run lint`

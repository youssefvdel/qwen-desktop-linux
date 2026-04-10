# Qwen Desktop for Linux

**The official Qwen AI desktop app, now for Linux with full MCP support!**

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Linux-orange.svg)

---

## ✨ Features

- 🤖 **Full Qwen AI Chat** - Direct access to chat.qwen.ai with desktop app experience
- 🔌 **MCP Support** - Connect to filesystem, browser automation, custom tools
- 📁 **File Access** - Native file picker and file system access
- 🖥️ **System Tray** - Linux system tray integration
- 🌓 **Theme Support** - Light/dark mode with system theme detection
- 🌍 **i18n** - 12 languages supported
- 📦 **Multiple Formats** - AppImage, .deb, .rpm packages
- 🔒 **Secure** - Context isolation, sandboxed webview, fuse security

---

## 🚀 Quick Start

### Prerequisites

- Node.js 22+
- npm or yarn
- Linux (x64 or arm64)

### Install & Run

```bash
# Clone or copy this project
cd qwen-desktop-linux

# Install dependencies (automatically downloads bun + uv runtimes)
npm install

# Start in development mode
npm start
```

### Build Packages

```bash
# Build all Linux packages (AppImage, deb, rpm)
npm run make

# Build specific format
npm run make:appimage  # Universal portable app
npm run make:deb       # Debian/Ubuntu
npm run make:rpm       # Fedora/RHEL
```

---

## 📦 Installation (After Build)

### AppImage (Recommended - Works on All Distros)

```bash
# Make executable
chmod +x Qwen-1.0.0.AppImage

# Run
./Qwen-1.0.0.AppImage
```

### Debian/Ubuntu

```bash
sudo dpkg -i qwen-desktop_1.0.0_amd64.deb
sudo apt-get install -f  # Install dependencies

# Launch from applications menu or:
qwen-desktop
```

### Fedora/RHEL

```bash
sudo dnf install qwen-desktop-1.0.0.x86_64.rpm

# Launch from applications menu or:
qwen-desktop
```

---

## 🔌 MCP Configuration

### What is MCP?

Model Context Protocol (MCP) lets Qwen interact with:
- **Files** - Read, write, search your filesystem
- **Browser** - Automate web browsing, take screenshots
- **Databases** - Query SQLite, PostgreSQL, etc.
- **Custom Tools** - Any CLI tool or API

### Configuring MCP Servers

MCP servers are configured through the app. The config is stored in `~/.config/Qwen/settings.json` (managed by the app).

#### Example Configuration

Add this to your MCP config (via the app's settings or programmatically):

```json
{
  "filesystem": {
    "command": "bun",
    "args": [
      "x",
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "/home/user/Documents",
      "/home/user/Desktop"
    ],
    "transportType": "stdio"
  },
  "browser": {
    "command": "uvx",
    "args": ["@anthropic/mcp-server-playwright"],
    "transportType": "stdio"
  },
  "sqlite": {
    "command": "uvx",
    "args": ["mcp-server-sqlite", "--db-path", "/home/user/data.db"],
    "transportType": "stdio"
  }
}
```

#### Supported Transports

| Transport | Description | Example |
|-----------|-------------|---------|
| `stdio` | Local process (default) | `bun x @mcp/server-filesystem /path` |
| `sse` | Server-Sent Events | `url: "http://localhost:3000/sse"` |
| `httpStream` | HTTP streaming | `url: "http://localhost:3000/stream"` |

#### Command Adaptation

The app automatically replaces:
- `npx` → bundled `bun` runtime
- `bun` → bundled `bun` runtime  
- `uvx` → bundled `uvx` runtime

This ensures MCP servers work without requiring system-wide installations!

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│           Qwen Desktop (Electron)                │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  Main Process                             │  │
│  │  ├─ MCP Proxy (McpProxy)                  │  │
│  │  │  ├─ @modelcontextprotocol/sdk v1.13.1 │  │
│  │  │  ├─ StdioClientTransport              │  │
│  │  │  ├─ SSEClientTransport                │  │
│  │  │  └─ StreamableHTTPClientTransport     │  │
│  │  ├─ IPC Handlers                          │  │
│  │  └─ Runtime Manager (bun, uvx)            │  │
│  └───────────────────┬───────────────────────┘  │
│                      │ contextBridge            │
│                      ▼                          │
│  ┌───────────────────────────────────────────┐  │
│  │  WebView (chat.qwen.ai)                   │  │
│  │  ├─ Preload Script                        │  │
│  │  │  └─ window.electronAPI                 │  │
│  │  │     ├─ mcp_client_tool_list()          │  │
│  │  │     ├─ mcp_client_tool_call()          │  │
│  │  │     ├─ mcp_client_update_config()      │  │
│  │  │     └─ request_file_access()           │  │
│  │  └─ chat.qwen.ai Web UI                   │  │
│  │     └─ Detects desktop via User-Agent     │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  Bundled Runtimes                         │  │
│  │  ├─ resources/bun/linux-x64/bun           │  │
│  │  └─ resources/uv/linux-x64/uvx            │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      │ stdio/sse/http
                      ▼
┌─────────────────────────────────────────────────┐
│           MCP Servers (Child Processes)          │
│  ├─ Filesystem Server                            │
│  ├─ Browser Server (Playwright)                  │
│  └─ Custom Tool Servers                          │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Development

### Project Structure

```
qwen-desktop-linux/
├── src/
│   ├── main/
│   │   ├── index.ts              # Electron main process
│   │   ├── runtime.ts            # Bundled runtime management
│   │   └── mcp-config.ts         # MCP config adaptation
│   ├── mcp/
│   │   ├── index.ts              # MCP exports
│   │   ├── proxy.ts              # MCP proxy server
│   │   └── server-client.ts      # Individual MCP client
│   ├── preload/
│   │   └── index.ts              # Preload script (bridge)
│   ├── renderer/
│   │   └── index.html            # Minimal shell with webview
│   └── shared/
│       └── types.ts              # Shared TypeScript types
├── resources/
│   ├── icon.png                  # App icon
│   ├── bun/linux-x64/           # Bundled bun runtime
│   └── uv/linux-x64/            # Bundled uv/uvx
├── scripts/
│   └── download-runtimes.js      # Post-install setup
├── package.json
├── tsconfig.json
└── forge.config.ts               # Electron Forge config
```

### Available Scripts

```bash
npm start              # Start in development mode
npm run package        # Package the app
npm run make           # Build all Linux packages
npm run make:appimage  # Build AppImage only
npm run make:deb       # Build .deb package
npm run make:rpm       # Build .rpm package
npm run lint           # Run ESLint
npm run typecheck      # TypeScript type checking
```

### Debug Mode

```bash
# Enable verbose logging
DEBUG=* npm start

# Open DevTools
# - Press F12 or Ctrl+Shift+I
# - Easter egg: Type "woshi149205" anywhere in the app
```

---

## 📋 Requirements

### Runtime Dependencies

**AppImage:** Self-contained (no dependencies)

**Debian/Ubuntu:**
```bash
libnotify4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0
```

**Fedora/RHEL:**
```bash
libnotify nss atk at-spi2-atk gtk3
```

### System Requirements

- **OS:** Linux (Kernel 4.4+)
- **Architecture:** x86_64 or ARM64
- **RAM:** 2GB minimum (4GB recommended)
- **Disk:** 500MB for app + runtimes
- **Display:** 800x600 minimum

---

## 🔒 Security

This app implements multiple security layers:

- ✅ **Context Isolation** - Renderer cannot access Node.js directly
- ✅ **Sandboxed WebView** - Webview runs in separate process
- ✅ **Electron Fuses** - Production builds disable dangerous features
- ✅ **No Node Integration** - Web content cannot access filesystem
- ✅ **Explicit IPC** - All communication goes through typed handlers
- ✅ **MCP Server Validation** - Only configured servers can connect

---

## 🌍 Internationalization

Supported languages:
- 🇨🇳 简体中文 (zh-CN)
- 🇺🇸 English (en-US)
- 🇹🇼 繁體中文 (zh-TW)
- 🇯🇵 日本語 (ja-JP)
- 🇰🇷 한국어 (ko-KR)
- 🇷🇺 Русский (ru-RU)
- 🇩🇪 Deutsch (de-DE)
- 🇫🇷 Français (fr-FR)
- 🇪🇸 Español (es-ES)
- 🇮🇹 Italiano (it-IT)
- 🇵🇹 Português (pt-PT)
- 🇧🇭 العربية (ar-BH)

---

## 🆚 Comparison with Official Apps

| Feature | Windows/Mac | Linux (This App) |
|---------|-------------|------------------|
| Chat Interface | ✅ chat.qwen.ai | ✅ chat.qwen.ai |
| MCP Support | ✅ | ✅ |
| File System Access | ✅ | ✅ |
| Browser Automation | ✅ | ✅ |
| Custom Tools | ✅ | ✅ |
| System Tray | ✅ | ✅ |
| Auto-Updates | ✅ | ⚠️ Manual (for now) |
| Deep Linking | ✅ qwen:// | ✅ qwen:// |
| Native Dialogs | ✅ | ✅ |
| i18n | ✅ 12 languages | ✅ 12 languages |

---

## 🐛 Known Issues & Limitations

- **Auto-update**: Not yet configured for Linux (use package manager updates)
- **Wayland**: May require `--enable-features=UseOzonePlatform --ozone-platform=wayland` flag
- **AppImage**: Requires FUSE on some distros

---

## 🤝 Contributing

Contributions welcome! This is a community project to bring Qwen Desktop to Linux.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- Based on reverse engineering of the official Qwen Desktop app (Windows/Mac)
- Uses `@modelcontextprotocol/sdk` by Anthropic
- Bundled runtimes: [Bun](https://bun.sh/) + [uv](https://github.com/astral-sh/uv)
- Built with [Electron](https://www.electronjs.org/)

---

**Made with ❤️ for the Linux community**

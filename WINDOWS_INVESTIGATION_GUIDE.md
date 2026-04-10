# Windows Investigation Guide for Qwen Desktop App Reverse Engineering

**Purpose:** Extract how the official Qwen desktop app (Windows) implements MCP integration 
**Goal:** Get exact architecture details so we can build the Linux version properly 
**Tool:** Qwen Code CLI on Windows (has access to the official desktop app installation)

---

## Instructions for the Person Running This on Windows

Give this file to your Windows Qwen Code CLI and ask it to:

> "Follow this investigation guide step by step. For each step, run the commands, inspect the files, and DOCUMENT EVERYTHING YOU FIND in a file called `QWEN_DESKTOP_FINDINGS.md`. Be thorough - we need precise details to build a Linux version."

### IMPORTANT - DOCUMENT EVERYTHING

The Windows Qwen CLI MUST:

1. **Create a file** called `QWEN_DESKTOP_FINDINGS.md` in the same directory as this guide
2. **Use the template** - Copy `FINDINGS_TEMPLATE.md` and fill it out completely
3. **Document EVERY step** - don't just show output in chat, WRITE IT TO THE FILE
4. **Include file paths, code snippets, JSON configs** - everything
5. **If something is not found, write that down too** - negative results are important
6. **Export key files** - copy important source files to a folder called `extracted-files/` so we can review them

**At the end, send back:**
- The complete `QWEN_DESKTOP_FINDINGS.md` file (filled out from `FINDINGS_TEMPLATE.md`)
- Any extracted code files from `extracted-files/` folder
- Screenshots if DevTools is accessible (`screenshots/` folder)

---

## Step 1: Locate the Official Qwen Desktop Installation

Run these commands to find where the app is installed:

```powershell
# Find Qwen desktop installation paths
Get-ChildItem -Path "$env:LOCALAPPDATA" -Recurse -Directory -Filter "*qwen*" -ErrorAction SilentlyContinue
Get-ChildItem -Path "$env:PROGRAMFILES" -Recurse -Directory -Filter "*qwen*" -ErrorAction SilentlyContinue
Get-ChildItem -Path "$env:APPDATA" -Recurse -Directory -Filter "*qwen*" -ErrorAction SilentlyContinue

# Also check Electron app cache locations
Get-ChildItem -Path "$env:LOCALAPPDATA\Programs" -Recurse -Directory -Filter "*qwen*" -ErrorAction SilentlyContinue
```

**Report back:**
- Where is the app installed?
- What files/folders exist in the installation directory?

---

## Step 2: Examine the App Structure

Once you find the installation folder, list ALL files:

```powershell
# Replace with actual installation path
cd "C:\Path\To\Qwen\Desktop\App"

# List all files recursively
Get-ChildItem -Recurse -File | Select-Object FullName, Length | Format-Table -AutoSize

# Show directory tree (limit to 3 levels deep)
Get-ChildItem -Recurse -Depth 3 | Select-Object FullName | Format-Table -AutoSize
```

**Report back:**
- Complete file tree structure
- File sizes (especially look for `resources/app.asar` - this contains the app code)

---

## Step 3: Extract the App Code (app.asar)

The app is built with Electron and the code is in `resources/app.asar`. We need to extract it:

```powershell
# Install asar tool globally
npm install -g @electron/asar

# Find app.asar location (usually in resources/ folder)
Get-ChildItem -Recurse -Filter "app.asar" -ErrorAction SilentlyContinue

# Extract it to a folder (replace path)
cd "C:\Path\To\Qwen\Desktop\App\resources"
asar extract app.asar extracted-app

# List extracted contents
Get-ChildItem -Path "extracted-app" -Recurse -File | Select-Object FullName | Format-Table -AutoSize
```

**Report back:**
- Extracted file structure
- Is there a `package.json`? Show its contents
- Is there a `main.js` or `main/` folder? Show structure
- Any MCP-related files? (look for `mcp`, `server`, `tool`, `context`, `protocol` in filenames)

---

## Step 4: Find MCP Configuration

Search for MCP-related code in the extracted app:

```powershell
cd "C:\Path\To\Qwen\Desktop\App\resources\extracted-app"

# Search for MCP references in all JS files
Select-String -Pattern "mcp|MCP|model.context.protocol" -Path "**/*.js" -List | Select-Object Path, LineNumber

# Search for MCP server configuration
Select-String -Pattern "mcpServers|mcp_servers|McpServer" -Path "**/*.js" | Select-Object Path, LineNumber, Line

# Search for filesystem/browser MCP
Select-String -Pattern "filesystem|browser|playwright" -Path "**/*.js" -SimpleMatch -List | Select-Object Path, LineNumber
```

**Report back:**
- Which files mention MCP?
- What MCP server configuration format does it use?
- How does it load/connect to MCP servers?

---

## Step 5: Find the Main Electron Entry Point

```powershell
cd "C:\Path\To\Qwen\Desktop\App\resources\extracted-app"

# Read package.json
Get-Content package.json | Select-String -Pattern "main|entry" -Context 2

# Find the main process file
Get-Content package.json
```

**Report back:**
- What is the `main` entry in `package.json`?
- Show the first 100 lines of that file

---

## Step 6: Extract MCP Client Implementation

Once you find the MCP code, read the full implementation:

```powershell
# Read the MCP-related files (replace with actual file paths)
Get-Content "path/to/mcp-file.js" | Out-File -FilePath "C:\temp\mcp-implementation.txt"

# Also check for @modelcontextprotocol/sdk usage
Select-String -Pattern "@modelcontextprotocol/sdk" -Path "**/*.js" -List | Select-Object Path
```

**Report back:**
- Full contents of MCP-related files
- How does it create the MCP client?
- Which transport does it use (stdio, http, sse)?
- How does it connect MCP tools to the chat?

---

## Step 7: Find How MCP Integrates with chat.qwen.ai

This is the CRITICAL part - how does MCP bridge to the web interface?

```powershell
cd "C:\Path\To\Qwen\Desktop\App\resources\extracted-app"

# Search for BrowserView, WebView, webviewTag usage
Select-String -Pattern "BrowserView|webview|webContents|loadURL|chat\.qwen\.ai" -Path "**/*.js" -List | Select-Object Path, LineNumber

# Search for preload script injection
Select-String -Pattern "preload|executeJavaScript|addInitScript" -Path "**/*.js" -List | Select-Object Path, LineNumber

# Search for API endpoints
Select-String -Pattern "api\.qwen|chat\.qwen|/api/|/v1/" -Path "**/*.js" | Select-Object Path, LineNumber, Line
```

**Report back:**
- How does the app load chat.qwen.ai? (BrowserView, webview, or custom UI?)
- Does it inject any scripts into the web view?
- Does it intercept/modify API calls?
- What URL does it use? (confirm it's chat.qwen.ai)

---

## Step 8: Find IPC Handlers (Main ↔ Renderer Communication)

```powershell
cd "C:\Path\To\Qwen\Desktop\App\resources\extracted-app"

# Search for IPC handlers
Select-String -Pattern "ipcMain|ipcRenderer|handle|invoke" -Path "**/*.js" -List | Select-Object Path, LineNumber

# Search for contextBridge
Select-String -Pattern "contextBridge|exposeInMainWorld" -Path "**/*.js" -List | Select-Object Path, LineNumber
```

**Report back:**
- How does the main process communicate with the renderer?
- What IPC channels exist?
- How are MCP tools exposed to the chat interface?

---

## Step 9: Extract MCP Config File Location

```powershell
# Find where MCP config is stored
Get-ChildItem -Path "$env:APPDATA" -Recurse -Filter "*mcp*" -ErrorAction SilentlyContinue
Get-ChildItem -Path "$env:LOCALAPPDATA" -Recurse -Filter "*mcp*" -ErrorAction SilentlyContinue

# Check common Electron config locations
Get-ChildItem -Path "$env:APPDATA\Qwen" -ErrorAction SilentlyContinue
Get-ChildItem -Path "$env:APPDATA\qwen-desktop" -ErrorAction SilentlyContinue
```

**Report back:**
- Where is the MCP configuration file stored?
- What format is it? (JSON, YAML, etc.)
- Show the contents of any MCP config files

---

## Step 10: Network Traffic Analysis

Open the official Qwen desktop app and inspect its network requests:

1. Open Qwen desktop app
2. Press `Ctrl+Shift+I` to open DevTools (should work in Electron apps)
3. Go to Network tab
4. Send a message in chat
5. Look at the API requests

**Report back:**
- What API endpoints does it call?
- Does it send MCP tool results in the requests?
- What's the request/response format?
- Are there any custom headers for MCP?

Also run this in DevTools Console:

```javascript
// Check if MCP is available on window object
console.log(window.mcp);
console.log(window.mcpIPC);
console.log(window.electronAPI);

// Check global Electron/Node access
console.log(process);
console.log(window.require);
```

**Report back:**
- What's exposed on `window` object related to MCP?
- Can you access Electron APIs from the renderer?
- Any `window.electronAPI` or similar?

---

## Step 11: Extract Preload Script

```powershell
cd "C:\Path\To\Qwen\Desktop\App\resources\extracted-app"

# Find preload scripts
Get-ChildItem -Recurse -Filter "*preload*" | Select-Object FullName
```

**Report back:**
- Show ALL preload script contents
- What does it expose to the renderer?
- How does it bridge MCP to the chat interface?

---

## Step 12: Find the Full Chat Integration Method

Search for how the app sends messages to chat.qwen.ai:

```powershell
cd "C:\Path\To\Qwen\Desktop\App\resources\extracted-app"

# Search for chat/message/completion endpoints
Select-String -Pattern "completions|chat|message|send|conversation" -Path "**/*.js" -Context 3,5 | Select-Object Path, LineNumber

# Search for OpenAI-compatible API usage
Select-String -Pattern "openai|completion|chat\.completions|gpt|qwen" -Path "**/*.js" -List | Select-Object Path
```

**Report back:**
- Does it use the web interface directly or call APIs?
- If it calls APIs, what's the base URL and format?
- How does it format messages with MCP tool results?

---

## Final Report Format

Please compile findings in this format:

```markdown
# Qwen Desktop Windows App - Reverse Engineering Report

## 1. App Location
- Installation path:
- Version:
- Size:

## 2. App Structure
- Full file tree:
- Main entry point:
- Key files:

## 3. MCP Implementation
- MCP SDK version:
- Transport method: (stdio / http / sse)
- Client architecture:
- Config file location:
- Config format: (show JSON)

## 4. Chat Integration
- Method: (BrowserView / Custom UI / API calls)
- URL used: (confirm chat.qwen.ai)
- How MCP tools are sent to the API:
- Request/response format:

## 5. IPC Architecture
- How main talks to renderer:
- What's exposed on window object:
- Preload script functionality:

## 6. Key Code Snippets
- MCP client creation: (show code)
- Tool call loop: (show code)
- API request format: (show code)

## 7. Critical Findings
- How does the official app actually work?
- What approach should the Linux version use?

## 8. File Exports
- Export these files for full analysis:
- package.json
- main process entry file
- ALL MCP-related files
- preload script
- IPC handlers
```

---

## Troubleshooting

### If app.asar can't be extracted

```powershell
# Try alternative extraction
npx asar extract "path\to\app.asar" "path\to\output"

# Or list contents without extracting
npx asar list "path\to\app.asar"
```

### If DevTools doesn't open in official app
- The app may have disabled it. Try:
- `F12`
- `Ctrl+Shift+I`
- Look for a developer menu in the app settings
- Check if there's a `--dev` or `--inspect` flag:
 ```powershell
 & "path\to\qwen.exe" --help
 ```

### If MCP code is minified/obfuscated
- Still extract and search - minified code still has strings
- Look for `mcp`, `tool`, `server` in variable names
- The `@modelcontextprotocol/sdk` package won't be minified

---

## Important Notes
- **DO NOT** share API keys, tokens, or personal credentials
- **ONLY** extract structural/architectural information
- This is for **interoperability research** - building a compatible Linux client
- Focus on **how** it works, not **what** it connects to

---

**End of Investigation Guide**

The more detailed the findings, the better we can build the Linux version to match the official app's functionality.

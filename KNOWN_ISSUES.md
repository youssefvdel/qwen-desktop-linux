# Known Issues & Bug Tracking

## Bug #1: Login Via Link "Request Aborted"

**Status:** Documented (not critical - workaround exists)

**Issue:**
- When clicking "Login" in the app → redirects to `chat.qwen.ai` → OAuth login → "request aborted" error

**Cause:**
- Electron's handling of OAuth redirects with custom User-Agent `AliDesktop(QWENCHAT/1.0.0)`
- The auth callback URL might be intercepted incorrectly by `setWindowOpenHandler`

**Workaround:**
- User can login via alternative method (cookie export, manual auth, etc.)
- Once logged in, the session persists across app restarts

**Fix Plan:**
```typescript
// In setWindowOpenHandler, exclude auth/callback URLs
mainWindow.webContents.setWindowOpenHandler((details) => {
 const url = new URL(details.url);
 // Allow auth redirects to open in same window
 if (url.pathname.includes('/auth') || url.pathname.includes('/callback')) {
 mainWindow?.loadURL(details.url);
 return { action: 'deny' };
 }
 // Open other links in external browser
 shell.openExternal(details.url);
 return { action: 'deny' };
});
```

---

## What's Working
- App launches and loads `chat.qwen.ai`
- Login via alternative method works
- Chat interface functional
- Custom User-Agent `AliDesktop(QWENCHAT/1.0.0)` set
- `window.electronAPI` injected via preload
- MCP proxy running in main process

---

## 🧪 MCP Testing Checklist

**Ready to test:**

### 1. Filesystem MCP
```json
{
 "filesystem": {
 "command": "npx",
 "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/youssefvdel/Documents"],
 "transportType": "stdio"
 }
}
```

### 2. Browser MCP (Playwright)
```json
{
 "browser": {
 "command": "npx",
 "args": ["-y", "@anthropic/mcp-server-playwright"],
 "transportType": "stdio"
 }
}
```

### 3. Custom Tool MCP
```json
{
 "hello": {
 "command": "node",
 "args": ["-e", "console.log(JSON.stringify({content:[{type:'text',text:'Hello from MCP!'}]}))"],
 "transportType": "stdio"
 }
}
```

### Test Steps:
1. Open MCP config panel in app (if available)
2. Add filesystem server config
3. Test listing tools → should see file operations
4. Test calling a tool → should list files
5. Verify tool results flow back to chat

---

**Last Updated:** 2026-04-09

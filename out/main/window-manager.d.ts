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
import { BrowserWindow } from "electron";
/**
 * Dependencies injected from index.ts to avoid circular dependencies.
 */
export interface WindowManagerDeps {
    onMcpClientConnect: () => Promise<void>;
    onOpenDevTool: (win: BrowserWindow) => void;
    setQuitting: (value: boolean) => void;
    isQuitting: () => boolean;
    onDeepLink: (url: string) => void;
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
export declare function createWindow(deps: WindowManagerDeps): BrowserWindow;
//# sourceMappingURL=window-manager.d.ts.map
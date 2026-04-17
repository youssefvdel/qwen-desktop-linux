/**
 * Qwen Web API Proxy - Direct HTTP Bridge
 *
 * This proxy forwards OpenAI-compatible requests to Qwen's web API
 * by stealing the authenticated session from the Electron window.
 *
 * Features:
 * - OpenAI API compatibility (/v1/chat/completions)
 * - Session cookie/header stealing from Electron
 * - Streaming (SSE) and non-streaming support
 * - Tool/function calling support
 * - Auto chat_id management
 */
import { BrowserWindow } from 'electron';
export declare class QwenProxy {
    private app;
    private mainWindow;
    private session;
    private port;
    constructor(port?: number);
    setWindow(win: BrowserWindow): void;
    /**
     * Steal cookies and headers from the Electron session
     * Called on every request to ensure fresh auth
     */
    private stealSession;
    /**
     * Create a new chat session to get a chat_id
     */
    private createChatId;
    /**
     * Forward request to Qwen API
     */
    private forwardToQwen;
    /**
     * Start the HTTP server
     */
    start(): void;
    stop(): void;
}
export declare const qwenProxy: QwenProxy;
//# sourceMappingURL=qwen-proxy.d.ts.map
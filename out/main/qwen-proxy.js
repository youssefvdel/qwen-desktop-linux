"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.qwenProxy = exports.QwenProxy = void 0;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const url_1 = require("url");
const logger_js_1 = require("./logger.js");
// Qwen Web API Configuration
const QWEN_BASE = 'https://chat.qwen.ai';
const QWEN_ENDPOINT = '/api/v2/chat/completions';
const QWEN_CHAT_NEW = '/api/v2/chats/new';
// Critical headers that Qwen's web API requires
const REQUIRED_HEADERS = [
    'source', // 'desktop'
    'Version', // '0.2.40'
    'bx-v', // '2.5.36'
    'bx-ua', // long fingerprint string
    'bx-umidtoken', // auth token
];
// OpenAI-compatible response generator
const generateId = () => `chatcmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
class QwenProxy {
    app = null;
    mainWindow = null;
    session = null;
    port;
    constructor(port = 11435) {
        this.port = port;
    }
    setWindow(win) {
        this.mainWindow = win;
        logger_js_1.logger.info('🔐 QwenProxy: Window attached, session stealer active');
    }
    /**
     * Steal cookies and headers from the Electron session
     * Called on every request to ensure fresh auth
     */
    async stealSession() {
        if (!this.mainWindow)
            return null;
        try {
            const ses = this.mainWindow.webContents.session;
            // Get cookies for chat.qwen.ai
            const cookies = await ses.cookies.get({ url: QWEN_BASE });
            const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            // Get the User-Agent from the window
            const userAgent = this.mainWindow.webContents.getUserAgent();
            // Extract critical headers from recent requests (cached)
            // In practice, we'll forward common headers + the cookie
            return {
                cookies: cookieString,
                headers: {
                    'source': 'desktop',
                    'Version': '0.2.40',
                    'bx-v': '2.5.36',
                    // bx-ua and bx-umidtoken come from cookies usually
                },
                chatId: null, // Will be set/created per request
                userAgent,
            };
        }
        catch (err) {
            logger_js_1.logger.error('❌ Failed to steal session', err);
            return null;
        }
    }
    /**
     * Create a new chat session to get a chat_id
     */
    async createChatId(sess) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'chat.qwen.ai',
                path: QWEN_CHAT_NEW,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': sess.cookies,
                    'User-Agent': sess.userAgent,
                    ...sess.headers,
                    'Accept': 'application/json',
                    'Origin': QWEN_BASE,
                    'Referer': `${QWEN_BASE}/`,
                },
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        // Qwen returns: { id: "uuid", ... }
                        const chatId = json.id || json.chatId;
                        if (chatId) {
                            logger_js_1.logger.info(`🆕 Created new chat: ${chatId}`);
                            resolve(chatId);
                        }
                        else {
                            reject(new Error('No chat_id in response: ' + data.slice(0, 200)));
                        }
                    }
                    catch (e) {
                        reject(new Error(`Parse error: ${e} | Response: ${data.slice(0, 200)}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(JSON.stringify({})); // Empty body for new chat
            req.end();
        });
    }
    /**
     * Forward request to Qwen API
     */
    async forwardToQwen(sess, chatId, payload) {
        return new Promise((resolve, reject) => {
            const url = new url_1.URL(QWEN_ENDPOINT, QWEN_BASE);
            url.searchParams.set('chat_id', chatId);
            const options = {
                hostname: 'chat.qwen.ai',
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': sess.cookies,
                    'User-Agent': sess.userAgent,
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Origin': QWEN_BASE,
                    'Referer': `${QWEN_BASE}/c/${chatId}`,
                    'X-Request-Id': generateId(),
                    ...sess.headers,
                    // Forward any bx-* headers if present
                    ...(payload.headers || {}),
                },
            };
            // Prepare body - map OpenAI format to Qwen web format
            const qwenBody = {
                messages: payload.messages,
                model: payload.model?.replace('qwen', 'qwen3.5') || 'qwen3.5-plus',
                stream: payload.stream ?? false,
                // Forward tools if present (for agent support)
                ...(payload.tools && { tools: payload.tools }),
                ...(payload.tool_choice && { tool_choice: payload.tool_choice }),
                // Qwen-specific params
                incremental_output: payload.stream ? true : undefined,
            };
            const req = https.request(options, (res) => {
                let data = '';
                const isStream = payload.stream;
                if (isStream) {
                    // Handle Server-Sent Events
                    res.setEncoding('utf8');
                    const chunks = [];
                    res.on('data', (chunk) => {
                        chunks.push(chunk);
                    });
                    res.on('end', () => {
                        const raw = chunks.join('');
                        // Parse SSE format: data: {...}\n\n
                        const lines = raw.split('\n').filter(l => l.trim());
                        const results = [];
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const jsonStr = line.slice(6).trim();
                                if (jsonStr === '[DONE]')
                                    break;
                                try {
                                    results.push(JSON.parse(jsonStr));
                                }
                                catch (e) {
                                    logger_js_1.logger.debug('SSE parse skip:', jsonStr.slice(0, 100));
                                }
                            }
                        }
                        // Convert Qwen stream chunks to OpenAI format
                        const openaiChunks = results.map((chunk, idx) => {
                            const choice = chunk.choices?.[0] || {};
                            return {
                                id: generateId(),
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: payload.model || 'qwen3.5-plus',
                                choices: [{
                                        index: 0,
                                        delta: {
                                            content: choice.delta?.content || choice.message?.content || '',
                                            // Forward tool_calls if present
                                            ...(choice.message?.tool_calls && { tool_calls: choice.message.tool_calls }),
                                        },
                                        finish_reason: choice.finish_reason || null,
                                    }],
                            };
                        });
                        resolve({ stream: true, chunks: openaiChunks });
                    });
                }
                else {
                    // Handle JSON response
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const qwenResp = JSON.parse(data);
                            // === AGGRESSIVE DEBUG LOGGING ===
                            const rawStr = JSON.stringify(qwenResp);
                            logger_js_1.logger.info('🔍 RAW QWEN RESPONSE:', rawStr.slice(0, 3000));
                            // Try EVERY possible path for content extraction
                            const choice = qwenResp.choices?.[0]
                                || qwenResp.output
                                || qwenResp.result
                                || qwenResp.data
                                || {};
                            const message = choice.message
                                || choice
                                || qwenResp.message
                                || {};
                            // Extract content from multiple possible fields
                            let content = message.content
                                || message.text
                                || message.output
                                || message.result
                                || qwenResp.content
                                || qwenResp.text
                                || qwenResp.answer
                                || qwenResp.response
                                || '';
                            // Handle array content (common in newer APIs)
                            if (Array.isArray(content)) {
                                content = content.map((c) => c.text || c.content || c).join('\n');
                            }
                            // Handle nested objects
                            if (content && typeof content === 'object' && !Array.isArray(content)) {
                                content = content.text || content.content || JSON.stringify(content);
                            }
                            logger_js_1.logger.info(`📝 Extracted content length: ${content?.length || 0}`);
                            if (!content && rawStr.length > 0) {
                                logger_js_1.logger.warn('⚠️ Content extraction failed! Available keys:', Object.keys(qwenResp).join(', '));
                            }
                            // === END DEBUG ===
                            const openaiResp = {
                                id: generateId(),
                                object: 'chat.completion',
                                created: Math.floor(Date.now() / 1000),
                                model: payload.model || 'qwen3.5-plus',
                                choices: [{
                                        index: 0,
                                        message: {
                                            role: 'assistant',
                                            content: content,
                                            // Forward tool_calls for agent support
                                            ...(message.tool_calls && { tool_calls: message.tool_calls }),
                                        },
                                        finish_reason: choice.finish_reason || qwenResp.finish_reason || 'stop',
                                    }],
                                usage: qwenResp.usage || {
                                    prompt_tokens: 0,
                                    completion_tokens: 0,
                                    total_tokens: 0,
                                },
                            };
                            resolve(openaiResp);
                        }
                        catch (e) {
                            logger_js_1.logger.error('❌ Response parse error:', e);
                            logger_js_1.logger.error('Raw response:', data.slice(0, 500));
                            reject(new Error(`Parse failed: ${e} | ${data.slice(0, 200)}`));
                        }
                    });
                }
            });
            req.on('error', (err) => {
                logger_js_1.logger.error('❌ Qwen API request failed:', err);
                reject(err);
            });
            req.write(JSON.stringify(qwenBody));
            req.end();
        });
    }
    /**
     * Start the HTTP server
     */
    start() {
        this.app = http.createServer(async (req, res) => {
            // CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }
            // Health check
            if (req.url === '/health' && req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', proxy: 'qwen-web' }));
                return;
            }
            // Main endpoint: /v1/chat/completions
            if (req.url?.startsWith('/v1/chat/completions') && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const payload = JSON.parse(body);
                        logger_js_1.logger.info(`📨 OpenAI request: model=${payload.model}, stream=${payload.stream}`);
                        // 1. Steal fresh session
                        let sess = await this.stealSession();
                        if (!sess) {
                            throw new Error('Cannot steal session - is Qwen window logged in?');
                        }
                        // 2. Get or create chat_id
                        let chatId = sess.chatId;
                        if (!chatId) {
                            chatId = await this.createChatId(sess);
                            sess.chatId = chatId;
                        }
                        // 3. Forward to Qwen
                        const result = await this.forwardToQwen(sess, chatId, payload);
                        // 4. Send response
                        if (payload.stream) {
                            // Streaming: send SSE
                            res.writeHead(200, {
                                'Content-Type': 'text/event-stream',
                                'Cache-Control': 'no-cache',
                                'Connection': 'keep-alive',
                            });
                            for (const chunk of result.chunks) {
                                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                            }
                            res.write('data: [DONE]\n\n');
                            res.end();
                        }
                        else {
                            // Non-streaming: send JSON
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(result));
                        }
                    }
                    catch (err) {
                        logger_js_1.logger.error('❌ Proxy error:', err.message);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            error: {
                                message: err.message || 'Proxy error',
                                type: 'proxy_error',
                            },
                        }));
                    }
                });
            }
            else {
                // 404 for other routes
                res.writeHead(404);
                res.end();
            }
        });
        this.app.listen(this.port, 'localhost', () => {
            logger_js_1.logger.info(`🚀 QwenProxy listening on http://localhost:${this.port}`);
            logger_js_1.logger.info(`📡 Endpoint: POST /v1/chat/completions (OpenAI-compatible)`);
        });
        this.app.on('error', (err) => {
            logger_js_1.logger.error(`❌ Proxy server error: ${err.message}`);
        });
    }
    stop() {
        if (this.app) {
            this.app.close();
            this.app = null;
            logger_js_1.logger.info('🛑 QwenProxy stopped');
        }
    }
}
exports.QwenProxy = QwenProxy;
exports.qwenProxy = new QwenProxy();
//# sourceMappingURL=qwen-proxy.js.map
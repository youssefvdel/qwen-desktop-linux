"use strict";
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
exports.activeEndpoint = exports.activeCookies = void 0;
exports.setupApiProxy = setupApiProxy;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const url_1 = require("url");
// Logger
const log = (msg) => console.log(`[LUNA-PROXY] ${msg}`);
const error = (msg, err) => console.error(`[LUNA-PROXY] ❌ ${msg}`, err?.message || err);
// Config
const PROXY_PORT = 11435;
const QWEN_HOST = 'chat.qwen.ai';
const QWEN_ENDPOINTS = [
    '/api/v2/chat/completions',
    '/gpts/api/chat/completions',
    '/api/v1/chat/completions',
    '/v1/chat/completions',
];
// State
let activeCookies = '';
exports.activeCookies = activeCookies;
let activeEndpoint = QWEN_ENDPOINTS[0];
exports.activeEndpoint = activeEndpoint;
let mainWindow = null;
function setupApiProxy(win) {
    mainWindow = win;
    // 1. Steal cookies from the main window's session
    win.webContents.session.cookies.get({})
        .then(cookies => {
        exports.activeCookies = activeCookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        log(`🍪 Loaded ${cookies.length} cookies`);
    })
        .catch(e => error('Failed to load cookies', e));
    // 2. Intercept network requests to find the REAL endpoint
    win.webContents.session.webRequest.onBeforeRequest({ urls: [`https://${QWEN_HOST}/*`] }, (details, callback) => {
        if (details.url.includes('/chat/completions') && details.method === 'POST') {
            const url = new url_1.URL(details.url);
            exports.activeEndpoint = activeEndpoint = url.pathname;
            log(`🎯 Found active endpoint: ${activeEndpoint}`);
        }
        callback({ cancel: false });
    });
    // 3. Start HTTP Server
    const server = http.createServer(async (req, res) => {
        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        if (req.url?.startsWith('/v1/chat/completions') && req.method === 'POST') {
            await handleChatRequest(req, res);
        }
        else if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', endpoint: activeEndpoint }));
        }
        else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });
    server.listen(PROXY_PORT, '127.0.0.1', () => {
        log(`🚀 Proxy listening on http://localhost:${PROXY_PORT}`);
    });
}
async function handleChatRequest(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            const payload = JSON.parse(body);
            log(`📥 Request: model=${payload.model}, stream=${payload.stream}, tools=${!!payload.tools}`);
            if (payload.stream) {
                // Handle streaming: pipe chunks directly
                await handleStreamingRequest(payload, res);
            }
            else {
                // Handle non-streaming: get full response then format
                const qwenResponse = await forwardToQwen(payload);
                const openaiResponse = formatResponse(qwenResponse, payload);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(openaiResponse));
            }
        }
        catch (e) {
            error('Proxy handler failed', e);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message || 'Proxy error' }));
            }
        }
    });
}
async function handleStreamingRequest(payload, res) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ ...payload, stream: true });
        const options = {
            hostname: QWEN_HOST,
            path: activeEndpoint,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'Cookie': activeCookies,
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': `https://${QWEN_HOST}`,
                'Referer': `https://${QWEN_HOST}/`,
                'bx-source': 'web',
                'bx-platform': 'web',
            }
        };
        // Set headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });
        const req = https.request(options, response => {
            // Pipe SSE chunks directly to client
            response.on('data', chunk => {
                res.write(chunk);
            });
            response.on('end', () => {
                res.end();
                resolve();
            });
        });
        req.on('error', e => {
            error('Streaming upstream failed', e);
            if (!res.headersSent) {
                res.writeHead(500);
                res.end();
            }
            reject(e);
        });
        req.write(body);
        req.end();
    });
}
async function forwardToQwen(payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            ...payload,
            stream: false, // Force non-streaming for this function
        });
        const options = {
            hostname: QWEN_HOST,
            path: activeEndpoint,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'Cookie': activeCookies,
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': `https://${QWEN_HOST}`,
                'Referer': `https://${QWEN_HOST}/`,
                'bx-source': 'web',
                'bx-platform': 'web',
            }
        };
        const req = https.request(options, response => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch {
                    resolve({ text: data, raw: data });
                }
            });
        });
        req.on('error', e => {
            error('Upstream request failed', e);
            reject(e);
        });
        req.write(body);
        req.end();
    });
}
function formatResponse(qwenResp, originalPayload) {
    // 1. Check for Tool Calls (Agent Support)
    // Qwen might return tool_calls in different locations
    const message = qwenResp.choices?.[0]?.message || qwenResp.message || {};
    const toolCalls = message.tool_calls || qwenResp.tool_calls || qwenResp.output?.tool_calls;
    if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
        log(`🛠️ Returning tool_calls: ${toolCalls.map((t) => t.function?.name).join(', ')}`);
        return {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: originalPayload.model || 'qwen-proxy',
            choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: message.content || null,
                        tool_calls: toolCalls.map((tc) => ({
                            id: tc.id || `call_${Date.now()}`,
                            type: 'function',
                            function: {
                                name: tc.function?.name || tc.name,
                                arguments: JSON.stringify(tc.function?.arguments || tc.parameters || {})
                            }
                        }))
                    },
                    finish_reason: 'tool_calls'
                }],
            usage: qwenResp.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        };
    }
    // 2. Standard Text Response
    // Extract content from various possible Qwen response structures
    let content = message.content
        || qwenResp.output?.text
        || qwenResp.text
        || qwenResp.result?.content
        || qwenResp.choices?.[0]?.text
        || '';
    // Handle array of content blocks (common in newer APIs)
    if (Array.isArray(content)) {
        content = content.map((c) => c.text || c).join('\n');
    }
    return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: originalPayload.model || 'qwen-proxy',
        choices: [{
                index: 0,
                message: { role: 'assistant', content },
                finish_reason: qwenResp.finish_reason || 'stop'
            }],
        usage: qwenResp.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };
}
//# sourceMappingURL=api-proxy.js.map
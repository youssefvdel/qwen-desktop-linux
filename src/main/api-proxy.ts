import { ipcMain, BrowserWindow, session } from 'electron';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

// Logger
const log = (msg: string) => console.log(`[LUNA-PROXY] ${msg}`);
const error = (msg: string, err?: any) => console.error(`[LUNA-PROXY] ❌ ${msg}`, err?.message || err);

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
let activeCookies: string = '';
let activeEndpoint: string = QWEN_ENDPOINTS[0];
let mainWindow: BrowserWindow | null = null;

export function setupApiProxy(win: BrowserWindow) {
  mainWindow = win;

  // 1. Steal cookies from the main window's session
  win.webContents.session.cookies.get({})
    .then(cookies => {
      activeCookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      log(`🍪 Loaded ${cookies.length} cookies`);
    })
    .catch(e => error('Failed to load cookies', e));

  // 2. Intercept network requests to find the REAL endpoint
  win.webContents.session.webRequest.onBeforeRequest(
    { urls: [`https://${QWEN_HOST}/*`] },
    (details, callback) => {
      if (details.url.includes('/chat/completions') && details.method === 'POST') {
        const url = new URL(details.url);
        activeEndpoint = url.pathname;
        log(`🎯 Found active endpoint: ${activeEndpoint}`);
      }
      callback({ cancel: false });
    }
  );

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
    } else if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', endpoint: activeEndpoint }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(PROXY_PORT, '127.0.0.1', () => {
    log(`🚀 Proxy listening on http://localhost:${PROXY_PORT}`);
  });
}

async function handleChatRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  let body = '';
  req.on('data', chunk => body += chunk);
  
  req.on('end', async () => {
    try {
      const payload = JSON.parse(body);
      log(`📥 Request: model=${payload.model}, stream=${payload.stream}, tools=${!!payload.tools}`);

      if (payload.stream) {
        // Handle streaming: pipe chunks directly
        await handleStreamingRequest(payload, res);
      } else {
        // Handle non-streaming: get full response then format
        const qwenResponse = await forwardToQwen(payload);
        const openaiResponse = formatResponse(qwenResponse, payload);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(openaiResponse));
      }
      
    } catch (e: any) {
      error('Proxy handler failed', e);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message || 'Proxy error' }));
      }
    }
  });
}

async function handleStreamingRequest(payload: any, res: http.ServerResponse): Promise<void> {
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

async function forwardToQwen(payload: any): Promise<any> {
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
        } catch {
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

function formatResponse(qwenResp: any, originalPayload: any): any {
  // 1. Check for Tool Calls (Agent Support)
  // Qwen might return tool_calls in different locations
  const message = qwenResp.choices?.[0]?.message || qwenResp.message || {};
  const toolCalls = message.tool_calls || qwenResp.tool_calls || qwenResp.output?.tool_calls;

  if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
    log(`🛠️ Returning tool_calls: ${toolCalls.map((t: any) => t.function?.name).join(', ')}`);
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
          tool_calls: toolCalls.map((tc: any) => ({
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
    content = content.map((c: any) => c.text || c).join('\n');
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

// Export for main process
export { activeCookies, activeEndpoint };

# Qwen Desktop Linux - Local API Bridge Case

## Overview
This document outlines the architecture for exposing a local HTTP API (`localhost:3000`) that allows third-party applications (like OpenCode) to interact with the active `chat.qwen.ai` session running inside the Electron app. The goal is to provide an **OpenAI-compatible** interface.

## 1. API Contract (OpenAI Compatible)
We will implement the standard endpoint: `POST /v1/chat/completions`.

### Request Format
```json
{
  "model": "qwen-max",
  "messages": [
    { "role": "user", "content": "Hello from OpenCode!" }
  ],
  "stream": true
}
```

### Response Format (Streaming)
The server must return Server-Sent Events (SSE) to mimic the real-time typing experience:
```text
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"qwen-max","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"qwen-max","choices":[{"index":0,"delta":{"content":" there!"},"finish_reason":null}]}

data: [DONE]
```

## 2. Technical Implementation Plan

### A. The Server (Main Process)
- **Location:** `src/main/index.ts` or a new `src/main/api-server.ts`.
- **Tech:** Express.js or Fastify.
- **Responsibilities:**
  - Listen on `localhost:3000`.
  - Handle CORS headers (`Access-Control-Allow-Origin: *`).
  - Receive the API request and forward the prompt to the BrowserWindow.
  - Stream the response back to the client as it arrives from the webview.

### B. DOM Injection (Preload/Renderer)
- **Challenge:** `chat.qwen.ai` uses React. Simply setting `textarea.value` does not update the internal state.
- **Solution:** We must trigger synthetic events.
  ```typescript
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  nativeInputValueSetter.call(inputElement, 'User Prompt');
  inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  // Trigger Send button click or Enter keydown
  ```

### C. Data Extraction (Output)
- **Preferred Method (Network Interception):** Use `session.webRequest.onCompleted` or the `debugger` protocol to capture the SSE stream coming from Alibaba's servers. This is more reliable than DOM scraping.
- **Fallback Method (DOM Scraping):** Use a `MutationObserver` in the preload script to watch for changes in the AI's response bubble and extract the text content.

## 3. Security & CSP Bypass
- **CSP Issues:** `chat.qwen.ai` has strict Content Security Policies that may block our injected scripts or local API calls.
- **Bypass Strategy:** In `window-manager.ts`, use `session.defaultSession.webRequest.onHeadersReceived` to modify or remove the `Content-Security-Policy` header for the main window.

## 4. File Structure
- `src/main/api-server.ts`: The Express/Fastify server logic.
- `src/preload/api-bridge.ts`: Scripts for DOM injection and observation.
- `src/shared/api-types.ts`: TypeScript interfaces for the OpenAI-compatible requests/responses.

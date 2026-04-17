# CLI Integration Guide

This guide explains how to use Qwen Desktop for Linux with CLI agent tools like **OpenCode**, **Claude Code CLI**, and other MCP-compatible tools.

## Overview

Qwen Desktop for Linux now includes a built-in HTTP server that exposes MCP (Model Context Protocol) tools via REST API endpoints. This allows CLI tools to:

1. **List available tools** from all configured MCP servers
2. **Call tools** to interact with files, browsers, databases, and custom systems
3. **Get configuration** for MCP servers

The HTTP server starts automatically when the app launches (default port: `3000`).

---

## Architecture

```
┌─────────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│  CLI Tool       │      │  Qwen Desktop        │      │  MCP Servers    │
│  (OpenCode,     │ HTTP │  (Electron App)      │ MCP  │  - Filesystem   │
│   Claude Code)  │─────▶│  HTTP Server :3000   │─────▶│  - Fetch        │
│                 │      │  /api/tools          │      │  - Commander    │
│                 │      │  /api/tools/call     │      │  - Custom...    │
└─────────────────┘      └──────────────────────┘      └─────────────────┘
```

---

## API Endpoints

### Base URL
```
http://localhost:3000
```

### 1. GET `/api/tools` - List All Available Tools

Returns all MCP tools from all connected servers.

**Example:**
```bash
curl http://localhost:3000/api/tools
```

**Response:**
```json
{
  "success": true,
  "servers": ["Filesystem", "Fetch", "Desktop-Commander"],
  "tools": [
    {
      "serverName": "Filesystem",
      "tools": [
        {
          "name": "read_file",
          "description": "Read contents of a file",
          "inputSchema": {
            "type": "object",
            "properties": { "path": { "type": "string" } },
            "required": ["path"]
          }
        }
      ]
    }
  ]
}
```

---

### 2. POST `/api/tools/call` - Call an MCP Tool

Calls a specific tool on a specific MCP server.

**Request Body:**
```json
{
  "serverName": "Filesystem",
  "toolName": "read_file",
  "arguments": { "path": "/path/to/file.txt" }
}
```

**Examples:**

**Read a file:**
```bash
curl -X POST http://localhost:3000/api/tools/call \
  -H "Content-Type: application/json" \
  -d '{"serverName":"Filesystem","toolName":"read_file","arguments":{"path":"/tmp/test.txt"}}'
```

**Write a file:**
```bash
curl -X POST http://localhost:3000/api/tools/call \
  -H "Content-Type: application/json" \
  -d '{"serverName":"Filesystem","toolName":"write_file","arguments":{"path":"/tmp/output.txt","content":"Hello from CLI!"}}'
```

**Fetch a URL:**
```bash
curl -X POST http://localhost:3000/api/tools/call \
  -H "Content-Type: application/json" \
  -d '{"serverName":"Fetch","toolName":"fetch","arguments":{"url":"https://example.com"}}'
```

---

### 3. GET `/api/config` - Get MCP Server Configuration

Returns the current MCP server configurations.

**Example:**
```bash
curl http://localhost:3000/api/config
```

---

## Using with OpenCode

Create a wrapper script `opencode-qwen.sh`:

```bash
#!/bin/bash

QWEN_API="http://localhost:3000/api/tools/call"

call_tool() {
  local server="$1"
  local tool="$2"
  local args="$3"
  
  curl -s -X POST "$QWEN_API" \
    -H "Content-Type: application/json" \
    -d "{\"serverName\":\"$server\",\"toolName\":\"$tool\",\"arguments\":$args}"
}

# Example usage
call_tool "Filesystem" "read_file" '{"path":"/tmp/test.txt"}'
```

---

## Using with Claude Code CLI

Create `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "qwen-desktop": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "http://localhost:3000/api/tools/call",
        "-H", "Content-Type: application/json",
        "-d", "{\"serverName\":\"${MCP_SERVER}\",\"toolName\":\"${MCP_TOOL}\",\"arguments\":${MCP_ARGS}}"
      ]
    }
  }
}
```

Then run:
```bash
claude-code --mcp-config ~/.claude/mcp.json
```

---

## Using with Custom Scripts

### Node.js Example

```javascript
const QWEN_API = 'http://localhost:3000/api/tools/call';

async function callTool(serverName, toolName, args = {}) {
  const response = await fetch(QWEN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serverName, toolName, arguments: args })
  });
  return await response.json();
}

// Usage
const result = await callTool('Filesystem', 'read_file', { path: '/tmp/test.txt' });
console.log(result);
```

### Python Example

```python
import requests

QWEN_API = "http://localhost:3000/api/tools/call"

def call_tool(server_name, tool_name, args=None):
    response = requests.post(QWEN_API, json={
        "serverName": server_name,
        "toolName": tool_name,
        "arguments": args or {}
    })
    return response.json()

# Usage
result = call_tool("Filesystem", "read_file", {"path": "/tmp/test.txt"})
print(result)
```

### Bash Example

```bash
#!/bin/bash

QWEN_API="http://localhost:3000/api/tools/call"

call_tool() {
  curl -s -X POST "$QWEN_API" \
    -H "Content-Type: application/json" \
    -d "{\"serverName\":\"$1\",\"toolName\":\"$2\",\"arguments\":$3}"
}

call_tool "Filesystem" "read_file" '{"path":"/tmp/test.txt"}'
```

---

## Security

- Server only binds to `localhost:3000` by default
- Optional Bearer token authentication available
- Can be disabled in settings: `{ "http_server_config": { "enabled": false } }`

---

## Troubleshooting

1. **Server not starting**: Check app logs with `npm start 2>&1 | grep "HTTP"`
2. **Connection refused**: Ensure app is running and server is enabled
3. **Tool not found**: Run `curl http://localhost:3000/api/tools` to list available tools

---

## License

MIT License - Part of Qwen Desktop for Linux

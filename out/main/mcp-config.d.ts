/**
 * MCP Config Adapter — rewrites MCP server configs to use bundled runtimes
 *
 * The official Qwen Desktop app uses `adaptConfig()` to replace command names
 * (npx, bun, uvx) with actual bundled binary paths. This module replicates
 * that behavior for Linux:
 * - Replaces `npx` → bundled `bun` path
 * - Replaces `bun` → bundled `bun` path
 * - Replaces `uvx` → bundled `uvx` path
 * - Fixes macOS paths (/Users) to Linux home directory
 * - Sets PATH environment with bundled runtime directories
 */
import type { McpConfig } from "../shared/types.js";
/**
 * Adapt MCP config to use bundled runtimes
 * Replaces "npx", "bun", "uvx" with bundled binary paths
 * This is the Linux equivalent of the official app's adaptConfig function
 */
export declare function adaptConfig(configs: McpConfig): McpConfig;
//# sourceMappingURL=mcp-config.d.ts.map
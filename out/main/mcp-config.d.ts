import type { McpConfig } from "../shared/types.js";
/**
 * Adapt MCP config to use bundled runtimes
 * Replaces "npx", "bun", "uvx" with bundled binary paths
 * This is the Linux equivalent of the official app's adaptConfig function
 */
export declare function adaptConfig(configs: McpConfig): McpConfig;
//# sourceMappingURL=mcp-config.d.ts.map
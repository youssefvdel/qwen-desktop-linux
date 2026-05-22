/**
 * Runtime Manager — bundled bun + uv binary path resolution
 *
 * Downloads and manages the bundled runtimes (bun, uv, uvx) that MCP
 * servers depend on. Handles platform-specific paths for Linux/macOS/Windows.
 *
 * Key functions:
 * - getRuntimePaths() — Returns absolute paths to bun, uv, uvx binaries
 * - ensureRuntimesExecutable() — chmod 0o755 on Linux/macOS (dev mode only)
 * - getPlatformName()/getPlatformDir() — Platform detection helpers
 *
 * Note: electron-builder nests project resources/ inside process.resourcesPath,
 * creating a double nesting (resources/resources/bun/...). This is handled
 * by checking app.isPackaged and adjusting the path accordingly.
 */
import type { RuntimePaths } from "../shared/types.js";
/**
 * Get platform-specific paths for bundled runtimes
 * Supports Linux (x64/arm64), macOS, and Windows
 */
export declare function getRuntimePaths(): RuntimePaths;
/**
 * Get the path to the bundled bun runtime
 */
export declare function getBunPath(): string;
/**
 * Get the path to the bundled uv runtime
 */
export declare function getUvPath(): string;
/**
 * Get the path to the bundled uvx runtime
 */
export declare function getUvxPath(): string;
/**
 * Check if a bundled runtime exists and is executable
 */
export declare function checkRuntimeExists(runtimePath: string): boolean;
/**
 * Ensure bundled runtimes are executable (Linux/macOS)
 */
export declare function ensureRuntimesExecutable(): Promise<void>;
/**
 * Get platform name for display
 */
export declare function getPlatformName(): string;
/**
 * Get platform directory name (for auto-updater, etc.)
 */
export declare function getPlatformDir(platform?: NodeJS.Platform, arch?: NodeJS.Architecture): string;
//# sourceMappingURL=runtime.d.ts.map
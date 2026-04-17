"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRuntimePaths = getRuntimePaths;
exports.getBunPath = getBunPath;
exports.getUvPath = getUvPath;
exports.getUvxPath = getUvxPath;
exports.checkRuntimeExists = checkRuntimeExists;
exports.ensureRuntimesExecutable = ensureRuntimesExecutable;
exports.getPlatformName = getPlatformName;
exports.getPlatformDir = getPlatformDir;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_1 = require("electron");
/**
 * Get platform-specific paths for bundled runtimes
 * Supports Linux (x64/arm64), macOS, and Windows
 */
function getRuntimePaths() {
    const platform = process.platform;
    const arch = process.arch;
    // In production, process.resourcesPath points to the app's resources dir
    // electron-builder nests our project resources/ inside it, creating resources/resources/
    // In development, fall back to project root
    const resourcesPath = electron_1.app.isPackaged
        ? process.resourcesPath
        : path_1.default.join(electron_1.app.getAppPath(), "resources");
    if (platform === "linux") {
        const archDir = arch === "arm64" ? "linux-arm64" : "linux-x64";
        return {
            bun: electron_1.app.isPackaged
                ? path_1.default.join(resourcesPath, "resources", "bun", archDir, "bun")
                : path_1.default.join(resourcesPath, "bun", archDir, "bun"),
            uv: electron_1.app.isPackaged
                ? path_1.default.join(resourcesPath, "resources", "uv", archDir, "uv")
                : path_1.default.join(resourcesPath, "uv", archDir, "uv"),
            uvx: electron_1.app.isPackaged
                ? path_1.default.join(resourcesPath, "resources", "uv", archDir, "uvx")
                : path_1.default.join(resourcesPath, "uv", archDir, "uvx"),
        };
    }
    if (platform === "darwin") {
        const archDir = arch === "arm64" ? "darwin-arm64" : "darwin-x64";
        return {
            bun: electron_1.app.isPackaged
                ? path_1.default.join(resourcesPath, "resources", "bun", archDir, "bun")
                : path_1.default.join(resourcesPath, "bun", archDir, "bun"),
            uv: electron_1.app.isPackaged
                ? path_1.default.join(resourcesPath, "resources", "uv", archDir, "uv")
                : path_1.default.join(resourcesPath, "uv", archDir, "uv"),
            uvx: electron_1.app.isPackaged
                ? path_1.default.join(resourcesPath, "resources", "uv", archDir, "uvx")
                : path_1.default.join(resourcesPath, "uv", archDir, "uvx"),
        };
    }
    if (platform === "win32") {
        return {
            bun: electron_1.app.isPackaged
                ? path_1.default.join(resourcesPath, "resources", "bun", "win-x64", "bun.exe")
                : path_1.default.join(resourcesPath, "bun", "win-x64", "bun.exe"),
            uv: electron_1.app.isPackaged
                ? path_1.default.join(resourcesPath, "resources", "uv", "win-x64", "uv.exe")
                : path_1.default.join(resourcesPath, "uv", "win-x64", "uv.exe"),
            uvx: electron_1.app.isPackaged
                ? path_1.default.join(resourcesPath, "resources", "uv", "win-x64", "uvx.exe")
                : path_1.default.join(resourcesPath, "uv", "win-x64", "uvx.exe"),
        };
    }
    throw new Error(`Unsupported platform: ${platform}, arch: ${arch}`);
}
/**
 * Get the path to the bundled bun runtime
 */
function getBunPath() {
    return getRuntimePaths().bun;
}
/**
 * Get the path to the bundled uv runtime
 */
function getUvPath() {
    return getRuntimePaths().uv;
}
/**
 * Get the path to the bundled uvx runtime
 */
function getUvxPath() {
    return getRuntimePaths().uvx;
}
/**
 * Check if a bundled runtime exists and is executable
 */
function checkRuntimeExists(runtimePath) {
    try {
        return (fs_1.default.existsSync(runtimePath) &&
            fs_1.default.accessSync(runtimePath, fs_1.default.constants.X_OK) === undefined);
    }
    catch {
        return false;
    }
}
/**
 * Ensure bundled runtimes are executable (Linux/macOS)
 */
async function ensureRuntimesExecutable() {
    if (process.platform === "win32")
        return;
    // Skip chmod on packaged apps — files are already executable from the RPM
    if (electron_1.app.isPackaged)
        return;
    const runtimes = getRuntimePaths();
    const chmod = require("fs").promises.chmod;
    for (const runtimePath of Object.values(runtimes)) {
        try {
            if (fs_1.default.existsSync(runtimePath)) {
                await chmod(runtimePath, 0o755);
                console.log(`[Runtime] Made executable: ${runtimePath}`);
            }
        }
        catch (error) {
            console.warn(`[Runtime] Failed to chmod ${runtimePath}:`, error);
        }
    }
}
/**
 * Get platform name for display
 */
function getPlatformName() {
    const platform = process.platform;
    const arch = process.arch;
    if (platform === "linux")
        return `Linux ${arch}`;
    if (platform === "darwin")
        return `macOS ${arch}`;
    if (platform === "win32")
        return `Windows ${arch}`;
    return `${platform} ${arch}`;
}
/**
 * Get platform directory name (for auto-updater, etc.)
 */
function getPlatformDir(platform = process.platform, arch = process.arch) {
    if (platform === "darwin")
        return arch === "arm64" ? "mac-arm64" : "mac-x64";
    if (platform === "win32")
        return "win-x64";
    if (platform === "linux")
        return arch === "arm64" ? "linux-arm64" : "linux-x64";
    throw new Error(`Unsupported platform: ${platform}, arch: ${arch}`);
}
//# sourceMappingURL=runtime.js.map
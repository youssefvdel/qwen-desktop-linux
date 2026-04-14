"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adaptConfig = adaptConfig;
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const electron_1 = require("electron");
const runtime_js_1 = require("./runtime.js");
/**
 * Adapt MCP config to use bundled runtimes
 * Replaces "npx", "bun", "uvx" with bundled binary paths
 * This is the Linux equivalent of the official app's adaptConfig function
 */
function adaptConfig(configs) {
    const adapted = { ...configs };
    const correctBunPath = (0, runtime_js_1.getBunPath)();
    const correctUvxPath = (0, runtime_js_1.getUvxPath)();
    for (const key in adapted) {
        const config = adapted[key];
        let cmd = config.command;
        // Always normalize to the correct bundled runtime path
        // Replace any path ending with /bun (from any source) with the bundled one
        if (cmd.endsWith("/bun") || cmd === "bun" || cmd === "npx") {
            cmd = correctBunPath;
            if (config.command === "npx" || (!config.command.endsWith("/bun") && config.command !== correctBunPath)) {
                config.args = config.args || [];
                if (!config.args.includes("-y")) {
                    config.args.unshift("-y");
                }
                if (!config.args.includes("x")) {
                    config.args.unshift("x");
                }
            }
        }
        // Replace any path ending with /uvx or "uvx" with bundled one
        if (cmd.endsWith("/uvx") || cmd === "uvx") {
            cmd = correctUvxPath;
        }
        config.command = cmd;
        // Fix macOS paths (/Users) to Linux home directory
        if (config.args && config.args.length > 0) {
            const homeDir = os_1.default.homedir();
            config.args = config.args.map((arg) => {
                if (arg === "/Users" || arg.startsWith("/Users/")) {
                    return arg.replace("/Users", homeDir);
                }
                return arg;
            });
        }
        // Set PATH environment with Linux standard paths + bundled bin
        // In production, project resources are nested at resources/resources/ inside process.resourcesPath
        const runtimeDir = electron_1.app.isPackaged
            ? path_1.default.join(process.resourcesPath, "resources")
            : path_1.default.join(process.cwd(), "resources");
        const bunDir = path_1.default.join(runtimeDir, "bun", process.arch === "arm64" ? "linux-arm64" : "linux-x64");
        const uvDir = path_1.default.join(runtimeDir, "uv", process.arch === "arm64" ? "linux-arm64" : "linux-x64");
        const PATH = [
            bunDir,
            uvDir,
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin",
            "/snap/bin",
            path_1.default.join(os_1.default.homedir(), ".local", "bin"),
        ].join(":");
        config.env = {
            PATH,
            ...process.env,
            ...config.env,
        };
    }
    return adapted;
}
//# sourceMappingURL=mcp-config.js.map
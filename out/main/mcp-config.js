"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adaptConfig = adaptConfig;
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const runtime_js_1 = require("./runtime.js");
/**
 * Adapt MCP config to use bundled runtimes
 * Replaces "npx", "bun", "uvx" with bundled binary paths
 * This is the Linux equivalent of the official app's adaptConfig function
 */
function adaptConfig(configs) {
    const adapted = { ...configs };
    for (const key in adapted) {
        const config = adapted[key];
        let cmd = config.command;
        // Replace "npx" or "bun" with bundled bun
        if (cmd === "npx" || cmd === "bun") {
            cmd = (0, runtime_js_1.getBunPath)();
            if (config.command === "npx") {
                // npx commands become "bun x -y <package> <args>"
                config.args = config.args || [];
                if (!config.args.includes("-y")) {
                    config.args.unshift("-y");
                }
                if (!config.args.includes("x")) {
                    config.args.unshift("x");
                }
            }
        }
        // Replace "uvx" with bundled uvx
        if (cmd === "uvx") {
            cmd = (0, runtime_js_1.getUvxPath)();
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
        const pathToMyBin = path_1.default.join(process.resourcesPath || process.cwd(), "resources", "bin");
        const PATH = [
            pathToMyBin,
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin",
            "/snap/bin", // Snap packages
            path_1.default.join(os_1.default.homedir(), ".local", "bin"), // User local bin
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
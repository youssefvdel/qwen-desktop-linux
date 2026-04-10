import path from "path";
import os from "os";
import { app } from "electron";
import { getBunPath, getUvxPath } from "./runtime.js";
import type { McpConfig } from "../shared/types.js";

/**
 * Adapt MCP config to use bundled runtimes
 * Replaces "npx", "bun", "uvx" with bundled binary paths
 * This is the Linux equivalent of the official app's adaptConfig function
 */
export function adaptConfig(configs: McpConfig): McpConfig {
  const adapted = { ...configs };
  const correctBunPath = getBunPath();
  const correctUvxPath = getUvxPath();

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
      const homeDir = os.homedir();
      config.args = config.args.map((arg: string) => {
        if (arg === "/Users" || arg.startsWith("/Users/")) {
          return arg.replace("/Users", homeDir);
        }
        return arg;
      });
    }

    // Set PATH environment with Linux standard paths + bundled bin
    // In production, process.resourcesPath = /opt/Qwen Desktop/resources/
    // Runtimes are at resources/resources/{bun,uv}/linux-x64/
    const runtimeDir = path.join(
      app.isPackaged ? process.resourcesPath : process.cwd(),
      "resources", "resources",
    );
    const bunDir = path.join(runtimeDir, "bun",
      process.arch === "arm64" ? "linux-arm64" : "linux-x64");
    const uvDir = path.join(runtimeDir, "uv",
      process.arch === "arm64" ? "linux-arm64" : "linux-x64");

    const PATH = [
      bunDir,
      uvDir,
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin",
      "/snap/bin",
      path.join(os.homedir(), ".local", "bin"),
    ].join(":");

    config.env = {
      PATH,
      ...process.env,
      ...config.env,
    };
  }

  return adapted;
}

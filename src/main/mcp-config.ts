import path from "path";
import os from "os";
import { getBunPath, getUvxPath } from "./runtime.js";
import type { McpConfig } from "../shared/types.js";

/**
 * Adapt MCP config to use bundled runtimes
 * Replaces "npx", "bun", "uvx" with bundled binary paths
 * This is the Linux equivalent of the official app's adaptConfig function
 */
export function adaptConfig(configs: McpConfig): McpConfig {
  const adapted = { ...configs };

  for (const key in adapted) {
    const config = adapted[key];
    let cmd = config.command;

    // Replace "npx" or "bun" with bundled bun
    if (cmd === "npx" || cmd === "bun") {
      cmd = getBunPath();
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
      cmd = getUvxPath();
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
    const pathToMyBin = path.join(
      process.resourcesPath || process.cwd(),
      "resources",
      "bin",
    );
    const PATH = [
      pathToMyBin,
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin",
      "/snap/bin", // Snap packages
      path.join(os.homedir(), ".local", "bin"), // User local bin
    ].join(":");

    config.env = {
      PATH,
      ...process.env,
      ...config.env,
    };
  }

  return adapted;
}

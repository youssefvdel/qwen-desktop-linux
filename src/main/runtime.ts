import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import type { RuntimePaths } from '../shared/types.js';

/**
 * Get platform-specific paths for bundled runtimes
 * Supports Linux (x64/arm64), macOS, and Windows
 */
export function getRuntimePaths(): RuntimePaths {
  const platform = process.platform;
  const arch = process.arch;
  // In production, process.resourcesPath points to /opt/Qwen Desktop/resources/
  // In development, fall back to project root
  const resourcesPath = app.isPackaged
    ? process.resourcesPath
    : path.join(app.getAppPath(), 'resources');

  if (platform === 'linux') {
    const archDir = arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
    return {
      bun: path.join(resourcesPath, 'resources', 'bun', archDir, 'bun'),
      uv: path.join(resourcesPath, 'resources', 'uv', archDir, 'uv'),
      uvx: path.join(resourcesPath, 'resources', 'uv', archDir, 'uvx'),
    };
  }

  if (platform === 'darwin') {
    const archDir = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
    return {
      bun: path.join(resourcesPath, 'resources', 'bun', archDir, 'bun'),
      uv: path.join(resourcesPath, 'resources', 'uv', archDir, 'uv'),
      uvx: path.join(resourcesPath, 'resources', 'uv', archDir, 'uvx'),
    };
  }

  if (platform === 'win32') {
    return {
      bun: path.join(resourcesPath, 'resources', 'bun', 'win-x64', 'bun.exe'),
      uv: path.join(resourcesPath, 'resources', 'uv', 'win-x64', 'uv.exe'),
      uvx: path.join(resourcesPath, 'resources', 'uv', 'win-x64', 'uvx.exe'),
    };
  }

  throw new Error(`Unsupported platform: ${platform}, arch: ${arch}`);
}

/**
 * Get the path to the bundled bun runtime
 */
export function getBunPath(): string {
  return getRuntimePaths().bun;
}

/**
 * Get the path to the bundled uv runtime
 */
export function getUvPath(): string {
  return getRuntimePaths().uv;
}

/**
 * Get the path to the bundled uvx runtime
 */
export function getUvxPath(): string {
  return getRuntimePaths().uvx;
}

/**
 * Check if a bundled runtime exists and is executable
 */
export function checkRuntimeExists(runtimePath: string): boolean {
  try {
    return fs.existsSync(runtimePath) && fs.accessSync(runtimePath, fs.constants.X_OK) === undefined;
  } catch {
    return false;
  }
}

/**
 * Ensure bundled runtimes are executable (Linux/macOS)
 */
export async function ensureRuntimesExecutable(): Promise<void> {
  if (process.platform === 'win32') return;
  // Skip chmod on packaged apps — files are already executable from the RPM
  if (app.isPackaged) return;

  const runtimes = getRuntimePaths();
  const chmod = require('fs').promises.chmod;

  for (const runtimePath of Object.values(runtimes)) {
    try {
      if (fs.existsSync(runtimePath)) {
        await chmod(runtimePath, 0o755);
        console.log(`[Runtime] Made executable: ${runtimePath}`);
      }
    } catch (error) {
      console.warn(`[Runtime] Failed to chmod ${runtimePath}:`, error);
    }
  }
}

/**
 * Get platform name for display
 */
export function getPlatformName(): string {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'linux') return `Linux ${arch}`;
  if (platform === 'darwin') return `macOS ${arch}`;
  if (platform === 'win32') return `Windows ${arch}`;
  return `${platform} ${arch}`;
}

/**
 * Get platform directory name (for auto-updater, etc.)
 */
export function getPlatformDir(platform = process.platform, arch = process.arch): string {
  if (platform === 'darwin') return arch === 'arm64' ? 'mac-arm64' : 'mac-x64';
  if (platform === 'win32') return 'win-x64';
  if (platform === 'linux') return arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  throw new Error(`Unsupported platform: ${platform}, arch: ${arch}`);
}

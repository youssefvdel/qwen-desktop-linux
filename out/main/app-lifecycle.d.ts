/**
 * App Lifecycle — protocol handler, deep links, quit state, app flags
 *
 * Responsibilities:
 * - configureApp() — Sets all app.commandLine flags (GPU, sandbox, platform hints).
 *   Called BEFORE app.whenReady() so flags take effect.
 * - setupProtocolHandler() — Registers qwen:// as a custom protocol handler.
 *   On Linux AppImage, patches the auto-generated .desktop file to add the MIME type.
 * - handleDeepLink() — Parses qwen://open?token=xxx URLs and sends the auth token
 *   to the renderer via IPC event.
 * - isQuitting/setQuitting — Global quit state used by window-manager for
 *   close-to-tray behavior vs actual quit.
 */
import { BrowserWindow } from "electron";
/** Check if app is in quit state. Used by window-manager close handler. */
export declare function isQuitting(): boolean;
/** Set the quit state. Called from tray "Quit" menu item. */
export declare function setQuitting(value: boolean): void;
/**
 * Configure app command-line flags.
 * Call this ONCE at startup before app.whenReady().
 * Replaces module-level side effects.
 */
export declare function configureApp(): void;
/**
 * Handle qwen:// deep link URLs.
 */
export declare function handleDeepLink(url: string, mainWindow: BrowserWindow | null): void;
/**
 * Setup protocol handler (qwen://) and second-instance handler (Linux).
 */
export declare function setupProtocolHandler(handlers: {
    onDeepLink: (url: string) => void;
    onCreateWindow: () => void;
}): void;
//# sourceMappingURL=app-lifecycle.d.ts.map
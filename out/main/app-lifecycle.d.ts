import { BrowserWindow } from "electron";
export declare function isQuitting(): boolean;
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
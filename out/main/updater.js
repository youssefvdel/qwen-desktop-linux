"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAutoUpdater = setupAutoUpdater;
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
function setupAutoUpdater() {
    if (!electron_1.app.isPackaged) {
        console.log("[Updater] Skipping update check in development mode");
        return;
    }
    electron_updater_1.autoUpdater.autoDownload = false;
    electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
    electron_updater_1.autoUpdater.on("update-available", (info) => {
        console.log(`[Updater] Update available: ${info.version}`);
        electron_1.dialog
            .showMessageBox({
            type: "info",
            title: "Update Available",
            message: `Version ${info.version} is available. Download now?`,
            buttons: ["Download", "Later"],
            defaultId: 0,
            cancelId: 1,
        })
            .then((result) => {
            if (result.response === 0) {
                electron_updater_1.autoUpdater.downloadUpdate();
            }
        });
    });
    electron_updater_1.autoUpdater.on("download-progress", (progressObj) => {
        console.log(`[Updater] Downloading: ${progressObj.percent}%`);
    });
    electron_updater_1.autoUpdater.on("update-downloaded", (info) => {
        console.log(`[Updater] Update downloaded: ${info.version}`);
        electron_1.dialog
            .showMessageBox({
            type: "info",
            title: "Update Ready",
            message: `Version ${info.version} has been downloaded. Restart to apply?`,
            buttons: ["Restart Now", "Later"],
            defaultId: 0,
            cancelId: 1,
        })
            .then((result) => {
            if (result.response === 0) {
                setImmediate(() => electron_updater_1.autoUpdater.quitAndInstall());
            }
        });
    });
    electron_updater_1.autoUpdater.on("error", (err) => {
        console.error("[Updater] Update error:", err);
    });
    console.log("[Updater] Checking for updates...");
    electron_updater_1.autoUpdater.checkForUpdatesAndNotify().catch(() => {
        // Silently ignore update check errors (e.g., no GitHub releases yet)
    });
}
//# sourceMappingURL=updater.js.map
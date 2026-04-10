const { app, BrowserWindow } = require("electron");

app.whenReady(() => {
  console.log("✅ App ready");

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  console.log("✅ Window created");

  win.loadURL("https://chat.qwen.ai");

  win.webContents.on("did-finish-load", () => {
    console.log("✅ Page loaded");
  });

  win.on("closed", () => {
    console.log("❌ Window closed");
    process.exit(0);
  });
});

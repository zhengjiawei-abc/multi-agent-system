const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "desktop.config.json");
let serverProcess = null;

function readDesktopConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeDesktopConfig(config) {
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function clampZoom(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0.9;
  return Math.min(1.2, Math.max(0.6, Math.round(next * 100) / 100));
}

function getZoomFactor() {
  const config = readDesktopConfig();
  return clampZoom(config.window?.zoomFactor ?? 0.9);
}

function saveZoomFactor(value) {
  const config = readDesktopConfig();
  config.window = config.window || {};
  config.window.zoomFactor = clampZoom(value);
  writeDesktopConfig(config);
  return config.window.zoomFactor;
}

function waitForServer(url, timeoutMs = 8000) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) resolve(false);
        else setTimeout(check, 350);
      });
      req.setTimeout(800, () => {
        req.destroy();
      });
    };
    check();
  });
}

function startServer() {
  const config = readDesktopConfig();
  const port = config.port || 8765;
  const bindHost = config.bindHost || "0.0.0.0";
  const python = path.join(ROOT, ".venv", "Scripts", "python.exe");
  serverProcess = spawn(python, ["-m", "uvicorn", "server:app", "--host", bindHost, "--port", String(port)], {
    cwd: ROOT,
    windowsHide: true,
    stdio: "ignore",
  });
}

function createWindow() {
  const config = readDesktopConfig();
  const width = config.window?.width || 1680;
  const height = config.window?.height || 980;
  const port = config.port || 8765;
  const win = new BrowserWindow({
    width,
    height,
    minWidth: 1360,
    minHeight: 820,
    title: config.appName || "QuantumFlow Desktop",
    backgroundColor: "#0d1020",
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.on("did-finish-load", () => {
    win.webContents.setZoomFactor(getZoomFactor());
  });

  win.webContents.on("before-input-event", (event, input) => {
    if (!input.control && !input.meta) return;
    const key = String(input.key || "").toLowerCase();
    const isPlus = key === "+" || key === "=" || key === "add";
    const isMinus = key === "-" || key === "_" || key === "subtract";
    const isReset = key === "0";
    if (!isPlus && !isMinus && !isReset) return;
    event.preventDefault();
    const current = getZoomFactor();
    const next = isReset ? 0.9 : current + (isPlus ? 0.05 : -0.05);
    const factor = saveZoomFactor(next);
    win.webContents.setZoomFactor(factor);
    win.webContents.send("zoom:changed", factor);
  });

  win.loadURL(`http://127.0.0.1:${port}/war-room?desktop=1`);
}

ipcMain.handle("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.handle("window:toggle-maximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
  return win.isMaximized();
});

ipcMain.handle("window:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle("zoom:get", () => getZoomFactor());

ipcMain.handle("zoom:set", (event, value) => {
  const factor = saveZoomFactor(value);
  BrowserWindow.fromWebContents(event.sender)?.webContents.setZoomFactor(factor);
  return factor;
});

app.whenReady().then(async () => {
  const config = readDesktopConfig();
  const port = config.port || 8765;
  const alive = await waitForServer(`http://127.0.0.1:${port}/api/app-version`, 1200);
  if (!alive) startServer();
  await waitForServer(`http://127.0.0.1:${port}/api/app-version`, 9000);
  createWindow();
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});

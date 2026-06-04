const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("quantumflowDesktop", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  getZoom: () => ipcRenderer.invoke("zoom:get"),
  setZoom: (value) => ipcRenderer.invoke("zoom:set", value),
  openExternal: (url) => ipcRenderer.invoke("browser:open-external", url),
  onZoomChanged: (callback) => {
    ipcRenderer.on("zoom:changed", (_event, value) => callback(value));
  },
});

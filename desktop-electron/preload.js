const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("quantumflowDesktop", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  getZoom: () => ipcRenderer.invoke("zoom:get"),
  setZoom: (value) => ipcRenderer.invoke("zoom:set", value),
  onZoomChanged: (callback) => {
    ipcRenderer.on("zoom:changed", (_event, value) => callback(value));
  },
});

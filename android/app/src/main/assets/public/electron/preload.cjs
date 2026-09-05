'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // ─── Terminal Real ───────────────────────────────────────────────────────
  terminal: {
    spawn: () => ipcRenderer.invoke('terminal:spawn'),
    write: (id, data) => ipcRenderer.send('terminal:write', { id, data }),
    kill: (id) => ipcRenderer.send('terminal:kill', { id }),
    onData: (id, cb) => {
      const handler = (_event, data) => cb(data);
      ipcRenderer.on(`terminal:data:${id}`, handler);
      return () => ipcRenderer.removeListener(`terminal:data:${id}`, handler);
    },
    onExit: (id, cb) => {
      ipcRenderer.once(`terminal:exit:${id}`, (_event, code) => cb(code));
    },
  },

  info: () => ipcRenderer.invoke('terminal:info'),

  // ─── Filesystem — Projetos no Disco do PC ───────────────────────────────
  fs: {
    saveProject: (name, files) => ipcRenderer.invoke('fs:saveProject', { name, files }),
    loadProject: (name) => ipcRenderer.invoke('fs:loadProject', { name }),
    listProjects: () => ipcRenderer.invoke('fs:listProjects'),
    deleteProject: (name) => ipcRenderer.invoke('fs:deleteProject', { name }),
    exportZip: (name, filesBase64, platform) => ipcRenderer.invoke('fs:exportZip', { name, files: filesBase64, platform }),
    openProjectsDir: () => ipcRenderer.invoke('fs:openProjectsDir'),
    openPath: (filePath) => ipcRenderer.invoke('fs:openPath', { filePath }),
    revealInExplorer: (filePath) => ipcRenderer.invoke('fs:revealInExplorer', { filePath }),
  },
});

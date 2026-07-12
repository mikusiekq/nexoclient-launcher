import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to the React frontend
contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  getSystemRam: () => ipcRenderer.invoke('get-system-ram'),
  
  detectJava: () => ipcRenderer.invoke('detect-java'),
  browseJava: () => ipcRenderer.invoke('browse-java'),
  browseGamePath: () => ipcRenderer.invoke('browse-game-path'),
  openFolder: (folderName: string, profileId?: string) => ipcRenderer.invoke('open-folder', folderName, profileId),
  
  fetchVersions: () => ipcRenderer.invoke('fetch-versions'),
  loginOffline: (username: string) => ipcRenderer.invoke('login-offline', username),
  loginMicrosoft: () => ipcRenderer.invoke('login-microsoft'),
  launchGame: (version: string) => ipcRenderer.invoke('launch-game', version),
  browseMcFolder: () => ipcRenderer.invoke('browse-mc-folder'),
  importMinecraftSettings: (mcPath: string) => ipcRenderer.invoke('import-minecraft-settings', mcPath),
  uploadMojangSkin: (token: string, base64DataUrl: string, modelType: 'default' | 'slim') =>
    ipcRenderer.invoke('upload-mojang-skin', token, base64DataUrl, modelType),
  
  getInstalledMods: (profileId: string) => ipcRenderer.invoke('get-installed-mods', profileId),
  installProfileMod: (profileId: string, projectId: string, title: string, versionId: string, downloadUrl: string, fileName: string, iconUrl?: string) =>
    ipcRenderer.invoke('install-profile-mod', profileId, projectId, title, versionId, downloadUrl, fileName, iconUrl),
  uninstallProfileMod: (profileId: string, projectId: string) => ipcRenderer.invoke('uninstall-profile-mod', profileId, projectId),
  
  // IPC Event Listeners
  onLaunchStatus: (callback: (status: string) => void) => {
    const subscription = (_event: any, status: string) => callback(status);
    ipcRenderer.on('launch-status', subscription);
    return () => ipcRenderer.removeListener('launch-status', subscription);
  },
  
  onLaunchProgress: (callback: (progress: any) => void) => {
    const subscription = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('launch-progress', subscription);
    return () => ipcRenderer.removeListener('launch-progress', subscription);
  },
  
  onLauncherLog: (callback: (log: string) => void) => {
    const subscription = (_event: any, log: string) => callback(log);
    ipcRenderer.on('launcher-log', subscription);
    return () => ipcRenderer.removeListener('launcher-log', subscription);
  },
  
  onGameStarted: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on('game-started', subscription);
    return () => ipcRenderer.removeListener('game-started', subscription);
  },
  
  onGameClosed: (callback: (code: number) => void) => {
    const subscription = (_event: any, code: number) => callback(code);
    ipcRenderer.on('game-closed', subscription);
    return () => ipcRenderer.removeListener('game-closed', subscription);
  }
});

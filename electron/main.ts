import { app, BrowserWindow } from 'electron';
import path from 'path';
import { ensureGameDirs, getConfig, loadConfig } from './config';
import { startDiscordRpc } from './discord';
import { registerIpcHandlers } from './ipc';
import { migrateLegacyGameData } from './migration';
import { stampLegacyProfileDirs, syncProfileFolderNames } from './profiles';
import { startAutoUpdate } from './updater';
import { createWindow, focusMainWindow } from './window';

// Dev builds get their own Electron data folder (and with it their own single-instance lock),
// so `npm run dev` can run next to an installed launcher
if (!app.isPackaged) app.setPath('userData', path.join(app.getPath('appData'), 'NEXOCLIENT-dev'));

// Only one launcher at a time; launching it again focuses the open window
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusMainWindow);

  app.whenReady().then(() => {
    const legacyGamePath = loadConfig();
    const config = getConfig();
    if (legacyGamePath) migrateLegacyGameData(legacyGamePath, config.gamePath, config.profiles);
    ensureGameDirs();
    stampLegacyProfileDirs(config.gamePath, config.profiles);
    syncProfileFolderNames(config.gamePath, config.profiles);

    registerIpcHandlers();
    createWindow();
    startAutoUpdate();
    if (config.discordRpc) startDiscordRpc();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

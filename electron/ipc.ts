import { app, dialog, ipcMain, shell } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loginMicrosoft, loginOffline } from './auth';
import { getConfig, saveConfig, type LauncherConfig } from './config';
import { setDiscordRpcEnabled } from './discord';
import { launchGame } from './game';
import { detectJavaPaths } from './java';
import { getInstalledMods, installMod, uninstallMod } from './mods';
import { getProfileDir, syncProfileFolderNames } from './profiles';
import { getUpdateStatus, installUpdateNow } from './updater';
import { fetchGameVersions } from './versions';
import { getMainWindow } from './window';

async function pickPath(options: Electron.OpenDialogOptions): Promise<string | null> {
  const window = getMainWindow();
  if (!window) return null;
  const result = await dialog.showOpenDialog(window, options);
  return result.canceled ? null : result.filePaths[0] ?? null;
}

export function registerIpcHandlers() {
  // Config
  ipcMain.handle('get-config', () => getConfig());
  ipcMain.handle('save-config', (_event, next: LauncherConfig) => {
    const rpcWasEnabled = getConfig().discordRpc;
    syncProfileFolderNames(next.gamePath, next.profiles);
    saveConfig(next);
    if (next.discordRpc !== rpcWasEnabled) setDiscordRpcEnabled(next.discordRpc);
    return getConfig();
  });

  // Accounts
  ipcMain.handle('login-offline', (_event, username: string) => loginOffline(username));
  ipcMain.handle('login-microsoft', () => loginMicrosoft());

  // Game
  ipcMain.handle('fetch-versions', async () => {
    try {
      return { versions: await fetchGameVersions() };
    } catch (error: any) {
      console.error('Failed to fetch versions:', error);
      throw new Error('Nie udało się pobrać wersji Fabric: ' + error.message);
    }
  });
  ipcMain.handle('launch-game', (_event, version: string) => launchGame(version));

  // Profile mods
  ipcMain.handle('get-installed-mods', (_event, profileId: string) => getInstalledMods(profileId));
  ipcMain.handle(
    'install-profile-mod',
    async (_event, profileId: string, projectId: string, title: string, versionId: string, downloadUrl: string, fileName: string, iconUrl?: string) => {
      try {
        await installMod(profileId, { projectId, title, versionId, downloadUrl, fileName, iconUrl });
        return true;
      } catch (err: any) {
        console.error(`Failed to install mod ${title}:`, err);
        throw new Error(`Mod installation failed: ${err.message}`);
      }
    },
  );
  ipcMain.handle('uninstall-profile-mod', (_event, profileId: string, projectId: string) => uninstallMod(profileId, projectId));

  // System
  ipcMain.handle('get-system-ram', () => Math.floor(os.totalmem() / 1024 ** 3));
  ipcMain.handle('detect-java', () => detectJavaPaths());
  ipcMain.handle('browse-java', () =>
    pickPath({
      title: 'Wybierz plik javaw.exe',
      filters: [{ name: 'Java Executable', extensions: ['exe'] }],
      properties: ['openFile'],
    }),
  );
  ipcMain.handle('browse-game-path', () =>
    pickPath({ title: 'Wybierz folder gry', properties: ['openDirectory', 'createDirectory'] }),
  );
  ipcMain.handle('open-folder', async (_event, folder: string, profileId?: string) => {
    const config = getConfig();
    const modsProfileId = profileId || config.activeProfileId;
    const target =
      folder === 'mods' && modsProfileId
        ? path.join(getProfileDir(modsProfileId), 'mods')
        : folder === 'resourcepacks'
          ? path.join(config.gamePath, 'resourcepacks')
          : config.gamePath;
    fs.mkdirSync(target, { recursive: true });
    await shell.openPath(target);
  });

  // Launcher updates
  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('get-update-status', () => getUpdateStatus());
  ipcMain.on('install-update', () => installUpdateNow());

  // Window controls (frameless window)
  ipcMain.on('window-minimize', () => getMainWindow()?.minimize());
  ipcMain.on('window-maximize', () => {
    const window = getMainWindow();
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.on('window-close', () => getMainWindow()?.close());
}

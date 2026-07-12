import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import https from 'https';
import os from 'os';
import { Client } from 'minecraft-launcher-core';
import { Auth } from 'msmc';
import DiscordRPC from 'discord-rpc';

// Structure of configuration
interface AccountInfo {
  username: string;
  uuid: string;
  token: string;
  type: 'offline' | 'microsoft';
  avatar: string;
}

interface Profile {
  id: string;
  name: string;
  version: string;
  accountUuid: string | null;
  modSet: 'vanilla' | 'optimization';
  createdAt: number;
}

interface LauncherConfig {
  ram: number;
  javaPath: string;
  gamePath: string;
  width: number;
  height: number;
  fullscreen: boolean;
  closeOnLaunch: boolean;
  discordRpc: boolean;
  selectedVersion: string;
  account: AccountInfo | null;
  savedAccounts: AccountInfo[];
  profiles: Profile[];
  activeProfileId: string | null;
}

const defaultConfig = (userDataPath: string): LauncherConfig => ({
  ram: 4,
  javaPath: '',
  gamePath: path.join(userDataPath, '.nexoclient'),
  width: 1024,
  height: 768,
  fullscreen: false,
  closeOnLaunch: false,
  discordRpc: true,
  selectedVersion: '',
  account: null,
  savedAccounts: [],
  profiles: [],
  activeProfileId: null,
});

let mainWindow: BrowserWindow | null = null;
let configPath = '';
let config: LauncherConfig;
let activeGameProcess: any = null;

// Discord RPC
const DISCORD_CLIENT_ID = '1507104421887082646';
let rpcClient: DiscordRPC.Client | null = null;
let rpcReady = false;

const rpcStartTime = Date.now();

function initDiscordRPC() {
  if (rpcClient) return;
  try {
    DiscordRPC.register(DISCORD_CLIENT_ID);
    rpcClient = new DiscordRPC.Client({ transport: 'ipc' });
    rpcClient.on('ready', () => {
      rpcReady = true;
      console.log('[Discord RPC] Ready');
      updateDiscordPresence('W menu głównym');
    });
    rpcClient.login({ clientId: DISCORD_CLIENT_ID }).catch((e: any) => {
      console.error('[Discord RPC] Login failed:', e?.message || e);
    });
  } catch (e) {
    console.error('[Discord RPC] Init error:', e);
  }
}

function destroyDiscordRPC() {
  if (rpcClient) {
    rpcClient.destroy().catch(() => {});
    rpcClient = null;
    rpcReady = false;
  }
}

function updateDiscordPresence(_state: string) {
  if (!rpcClient || !rpcReady) return;
  (rpcClient.setActivity as any)({
    details: 'W menu głównym',
    state: 'Pobierz na nexoclient.top',
    startTimestamp: rpcStartTime,
    largeImageKey: 'nexoclient',
    largeImageText: 'NEXOCLIENT',
    buttons: [
      { label: 'Strona launchera', url: 'https://nexoclient.top' }
    ],
  }).catch((e: any) => {
    console.error('[Discord RPC] setActivity error:', e?.message || e);
  });
}

// Helper to make HTTPS requests
function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'NexoClient-Launcher' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Handle redirect
        return httpGet(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Failed to load ${url}: Status ${res.statusCode}`));
        } else {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');
    protocol.get(url, { headers: { 'User-Agent': 'NexoClient-Launcher' } }, (res: any) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        return downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
      }

      if (res.statusCode && res.statusCode >= 400) {
        return reject(new Error(`Failed to download ${url}: Status ${res.statusCode}`));
      }

      const dir = path.dirname(destPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

function loadConfig() {
  const userDataPath = app.getPath('userData');
  configPath = path.join(userDataPath, 'launcher-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      config = { ...defaultConfig(userDataPath), ...JSON.parse(content) };
      // Ensure savedAccounts exists for older configs
      if (!Array.isArray(config.savedAccounts)) {
        config.savedAccounts = config.account ? [config.account] : [];
      }
      // Ensure profiles array exists
      if (!Array.isArray(config.profiles)) {
        config.profiles = [];
      }
    } catch (e) {
      config = defaultConfig(userDataPath);
    }
  } else {
    config = defaultConfig(userDataPath);
    saveConfig(config);
  }
}

function saveConfig(newConfig: LauncherConfig) {
  config = newConfig;
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

// Helper to add account to savedAccounts (replaces if same uuid exists)
function addToSavedAccounts(account: AccountInfo) {
  const idx = config.savedAccounts.findIndex(a => a.uuid === account.uuid);
  if (idx >= 0) {
    config.savedAccounts[idx] = account;
  } else {
    config.savedAccounts.push(account);
  }
}

// Java detection utility
function detectJavaPaths(): string[] {
  const paths: string[] = [];
  
  // 1. Scan Minecraft official runtime directory
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
  const mcRuntime = path.join(appData, '.minecraft', 'runtime');
  if (fs.existsSync(mcRuntime)) {
    try {
      const runtimes = fs.readdirSync(mcRuntime);
      for (const rt of runtimes) {
        const exePath17 = path.join(mcRuntime, rt, 'windows-x64', rt, 'bin', 'javaw.exe');
        const exePath21 = path.join(mcRuntime, rt, 'windows-x86', rt, 'bin', 'javaw.exe');
        if (fs.existsSync(exePath17)) {
          paths.push(exePath17);
        } else if (fs.existsSync(exePath21)) {
          paths.push(exePath21);
        } else {
          // Scan recursively for javaw.exe
          const deepScan = (dir: string) => {
            const files = fs.readdirSync(dir);
            for (const f of files) {
              const full = path.join(dir, f);
              if (fs.statSync(full).isDirectory()) {
                deepScan(full);
              } else if (f.toLowerCase() === 'javaw.exe') {
                paths.push(full);
              }
            }
          };
          try { deepScan(path.join(mcRuntime, rt)); } catch (e) {}
        }
      }
    } catch (e) {}
  }

  // 2. Program Files Java scan
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const javaDir = path.join(programFiles, 'Java');
  if (fs.existsSync(javaDir)) {
    try {
      const dirs = fs.readdirSync(javaDir);
      for (const d of dirs) {
        const javaw = path.join(javaDir, d, 'bin', 'javaw.exe');
        if (fs.existsSync(javaw)) paths.push(javaw);
      }
    } catch (e) {}
  }

  // 3. Program Files Eclipse Adoptium scan
  const adoptiumDir = path.join(programFiles, 'Eclipse Adoptium');
  if (fs.existsSync(adoptiumDir)) {
    try {
      const dirs = fs.readdirSync(adoptiumDir);
      for (const d of dirs) {
        const javaw = path.join(adoptiumDir, d, 'bin', 'javaw.exe');
        if (fs.existsSync(javaw)) paths.push(javaw);
      }
    } catch (e) {}
  }

  paths.push('java'); // Fallback to path
  return Array.from(new Set(paths));
}

// Check Minecraft versions starting 1.19.4
function isVersionSupported(versionStr: string): boolean {
  const parts = versionStr.split('.').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return false;
  const major = parts[0];
  const minor = parts[1];
  const patch = parts[2] || 0;
  
  if (major > 1) return true;
  if (major === 1) {
    if (minor > 19) return true;
    if (minor === 19) return patch >= 4;
  }
  return false;
}

function createWindow() {
  const iconPath = path.join(__dirname, '../src/assets/logo-icon.png');
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 760,
    minWidth: 1000,
    minHeight: 620,
    center: true,
    title: 'NEXOCLIENT',
    backgroundColor: '#000000',
    frame: true,
    show: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.setMenuBarVisibility(false);

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function syncHudModToAllProfiles() {
  const hudSource = path.join(__dirname, 'nexoclient-1.0.0.jar');
  if (!fs.existsSync(hudSource)) {
    console.warn(`HUD mod source not found at ${hudSource}, skipping sync.`);
    return;
  }

  if (!config || !config.profiles) return;

  for (const p of config.profiles) {
    try {
      const profileDir = getProfileDir(config.gamePath, p.id);
      const modsDir = path.join(profileDir, 'mods');
      const hudDest = path.join(modsDir, 'nexoclient-1.0.0.jar');
      const metaPath = path.join(profileDir, 'mods.json');

      if (!fs.existsSync(modsDir)) {
        fs.mkdirSync(modsDir, { recursive: true });
      }

      let shouldCopy = true;
      if (fs.existsSync(hudDest)) {
        const sourceSize = fs.statSync(hudSource).size;
        const destSize = fs.statSync(hudDest).size;
        if (sourceSize === destSize) {
          shouldCopy = false;
        }
      }

      if (shouldCopy) {
        fs.copyFileSync(hudSource, hudDest);
        console.log(`Synced/updated HUD mod for profile ${p.name} at ${hudDest}`);

        // Register in mods.json
        let installedMods: any[] = [];
        if (fs.existsSync(metaPath)) {
          try {
            installedMods = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          } catch (e) {
            installedMods = [];
          }
        }
        if (!installedMods.some((m: any) => m.projectId === 'nexoclient')) {
          installedMods.push({
            projectId: 'nexoclient',
            title: 'NexoClient',
            versionId: '1.0.0',
            fileName: 'nexoclient-1.0.0.jar',
            iconUrl: 'https://img.icons8.com/color/96/minecraft.png',
            downloadUrl: '',
            installedAt: Date.now()
          });
          fs.writeFileSync(metaPath, JSON.stringify(installedMods, null, 2), 'utf-8');
        }
      }
    } catch (e) {
      console.error(`Failed to sync HUD mod for profile ${p.id}:`, e);
    }
  }
}

app.whenReady().then(() => {
  loadConfig();
  migrateProfileFolders(config.gamePath, config.profiles);
  syncHudModToAllProfiles();
  createWindow();
  if (config.discordRpc) initDiscordRPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function getProfileFolderName(profileId: string, profiles: Profile[]): string {
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return profileId;

  const safeName = profile.name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'unnamed';
  
  // Find all profiles that have the same sanitized name
  const sameNameProfiles = profiles.filter(p => {
    const name = p.name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'unnamed';
    return name.toLowerCase() === safeName.toLowerCase();
  });

  if (sameNameProfiles.length <= 1) {
    return safeName;
  }

  // Sort them deterministically by createdAt, then by id to ensure stable indexing
  sameNameProfiles.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));

  const index = sameNameProfiles.findIndex(p => p.id === profileId);
  if (index <= 0) {
    return safeName;
  } else {
    return `${safeName} (${index + 1})`;
  }
}

function findExistingProfileDir(gamePath: string, profileId: string, oldProfiles: Profile[]): string | null {
  const profilesParent = path.join(gamePath, 'profiles');
  if (!fs.existsSync(profilesParent)) return null;

  // 1. Check the previous clean name from current config
  const oldFolderName = getProfileFolderName(profileId, oldProfiles);
  if (oldFolderName !== profileId) {
    const oldPath = path.join(profilesParent, oldFolderName);
    if (fs.existsSync(oldPath)) {
      return oldFolderName;
    }
  }

  // 2. Check if there's a folder named exactly the profile ID (UUID)
  const uuidPath = path.join(profilesParent, profileId);
  if (fs.existsSync(uuidPath)) {
    return profileId;
  }

  // 3. Scan profiles directory for old-style folder ending with `_${profileId}`
  try {
    const files = fs.readdirSync(profilesParent);
    for (const f of files) {
      if (f.endsWith(`_${profileId}`)) {
        return f;
      }
    }
  } catch (e) {
    console.error(e);
  }

  return null;
}

function migrateProfileFolders(gamePath: string, profiles: Profile[], oldProfiles: Profile[] = config.profiles) {
  const profilesParent = path.join(gamePath, 'profiles');
  if (!fs.existsSync(profilesParent)) {
    try {
      fs.mkdirSync(profilesParent, { recursive: true });
    } catch (e) {
      console.error('Failed to create profiles parent directory:', e);
      return;
    }
  }

  try {
    for (const p of profiles) {
      const targetFolderName = getProfileFolderName(p.id, profiles);
      const targetPath = path.join(profilesParent, targetFolderName);

      // Find if there is an existing directory for this profile using the detection sequence
      const existingDirName = findExistingProfileDir(gamePath, p.id, oldProfiles);

      // If it exists and has a different name, rename it
      if (existingDirName && existingDirName !== targetFolderName) {
        const srcPath = path.join(profilesParent, existingDirName);
        
        // If targetPath already exists, we might want to avoid overwriting it
        if (!fs.existsSync(targetPath)) {
          fs.renameSync(srcPath, targetPath);
          console.log(`Migrated profile folder from ${existingDirName} to ${targetFolderName}`);
        } else {
          console.warn(`Target path ${targetPath} already exists, cannot rename ${srcPath}`);
        }
      }
    }
  } catch (e) {
    console.error('Failed to migrate profile folders:', e);
  }
}

function getProfileDir(gamePath: string, profileId: string): string {
  // First, check if there is an existing directory on disk
  const existingFolder = findExistingProfileDir(gamePath, profileId, config.profiles);
  if (existingFolder) {
    return path.join(gamePath, 'profiles', existingFolder);
  }

  // If not, use the target folder name
  const folderName = getProfileFolderName(profileId, config.profiles);
  return path.join(gamePath, 'profiles', folderName);
}

function getProfileDirWithProfiles(gamePath: string, profileId: string, profiles: Profile[]): string {
  const existingFolder = findExistingProfileDir(gamePath, profileId, profiles);
  if (existingFolder) {
    return path.join(gamePath, 'profiles', existingFolder);
  }
  const folderName = getProfileFolderName(profileId, profiles);
  return path.join(gamePath, 'profiles', folderName);
}

// --- IPC IPC HANDLERS ---

// Config
ipcMain.handle('get-config', () => config);
ipcMain.handle('save-config', (_event, newConfig: LauncherConfig) => {
  const prevRpc = config.discordRpc;

  // Rename profile folders if they exist on disk and name has changed, or if they were created as UUID-only
  if (newConfig && newConfig.profiles) {
    migrateProfileFolders(newConfig.gamePath, newConfig.profiles, config.profiles);

    // Auto-inject HUD mod to any new profiles
    for (const p of newConfig.profiles) {
      const isNew = !config.profiles.some(oldP => oldP.id === p.id);
      if (isNew) {
        const profileDir = getProfileDirWithProfiles(newConfig.gamePath, p.id, newConfig.profiles);
        const modsDir = path.join(profileDir, 'mods');
        const hudSource = path.join(__dirname, 'nexoclient-1.0.0.jar');
        const hudDest = path.join(modsDir, 'nexoclient-1.0.0.jar');
        const metaPath = path.join(profileDir, 'mods.json');

        if (fs.existsSync(hudSource)) {
          if (!fs.existsSync(modsDir)) {
            fs.mkdirSync(modsDir, { recursive: true });
          }
          fs.copyFileSync(hudSource, hudDest);
          console.log(`Auto-injected HUD mod to new profile ${p.name} at ${hudDest}`);

          // Register in mods.json
          let installedMods: any[] = [];
          if (fs.existsSync(metaPath)) {
            try {
              installedMods = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            } catch (e) {
              installedMods = [];
            }
          }
          if (!installedMods.some((m: any) => m.projectId === 'nexoclient')) {
            installedMods.push({
              projectId: 'nexoclient',
              title: 'NexoClient',
              versionId: '1.0.0',
              fileName: 'nexoclient-1.0.0.jar',
              iconUrl: 'https://img.icons8.com/color/96/minecraft.png',
              downloadUrl: '',
              installedAt: Date.now()
            });
            fs.writeFileSync(metaPath, JSON.stringify(installedMods, null, 2), 'utf-8');
          }
        } else {
          console.warn(`Could not auto-inject HUD mod because source was not found at ${hudSource}`);
        }
      }
    }
  }

  saveConfig(newConfig);
  if (config.discordRpc && !prevRpc) initDiscordRPC();
  if (!config.discordRpc && prevRpc) destroyDiscordRPC();
  return config;
});

// Mods management handlers
ipcMain.handle('get-installed-mods', (_event, profileId: string) => {
  const metaPath = path.join(getProfileDir(config.gamePath, profileId), 'mods.json');
  if (!fs.existsSync(metaPath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(metaPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to read mods metadata:', e);
    return [];
  }
});

ipcMain.handle('install-profile-mod', async (_event, profileId: string, projectId: string, title: string, versionId: string, downloadUrl: string, fileName: string, iconUrl?: string) => {
  const profileDir = getProfileDir(config.gamePath, profileId);
  const modsDir = path.join(profileDir, 'mods');
  const destPath = path.join(modsDir, fileName);
  const metaPath = path.join(profileDir, 'mods.json');

  try {
    await downloadFile(downloadUrl, destPath);

    let installedMods: any[] = [];
    if (fs.existsSync(metaPath)) {
      try {
        installedMods = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch (e) {
        installedMods = [];
      }
    }

    installedMods = installedMods.filter((m: any) => m.projectId !== projectId);
    installedMods.push({
      projectId,
      title,
      versionId,
      fileName,
      iconUrl,
      downloadUrl,
      installedAt: Date.now()
    });

    if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });
    fs.writeFileSync(metaPath, JSON.stringify(installedMods, null, 2), 'utf-8');

    return true;
  } catch (err: any) {
    console.error(`Failed to install mod ${title}:`, err);
    throw new Error(`Mod installation failed: ${err.message}`);
  }
});

ipcMain.handle('uninstall-profile-mod', async (_event, profileId: string, projectId: string) => {
  const profileDir = getProfileDir(config.gamePath, profileId);
  const metaPath = path.join(profileDir, 'mods.json');
  const modsDir = path.join(profileDir, 'mods');

  if (!fs.existsSync(metaPath)) return false;

  try {
    let installedMods = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const mod = installedMods.find((m: any) => m.projectId === projectId);
    
    if (mod) {
      const filePath = path.join(modsDir, mod.fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      installedMods = installedMods.filter((m: any) => m.projectId !== projectId);
      fs.writeFileSync(metaPath, JSON.stringify(installedMods, null, 2), 'utf-8');
      return true;
    }
    return false;
  } catch (err: any) {
    console.error(`Failed to uninstall mod ${projectId}:`, err);
    throw new Error(`Mod uninstallation failed: ${err.message}`);
  }
});

// System RAM
ipcMain.handle('get-system-ram', () => Math.floor(os.totalmem() / 1024 / 1024 / 1024));

// Java Path Selection
ipcMain.handle('detect-java', () => detectJavaPaths());

ipcMain.handle('browse-java', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Wybierz plik javaw.exe',
    filters: [{ name: 'Java Executable', extensions: ['exe'] }],
    properties: ['openFile']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('browse-game-path', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Wybierz folder gry',
    properties: ['openDirectory', 'createDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Open system directories
ipcMain.handle('open-folder', async (_event, folderName: string, profileId?: string) => {
  const root = config.gamePath;
  let targetPath = root;
  if (folderName === 'mods') {
    const targetProfileId = profileId || config.activeProfileId;
    if (targetProfileId) {
      targetPath = path.join(getProfileDir(root, targetProfileId), 'mods');
    } else {
      targetPath = path.join(root, 'mods');
    }
  } else if (folderName === 'resourcepacks') {
    targetPath = path.join(root, 'resourcepacks');
  }
  
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
  await shell.openPath(targetPath);
});

// Fetching Minecraft & Fabric loader versions
ipcMain.handle('fetch-versions', async () => {
  try {
    // Fetch Fabric-compatible game versions
    const gameVersionsRaw = await httpGet('https://meta.fabricmc.net/v2/versions/game');
    const allGames = JSON.parse(gameVersionsRaw);
    
    // Filter out snapshots and only versions >= 1.19.4
    const filteredVersions = allGames
      .filter((v: any) => v.stable && isVersionSupported(v.version))
      .map((v: any) => v.version);
      
    // Fetch latest stable Fabric loader
    const loadersRaw = await httpGet('https://meta.fabricmc.net/v2/versions/loader');
    const loaders = JSON.parse(loadersRaw);
    const latestStableLoader = loaders.find((l: any) => l.stable)?.version || loaders[0]?.version || '0.16.10';

    return {
      versions: filteredVersions,
      latestLoader: latestStableLoader
    };
  } catch (error: any) {
    console.error('Failed to fetch versions:', error);
    throw new Error('Nie udało się pobrać wersji Fabric: ' + error.message);
  }
});

// Auth Handlers
ipcMain.handle('login-offline', (_event, username: string) => {
  // Generate consistent offline UUID based on nickname to keep inventory
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  let uuidTail = '';
  for (let i = 0; i < 4; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    uuidTail += ('00' + value.toString(16)).slice(-2);
  }
  const uuid = `00000000-0000-0000-0000-0000${uuidTail.padEnd(8, '0')}`;
  
  const account: AccountInfo = {
    username,
    uuid,
    token: 'offline_token',
    type: 'offline',
    avatar: `https://minotar.net/helm/${username}/32.png`
  };
  
  config.account = account;
  addToSavedAccounts(account);
  saveConfig(config);
  return account;
});

ipcMain.handle('login-microsoft', async () => {
  try {
    const authManager = new Auth("select_account");
    const xboxManager = await authManager.launch("electron");
    const mcToken = await xboxManager.getMinecraft();
    
    const profile = (mcToken as any).profile;
    const account: AccountInfo = {
      username: profile?.name ?? 'Player',
      uuid: profile?.id ?? '',
      token: (mcToken as any).mcToken ?? (mcToken as any).token ?? '',
      type: 'microsoft',
      avatar: `https://minotar.net/helm/${profile?.name ?? 'Steve'}/32.png`
    };
    
    config.account = account;
    addToSavedAccounts(account);
    saveConfig(config);
    return account;
  } catch (error: any) {
    console.error('Microsoft authentication failed:', error);
    throw new Error('Błąd logowania Microsoft: ' + error.message);
  }
});

// Upload skin to Mojang API
ipcMain.handle('upload-mojang-skin', async (_event, token: string, base64DataUrl: string, modelType: 'default' | 'slim') => {
  try {
    let buffer: Buffer;
    if (base64DataUrl.startsWith('data:')) {
      const base64Data = base64DataUrl.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid skin data URL format.');
      }
      buffer = Buffer.from(base64Data, 'base64');
    } else if (base64DataUrl.startsWith('http://') || base64DataUrl.startsWith('https://')) {
      console.log('[SKIN UPLOAD] Skin URL is a web address, downloading:', base64DataUrl);
      const res = await fetch(base64DataUrl);
      if (!res.ok) {
        throw new Error(`Nie udało się pobrać skina z adresu URL: ${res.status} ${res.statusText}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      throw new Error('Nieobsługiwany format adresu URL skina.');
    }
    
    // Generate RFC-compliant multipart boundary
    const boundary = '----ElectronMultipartBoundary' + Math.random().toString(36).slice(2);
    const CRLF = '\r\n';
    const parts = [];
    
    // Append variant parameter
    parts.push(`--${boundary}${CRLF}`);
    parts.push(`Content-Disposition: form-data; name="variant"${CRLF}${CRLF}`);
    parts.push(`${modelType === 'slim' ? 'slim' : 'classic'}${CRLF}`);

    // Append model parameter (fallback for some Mojang endpoints)
    parts.push(`--${boundary}${CRLF}`);
    parts.push(`Content-Disposition: form-data; name="model"${CRLF}${CRLF}`);
    parts.push(`${modelType === 'slim' ? 'slim' : 'classic'}${CRLF}`);
    
    // Append file parameter header
    parts.push(`--${boundary}${CRLF}`);
    parts.push(`Content-Disposition: form-data; name="file"; filename="skin.png"${CRLF}`);
    parts.push(`Content-Type: image/png${CRLF}${CRLF}`);
    
    const headerBuffers = parts.map(p => Buffer.from(p, 'utf-8'));
    const fileBuffer = buffer;
    const footerBuffer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf-8');
    
    const bodyBuffer = Buffer.concat([
      ...headerBuffers,
      fileBuffer,
      footerBuffer
    ]);

    const response = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(bodyBuffer.length)
      },
      body: bodyBuffer
    });

    if (!response.ok) {
      const errText = await response.text();
      const status = response.status;
      const statusText = response.statusText;
      console.error(`[SKIN UPLOAD ERROR] Status: ${status} (${statusText}), Body: ${errText}`);
      
      let parsed;
      try {
        parsed = JSON.parse(errText);
      } catch (_) {}
      
      let msg = parsed?.errorMessage || parsed?.error || errText;
      if (status === 401) {
        msg = 'Twój token wygasł. Zaloguj się ponownie w zakładce Konta.';
      } else if (status === 403) {
        msg = 'Brak licencji Minecraft na tym koncie Microsoft.';
      } else {
        msg = `Błąd API Mojang (${status} ${statusText}): ${msg}`;
      }
      throw new Error(msg);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to upload skin to Mojang in main process:', error);
    throw new Error(error.message || error);
  }
});

// Launch Minecraft
ipcMain.handle('launch-game', async (_event, versionStr: string) => {
  if (!config.account) {
    throw new Error('Musisz się zalogować, aby zagrać!');
  }
  
  if (activeGameProcess) {
    throw new Error('Gra jest już uruchomiona!');
  }

  try {
    mainWindow?.webContents.send('launch-status', 'Przygotowywanie wersji Fabric...');
    
    // Fetch latest stable Fabric loader version dynamically
    const loadersRaw = await httpGet('https://meta.fabricmc.net/v2/versions/loader');
    const loaders = JSON.parse(loadersRaw);
    const loaderVersion = loaders.find((l: any) => l.stable)?.version || loaders[0]?.version || '0.16.10';
    
    const versionId = `fabric-loader-${loaderVersion}-${versionStr}`;
    const versionDir = path.join(config.gamePath, 'versions', versionId);
    const jsonPath = path.join(versionDir, `${versionId}.json`);
    
    // Check if Fabric version JSON profile exists. If not, download it.
    if (!fs.existsSync(jsonPath)) {
      mainWindow?.webContents.send('launch-status', 'Pobieranie profilu Fabric...');
      fs.mkdirSync(versionDir, { recursive: true });
      
      const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${versionStr}/${loaderVersion}/profile/json`;
      const profileJson = await httpGet(profileUrl);
      fs.writeFileSync(jsonPath, profileJson, 'utf-8');
    }

    // Read the version JSON and ensure our custom library is present
    try {
      const profileJson = fs.readFileSync(jsonPath, 'utf-8');
      const profileData = JSON.parse(profileJson);
      if (!profileData.libraries) {
        profileData.libraries = [];
      }
      const hasCoreLib = profileData.libraries.some((lib: any) => lib.name && lib.name.startsWith('net.nexoclient:nexoclient-core'));
      if (!hasCoreLib) {
        profileData.libraries.unshift({
          name: 'net.nexoclient:nexoclient-core:1.0.0'
        });
        fs.writeFileSync(jsonPath, JSON.stringify(profileData, null, 2), 'utf-8');
      }
    } catch (e) {
      console.error('Failed to inject nexoclient-core library into version JSON:', e);
    }

    // Remove known broken/incompatible mods from the active profile
    if (config.activeProfileId) {
      try {
        const profileDir = getProfileDir(config.gamePath, config.activeProfileId);
        const modsDir = path.join(profileDir, 'mods');
        if (fs.existsSync(modsDir)) {
          const BROKEN_MODS = ['cullleaves', 'cull-leaves', 'cull_leaves'];
          const files = fs.readdirSync(modsDir);
          for (const file of files) {
            const lf = file.toLowerCase();
            if (BROKEN_MODS.some(name => lf.startsWith(name))) {
              fs.unlinkSync(path.join(modsDir, file));
              console.log(`Removed incompatible mod: ${file}`);
              // Also remove from mods.json
              const metaPath = path.join(profileDir, 'mods.json');
              if (fs.existsSync(metaPath)) {
                try {
                  let mods = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                  mods = mods.filter((m: any) => !BROKEN_MODS.some(n => (m.fileName || '').toLowerCase().startsWith(n)));
                  fs.writeFileSync(metaPath, JSON.stringify(mods, null, 2), 'utf-8');
                } catch (e) {}
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to remove broken mods:', e);
      }
    }

    // Ensure Fabric API is present in the active profile (required by nexoclient)
    if (config.activeProfileId) {
      try {
        const profileDir = getProfileDir(config.gamePath, config.activeProfileId);
        const modsDir = path.join(profileDir, 'mods');
        if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });

        const metaPath = path.join(profileDir, 'mods.json');
        let installedMods: any[] = [];
        if (fs.existsSync(metaPath)) {
          try { installedMods = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch (e) { installedMods = []; }
        }

        const hasFabricApi = installedMods.some((m: any) => m.projectId === 'P7dR8mSH') ||
          fs.readdirSync(modsDir).some(f => f.toLowerCase().startsWith('fabric-api'));

        if (!hasFabricApi) {
          mainWindow?.webContents.send('launch-status', 'Pobieranie Fabric API (wymagane)...');
          try {
            const versionsRaw = await httpGet(`https://api.modrinth.com/v2/project/P7dR8mSH/version?loaders=%5B%22fabric%22%5D&game_versions=%5B%22${versionStr}%22%5D`);
            const versionsData = JSON.parse(versionsRaw);
            if (versionsData && versionsData.length > 0) {
              const ver = versionsData[0];
              const file = ver.files.find((f: any) => f.primary) || ver.files[0];
              if (file) {
                const destPath = path.join(modsDir, file.filename);
                await downloadFile(file.url, destPath);
                installedMods = installedMods.filter((m: any) => m.projectId !== 'P7dR8mSH');
                installedMods.push({
                  projectId: 'P7dR8mSH',
                  title: 'Fabric API',
                  versionId: ver.id,
                  fileName: file.filename,
                  iconUrl: undefined,
                  downloadUrl: file.url,
                  installedAt: Date.now()
                });
                fs.writeFileSync(metaPath, JSON.stringify(installedMods, null, 2), 'utf-8');
                console.log(`Auto-installed Fabric API to profile ${config.activeProfileId}`);
              }
            }
          } catch (e) {
            console.error('Failed to auto-install Fabric API:', e);
          }
        }
      } catch (e) {
        console.error('Failed to check/install Fabric API:', e);
      }
    }

    // Sync isolated mods folder, options.txt, and servers.dat for the active profile to global game directory
    if (config.activeProfileId) {
      mainWindow?.webContents.send('launch-status', 'Synchronizowanie profilu...');
      const globalModsDir = path.join(config.gamePath, 'mods');
      
      // Clear global mods folder first
      if (fs.existsSync(globalModsDir)) {
        try {
          fs.rmSync(globalModsDir, { recursive: true, force: true });
        } catch (e) {
          console.error('Failed to clear global mods directory:', e);
        }
      }
      fs.mkdirSync(globalModsDir, { recursive: true });

      // Copy mods from active profile mods folder
      const profileDir = getProfileDir(config.gamePath, config.activeProfileId);
      const profileModsDir = path.join(profileDir, 'mods');
      if (fs.existsSync(profileModsDir)) {
        try {
          const files = fs.readdirSync(profileModsDir);
          for (const file of files) {
            const srcPath = path.join(profileModsDir, file);
            const destPath = path.join(globalModsDir, file);
            if (fs.statSync(srcPath).isFile()) {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        } catch (e) {
          console.error('Failed to copy profile mods:', e);
        }
      }

      // Sync settings (options.txt) and servers (servers.dat)
      try {
        if (!fs.existsSync(profileDir)) {
          fs.mkdirSync(profileDir, { recursive: true });
        }

        const globalOptionsPath = path.join(config.gamePath, 'options.txt');
        const profileOptionsPath = path.join(profileDir, 'options.txt');
        if (fs.existsSync(profileOptionsPath)) {
          fs.copyFileSync(profileOptionsPath, globalOptionsPath);
        } else if (fs.existsSync(globalOptionsPath)) {
          fs.copyFileSync(globalOptionsPath, profileOptionsPath);
        }

        const globalServersPath = path.join(config.gamePath, 'servers.dat');
        const profileServersPath = path.join(profileDir, 'servers.dat');
        if (fs.existsSync(profileServersPath)) {
          fs.copyFileSync(profileServersPath, globalServersPath);
        } else if (fs.existsSync(globalServersPath)) {
          fs.copyFileSync(globalServersPath, profileServersPath);
        }
      } catch (e) {
        console.error('Failed to sync profile settings on launch:', e);
      }
    }

    mainWindow?.webContents.send('launch-status', 'Inicjalizacja pobierania Minecraft...');

    const launcher = new Client();
    
    const launcherAuth = config.account.type === 'offline' 
      ? {
          access_token: 'null',
          client_token: 'null',
          uuid: config.account.uuid,
          name: config.account.username,
          user_properties: '{}'
        }
      : {
          access_token: config.account.token,
          client_token: 'null',
          uuid: config.account.uuid,
          name: config.account.username,
          user_properties: '{}'
        };

    // Delete the old agent jar if it exists to keep it clean
    const oldAgentPath = path.join(config.gamePath, 'nexoclient-agent.jar');
    if (fs.existsSync(oldAgentPath)) {
      try {
        fs.unlinkSync(oldAgentPath);
      } catch (e) {}
    }

    // Write nexoclient-core.jar to the gamePath libraries folder
    const libraryDestPath = path.join(config.gamePath, 'libraries', 'net', 'nexoclient', 'nexoclient-core', '1.0.0', 'nexoclient-core-1.0.0.jar');
    const coreSourcePath = path.join(__dirname, 'nexoclient-core.jar');
    try {
      const libraryDestDir = path.dirname(libraryDestPath);
      if (!fs.existsSync(libraryDestDir)) {
        fs.mkdirSync(libraryDestDir, { recursive: true });
      }
      if (fs.existsSync(coreSourcePath)) {
        fs.copyFileSync(coreSourcePath, libraryDestPath);
      } else {
        console.error('Core JAR source file not found at:', coreSourcePath);
      }
    } catch (e) {
      console.error('Failed to write nexoclient-core JAR:', e);
    }

    const javaExecutable = config.javaPath || 'java';

    const options = {
      authorization: launcherAuth,
      root: config.gamePath,
      javaPath: javaExecutable,
      version: {
        number: versionStr,
        type: 'release',
        custom: versionId
      },
      memory: {
        max: `${config.ram}G`,
        min: '1G'
      },
      window: {
        width: config.width,
        height: config.height,
        fullscreen: config.fullscreen
      },
      customArgs: [
        `-Dnexoclient.title=NEXOCLIENT wersja ${app.getVersion()}`
      ]
    };

    // Bind event listeners for launch progress
    launcher.on('debug', (e) => {
      mainWindow?.webContents.send('launcher-log', `[DEBUG] ${e}`);
    });
    
    launcher.on('data', (e) => {
      mainWindow?.webContents.send('launcher-log', e);
    });

    launcher.on('progress', (e) => {
      mainWindow?.webContents.send('launch-progress', {
        type: e.type,
        task: e.task,
        total: e.total,
        percentage: Math.round((e.task / e.total) * 100)
      });
    });

    launcher.on('download-status', (e) => {
      mainWindow?.webContents.send('launch-status', `Pobieranie: ${e.name} (${e.current}/${e.total})`);
    });

    mainWindow?.webContents.send('launch-status', 'Uruchamianie silnika gry...');
    
    // Spawns game
    activeGameProcess = await launcher.launch(options as any);
    
    mainWindow?.webContents.send('game-started');
    
    if (config.closeOnLaunch) {
      setTimeout(() => {
        app.quit();
      }, 2000);
    }

    activeGameProcess.on('close', (code: number) => {
      // Sync back options.txt and servers.dat from global to profile
      if (config.activeProfileId) {
        try {
          const profileDir = getProfileDir(config.gamePath, config.activeProfileId);
          if (!fs.existsSync(profileDir)) {
            fs.mkdirSync(profileDir, { recursive: true });
          }
          const globalOptionsPath = path.join(config.gamePath, 'options.txt');
          const profileOptionsPath = path.join(profileDir, 'options.txt');
          if (fs.existsSync(globalOptionsPath)) {
            fs.copyFileSync(globalOptionsPath, profileOptionsPath);
          }

          const globalServersPath = path.join(config.gamePath, 'servers.dat');
          const profileServersPath = path.join(profileDir, 'servers.dat');
          if (fs.existsSync(globalServersPath)) {
            fs.copyFileSync(globalServersPath, profileServersPath);
          }
        } catch (e) {
          console.error('Failed to sync back profile settings on close:', e);
        }
      }

      activeGameProcess = null;
      mainWindow?.webContents.send('game-closed', code);
    });

    return true;
  } catch (error: any) {
    console.error('Launch failed:', error);
    activeGameProcess = null;
    mainWindow?.webContents.send('game-closed', -1);
    throw new Error('Błąd uruchamiania: ' + error.message);
  }
});

// Browse for .minecraft folder
ipcMain.handle('browse-mc-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Wybierz folder .minecraft',
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Import Minecraft settings (options.txt + servers.dat) from given .minecraft folder
// If mcPath is empty, auto-detect default %APPDATA%\.minecraft
ipcMain.handle('import-minecraft-settings', async (_event, mcPath: string) => {
  let copiedOptions = false;
  let copiedServers = false;
  try {
    const gameDir = config.gamePath;
    if (!fs.existsSync(gameDir)) {
      fs.mkdirSync(gameDir, { recursive: true });
    }

    // Auto-detect default .minecraft path if none provided
    const resolvedPath = mcPath && mcPath.length > 0
      ? mcPath
      : path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), '.minecraft');

    const srcOptions = path.join(resolvedPath, 'options.txt');
    if (fs.existsSync(srcOptions)) {
      fs.copyFileSync(srcOptions, path.join(gameDir, 'options.txt'));
      copiedOptions = true;

      // Copy to active profile as well
      if (config.activeProfileId) {
        const profileDir = getProfileDir(gameDir, config.activeProfileId);
        if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });
        fs.copyFileSync(srcOptions, path.join(profileDir, 'options.txt'));
      }
    }

    const srcServers = path.join(resolvedPath, 'servers.dat');
    if (fs.existsSync(srcServers)) {
      fs.copyFileSync(srcServers, path.join(gameDir, 'servers.dat'));
      copiedServers = true;

      // Copy to active profile as well
      if (config.activeProfileId) {
        const profileDir = getProfileDir(gameDir, config.activeProfileId);
        if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });
        fs.copyFileSync(srcServers, path.join(profileDir, 'servers.dat'));
      }
    }

    return { success: true, copiedOptions, copiedServers };
  } catch (e: any) {
    console.error('Import minecraft settings failed:', e);
    return { success: false, copiedOptions, copiedServers };
  }
});

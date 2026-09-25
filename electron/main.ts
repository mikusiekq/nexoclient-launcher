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
  engine: 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt';
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
  setupCompleted?: boolean;
}

// %APPDATA%\.nexoclient — shared game data (saves, resourcepacks, options.txt, servers.dat),
// launcher\ (config + shared assets) and profiles\<name>\ (version files + mods per profile)
const getDefaultGamePath = () => path.join(app.getPath('appData'), '.nexoclient');
const getLauncherDir = () => path.join(getDefaultGamePath(), 'launcher');

const defaultConfig = (): LauncherConfig => ({
  ram: 4,
  javaPath: '',
  gamePath: getDefaultGamePath(),
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

// Copies data from an old layout (<userData>\game or <userData>\.nexoclient) into the new one.
// Runs once; the old folder is left untouched.
function migrateLegacyGameData(legacyRoot: string, newRoot: string, profiles: Profile[]) {
  const marker = path.join(getLauncherDir(), '.legacy-migrated');
  if (!fs.existsSync(legacyRoot) || fs.existsSync(marker) || path.resolve(legacyRoot) === path.resolve(newRoot)) return;

  try {
    fs.mkdirSync(newRoot, { recursive: true });

    for (const item of ['saves', 'resourcepacks', 'shaderpacks', 'screenshots', 'config', 'options.txt', 'servers.dat']) {
      const src = path.join(legacyRoot, item);
      const dest = path.join(newRoot, item);
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        fs.cpSync(src, dest, { recursive: true });
      }
    }

    const legacyAssets = path.join(legacyRoot, 'assets');
    const newAssets = path.join(getLauncherDir(), 'assets');
    if (fs.existsSync(legacyAssets) && !fs.existsSync(newAssets)) {
      fs.cpSync(legacyAssets, newAssets, { recursive: true });
    }

    // Folders of existing profiles only: keep mods, drop per-profile options/servers (now shared in the root)
    for (const p of profiles) {
      const legacyDir = findLegacyProfileDir(legacyRoot, p.id, profiles);
      if (!legacyDir) continue;
      const src = path.join(legacyRoot, 'profiles', legacyDir);
      const dest = path.join(newRoot, 'profiles', getProfileFolderName(p.id, profiles));
      if (fs.existsSync(dest)) continue;
      fs.cpSync(src, dest, { recursive: true });
      for (const f of ['options.txt', 'servers.dat']) fs.rmSync(path.join(dest, f), { force: true });
      stampProfileDir(dest, p.id);
    }

    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, new Date().toISOString(), 'utf-8');
    console.log(`Migrated legacy game data from ${legacyRoot} to ${newRoot}`);
  } catch (e) {
    console.error('Failed to migrate legacy game data:', e);
  }
}

// Creates the .nexoclient layout on startup so it exists before the first game launch
function ensureGameDirs(gamePath: string) {
  for (const dir of [
    getLauncherDir(),
    path.join(gamePath, 'launcher'),
    path.join(gamePath, 'profiles'),
    path.join(gamePath, 'saves'),
    path.join(gamePath, 'resourcepacks'),
  ]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.error(`Failed to create ${dir}:`, e);
    }
  }
}

function loadConfig() {
  const legacyUserData = app.getPath('userData');
  const legacyConfigPath = path.join(legacyUserData, 'launcher-config.json');
  const legacyGamePaths = [path.join(legacyUserData, 'game'), path.join(legacyUserData, '.nexoclient')];
  configPath = path.join(getLauncherDir(), 'launcher-config.json');

  const sourcePath = fs.existsSync(configPath) ? configPath : legacyConfigPath;
  if (fs.existsSync(sourcePath)) {
    try {
      const content = fs.readFileSync(sourcePath, 'utf-8');
      config = { ...defaultConfig(), ...JSON.parse(content) };
      // Ensure savedAccounts exists for older configs
      if (!Array.isArray(config.savedAccounts)) {
        config.savedAccounts = config.account ? [config.account] : [];
      }
      // Ensure profiles array exists
      if (!Array.isArray(config.profiles)) {
        config.profiles = [];
      }
    } catch (e) {
      config = defaultConfig();
    }
  } else {
    config = defaultConfig();
  }

  // Move old default locations to %APPDATA%\.nexoclient
  const legacyGamePath = legacyGamePaths.find(p => config.gamePath && path.resolve(config.gamePath) === path.resolve(p))
    || legacyGamePaths.find(p => fs.existsSync(p));
  if (!config.gamePath || legacyGamePaths.some(p => path.resolve(config.gamePath) === path.resolve(p))) {
    config.gamePath = getDefaultGamePath();
  }
  if (legacyGamePath) migrateLegacyGameData(legacyGamePath, config.gamePath, config.profiles);
  ensureGameDirs(config.gamePath);
  saveConfig(config);
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
  const iconPath = path.join(__dirname, '../src/assets/logo.png');
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 760,
    minWidth: 1000,
    minHeight: 620,
    center: true,
    title: 'NEXOCLIENT',
    backgroundColor: '#000000',
    frame: false,
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

// NexoClient is a built-in mod loaded from the launcher folder (see prepareBuiltinMods), so remove copies
// that earlier versions put into profile mods folders — they would show in the list and load twice
function removeNexoclientFromProfiles() {
  if (!config || !config.profiles) return;

  for (const p of config.profiles) {
    try {
      const profileDir = getProfileDir(config.gamePath, p.id);
      const modsDir = path.join(profileDir, 'mods');
      if (fs.existsSync(modsDir)) {
        for (const file of fs.readdirSync(modsDir)) {
          if (/^nexoclient.*\.jar$/i.test(file)) {
            fs.rmSync(path.join(modsDir, file), { force: true });
            console.log(`Removed ${file} from profile ${p.name}`);
          }
        }
      }

      const metaPath = path.join(profileDir, 'mods.json');
      if (fs.existsSync(metaPath)) {
        const installedMods = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const cleaned = installedMods.filter((m: any) => m.projectId !== 'nexoclient' && !/^nexoclient/i.test(m.fileName || ''));
        if (cleaned.length !== installedMods.length) {
          fs.writeFileSync(metaPath, JSON.stringify(cleaned, null, 2), 'utf-8');
        }
      }

      fs.rmSync(path.join(profileDir, 'libraries', 'net', 'nexoclient'), { recursive: true, force: true });
    } catch (e) {
      console.error(`Failed to remove NexoClient mod from profile ${p.id}:`, e);
    }
  }
}

// --- Built-in NexoClient mod ---
// Loaded via -Dfabric.addMods from <game>\launcher\builtin\<mc version>\ instead of the profile's mods folder,
// so it isn't listed in the mods UI and can't be removed there.
const NEXOCLIENT_MOD_FILE = 'nexoclient-1.0.0.jar';
const FABRIC_API_PROJECT_ID = 'P7dR8mSH';

// The mod is built for ~1.21.11 (>= 1.21.11, < 1.22)
function isNexoclientSupported(mcVersion: string): boolean {
  const m = /^1\.21\.(\d+)/.exec(mcVersion);
  return !!m && parseInt(m[1], 10) >= 11;
}

async function ensureBuiltinFabricApi(mcVersion: string, dir: string): Promise<string | null> {
  const cached = fs.readdirSync(dir).find(f => f.toLowerCase().startsWith('fabric-api'));
  if (cached) return path.join(dir, cached);

  try {
    mainWindow?.webContents.send('launch-status', 'Pobieranie Fabric API (wymagane przez NexoClient)...');
    const versionsRaw = await httpGet(`https://api.modrinth.com/v2/project/${FABRIC_API_PROJECT_ID}/version?loaders=%5B%22fabric%22%5D&game_versions=%5B%22${mcVersion}%22%5D`);
    const ver = JSON.parse(versionsRaw)[0];
    const file = ver?.files?.find((f: any) => f.primary) || ver?.files?.[0];
    if (!file) {
      console.error(`No Fabric API build found for ${mcVersion}`);
      return null;
    }
    const dest = path.join(dir, file.filename);
    await downloadFile(file.url, dest);
    return dest;
  } catch (e) {
    console.error('Failed to download built-in Fabric API:', e);
    return null;
  }
}

// Returns the jars to add to fabric.addMods for this launch
async function prepareBuiltinMods(mcVersion: string, gameRoot: string, profileModsDir: string): Promise<string[]> {
  if (!isNexoclientSupported(mcVersion)) {
    console.log(`NexoClient mod skipped: not built for Minecraft ${mcVersion}`);
    return [];
  }

  // Copy out of the app bundle: Java can't read files inside app.asar
  const source = path.join(__dirname, NEXOCLIENT_MOD_FILE);
  if (!fs.existsSync(source)) {
    console.error(`NexoClient mod not found at ${source}`);
    return [];
  }
  const dir = path.join(gameRoot, 'launcher', 'builtin', mcVersion);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, NEXOCLIENT_MOD_FILE);
  fs.copyFileSync(source, dest);
  const mods = [dest];

  // NexoClient depends on Fabric API; use the profile's own copy if it has one (two copies would conflict)
  const profileHasFabricApi = fs.readdirSync(profileModsDir).some(f => f.toLowerCase().startsWith('fabric-api'));
  if (!profileHasFabricApi) {
    const fabricApi = await ensureBuiltinFabricApi(mcVersion, dir);
    if (fabricApi) mods.push(fabricApi);
  }
  return mods;
}

function stripNexoclientLibrary(jsonPath: string) {
  try {
    const profileData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const libraries = profileData.libraries || [];
    const cleaned = libraries.filter((lib: any) => !(lib.name && lib.name.startsWith('net.nexoclient:')));
    if (cleaned.length !== libraries.length) {
      profileData.libraries = cleaned;
      fs.writeFileSync(jsonPath, JSON.stringify(profileData, null, 2), 'utf-8');
    }
  } catch (e) {
    console.error('Failed to clean version JSON:', e);
  }
}

// Allow only one launcher; a second launch focuses the existing window instead
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  if (!app.hasSingleInstanceLock()) return;
  loadConfig();
  stampLegacyProfileDirs(config.gamePath, config.profiles);
  migrateProfileFolders(config.gamePath, config.profiles);
  removeNexoclientFromProfiles();
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

// Each profile folder carries a .profile-id file, so a profile only ever uses its own folder
// (a new/renamed profile must not pick up an unrelated folder that happens to have the same name)
const PROFILE_ID_FILE = '.profile-id';

function readProfileDirId(dir: string): string | null {
  try {
    return fs.readFileSync(path.join(dir, PROFILE_ID_FILE), 'utf-8').trim() || null;
  } catch {
    return null;
  }
}

function stampProfileDir(dir: string, profileId: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, PROFILE_ID_FILE), profileId, 'utf-8');
}

// Folder name (inside profiles\) stamped with this profile's id
function findProfileDir(gamePath: string, profileId: string): string | null {
  const profilesParent = path.join(gamePath, 'profiles');
  if (!fs.existsSync(profilesParent)) return null;
  try {
    for (const f of fs.readdirSync(profilesParent)) {
      if (readProfileDirId(path.join(profilesParent, f)) === profileId) return f;
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

// Pre-.profile-id lookup (by name, raw id or `_<id>` suffix); only for unstamped folders from older versions
function findLegacyProfileDir(gamePath: string, profileId: string, profiles: Profile[]): string | null {
  const profilesParent = path.join(gamePath, 'profiles');
  if (!fs.existsSync(profilesParent)) return null;

  const candidates = [getProfileFolderName(profileId, profiles), profileId];
  try {
    candidates.push(...fs.readdirSync(profilesParent).filter(f => f.endsWith(`_${profileId}`)));
  } catch (e) {
    console.error(e);
  }

  for (const c of candidates) {
    const dir = path.join(profilesParent, c);
    if (fs.existsSync(dir) && readProfileDirId(dir) === null) return c;
  }
  return null;
}

// One-time: stamp folders of existing profiles that were created before .profile-id existed
function stampLegacyProfileDirs(gamePath: string, profiles: Profile[]) {
  const marker = path.join(getLauncherDir(), '.profile-dirs-stamped');
  if (fs.existsSync(marker)) return;
  for (const p of profiles) {
    if (findProfileDir(gamePath, p.id)) continue;
    const legacy = findLegacyProfileDir(gamePath, p.id, profiles);
    if (legacy) stampProfileDir(path.join(gamePath, 'profiles', legacy), p.id);
  }
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, new Date().toISOString(), 'utf-8');
}

// Profile name, or "name (2)", "name (3)"… if that folder is already taken
function getFreeProfileFolderName(gamePath: string, profileId: string, profiles: Profile[]): string {
  const base = getProfileFolderName(profileId, profiles);
  const profilesParent = path.join(gamePath, 'profiles');
  let name = base;
  for (let i = 2; fs.existsSync(path.join(profilesParent, name)) && readProfileDirId(path.join(profilesParent, name)) !== profileId; i++) {
    name = `${base} (${i})`;
  }
  return name;
}

// Rename profile folders to follow profile names
function migrateProfileFolders(gamePath: string, profiles: Profile[]) {
  const profilesParent = path.join(gamePath, 'profiles');
  try {
    fs.mkdirSync(profilesParent, { recursive: true });
    for (const p of profiles) {
      const existing = findProfileDir(gamePath, p.id);
      if (!existing) continue;
      const target = getFreeProfileFolderName(gamePath, p.id, profiles);
      if (existing !== target) {
        fs.renameSync(path.join(profilesParent, existing), path.join(profilesParent, target));
        console.log(`Renamed profile folder ${existing} -> ${target}`);
      }
    }
  } catch (e) {
    console.error('Failed to migrate profile folders:', e);
  }
}

function getProfileDir(gamePath: string, profileId: string): string {
  const existing = findProfileDir(gamePath, profileId);
  if (existing) return path.join(gamePath, 'profiles', existing);

  // New profile: create its own folder
  const dir = path.join(gamePath, 'profiles', getFreeProfileFolderName(gamePath, profileId, config.profiles));
  stampProfileDir(dir, profileId);
  return dir;
}
// --- IPC IPC HANDLERS ---

// Config
ipcMain.handle('get-config', () => config);
ipcMain.handle('save-config', (_event, newConfig: LauncherConfig) => {
  const prevRpc = config.discordRpc;

  // Rename profile folders if they exist on disk and name has changed, or if they were created as UUID-only
  if (newConfig && newConfig.profiles) {
    migrateProfileFolders(newConfig.gamePath, newConfig.profiles);
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

// Launch Minecraft
ipcMain.handle('launch-game', async (_event, versionStr: string) => {
  if (!config.account) {
    throw new Error('Musisz się zalogować, aby zagrać!');
  }
  
  if (activeGameProcess) {
    throw new Error('Gra jest już uruchomiona!');
  }

  try {
    const activeProfile = config.profiles?.find(p => p.id === config.activeProfileId);
    const engine = activeProfile?.engine || 'vanilla';
    let versionId = versionStr;

    // Version files, libraries and mods live in the profile folder; saves/settings/servers/resourcepacks in the shared root
    fs.mkdirSync(config.gamePath, { recursive: true });
    // Resolve the real on-disk path. When Windows redirects AppData (e.g. a launcher started from a packaged app),
    // Java reports class locations under the redirected path; if the classpath used the original one, Fabric
    // wouldn't recognise its own loader jar and would crash with "trying to load ... from target class loader".
    const gameRoot = fs.realpathSync.native(config.gamePath);
    const instanceDir = activeProfile
      ? path.join(gameRoot, 'profiles', path.basename(getProfileDir(config.gamePath, activeProfile.id)))
      : gameRoot;
    fs.mkdirSync(instanceDir, { recursive: true });

    if (engine === 'vanilla') {
      versionId = versionStr;
    } else if (engine === 'fabric') {
      mainWindow?.webContents.send('launch-status', 'Przygotowywanie wersji Fabric...');
      const loadersRaw = await httpGet('https://meta.fabricmc.net/v2/versions/loader');
      const loaders = JSON.parse(loadersRaw);
      const loaderVersion = loaders.find((l: any) => l.stable)?.version || loaders[0]?.version || '0.16.10';
      
      versionId = `fabric-loader-${loaderVersion}-${versionStr}`;
      const versionDir = path.join(instanceDir, 'versions', versionId);
      const jsonPath = path.join(versionDir, `${versionId}.json`);
      
      if (!fs.existsSync(jsonPath)) {
        mainWindow?.webContents.send('launch-status', 'Pobieranie profilu Fabric...');
        fs.mkdirSync(versionDir, { recursive: true });
        
        const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${versionStr}/${loaderVersion}/profile/json`;
        const profileJson = await httpGet(profileUrl);
        fs.writeFileSync(jsonPath, profileJson, 'utf-8');
      }

      stripNexoclientLibrary(jsonPath);
    } else if (engine === 'quilt') {
      mainWindow?.webContents.send('launch-status', 'Przygotowywanie wersji Quilt...');
      const loadersRaw = await httpGet('https://meta.quiltmc.org/v3/versions/loader');
      const loaders = JSON.parse(loadersRaw);
      const loaderVersion = loaders.find((l: any) => l.stable)?.version || loaders[0]?.version || '0.26.3';
      
      versionId = `quilt-loader-${loaderVersion}-${versionStr}`;
      const versionDir = path.join(instanceDir, 'versions', versionId);
      const jsonPath = path.join(versionDir, `${versionId}.json`);
      
      if (!fs.existsSync(jsonPath)) {
        mainWindow?.webContents.send('launch-status', 'Pobieranie profilu Quilt...');
        fs.mkdirSync(versionDir, { recursive: true });
        
        const profileUrl = `https://meta.quiltmc.org/v3/versions/loader/${versionStr}/${loaderVersion}/profile/json`;
        const profileJson = await httpGet(profileUrl);
        fs.writeFileSync(jsonPath, profileJson, 'utf-8');
      }

      stripNexoclientLibrary(jsonPath);
    } else if (engine === 'forge') {
      mainWindow?.webContents.send('launch-status', 'Pobieranie rekomendowanej wersji Forge...');
      let forgeVersion = '';
      try {
        const promoRaw = await httpGet('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
        const promo = JSON.parse(promoRaw);
        forgeVersion = promo.promos[`${versionStr}-recommended`] || promo.promos[`${versionStr}-latest`];
      } catch (e) {
        if (versionStr === '1.20.1') forgeVersion = '47.3.0';
        else if (versionStr === '1.20.4') forgeVersion = '49.0.38';
        else if (versionStr === '1.19.4') forgeVersion = '45.3.0';
        else forgeVersion = '47.2.0';
      }
      
      if (!forgeVersion) {
        throw new Error(`Silnik Forge nie jest dostępny dla wersji Minecraft ${versionStr}.`);
      }

      versionId = `${versionStr}-forge-${forgeVersion}`;
      const versionDir = path.join(instanceDir, 'versions', versionId);
      const jsonPath = path.join(versionDir, `${versionId}.json`);
      
      if (!fs.existsSync(jsonPath)) {
        mainWindow?.webContents.send('launch-status', `Pobieranie instalatora Forge ${forgeVersion}...`);
        const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${versionStr}-${forgeVersion}/forge-${versionStr}-${forgeVersion}-installer.jar`;
        const installerPath = path.join(instanceDir, 'forge-installer.jar');
        
        await downloadFile(installerUrl, installerPath);
        
        mainWindow?.webContents.send('launch-status', 'Instalowanie silnika Forge (może to potrwać chwilę)...');
        const javaExecutable = config.javaPath || 'java';
        
        const { exec } = require('child_process');
        await new Promise<void>((resolve, reject) => {
          exec(`"${javaExecutable}" -jar "${installerPath}" --installClient "${instanceDir}"`, (err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        try { fs.unlinkSync(installerPath); } catch (e) {}
      }
    } else if (engine === 'neoforge') {
      mainWindow?.webContents.send('launch-status', 'Rozwiązywanie wersji NeoForge...');
      let neoforgeVersion = '';
      if (versionStr === '1.20.1') neoforgeVersion = '20.1.89';
      else if (versionStr === '1.20.4') neoforgeVersion = '20.4.80';
      else if (versionStr === '1.21.1') neoforgeVersion = '21.1.81';
      else neoforgeVersion = '21.1.81';
      
      versionId = `${versionStr}-neoforge-${neoforgeVersion}`;
      const versionDir = path.join(instanceDir, 'versions', versionId);
      const jsonPath = path.join(versionDir, `${versionId}.json`);
      
      if (!fs.existsSync(jsonPath)) {
        mainWindow?.webContents.send('launch-status', `Pobieranie instalatora NeoForge ${neoforgeVersion}...`);
        const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoforgeVersion}/neoforge-${neoforgeVersion}-installer.jar`;
        const installerPath = path.join(instanceDir, 'neoforge-installer.jar');
        
        await downloadFile(installerUrl, installerPath);
        
        mainWindow?.webContents.send('launch-status', 'Instalowanie silnika NeoForge (może to potrwać chwilę)...');
        const javaExecutable = config.javaPath || 'java';
        
        const { exec } = require('child_process');
        await new Promise<void>((resolve, reject) => {
          exec(`"${javaExecutable}" -jar "${installerPath}" --installClient "${instanceDir}"`, (err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        try { fs.unlinkSync(installerPath); } catch (e) {}
      }
    }

    // Remove known broken/incompatible mods from the active profile
    if (config.activeProfileId) {
      try {
        const profileDir = getProfileDir(config.gamePath, config.activeProfileId);
        const modsDir = path.join(profileDir, 'mods');
        if (fs.existsSync(modsDir)) {
          const BROKEN_MODS = [
            'cullleaves', 'cull-leaves', 'cull_leaves',
            'entity_texture_features', 'entity-texture-features', 'entitytexturefeatures', 'entity_texture', 'entitytexture'
          ];
          const files = fs.readdirSync(modsDir);
          for (const file of files) {
            const lf = file.toLowerCase();
            if (BROKEN_MODS.some(name => lf.includes(name))) {
              fs.unlinkSync(path.join(modsDir, file));
              console.log(`Removed incompatible mod: ${file}`);
              // Also remove from mods.json
              const metaPath = path.join(profileDir, 'mods.json');
              if (fs.existsSync(metaPath)) {
                try {
                  let mods = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                  mods = mods.filter((m: any) => !BROKEN_MODS.some(n => (m.fileName || '').toLowerCase().includes(n) || (m.projectId || '').toLowerCase().includes(n)));
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

    // Mods are loaded straight from the profile folder (see -Dfabric.addMods below)
    const profileModsDir = path.join(instanceDir, 'mods');
    fs.mkdirSync(profileModsDir, { recursive: true });
    const builtinMods = engine === 'fabric' ? await prepareBuiltinMods(versionStr, gameRoot, profileModsDir) : [];

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

    const javaExecutable = config.javaPath || 'java';

    const options = {
      authorization: launcherAuth,
      root: instanceDir,
      javaPath: javaExecutable,
      overrides: {
        // Shared: saves, resourcepacks, options.txt, servers.dat
        gameDirectory: gameRoot,
        // Shared asset cache so each profile doesn't download its own copy
        assetRoot: path.join(gameRoot, 'launcher', 'assets'),
      },
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
        `-Dfabric.addMods=${[profileModsDir, ...builtinMods].join(path.delimiter)}`
      ]
    };

    // Bind event listeners for launch progress
    // Never show the session token in the console (MCLC logs the full launch arguments)
    const redact = (text: string) => {
      let out = String(text).replace(/(--(?:accessToken|xuid)\s+)\S+/g, '$1[ukryte]');
      if (launcherAuth.access_token && launcherAuth.access_token.length > 20) {
        out = out.split(launcherAuth.access_token).join('[ukryte]');
      }
      return out;
    };

    launcher.on('debug', (e) => {
      mainWindow?.webContents.send('launcher-log', `[DEBUG] ${redact(e)}`);
    });

    launcher.on('data', (e) => {
      mainWindow?.webContents.send('launcher-log', redact(e));
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

ipcMain.on('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  mainWindow?.close();
});

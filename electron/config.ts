import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export interface AccountInfo {
  username: string;
  uuid: string;
  token: string;
  type: 'offline' | 'microsoft';
  avatar: string;
}

export interface Profile {
  id: string;
  name: string;
  version: string;
  accountUuid: string | null;
  engine: 'fabric';
  icon?: string;
  createdAt: number;
}

export interface LauncherConfig {
  ram: number;
  javaPath: string;
  gamePath: string;
  width: number;
  height: number;
  fullscreen: boolean;
  closeOnLaunch: boolean;
  discordRpc: boolean;
  account: AccountInfo | null;
  savedAccounts: AccountInfo[];
  profiles: Profile[];
  activeProfileId: string | null;
  setupCompleted?: boolean;
}

// %APPDATA%\.nexoclient
//   launcher\         launcher config, shared assets, built-in mods
//   profiles\<name>\  version files, libraries and mods of one profile
//   saves\, resourcepacks\, config\, options.txt, servers.dat — shared by all profiles
export const getDefaultGamePath = () => path.join(app.getPath('appData'), '.nexoclient');
export const getLauncherDir = () => path.join(getDefaultGamePath(), 'launcher');
const getConfigPath = () => path.join(getLauncherDir(), 'launcher-config.json');

// Older launcher versions kept everything in Electron's userData folder, which was %APPDATA%\nexoclient
const getLegacyDataDir = () => path.join(app.getPath('appData'), 'nexoclient');
const getLegacyConfigPath = () => path.join(getLegacyDataDir(), 'launcher-config.json');
export const getLegacyGamePaths = () => [
  path.join(getLegacyDataDir(), 'game'),
  path.join(getLegacyDataDir(), '.nexoclient'),
];

const defaultConfig = (): LauncherConfig => ({
  ram: 4,
  javaPath: '',
  gamePath: getDefaultGamePath(),
  width: 1024,
  height: 768,
  fullscreen: false,
  closeOnLaunch: false,
  discordRpc: true,
  account: null,
  savedAccounts: [],
  profiles: [],
  activeProfileId: null,
});

let config: LauncherConfig;

export function getConfig(): LauncherConfig {
  return config;
}

const samePath = (a: string, b: string) => path.resolve(a) === path.resolve(b);

// Loads the config (falling back to the legacy location) and moves an old default game path to %APPDATA%\.nexoclient.
// Returns the legacy game folder whose data should be migrated, if any.
export function loadConfig(): string | null {
  const source = [getConfigPath(), getLegacyConfigPath()].find(p => fs.existsSync(p));
  config = defaultConfig();
  if (source) {
    try {
      config = { ...config, ...JSON.parse(fs.readFileSync(source, 'utf-8')) };
    } catch (e) {
      console.error('Failed to read config, using defaults:', e);
    }
  }
  if (!Array.isArray(config.savedAccounts)) config.savedAccounts = config.account ? [config.account] : [];
  if (!Array.isArray(config.profiles)) config.profiles = [];

  const legacyGamePaths = getLegacyGamePaths();
  const legacyGamePath =
    legacyGamePaths.find(p => config.gamePath && samePath(config.gamePath, p)) ||
    legacyGamePaths.find(p => fs.existsSync(p)) ||
    null;
  if (!config.gamePath || legacyGamePaths.some(p => samePath(config.gamePath, p))) {
    config.gamePath = getDefaultGamePath();
  }

  saveConfig(config);
  return legacyGamePath;
}

export function saveConfig(next: LauncherConfig) {
  config = next;
  try {
    fs.mkdirSync(path.dirname(getConfigPath()), { recursive: true });
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

// Creates the .nexoclient layout so it exists before the first game launch
export function ensureGameDirs() {
  for (const dir of [getLauncherDir(), ...['launcher', 'profiles', 'saves', 'resourcepacks'].map(d => path.join(config.gamePath, d))]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.error(`Failed to create ${dir}:`, e);
    }
  }
}

// Adds the account (replacing one with the same uuid in place) and makes it active
export function setActiveAccount(account: AccountInfo) {
  const exists = config.savedAccounts.some(a => a.uuid === account.uuid);
  const savedAccounts = exists
    ? config.savedAccounts.map(a => (a.uuid === account.uuid ? account : a))
    : [...config.savedAccounts, account];
  saveConfig({ ...config, account, savedAccounts });
}

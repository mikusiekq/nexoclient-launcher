import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { getConfig, saveConfig, type LauncherConfig, type Profile } from './config';
import type { InstalledMod } from './mods';
import { getProfileDir } from './profiles';

// Import of profiles from other launchers: mods go into the new profile, worlds/servers/settings/resource packs
// into the shared .nexoclient folder (they're shared by all profiles here).

export type ImportSourceId = 'ogulniega' | 'dawn' | 'modrinth' | 'lunar';

interface SourceProfile {
  key: string;
  name: string;
  version: string | null; // null when the other launcher doesn't record it
  gameDir: string; // options.txt, servers.dat, saves\, resourcepacks\
  optionsFile?: string; // when options.txt isn't in gameDir
  modFiles: string[];
}

export interface ImportableProfile {
  key: string;
  name: string;
  version: string | null;
  mods: number;
  worlds: string[];
  resourcePacks: number;
  hasOptions: boolean;
  hasServers: boolean;
}

export interface ImportSource {
  id: ImportSourceId;
  name: string;
  found: boolean;
  profiles: ImportableProfile[];
}

export interface ImportOptions {
  name: string;
  version: string;
  mods: boolean;
  worlds: boolean;
  servers: boolean;
  options: boolean;
  resourcePacks: boolean;
}

const appData = () => app.getPath('appData');
const home = () => app.getPath('home');

const readJson = (file: string): any => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
};

const listDirs = (dir: string) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  } catch {
    return [];
  }
};

const listJars = (dir: string) => {
  try {
    return fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.jar')).map(f => path.join(dir, f));
  } catch {
    return [];
  }
};

const firstExisting = (...paths: string[]) => paths.find(p => fs.existsSync(p)) ?? paths[0];
const versionFromText = (text: string) => /\b(1\.\d+(?:\.\d+)?)\b/.exec(text)?.[1] ?? null;

// Minecraft version from the last game log ("Loading Minecraft 1.21.4 with Fabric Loader ...")
function versionFromLog(gameDir: string): string | null {
  try {
    const log = fs.readFileSync(path.join(gameDir, 'logs', 'latest.log'), 'utf-8');
    return /Loading Minecraft (\S+)/.exec(log)?.[1] ?? null;
  } catch {
    return null;
  }
}

// --- Launchers ---

// %APPDATA%\.ogulniega: versions in launcher\launcher.json, installed ones have launcher\<name>.json,
// mods in profile\mods\<name>\ (+ preinstalled\), everything else shared in profile\
function ogulniegaProfiles(): SourceProfile[] {
  const root = path.join(appData(), '.ogulniega');
  const versions: any[] = readJson(path.join(root, 'launcher', 'launcher.json'))?.versions ?? [];
  const gameDir = path.join(root, 'profile');

  return fs
    .readdirSync(path.join(root, 'launcher'))
    .filter(f => f.endsWith('.json') && f !== 'launcher.json')
    .map(f => {
      const name = f.slice(0, -'.json'.length);
      const disabled = new Set<string>(
        (readJson(path.join(root, 'launcher', f))?.mods ?? []).filter((m: any) => m.enabled === false).map((m: any) => m.filename),
      );
      const modsDir = path.join(gameDir, 'mods', name);
      const modFiles = [...listJars(modsDir), ...listJars(path.join(modsDir, 'preinstalled'))].filter(file => {
        const base = path.basename(file);
        return !disabled.has(base) && !/^ogulniega-mod/i.test(base);
      });
      const version = versions.find(v => v.name === name)?.minecraft_version ?? versionFromText(name);
      return { key: name, name, version, gameDir, modFiles };
    });
}

// %APPDATA%\.dawn\profiles\<id>\profile.json; game folder is .minecraft\, or the auto-sync group folder
function dawnProfiles(): SourceProfile[] {
  const root = path.join(appData(), '.dawn');
  return listDirs(path.join(root, 'profiles')).flatMap(id => {
    const dir = path.join(root, 'profiles', id);
    const profile = readJson(path.join(dir, 'profile.json'))?.profile;
    if (!profile) return [];

    const syncGroup = profile.settings?.autoSyncMembership;
    const gameDir =
      syncGroup?.kind === 'Member'
        ? path.join(root, 'auto-sync', 'groups', syncGroup.groupId)
        : path.join(dir, '.minecraft');
    const managed = new Set<string>(
      (readJson(path.join(dir, 'dawn-managed-client-mods.json'))?.mods ?? []).map((m: any) => m.fileName),
    );
    const modsDir = firstExisting(path.join(dir, 'private-game-content', 'mods'), path.join(dir, '.minecraft', 'mods'));
    const modFiles = listJars(modsDir).filter(f => !managed.has(path.basename(f)) && !/^dawn-client/i.test(path.basename(f)));

    const optionsFile = firstExisting(path.join(dir, 'private-game-content', 'options.txt'), path.join(gameDir, 'options.txt'));
    return [{ key: id, name: profile.name || id, version: profile.minecraftVersion ?? null, gameDir, optionsFile, modFiles }];
  });
}

// %APPDATA%\ModrinthApp\profiles\<name>\ is a full game folder; the version lives in its SQLite db,
// so it's read from the last game log or the profile name instead
function modrinthProfiles(): SourceProfile[] {
  const root = path.join(appData(), 'ModrinthApp', 'profiles');
  return listDirs(root).map(name => {
    const gameDir = path.join(root, name);
    return {
      key: name,
      name,
      version: versionFromLog(gameDir) ?? versionFromText(name),
      gameDir,
      modFiles: listJars(path.join(gameDir, 'mods')),
    };
  });
}

// ~\.lunarclient: game folder from settings\launcher.json (default .minecraft), Fabric mods in profiles\lunar\<version>\mods
function lunarProfiles(): SourceProfile[] {
  const root = path.join(home(), '.lunarclient');
  const gameDir =
    readJson(path.join(root, 'settings', 'launcher.json'))?.gameDirectory || path.join(appData(), '.minecraft');
  const modVersions = listDirs(path.join(root, 'profiles', 'lunar'));

  if (modVersions.length === 0) {
    return [{ key: 'lunar', name: 'Lunar Client', version: null, gameDir, modFiles: [] }];
  }
  return modVersions.map(version => ({
    key: version,
    name: `Lunar Client ${version}`,
    version: versionFromText(version),
    gameDir,
    modFiles: listJars(path.join(root, 'profiles', 'lunar', version, 'mods')),
  }));
}

const SOURCES: { id: ImportSourceId; name: string; root: () => string; profiles: () => SourceProfile[] }[] = [
  { id: 'ogulniega', name: 'Ogulniega', root: () => path.join(appData(), '.ogulniega'), profiles: ogulniegaProfiles },
  { id: 'dawn', name: 'Dawn', root: () => path.join(appData(), '.dawn'), profiles: dawnProfiles },
  { id: 'modrinth', name: 'Modrinth', root: () => path.join(appData(), 'ModrinthApp'), profiles: modrinthProfiles },
  { id: 'lunar', name: 'Lunar Client', root: () => path.join(home(), '.lunarclient'), profiles: lunarProfiles },
];

function sourceProfiles(id: ImportSourceId): SourceProfile[] {
  const source = SOURCES.find(s => s.id === id);
  if (!source || !fs.existsSync(source.root())) return [];
  try {
    return source.profiles();
  } catch (e) {
    console.error(`Failed to read ${source.name} profiles:`, e);
    return [];
  }
}

const optionsPath = (p: SourceProfile) => p.optionsFile ?? path.join(p.gameDir, 'options.txt');

function describe(profile: SourceProfile): ImportableProfile {
  return {
    key: profile.key,
    name: profile.name,
    version: profile.version,
    mods: profile.modFiles.length,
    worlds: listDirs(path.join(profile.gameDir, 'saves')),
    resourcePacks: fs.existsSync(path.join(profile.gameDir, 'resourcepacks'))
      ? fs.readdirSync(path.join(profile.gameDir, 'resourcepacks')).length
      : 0,
    hasOptions: fs.existsSync(optionsPath(profile)),
    hasServers: fs.existsSync(path.join(profile.gameDir, 'servers.dat')),
  };
}

export function listImportSources(): ImportSource[] {
  return SOURCES.map(source => ({
    id: source.id,
    name: source.name,
    found: fs.existsSync(source.root()),
    profiles: sourceProfiles(source.id).map(describe),
  }));
}

// --- Import ---

// "name", "name (2)", … — first name not taken in dir
function freeName(dir: string, name: string): string {
  let candidate = name;
  for (let i = 2; fs.existsSync(path.join(dir, candidate)); i++) candidate = `${name} (${i})`;
  return candidate;
}

// Replaces a shared file, keeping the previous one as <file>.bak
function replaceWithBackup(src: string, dest: string) {
  if (fs.existsSync(dest)) fs.copyFileSync(dest, `${dest}.bak`);
  fs.copyFileSync(src, dest);
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function importProfile(sourceId: ImportSourceId, key: string, options: ImportOptions): LauncherConfig {
  const source = sourceProfiles(sourceId).find(p => p.key === key);
  if (!source) throw new Error('Nie znaleziono profilu do importu.');

  const config = getConfig();
  const profile: Profile = {
    id: genId(),
    name: options.name.trim() || source.name,
    version: options.version,
    accountUuid: null,
    engine: 'fabric',
    icon: 'grass_block_top',
    createdAt: Date.now(),
  };
  const next: LauncherConfig = {
    ...config,
    profiles: [...config.profiles, profile],
    activeProfileId: config.activeProfileId ?? profile.id,
  };
  saveConfig(next);

  const shared = config.gamePath;
  const profileDir = getProfileDir(profile.id);

  if (options.mods && source.modFiles.length > 0) {
    const modsDir = path.join(profileDir, 'mods');
    fs.mkdirSync(modsDir, { recursive: true });
    const installed: InstalledMod[] = source.modFiles.map(file => {
      const fileName = path.basename(file);
      fs.copyFileSync(file, path.join(modsDir, fileName));
      return {
        projectId: `local:${fileName}`,
        title: fileName.replace(/\.jar$/i, ''),
        versionId: '',
        fileName,
        downloadUrl: '',
        installedAt: Date.now(),
      };
    });
    fs.writeFileSync(path.join(profileDir, 'mods.json'), JSON.stringify(installed, null, 2), 'utf-8');
  }

  if (options.worlds) {
    const savesDir = path.join(shared, 'saves');
    fs.mkdirSync(savesDir, { recursive: true });
    for (const world of listDirs(path.join(source.gameDir, 'saves'))) {
      fs.cpSync(path.join(source.gameDir, 'saves', world), path.join(savesDir, freeName(savesDir, world)), { recursive: true });
    }
  }

  if (options.resourcePacks) {
    const src = path.join(source.gameDir, 'resourcepacks');
    const dest = path.join(shared, 'resourcepacks');
    if (fs.existsSync(src)) {
      fs.mkdirSync(dest, { recursive: true });
      for (const pack of fs.readdirSync(src)) {
        if (!fs.existsSync(path.join(dest, pack))) fs.cpSync(path.join(src, pack), path.join(dest, pack), { recursive: true });
      }
    }
  }

  const servers = path.join(source.gameDir, 'servers.dat');
  if (options.servers && fs.existsSync(servers)) replaceWithBackup(servers, path.join(shared, 'servers.dat'));
  const gameOptions = optionsPath(source);
  if (options.options && fs.existsSync(gameOptions)) replaceWithBackup(gameOptions, path.join(shared, 'options.txt'));

  return getConfig();
}

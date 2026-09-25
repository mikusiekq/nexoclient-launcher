import fs from 'fs';
import path from 'path';
import { getConfig, getLauncherDir, type Profile } from './config';

// Every profile folder carries a .profile-id file, so a profile only ever uses its own folder
// (a new or renamed profile must not pick up an unrelated folder that happens to have the same name)
const PROFILE_ID_FILE = '.profile-id';

const profilesDir = (gamePath: string) => path.join(gamePath, 'profiles');
const sanitize = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'unnamed';

function readProfileDirId(dir: string): string | null {
  try {
    return fs.readFileSync(path.join(dir, PROFILE_ID_FILE), 'utf-8').trim() || null;
  } catch {
    return null;
  }
}

export function stampProfileDir(dir: string, profileId: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, PROFILE_ID_FILE), profileId, 'utf-8');
}

// Folder name for a profile: its name, "name (2)"… when several profiles share a name
export function getProfileFolderName(profileId: string, profiles: Profile[]): string {
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return profileId;

  const name = sanitize(profile.name);
  const sameName = profiles
    .filter(p => sanitize(p.name).toLowerCase() === name.toLowerCase())
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const index = sameName.findIndex(p => p.id === profileId);
  return index <= 0 ? name : `${name} (${index + 1})`;
}

// Profile folder name, or "name (2)", "name (3)"… if that folder belongs to something else
function getFreeFolderName(gamePath: string, profileId: string, profiles: Profile[]): string {
  const base = getProfileFolderName(profileId, profiles);
  const isTaken = (name: string) => {
    const dir = path.join(profilesDir(gamePath), name);
    return fs.existsSync(dir) && readProfileDirId(dir) !== profileId;
  };
  let name = base;
  for (let i = 2; isTaken(name); i++) name = `${base} (${i})`;
  return name;
}

// Name of the folder stamped with this profile's id
function findProfileDir(gamePath: string, profileId: string): string | null {
  const parent = profilesDir(gamePath);
  if (!fs.existsSync(parent)) return null;
  return fs.readdirSync(parent).find(f => readProfileDirId(path.join(parent, f)) === profileId) ?? null;
}

// Profile folder, created (and stamped) on first use
export function getProfileDir(profileId: string, gamePath = getConfig().gamePath): string {
  const existing = findProfileDir(gamePath, profileId);
  if (existing) return path.join(profilesDir(gamePath), existing);

  const dir = path.join(profilesDir(gamePath), getFreeFolderName(gamePath, profileId, getConfig().profiles));
  stampProfileDir(dir, profileId);
  return dir;
}

// Renames profile folders to follow profile names
export function syncProfileFolderNames(gamePath: string, profiles: Profile[]) {
  const parent = profilesDir(gamePath);
  try {
    fs.mkdirSync(parent, { recursive: true });
    for (const p of profiles) {
      const existing = findProfileDir(gamePath, p.id);
      if (!existing) continue;
      const target = getFreeFolderName(gamePath, p.id, profiles);
      if (existing !== target) {
        fs.renameSync(path.join(parent, existing), path.join(parent, target));
        console.log(`Renamed profile folder ${existing} -> ${target}`);
      }
    }
  } catch (e) {
    console.error('Failed to rename profile folders:', e);
  }
}

// Folders from launcher versions before .profile-id: matched by name, raw id or `_<id>` suffix (unstamped only)
export function findLegacyProfileDir(gamePath: string, profileId: string, profiles: Profile[]): string | null {
  const parent = profilesDir(gamePath);
  if (!fs.existsSync(parent)) return null;

  const candidates = [
    getProfileFolderName(profileId, profiles),
    profileId,
    ...fs.readdirSync(parent).filter(f => f.endsWith(`_${profileId}`)),
  ];
  return candidates.find(c => {
    const dir = path.join(parent, c);
    return fs.existsSync(dir) && readProfileDirId(dir) === null;
  }) ?? null;
}

// One-time: stamp folders of existing profiles created before .profile-id existed
export function stampLegacyProfileDirs(gamePath: string, profiles: Profile[]) {
  const marker = path.join(getLauncherDir(), '.profile-dirs-stamped');
  if (fs.existsSync(marker)) return;
  for (const p of profiles) {
    if (findProfileDir(gamePath, p.id)) continue;
    const legacy = findLegacyProfileDir(gamePath, p.id, profiles);
    if (legacy) stampProfileDir(path.join(profilesDir(gamePath), legacy), p.id);
  }
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, new Date().toISOString(), 'utf-8');
}

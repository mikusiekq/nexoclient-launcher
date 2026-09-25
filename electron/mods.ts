import fs from 'fs';
import path from 'path';
import { downloadFile } from './net';
import { getProfileDir } from './profiles';

// Mods installed through the launcher are listed in <profile>\mods.json next to the mods\ folder
export interface InstalledMod {
  projectId: string;
  title: string;
  versionId: string;
  fileName: string;
  iconUrl?: string;
  downloadUrl: string;
  installedAt: number;
}

const metaPath = (profileId: string) => path.join(getProfileDir(profileId), 'mods.json');
const modsDir = (profileId: string) => path.join(getProfileDir(profileId), 'mods');

export function getInstalledMods(profileId: string): InstalledMod[] {
  try {
    return JSON.parse(fs.readFileSync(metaPath(profileId), 'utf-8'));
  } catch {
    return [];
  }
}

function writeInstalledMods(profileId: string, mods: InstalledMod[]) {
  fs.writeFileSync(metaPath(profileId), JSON.stringify(mods, null, 2), 'utf-8');
}

export async function installMod(profileId: string, mod: Omit<InstalledMod, 'installedAt'>) {
  await downloadFile(mod.downloadUrl, path.join(modsDir(profileId), mod.fileName));
  const others = getInstalledMods(profileId).filter(m => m.projectId !== mod.projectId);
  writeInstalledMods(profileId, [...others, { ...mod, installedAt: Date.now() }]);
}

export function uninstallMod(profileId: string, projectId: string): boolean {
  const mods = getInstalledMods(profileId);
  const mod = mods.find(m => m.projectId === projectId);
  if (!mod) return false;
  fs.rmSync(path.join(modsDir(profileId), mod.fileName), { force: true });
  writeInstalledMods(profileId, mods.filter(m => m.projectId !== projectId));
  return true;
}

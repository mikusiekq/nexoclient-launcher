import fs from 'fs';
import path from 'path';
import { getLauncherDir, type Profile } from './config';
import { findLegacyProfileDir, getProfileFolderName, stampProfileDir } from './profiles';

const SHARED_ITEMS = ['saves', 'resourcepacks', 'shaderpacks', 'screenshots', 'config', 'options.txt', 'servers.dat'];

// Copies data from an old launcher layout into %APPDATA%\.nexoclient. Runs once; the old folder is left untouched.
export function migrateLegacyGameData(legacyRoot: string, newRoot: string, profiles: Profile[]) {
  const marker = path.join(getLauncherDir(), '.legacy-migrated');
  if (!fs.existsSync(legacyRoot) || fs.existsSync(marker) || path.resolve(legacyRoot) === path.resolve(newRoot)) return;

  const copyIfMissing = (src: string, dest: string) => {
    if (fs.existsSync(src) && !fs.existsSync(dest)) fs.cpSync(src, dest, { recursive: true });
  };

  try {
    fs.mkdirSync(newRoot, { recursive: true });
    for (const item of SHARED_ITEMS) copyIfMissing(path.join(legacyRoot, item), path.join(newRoot, item));
    copyIfMissing(path.join(legacyRoot, 'assets'), path.join(getLauncherDir(), 'assets'));

    // Existing profiles only: keep their mods, drop per-profile options/servers (now shared in the root)
    for (const p of profiles) {
      const legacyDir = findLegacyProfileDir(legacyRoot, p.id, profiles);
      const dest = path.join(newRoot, 'profiles', getProfileFolderName(p.id, profiles));
      if (!legacyDir || fs.existsSync(dest)) continue;
      fs.cpSync(path.join(legacyRoot, 'profiles', legacyDir), dest, { recursive: true });
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

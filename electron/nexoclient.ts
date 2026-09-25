import fs from 'fs';
import path from 'path';
import { downloadFile, httpGetJson } from './net';
import { setLaunchStatus } from './window';

// The NexoClient mod is built into the launcher: it is loaded through -Dfabric.addMods from
// <game>\launcher\builtin\ instead of the profile's mods folder, so it isn't listed in the mods UI
// and can't be removed there. It is updated from the latest GitHub release of the mod repo.
const RELEASES_API = 'https://api.github.com/repos/mikusiekq/nexoclient-mod/releases/latest';
const BUNDLED_JAR = 'nexoclient.jar'; // copied next to main.js by scripts/build-electron.js
const FABRIC_API_PROJECT_ID = 'P7dR8mSH';

interface ReleaseState {
  tag: string;
  assetKey: string; // asset id + upload time, so re-uploading under the same tag also updates
  file: string; // relative to the cache dir
}

// The mod targets ~1.21.11 (>= 1.21.11, < 1.22)
function isSupported(mcVersion: string): boolean {
  const match = /^1\.21\.(\d+)/.exec(mcVersion);
  return !!match && Number(match[1]) >= 11;
}

function readState(statePath: string, cacheDir: string): ReleaseState | null {
  try {
    const state: ReleaseState = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    return fs.existsSync(path.join(cacheDir, state.file)) ? state : null;
  } catch {
    return null;
  }
}

// Latest release jar (downloaded when a new one appears); otherwise the last download, otherwise the bundled copy
async function resolveModJar(builtinDir: string): Promise<string | null> {
  const cacheDir = path.join(builtinDir, 'nexoclient');
  const statePath = path.join(cacheDir, 'release.json');
  fs.mkdirSync(cacheDir, { recursive: true });
  const cached = readState(statePath, cacheDir);

  try {
    setLaunchStatus('Sprawdzanie aktualizacji NexoClient...');
    const release = await httpGetJson(RELEASES_API);
    const asset = (release.assets || []).find(
      (a: any) => /\.jar$/i.test(a.name) && !/-(sources|dev)\.jar$/i.test(a.name),
    );
    if (!release.tag_name || !asset) throw new Error('latest release has no mod .jar');

    const assetKey = `${asset.id}:${asset.updated_at}`;
    if (cached?.assetKey === assetKey) return path.join(cacheDir, cached.file);

    setLaunchStatus(`Pobieranie NexoClient ${release.tag_name}...`);
    const releaseDir = `${String(release.tag_name).replace(/[\\/:*?"<>|]/g, '_')}-${asset.id}`;
    const file = path.join(releaseDir, asset.name);
    const dest = path.join(cacheDir, file);
    await downloadFile(asset.browser_download_url, `${dest}.download`);
    fs.renameSync(`${dest}.download`, dest);

    if (cached && path.dirname(cached.file) !== releaseDir) {
      fs.rmSync(path.join(cacheDir, path.dirname(cached.file)), { recursive: true, force: true });
    }
    const state: ReleaseState = { tag: release.tag_name, assetKey, file };
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
    console.log(`NexoClient updated to ${release.tag_name}`);
    return dest;
  } catch (e: any) {
    console.error('NexoClient update check failed:', e?.message || e);
  }

  if (cached) return path.join(cacheDir, cached.file);

  // Copied out of the app bundle because Java can't read files inside app.asar
  const bundled = path.join(__dirname, BUNDLED_JAR);
  if (!fs.existsSync(bundled)) {
    console.error(`Bundled NexoClient mod not found at ${bundled}`);
    return null;
  }
  const dest = path.join(cacheDir, 'bundled', BUNDLED_JAR);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(bundled, dest);
  return dest;
}

// Fabric API build for the Minecraft version, downloaded once from Modrinth
async function resolveFabricApi(mcVersion: string, builtinDir: string): Promise<string | null> {
  const dir = path.join(builtinDir, mcVersion);
  fs.mkdirSync(dir, { recursive: true });
  const cached = fs.readdirSync(dir).find(f => f.toLowerCase().startsWith('fabric-api'));
  if (cached) return path.join(dir, cached);

  try {
    setLaunchStatus('Pobieranie Fabric API (wymagane przez NexoClient)...');
    const query = `loaders=%5B%22fabric%22%5D&game_versions=%5B%22${mcVersion}%22%5D`;
    const [version] = await httpGetJson(`https://api.modrinth.com/v2/project/${FABRIC_API_PROJECT_ID}/version?${query}`);
    const file = version?.files?.find((f: any) => f.primary) || version?.files?.[0];
    if (!file) throw new Error(`no Fabric API build for ${mcVersion}`);
    const dest = path.join(dir, file.filename);
    await downloadFile(file.url, dest);
    return dest;
  } catch (e: any) {
    console.error('Failed to download Fabric API:', e?.message || e);
    return null;
  }
}

// Jars to load in addition to the profile's mods folder
export async function prepareBuiltinMods(mcVersion: string, gameRoot: string, profileModsDir: string): Promise<string[]> {
  if (!isSupported(mcVersion)) {
    console.log(`NexoClient mod skipped: not built for Minecraft ${mcVersion}`);
    return [];
  }

  const builtinDir = path.join(gameRoot, 'launcher', 'builtin');
  const modJar = await resolveModJar(builtinDir);
  if (!modJar) return [];

  // NexoClient depends on Fabric API; the profile's own copy wins (two copies would conflict)
  const profileHasFabricApi = fs.readdirSync(profileModsDir).some(f => f.toLowerCase().startsWith('fabric-api'));
  const fabricApi = profileHasFabricApi ? null : await resolveFabricApi(mcVersion, builtinDir);
  return fabricApi ? [modJar, fabricApi] : [modJar];
}

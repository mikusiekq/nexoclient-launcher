import { httpGetJson } from './net';

const FABRIC_META = 'https://meta.fabricmc.net/v2';

// Minecraft 1.19.4 and newer
function isVersionSupported(version: string): boolean {
  const [major, minor, patch = 0] = version.split('.').map(Number);
  if (Number.isNaN(major) || Number.isNaN(minor)) return false;
  if (major !== 1) return major > 1;
  return minor > 19 || (minor === 19 && patch >= 4);
}

// Stable Minecraft releases supported by Fabric
export async function fetchGameVersions(): Promise<string[]> {
  const versions = await httpGetJson<{ version: string; stable: boolean }[]>(`${FABRIC_META}/versions/game`);
  return versions.filter(v => v.stable && isVersionSupported(v.version)).map(v => v.version);
}

export async function fetchLatestFabricLoader(): Promise<string> {
  const loaders = await httpGetJson<{ version: string; stable: boolean }[]>(`${FABRIC_META}/versions/loader`);
  return loaders.find(l => l.stable)?.version || loaders[0]?.version;
}

// Launch profile (version JSON) of a Fabric Loader for a Minecraft version
export const fabricProfileUrl = (mcVersion: string, loaderVersion: string) =>
  `${FABRIC_META}/versions/loader/${mcVersion}/${loaderVersion}/profile/json`;

import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { Client } from 'minecraft-launcher-core';
import { ensureFreshAccount } from './auth';
import { getConfig } from './config';
import { setGamePresence, setLauncherPresence, updatePresenceFromLog } from './discord';
import { httpGet } from './net';
import { prepareBuiltinMods } from './nexoclient';
import { getProfileDir } from './profiles';
import { fabricProfileUrl, fetchLatestFabricLoader } from './versions';
import { sendToRenderer, setLaunchStatus } from './window';

let gameProcess: { on(event: 'close', cb: (code: number) => void): void } | null = null;

// Writes the Fabric launch profile into the instance's versions\ folder and returns its version id
async function installFabric(mcVersion: string, instanceDir: string): Promise<string> {
  setLaunchStatus('Przygotowywanie wersji Fabric...');
  const loaderVersion = await fetchLatestFabricLoader();
  const versionId = `fabric-loader-${loaderVersion}-${mcVersion}`;
  const jsonPath = path.join(instanceDir, 'versions', versionId, `${versionId}.json`);

  if (!fs.existsSync(jsonPath)) {
    setLaunchStatus('Pobieranie profilu Fabric...');
    const profileJson = await httpGet(fabricProfileUrl(mcVersion, loaderVersion));
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, profileJson, 'utf-8');
  }
  return versionId;
}

// MCLC logs the full launch arguments; never show the session token in the console
function createRedactor(token: string) {
  return (text: string) => {
    const out = String(text).replace(/(--(?:accessToken|xuid)\s+)\S+/g, '$1[ukryte]');
    return token.length > 20 ? out.split(token).join('[ukryte]') : out;
  };
}

export async function launchGame(mcVersion: string) {
  const config = getConfig();
  if (!config.account) throw new Error('Musisz się zalogować, aby zagrać!');
  if (gameProcess) throw new Error('Gra jest już uruchomiona!');

  const profile = config.profiles.find(p => p.id === config.activeProfileId);
  if (!profile) throw new Error('Wybierz profil, aby zagrać.');

  try {
    // An expired Microsoft token makes servers reject the session (401 on the profile key pair)
    setLaunchStatus('Sprawdzanie sesji konta...');
    const account = await ensureFreshAccount(config.account);

    // Real on-disk path: when Windows redirects AppData (launcher started from a packaged app), Java reports
    // class locations under the redirected path, and Fabric would not recognise its own loader on a
    // classpath built from the original one ("trying to load ... from target class loader")
    fs.mkdirSync(config.gamePath, { recursive: true });
    const gameRoot = fs.realpathSync.native(config.gamePath);
    const instanceDir = path.join(gameRoot, 'profiles', path.basename(getProfileDir(profile.id)));
    const modsDir = path.join(instanceDir, 'mods');
    fs.mkdirSync(modsDir, { recursive: true });

    const versionId = await installFabric(mcVersion, instanceDir);
    const builtinMods = await prepareBuiltinMods(mcVersion, gameRoot, modsDir);

    const token = account.type === 'microsoft' ? account.token : 'null';
    const redact = createRedactor(token);
    const launcher = new Client();

    launcher.on('debug', e => sendToRenderer('launcher-log', `[DEBUG] ${redact(e)}`));
    launcher.on('data', e => {
      sendToRenderer('launcher-log', redact(e));
      updatePresenceFromLog(String(e));
    });
    launcher.on('progress', e =>
      sendToRenderer('launch-progress', {
        type: e.type,
        task: e.task,
        total: e.total,
        percentage: Math.round((e.task / e.total) * 100),
      }),
    );
    launcher.on('download-status', e => setLaunchStatus(`Pobieranie: ${e.name} (${e.current}/${e.total})`));

    setLaunchStatus('Uruchamianie silnika gry...');
    const child = await launcher.launch({
      authorization: {
        access_token: token,
        client_token: 'null',
        uuid: account.uuid,
        name: account.username,
        user_properties: '{}',
        meta: account.type === 'microsoft' ? { type: 'msa', xuid: account.xuid } : { type: 'legacy' },
      },
      // Version files, libraries and mods per profile; saves, settings, servers and resource packs shared
      root: instanceDir,
      javaPath: config.javaPath || 'java',
      overrides: {
        gameDirectory: gameRoot,
        assetRoot: path.join(gameRoot, 'launcher', 'assets'),
      },
      version: { number: mcVersion, type: 'release', custom: versionId },
      memory: { max: `${config.ram}G`, min: '1G' },
      window: { width: config.width, height: config.height, fullscreen: config.fullscreen },
      customArgs: [`-Dfabric.addMods=${[modsDir, ...builtinMods].join(path.delimiter)}`],
    } as any);

    if (!child) throw new Error('Nie udało się uruchomić procesu gry.');
    gameProcess = child;
    sendToRenderer('game-started');
    setGamePresence(mcVersion);
    child.on('close', (code: number) => {
      gameProcess = null;
      sendToRenderer('game-closed', code);
      setLauncherPresence();
    });

    if (config.closeOnLaunch) setTimeout(() => app.quit(), 2000);
  } catch (error: any) {
    console.error('Launch failed:', error);
    gameProcess = null;
    sendToRenderer('game-closed', -1);
    throw new Error('Błąd uruchamiania: ' + error.message);
  }
}

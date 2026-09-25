import DiscordRPC from 'discord-rpc';

// Discord application "NEXOCLIENT" (Developer Portal); its name is the title shown on the profile,
// and the Rich Presence art asset named LOGO_ASSET is the large image
const CLIENT_ID = '1553019590286508152';
const LOGO_ASSET = 'logo';
const WEBSITE = 'https://nexoclient.top';

type Presence =
  | { mode: 'launcher' }
  | { mode: 'game'; version: string; startedAt: number; place: string | null };

const launcherStartedAt = Date.now();
let presence: Presence = { mode: 'launcher' };
let client: DiscordRPC.Client | null = null;
let ready = false;

function publish() {
  if (!client || !ready) return;
  const game = presence.mode === 'game' ? presence : null;
  client
    .setActivity({
      details: game ? (game.place ? `In ${game.place}` : 'W menu głównym') : 'W launcherze',
      state: game ? game.version : undefined,
      startTimestamp: game ? game.startedAt : launcherStartedAt,
      largeImageKey: LOGO_ASSET,
      largeImageText: 'NEXOCLIENT',
      buttons: [{ label: 'POBIERZ CLIENTA', url: WEBSITE }],
      instance: false,
    })
    .catch(e => console.error('[Discord RPC] setActivity error:', e?.message || e));
}

export function startDiscordRpc() {
  if (client) return;
  try {
    DiscordRPC.register(CLIENT_ID);
    const rpc = new DiscordRPC.Client({ transport: 'ipc' });
    rpc.on('ready', () => {
      ready = true;
      publish();
    });
    rpc.login({ clientId: CLIENT_ID }).catch(e => {
      console.error('[Discord RPC] Login failed:', e?.message || e);
      if (client === rpc) client = null;
    });
    client = rpc;
  } catch (e) {
    console.error('[Discord RPC] Init error:', e);
  }
}

export function stopDiscordRpc() {
  client?.destroy().catch(() => {});
  client = null;
  ready = false;
}

export function setDiscordRpcEnabled(enabled: boolean) {
  if (enabled) startDiscordRpc();
  else stopDiscordRpc();
}

// --- Presence updates from the game ---

export function setGamePresence(version: string) {
  presence = { mode: 'game', version, startedAt: Date.now(), place: null };
  publish();
}

export function setLauncherPresence() {
  presence = { mode: 'launcher' };
  publish();
}

// Reads the game log to show where the player is: "Connecting to <server>, <port>" for multiplayer,
// "Preparing level "<world>"" for singleplayer, "Stopping server" when leaving a singleplayer world
export function updatePresenceFromLog(text: string) {
  if (presence.mode !== 'game') return;
  let place = presence.place;

  const server = /Connecting to ([^\s,]+), (\d+)/.exec(text);
  const world = /Preparing level "(.+?)"/.exec(text);
  if (server) place = server[2] === '25565' ? server[1] : `${server[1]}:${server[2]}`;
  else if (world) place = world[1];
  else if (/Stopping server/.test(text)) place = null;

  if (place !== presence.place) {
    presence = { ...presence, place };
    publish();
  }
}

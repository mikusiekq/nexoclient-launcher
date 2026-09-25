import DiscordRPC from 'discord-rpc';

const CLIENT_ID = '1507104421887082646';
const startTimestamp = Date.now();

let client: DiscordRPC.Client | null = null;

function setPresence(rpc: DiscordRPC.Client) {
  rpc
    .setActivity({
      details: 'W menu głównym',
      state: 'Pobierz na nexoclient.top',
      startTimestamp,
      largeImageKey: 'nexoclient',
      largeImageText: 'NEXOCLIENT',
      buttons: [{ label: 'Strona launchera', url: 'https://nexoclient.top' }],
    })
    .catch(e => console.error('[Discord RPC] setActivity error:', e?.message || e));
}

export function startDiscordRpc() {
  if (client) return;
  try {
    DiscordRPC.register(CLIENT_ID);
    const rpc = new DiscordRPC.Client({ transport: 'ipc' });
    rpc.on('ready', () => setPresence(rpc));
    rpc.login({ clientId: CLIENT_ID }).catch(e => console.error('[Discord RPC] Login failed:', e?.message || e));
    client = rpc;
  } catch (e) {
    console.error('[Discord RPC] Init error:', e);
  }
}

export function stopDiscordRpc() {
  client?.destroy().catch(() => {});
  client = null;
}

export function setDiscordRpcEnabled(enabled: boolean) {
  if (enabled) startDiscordRpc();
  else stopDiscordRpc();
}

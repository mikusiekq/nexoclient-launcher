import { Auth } from 'msmc';
import type { Minecraft, Xbox } from 'msmc';
import { getConfig, saveConfig, setActiveAccount, type AccountInfo } from './config';

const avatarUrl = (name: string) => `https://minotar.net/helm/${name}/32.png`;

// Refresh the game token when less than this is left, so it can't expire mid-session start
const REFRESH_MARGIN_MS = 30 * 60 * 1000;

// Stable offline UUID derived from the nickname, so the same nick keeps its inventory
function offlineUuid(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  let tail = '';
  for (let i = 0; i < 4; i++) {
    tail += ((hash >> (i * 8)) & 0xff).toString(16).padStart(2, '0');
  }
  return `00000000-0000-0000-0000-0000${tail.padEnd(8, '0')}`;
}

export function loginOffline(username: string): AccountInfo {
  const account: AccountInfo = {
    username,
    uuid: offlineUuid(username),
    token: 'offline_token',
    type: 'offline',
    avatar: avatarUrl(username),
  };
  setActiveAccount(account);
  return account;
}

async function toAccount(xbox: Xbox): Promise<AccountInfo> {
  const minecraft: Minecraft = await xbox.getMinecraft();
  const name = minecraft.profile?.name ?? 'Player';
  return {
    username: name,
    uuid: minecraft.profile?.id ?? '',
    token: minecraft.mcToken,
    type: 'microsoft',
    avatar: avatarUrl(name),
    refreshToken: xbox.save(),
    expiresAt: minecraft.exp,
    xuid: minecraft.xuid,
  };
}

export async function loginMicrosoft(): Promise<AccountInfo> {
  try {
    const account = await toAccount(await new Auth('select_account').launch('electron'));
    setActiveAccount(account);
    return account;
  } catch (error: any) {
    console.error('Microsoft authentication failed:', error);
    throw new Error('Błąd logowania Microsoft: ' + error.message);
  }
}

// Returns the account with a valid game token, renewing an expired Microsoft token first
export async function ensureFreshAccount(account: AccountInfo): Promise<AccountInfo> {
  if (account.type !== 'microsoft') return account;
  if (account.expiresAt && account.expiresAt - Date.now() > REFRESH_MARGIN_MS) return account;

  if (!account.refreshToken) {
    throw new Error('Sesja konta Microsoft wygasła. Zaloguj się ponownie w zakładce Konta.');
  }
  let refreshed: AccountInfo;
  try {
    refreshed = await toAccount(await new Auth('select_account').refresh(account.refreshToken));
  } catch (error: any) {
    console.error('Microsoft token refresh failed:', error);
    throw new Error('Nie udało się odświeżyć sesji Microsoft. Zaloguj się ponownie w zakładce Konta.');
  }

  // Update this account wherever it's stored, without changing which account is active
  const config = getConfig();
  saveConfig({
    ...config,
    account: config.account?.uuid === refreshed.uuid ? refreshed : config.account,
    savedAccounts: config.savedAccounts.map(a => (a.uuid === refreshed.uuid ? refreshed : a)),
  });
  return refreshed;
}

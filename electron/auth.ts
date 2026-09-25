import { Auth } from 'msmc';
import { setActiveAccount, type AccountInfo } from './config';

const avatarUrl = (name: string) => `https://minotar.net/helm/${name}/32.png`;

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

export async function loginMicrosoft(): Promise<AccountInfo> {
  try {
    const xbox = await new Auth('select_account').launch('electron');
    const minecraft: any = await xbox.getMinecraft();
    const name = minecraft.profile?.name ?? 'Player';
    const account: AccountInfo = {
      username: name,
      uuid: minecraft.profile?.id ?? '',
      token: minecraft.mcToken ?? minecraft.token ?? '',
      type: 'microsoft',
      avatar: avatarUrl(name),
    };
    setActiveAccount(account);
    return account;
  } catch (error: any) {
    console.error('Microsoft authentication failed:', error);
    throw new Error('Błąd logowania Microsoft: ' + error.message);
  }
}

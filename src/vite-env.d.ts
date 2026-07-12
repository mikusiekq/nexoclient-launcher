/// <reference types="vite/client" />

interface AccountInfo {
  username: string;
  uuid: string;
  token: string;
  type: 'offline' | 'microsoft';
  avatar: string;
}

interface Profile {
  id: string;
  name: string;
  version: string;
  accountUuid: string | null;
  modSet: 'vanilla' | 'optimization';
  createdAt: number;
}

interface Skin {
  id: string;
  name: string;
  url: string;
  modelType: 'default' | 'slim';
  createdAt: number;
}

interface LauncherConfig {
  ram: number;
  javaPath: string;
  gamePath: string;
  width: number;
  height: number;
  fullscreen: boolean;
  closeOnLaunch: boolean;
  discordRpc: boolean;
  selectedVersion: string;
  account: AccountInfo | null;
  savedAccounts: AccountInfo[];
  profiles: Profile[];
  activeProfileId: string | null;
  skins?: Skin[];
  activeSkinId?: string | null;
}

interface Window {
  electronAPI: {
    getConfig(): Promise<LauncherConfig>;
    saveConfig(config: LauncherConfig): Promise<LauncherConfig>;
    getSystemRam(): Promise<number>;
    detectJava(): Promise<string[]>;
    browseJava(): Promise<string | null>;
    browseGamePath(): Promise<string | null>;
    openFolder(folderName: string, profileId?: string): Promise<void>;
    fetchVersions(): Promise<{ versions: string[]; latestLoader: string }>;
    loginOffline(username: string): Promise<AccountInfo>;
    loginMicrosoft(): Promise<AccountInfo>;
    launchGame(version: string): Promise<boolean>;
    browseMcFolder(): Promise<string | null>;
    importMinecraftSettings(mcPath: string): Promise<{ success: boolean; copiedOptions: boolean; copiedServers: boolean }>;
    uploadMojangSkin(token: string, base64DataUrl: string, modelType: 'default' | 'slim'): Promise<{ success: boolean }>;
    
    // Mods Management APIs
    getInstalledMods(profileId: string): Promise<any[]>;
    installProfileMod(
      profileId: string,
      projectId: string,
      title: string,
      versionId: string,
      downloadUrl: string,
      fileName: string,
      iconUrl?: string
    ): Promise<boolean>;
    uninstallProfileMod(profileId: string, projectId: string): Promise<boolean>;
    
    onLaunchStatus(callback: (status: string) => void): () => void;
    onLaunchProgress(callback: (progress: any) => void): () => void;
    onLauncherLog(callback: (log: string) => void): () => void;
    onGameStarted(callback: () => void): () => void;
    onGameClosed(callback: (code: number) => void): () => void;
  };
}

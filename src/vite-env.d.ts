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
  engine: 'fabric';
  /** Minecraft block texture name used as the profile icon */
  icon?: string;
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
  account: AccountInfo | null;
  savedAccounts: AccountInfo[];
  profiles: Profile[];
  activeProfileId: string | null;
  /** First-run setup (account + profile) has been completed or skipped */
  setupCompleted?: boolean;
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
    fetchVersions(): Promise<{ versions: string[] }>;
    loginOffline(username: string): Promise<AccountInfo>;
    loginMicrosoft(): Promise<AccountInfo>;
    launchGame(version: string): Promise<void>;

    // Profile mods
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

    minimizeWindow(): void;
    maximizeWindow(): void;
    closeWindow(): void;

    onLaunchStatus(callback: (status: string) => void): () => void;
    onLaunchProgress(callback: (progress: any) => void): () => void;
    onLauncherLog(callback: (log: string) => void): () => void;
    onGameStarted(callback: () => void): () => void;
    onGameClosed(callback: (code: number) => void): () => void;
  };
}

/// <reference types="vite/client" />

interface AccountInfo {
  username: string;
  uuid: string;
  token: string;
  type: 'offline' | 'microsoft';
  avatar: string;
  refreshToken?: string;
  expiresAt?: number;
  xuid?: string;
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

type ImportSourceId = 'ogulniega' | 'dawn' | 'modrinth' | 'lunar';

interface ImportableProfile {
  key: string;
  name: string;
  version: string | null;
  mods: number;
  worlds: string[];
  resourcePacks: number;
  hasOptions: boolean;
  hasServers: boolean;
}

interface ImportSource {
  id: ImportSourceId;
  name: string;
  found: boolean;
  profiles: ImportableProfile[];
}

interface ImportOptions {
  name: string;
  version: string;
  mods: boolean;
  worlds: boolean;
  servers: boolean;
  options: boolean;
  resourcePacks: boolean;
}

type UpdateStatus =
  | { state: 'idle' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string };

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

    // Import from other launchers
    listImportSources(): Promise<ImportSource[]>;
    importProfile(sourceId: ImportSourceId, key: string, options: ImportOptions): Promise<LauncherConfig>;

    // Launcher updates
    getAppVersion(): Promise<string>;
    getUpdateStatus(): Promise<UpdateStatus>;
    installUpdate(): void;
    onUpdateStatus(callback: (status: UpdateStatus) => void): () => void;

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

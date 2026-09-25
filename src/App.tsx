import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './views/HomeView';
import { SettingsView } from './views/SettingsView';
import { AccountsView } from './views/AccountsView';
import { ProfilesView } from './views/ProfilesView';
import { ProfileDetailView } from './views/ProfileDetailView';
import { ModsView } from './views/ModsView';
import { ConsoleView } from './views/ConsoleView';
import { FirstRunSetup } from './components/FirstRunSetup';
import { LoginModal } from './components/LoginModal';
import logoIcon from './assets/logo.png';

export const App: React.FC = () => {
  // Config state
  const [config, setConfig] = useState<LauncherConfig | null>(null);

  // Navigation & Modal states
  const [activeTab, setActiveTab] = useState<'home' | 'accounts' | 'settings' | 'profiles' | 'mods'>('home');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [profileDetailId, setProfileDetailId] = useState<string | null>(null);
  const [profileDetailTab, setProfileDetailTab] = useState<'mods' | 'settings'>('mods');

  // Version states
  const [versions, setVersions] = useState<string[]>([]);
  const [latestLoader, setLatestLoader] = useState('0.16.10');
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Game execution states
  const [isLaunching, setIsLaunching] = useState(false);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [launchStatus, setLaunchStatus] = useState('');
  const [launchProgress, setLaunchProgress] = useState<{
    type: string;
    percentage: number;
    task: number;
    total: number;
  } | null>(null);

  // Logs console state (the console is a full page shown over the current tab)
  const [logs, setLogs] = useState<string[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);

  // Derive active profile and selected version
  const activeProfile = config?.profiles?.find(p => p.id === config?.activeProfileId) || null;
  const selectedVersion = activeProfile?.version || (versions.length > 0 ? versions[0] : '');

  const handleSetActiveTab = (tab: 'home' | 'accounts' | 'settings' | 'profiles' | 'mods') => {
    setConsoleOpen(false);
    setActiveTab(tab);
  };

  // Load config & versions on mount
  useEffect(() => {
    async function init() {
      try {
        let localConfig = await window.electronAPI.getConfig();
        // Existing installs that already have an account and a profile don't need the first-run setup
        if (!localConfig.setupCompleted && localConfig.savedAccounts?.length > 0 && localConfig.profiles?.length > 0) {
          localConfig = await window.electronAPI.saveConfig({ ...localConfig, setupCompleted: true });
        }
        setConfig(localConfig);

        // Fetch Fabric versions
        const versionData = await window.electronAPI.fetchVersions();
        setVersions(versionData.versions);
        setLatestLoader(versionData.latestLoader);
      } catch (e: any) {
        console.error(e);
        setFetchError('Nie udało się połączyć z API Fabric. Sprawdź połączenie z internetem.');
      } finally {
        setLoadingVersions(false);
      }
    }

    init();
  }, []);

  // Listen to IPC launch events
  useEffect(() => {
    const removeLaunchStatus = window.electronAPI.onLaunchStatus((status) => {
      setLaunchStatus(status);
    });

    const removeLaunchProgress = window.electronAPI.onLaunchProgress((progress) => {
      setLaunchProgress(progress);
    });

    const removeLauncherLog = window.electronAPI.onLauncherLog((log) => {
      // Limit logs array size to prevent performance lag
      setLogs((prev) => [...prev, log].slice(-500));
    });

    const removeGameStarted = window.electronAPI.onGameStarted(() => {
      setIsGameRunning(true);
      setIsLaunching(false);
      setLaunchStatus('Gra uruchomiona pomyślnie!');
      setLaunchProgress(null);
    });

    const removeGameClosed = window.electronAPI.onGameClosed((code) => {
      setIsGameRunning(false);
      setIsLaunching(false);
      setLaunchStatus('');
      setLaunchProgress(null);
      setLogs((prev) => [...prev, `[INFO] Minecraft process exited with code ${code}.`]);
    });

    return () => {
      removeLaunchStatus();
      removeLaunchProgress();
      removeLauncherLog();
      removeGameStarted();
      removeGameClosed();
    };
  }, []);

  // Save config wrapper
  const handleSaveConfig = async (newConfig: LauncherConfig) => {
    try {
      const saved = await window.electronAPI.saveConfig(newConfig);
      setConfig(saved);
    } catch (e) {
      console.error('Failed to save config', e);
    }
  };

  // Login wrappers
  const handleLoginOffline = async (username: string) => {
    await window.electronAPI.loginOffline(username);
    const updated = await window.electronAPI.getConfig();
    setConfig(updated);
  };

  const handleLoginMicrosoft = async () => {
    await window.electronAPI.loginMicrosoft();
    const updated = await window.electronAPI.getConfig();
    setConfig(updated);
  };

  const handleSwitchAccount = async (account: AccountInfo) => {
    if (!config) return;
    const updated = await window.electronAPI.saveConfig({ ...config, account });
    setConfig(updated);
  };

  const handleSetActiveProfile = async (id: string) => {
    if (!config) return;
    const profile = config.profiles.find(p => p.id === id);
    let account = config.account;
    if (profile?.accountUuid) {
      const acc = config.savedAccounts.find(a => a.uuid === profile.accountUuid);
      if (acc) account = acc;
    }
    const updated = await window.electronAPI.saveConfig({ ...config, activeProfileId: id, account });
    setConfig(updated);
  };

  const handleLogout = () => {
    if (config) {
      const updatedConfig = { ...config, account: null };
      handleSaveConfig(updatedConfig);
    }
  };

  // Game Launch trigger
  const handleLaunch = async () => {
    // Playing needs a profile
    if (!activeProfile?.version) return;
    const version = activeProfile.version;
    setIsLaunching(true);
    setLogs([]); // Reset logs console
    setConsoleOpen(true); // Show the console page on launch

    try {
      await window.electronAPI.launchGame(version);
    } catch (e) {
      setIsLaunching(false);
      throw e;
    }
  };

  if (config === null || loadingVersions) {
    return (
      <div className="app-loading-screen">
        <div className="loading-logo-container">
          <img src={logoIcon} className="loading-logo-icon" alt="NexoClient Icon" />
          <div className="loading-spinner-bar">
            <div className="loading-spinner-fill"></div>
          </div>
          <div className="loading-text">Ładowanie profili i wersji Fabric...</div>
        </div>
        <style>{`
          .app-loading-screen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: #070a13;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
          }
          .loading-logo-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 24px;
          }
          .loading-logo-icon {
            width: 72px;
            height: 72px;
            animation: pulse-glow-icon 2s infinite ease-in-out;
          }
          .loading-spinner-bar {
            width: 180px;
            height: 3px;
            background: rgba(255, 255, 255, 0.06);
            border-radius: 2px;
            overflow: hidden;
            margin-top: 8px;
          }
          .loading-spinner-fill {
            height: 100%;
            width: 50%;
            background: linear-gradient(90deg, #4ade80, #3b82f6);
            border-radius: 2px;
            animation: loading-shimmer-bar 1.5s infinite ease-in-out;
          }
          .loading-text {
            font-family: 'Outfit', sans-serif;
            color: #64748b;
            font-size: 0.8rem;
            font-weight: 500;
            letter-spacing: 0.5px;
          }
          @keyframes pulse-glow-icon {
            0% { transform: scale(0.95); opacity: 0.8; filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.3)); }
            50% { transform: scale(1.03); opacity: 1; filter: drop-shadow(0 0 20px rgba(59, 130, 246, 0.5)); }
            100% { transform: scale(0.95); opacity: 0.8; filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.3)); }
          }
          @keyframes loading-shimmer-bar {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Background Neon Nebula Glows */}
      <div className="bg-glow-container">
        <div className="bg-glow-orb orb-primary"></div>
        <div className="bg-glow-orb orb-secondary"></div>
        <div className="bg-glow-orb orb-accent"></div>
      </div>

      {/* Main Navbar */}
      <Navbar
        config={config}
        setActiveTab={handleSetActiveTab}
        openLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        onSwitchAccount={handleSwitchAccount}
      />

      <div className="app-body-wrapper">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleSetActiveTab}
        />
        <div className="sidebar-corner-helper" />

        {/* Main Content Area */}
        <main className="app-main-content">
            {consoleOpen && (
              <ConsoleView
                logs={logs}
                clearLogs={() => setLogs([])}
                onBack={() => {
                  setConsoleOpen(false);
                  setActiveTab('home');
                }}
                isLaunching={isLaunching}
                isGameRunning={isGameRunning}
                launchStatus={launchStatus}
                launchProgress={launchProgress}
              />
            )}
            {!consoleOpen && activeTab === 'home' && (
              <HomeView
                config={config}
                versions={versions}
                latestLoader={latestLoader}
                loadingVersions={loadingVersions}
                selectedVersion={selectedVersion}
                activeProfile={activeProfile}
                isLaunching={isLaunching}
                isGameRunning={isGameRunning}
                launchStatus={launchStatus}
                launchProgress={launchProgress}
                onLaunch={handleLaunch}
                openLoginModal={() => setIsLoginModalOpen(true)}
                onOpenConsole={() => setConsoleOpen(true)}
                fetchError={fetchError}
                profiles={config.profiles}
                activeProfileId={config.activeProfileId}
                onSetActiveProfile={handleSetActiveProfile}
                onNavigateToProfiles={() => handleSetActiveTab('profiles')}
              />
            )}
            {!consoleOpen && activeTab === 'accounts' && (
              <AccountsView
                config={config}
                onSaveConfig={handleSaveConfig}
                onLoginOffline={handleLoginOffline}
                onLoginMicrosoft={handleLoginMicrosoft}
              />
            )}
            {!consoleOpen && activeTab === 'settings' && (
              <SettingsView
                config={config}
                onSaveConfig={handleSaveConfig}
              />
            )}
            {!consoleOpen && activeTab === 'profiles' && !profileDetailId && (
              <ProfilesView
                config={config}
                versions={versions}
                loadingVersions={loadingVersions}
                onSaveConfig={handleSaveConfig}
                onNavigateHome={() => setActiveTab('home')}
                onOpenProfile={(id, initialTab = 'mods') => {
                  setProfileDetailId(id);
                  setProfileDetailTab(initialTab);
                }}
                onLaunch={handleLaunch}
              />
            )}
            {!consoleOpen && activeTab === 'profiles' && profileDetailId && (
              <ProfileDetailView
                profileId={profileDetailId}
                config={config}
                versions={versions}
                loadingVersions={loadingVersions}
                onSaveConfig={handleSaveConfig}
                initialTab={profileDetailTab}
                onBack={() => setProfileDetailId(null)}
              />
            )}
            {!consoleOpen && activeTab === 'mods' && (
              <ModsView
                config={config}
                onSaveConfig={handleSaveConfig}
              />
            )}
          </main>
        </div>


      {/* First-run setup: account, then profile */}
      {!config.setupCompleted && (
        <FirstRunSetup
          config={config}
          versions={versions}
          onLoginOffline={handleLoginOffline}
          onLoginMicrosoft={handleLoginMicrosoft}
          onSaveConfig={handleSaveConfig}
        />
      )}

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginOffline={handleLoginOffline}
        onLoginMicrosoft={handleLoginMicrosoft}
      />

      <style>{`
        .app-body-wrapper {
          display: flex;
          flex-direction: row;
          gap: 0;
          flex-grow: 1;
          overflow: hidden;
          height: 100%;
          position: relative;
        }

        .sidebar-corner-helper {
          position: absolute;
          top: -1px;
          left: 71px;
          width: 16px;
          height: 16px;
          background: transparent;
          border-top-left-radius: 12px;
          border-top: 1px solid var(--border-color);
          border-left: 1px solid var(--border-color);
          box-shadow: -16px -16px 0 0 var(--bg-panel);
          pointer-events: none;
          z-index: 10;
        }

        .app-main-content {
          flex-grow: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 1;
          padding: 20px 20px 20px 20px;
        }



      `}</style>
    </div>
  );
};

export default App;

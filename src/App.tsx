import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HomeView } from './views/HomeView';
import { SettingsView } from './views/SettingsView';
import { AccountsView } from './views/AccountsView';
import { ProfilesView } from './views/ProfilesView';
import { SkinsView } from './views/SkinsView';
import { LoginModal } from './components/LoginModal';
import { Server, X } from 'lucide-react';
import { useLanguage } from './context/LanguageContext';
import logoIcon from './assets/logo-icon.png';
import logoNexoclient from './assets/logo-nexoclient.png';

export const App: React.FC = () => {
  const { t } = useLanguage();
  // Config state
  const [config, setConfig] = useState<LauncherConfig | null>(null);

  // Navigation & Modal states
  const [activeTab, setActiveTab] = useState<'home' | 'accounts' | 'settings' | 'profiles' | 'skins'>('home');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

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

  // Logs console state
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Partner servers state
  const [serversModalOpen, setServersModalOpen] = useState(false);

  type ServerStatus = { online: boolean; playersOnline: number; playersMax: number; icon: string | null; loading: boolean; };
  const defaultServerStatus: ServerStatus = { online: false, playersOnline: 0, playersMax: 0, icon: null, loading: true };

  const [partnerServer, setPartnerServer] = useState<ServerStatus>(defaultServerStatus);
  const [server22mc, setServer22mc] = useState<ServerStatus>(defaultServerStatus);
  const [serverBombamc, setServerBombamc] = useState<ServerStatus>(defaultServerStatus);
  const [serverShieldmc, setServerShieldmc] = useState<ServerStatus>(defaultServerStatus);

  const fetchServerStatus = async (host: string, setter: React.Dispatch<React.SetStateAction<ServerStatus>>, active: { value: boolean }) => {
    try {
      const response = await fetch(`https://api.mcstatus.io/v2/status/java/${host}`);
      if (!response.ok) throw new Error('HTTP status ' + response.status);
      const data = await response.json();
      if (!data.online) throw new Error('Offline on primary API');
      if (active.value) setter({ online: true, playersOnline: data.players?.online || 0, playersMax: data.players?.max || 0, icon: data.icon || null, loading: false });
    } catch {
      try {
        const fallbackRes = await fetch(`https://api.mcsrvstat.us/2/${host}`);
        if (!fallbackRes.ok) throw new Error();
        const fallbackData = await fallbackRes.json();
        if (active.value) setter({ online: fallbackData.online, playersOnline: fallbackData.players?.online || 0, playersMax: fallbackData.players?.max || 0, icon: fallbackData.icon || null, loading: false });
      } catch {
        if (active.value) setter(prev => ({ ...prev, loading: false }));
      }
    }
  };

  useEffect(() => {
    const active = { value: true };
    const fetchAll = () => {
      fetchServerStatus('surferhub.pl', setPartnerServer, active);
      fetchServerStatus('22mc.pl', setServer22mc, active);
      fetchServerStatus('bombamc.pl', setServerBombamc, active);
      fetchServerStatus('shieldmc.pl:25565', setServerShieldmc, active);
    };
    fetchAll();
    const intervalId = setInterval(fetchAll, 45000);
    return () => {
      active.value = false;
      clearInterval(intervalId);
    };
  }, []);

  // Derive active profile and selected version
  const activeProfile = config?.profiles?.find(p => p.id === config?.activeProfileId) || null;
  const selectedVersion = activeProfile?.version || (versions.length > 0 ? versions[0] : '');
  const hasProfiles = !!(config?.profiles && config.profiles.length > 0);
  const hasAccount = !!(config?.savedAccounts && config.savedAccounts.length > 0);

  // Force navigate based on onboarding state
  useEffect(() => {
    if (config !== null) {
      if (!hasAccount) {
        setActiveTab('accounts');
      } else if (!hasProfiles) {
        setActiveTab('profiles');
      }
    }
  }, [config, hasAccount, hasProfiles]);

  // Navigation wrapper - blocks leaving based on onboarding state
  const handleSetActiveTab = (tab: 'home' | 'accounts' | 'settings' | 'profiles' | 'skins') => {
    if (!hasAccount && tab !== 'accounts') return;
    if (hasAccount && !hasProfiles && tab !== 'profiles' && tab !== 'accounts') return;
    setActiveTab(tab);
  };

  // Load config & versions on mount
  useEffect(() => {
    async function init() {
      try {
        const localConfig = await window.electronAPI.getConfig();
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

  const handleLogout = () => {
    if (config) {
      const updatedConfig = { ...config, account: null };
      handleSaveConfig(updatedConfig);
    }
  };

  // Game Launch trigger
  const handleLaunch = async () => {
    const version = activeProfile?.version || selectedVersion;
    if (!version) return;
    setIsLaunching(true);
    setLogs([]); // Reset logs console
    setShowLogs(true); // Open console view on launch

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
          <img src={logoNexoclient} className="loading-logo-brand" alt="NexoClient Brand" />
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
          .loading-logo-brand {
            height: 28px;
            opacity: 0.95;
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
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        openLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        onSwitchAccount={handleSwitchAccount}
        hasProfiles={hasProfiles}
        hasAccount={hasAccount}
      />

      {/* Main Content Area */}
      <main className="app-main-content">
        {activeTab === 'home' && (
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
            onNavigateToProfiles={() => handleSetActiveTab('profiles')}
            onSetActiveProfile={async (id) => {
              if (!config) return;
              const profile = config.profiles?.find(p => p.id === id);
              let account = config.account;
              if (profile?.accountUuid) {
                const acc = config.savedAccounts?.find(a => a.uuid === profile.accountUuid);
                if (acc) account = acc;
              }
              await handleSaveConfig({ ...config, activeProfileId: id, account });
            }}
            logs={logs}
            clearLogs={() => setLogs([])}
            showLogs={showLogs}
            setShowLogs={setShowLogs}
            fetchError={fetchError}
            partnerServer={partnerServer}
            server22mc={server22mc}
            serverBombamc={serverBombamc}
            serverShieldmc={serverShieldmc}
            setServersModalOpen={setServersModalOpen}
          />
        )}
        {activeTab === 'accounts' && (
          <AccountsView
            config={config}
            onSaveConfig={handleSaveConfig}
            onLoginOffline={handleLoginOffline}
            onLoginMicrosoft={handleLoginMicrosoft}
            isOnboarding={!hasAccount}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsView
            config={config}
            onSaveConfig={handleSaveConfig}
          />
        )}
        {activeTab === 'profiles' && (
          <ProfilesView
            config={config}
            versions={versions}
            loadingVersions={loadingVersions}
            onSaveConfig={handleSaveConfig}
            onNavigateHome={() => setActiveTab('home')}
            isOnboarding={!hasProfiles}
          />
        )}
        {activeTab === 'skins' && (
          <SkinsView
            config={config}
            onSaveConfig={handleSaveConfig}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-left">
          <span>{t('footer.version')}</span>
        </div>
        <div className="footer-center">
          <span>{t('footer.credits')}</span>
        </div>
        <div className="footer-right">
          <div className="status-indicator online pulsing" />
          <span>{t('footer.status')}</span>
        </div>
      </footer>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginOffline={handleLoginOffline}
        onLoginMicrosoft={handleLoginMicrosoft}
      />

      {/* Partner Servers Modal */}
      {serversModalOpen && (
        <div className="modal-overlay-backdrop" onClick={() => setServersModalOpen(false)}>
          <div className="servers-modal-panel glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Server size={20} className="modal-header-icon" />
                <div className="modal-title-text">
                  <h2>PARTNERZY PROJEKTU</h2>
                  <p>Oficjalna lista wspieranych serwerów partnerskich</p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setServersModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-content">
              <div className="modal-servers-list">

                {/* surferhub Server Card */}
                <div className="modal-server-card">
                  <div className="modal-card-left">
                    <div className="modal-card-logo-container">
                      {partnerServer.loading ? (
                        <div className="server-logo-placeholder loading" />
                      ) : partnerServer.icon ? (
                        <img src={partnerServer.icon} alt="surferhub Logo" className="modal-server-logo" />
                      ) : (
                        <img src="https://api.mcsrvstat.us/icon/surferhub.pl" alt="surferhub Logo" className="modal-server-logo" />
                      )}
                    </div>
                    <div className="modal-card-details">
                      <h3 className="modal-card-name">SURFERHUB</h3>
                      <span className="modal-card-ip" onClick={() => {
                        navigator.clipboard.writeText('surferhub.pl');
                      }} title="Kliknij, aby skopiować IP">
                        SURFERHUB.PL
                      </span>
                    </div>
                  </div>

                  <div className="modal-card-right">
                    <div className="modal-card-status">
                      {partnerServer.loading ? (
                        <span className="status-players loading">Ładowanie statusu...</span>
                      ) : partnerServer.online ? (
                        <div className="modal-status-online-info">
                          <div className="status-indicator online pulsing" />
                          <span className="modal-status-players">
                            ONLINE · <strong style={{ color: '#fff' }}>{partnerServer.playersOnline}</strong> / {partnerServer.playersMax} graczy
                          </span>
                        </div>
                      ) : (
                        <div className="modal-status-online-info offline">
                          <div className="status-indicator offline" />
                          <span className="modal-status-players offline">OFFLINE</span>
                        </div>
                      )}
                    </div>

                    <button className="modal-card-copy-btn" onClick={() => {
                      navigator.clipboard.writeText('surferhub.pl');
                    }}>
                      Skopiuj IP
                    </button>
                  </div>
                </div>

                {/* 22MC Server Card */}
                <div className="modal-server-card">
                  <div className="modal-card-left">
                    <div className="modal-card-logo-container">
                      {server22mc.loading ? (
                        <div className="server-logo-placeholder loading" />
                      ) : server22mc.icon ? (
                        <img src={server22mc.icon} alt="22MC Logo" className="modal-server-logo" />
                      ) : (
                        <img src="https://api.mcsrvstat.us/icon/22mc.pl" alt="22MC Logo" className="modal-server-logo" />
                      )}
                    </div>
                    <div className="modal-card-details">
                      <h3 className="modal-card-name">22MC</h3>
                      <span className="modal-card-ip" onClick={() => navigator.clipboard.writeText('22mc.pl')} title="Kliknij, aby skopiować IP">22mc.pl</span>
                    </div>
                  </div>
                  <div className="modal-card-right">
                    <div className="modal-card-status">
                      {server22mc.loading ? (
                        <span className="status-players loading">Ładowanie statusu...</span>
                      ) : server22mc.online ? (
                        <div className="modal-status-online-info">
                          <div className="status-indicator online pulsing" />
                          <span className="modal-status-players">ONLINE · <strong style={{ color: '#fff' }}>{server22mc.playersOnline}</strong> / {server22mc.playersMax} graczy</span>
                        </div>
                      ) : (
                        <div className="modal-status-online-info offline">
                          <div className="status-indicator offline" />
                          <span className="modal-status-players offline">OFFLINE</span>
                        </div>
                      )}
                    </div>
                    <button className="modal-card-copy-btn" onClick={() => navigator.clipboard.writeText('22mc.pl')}>Skopiuj IP</button>
                  </div>
                </div>

                {/* BombaMC Server Card */}
                <div className="modal-server-card">
                  <div className="modal-card-left">
                    <div className="modal-card-logo-container">
                      {serverBombamc.loading ? (
                        <div className="server-logo-placeholder loading" />
                      ) : serverBombamc.icon ? (
                        <img src={serverBombamc.icon} alt="BombaMC Logo" className="modal-server-logo" />
                      ) : (
                        <img src="https://api.mcsrvstat.us/icon/bombamc.pl" alt="BombaMC Logo" className="modal-server-logo" />
                      )}
                    </div>
                    <div className="modal-card-details">
                      <h3 className="modal-card-name">BombaMC</h3>
                      <span className="modal-card-ip" onClick={() => navigator.clipboard.writeText('bombamc.pl')} title="Kliknij, aby skopiować IP">bombamc.pl</span>
                    </div>
                  </div>
                  <div className="modal-card-right">
                    <div className="modal-card-status">
                      {serverBombamc.loading ? (
                        <span className="status-players loading">Ładowanie statusu...</span>
                      ) : serverBombamc.online ? (
                        <div className="modal-status-online-info">
                          <div className="status-indicator online pulsing" />
                          <span className="modal-status-players">ONLINE · <strong style={{ color: '#fff' }}>{serverBombamc.playersOnline}</strong> / {serverBombamc.playersMax} graczy</span>
                        </div>
                      ) : (
                        <div className="modal-status-online-info offline">
                          <div className="status-indicator offline" />
                          <span className="modal-status-players offline">OFFLINE</span>
                        </div>
                      )}
                    </div>
                    <button className="modal-card-copy-btn" onClick={() => navigator.clipboard.writeText('bombamc.pl')}>Skopiuj IP</button>
                  </div>
                </div>

                {/* ShieldMC Server Card */}
                <div className="modal-server-card">
                  <div className="modal-card-left">
                    <div className="modal-card-logo-container">
                      {serverShieldmc.loading ? (
                        <div className="server-logo-placeholder loading" />
                      ) : serverShieldmc.icon ? (
                        <img src={serverShieldmc.icon} alt="ShieldMC Logo" className="modal-server-logo" />
                      ) : (
                        <img src="https://i.ibb.co/BJ92jpL/logo.png" alt="ShieldMC Logo" className="modal-server-logo" />
                      )}
                    </div>
                    <div className="modal-card-details">
                      <h3 className="modal-card-name">ShieldMC</h3>
                      <span className="modal-card-ip" onClick={() => navigator.clipboard.writeText('shieldmc.pl')} title="Kliknij, aby skopiować IP">shieldmc.pl</span>
                    </div>
                  </div>
                  <div className="modal-card-right">
                    <div className="modal-card-status">
                      {serverShieldmc.loading ? (
                        <span className="status-players loading">Ładowanie statusu...</span>
                      ) : serverShieldmc.online ? (
                        <div className="modal-status-online-info">
                          <div className="status-indicator online pulsing" />
                          <span className="modal-status-players">ONLINE · <strong style={{ color: '#fff' }}>{serverShieldmc.playersOnline}</strong> / {serverShieldmc.playersMax} graczy</span>
                        </div>
                      ) : (
                        <div className="modal-status-online-info offline">
                          <div className="status-indicator offline" />
                          <span className="modal-status-players offline">OFFLINE</span>
                        </div>
                      )}
                    </div>
                    <button className="modal-card-copy-btn" onClick={() => navigator.clipboard.writeText('shieldmc.pl')}>Skopiuj IP</button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .app-main-content {
          flex-grow: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 1;
        }

        .app-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 24px;
          margin-top: 12px;
          margin-left: -20px;
          margin-right: -20px;
          margin-bottom: -20px;
          background: rgba(9, 9, 9, 0.6);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          border-left: none;
          border-right: none;
          border-bottom: none;
          border-radius: 0;
          backdrop-filter: blur(10px);
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 500;
          flex-shrink: 0;
        }

        .footer-left {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          color: var(--text-muted);
        }

        .footer-center {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-weight: 600;
        }

        .footer-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          color: #4ade80;
          font-weight: 600;
        }

        .footer-right .status-indicator {
          width: 5px;
          height: 5px;
        }

        /* Modal Overlay */
        .modal-overlay-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .servers-modal-panel {
          width: 90%;
          max-width: 950px;
          height: 80%;
          max-height: 700px;
          border-radius: 16px !important;
          padding: 32px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.95) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          background: rgba(9, 9, 9, 0.96) !important;
          animation: modal-enter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @keyframes modal-enter {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding-bottom: 16px;
          flex-shrink: 0;
        }

        .modal-title-wrap {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .modal-header-icon {
          color: var(--text-main);
          opacity: 0.8;
        }

        .modal-title-text h2 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.25rem;
          font-weight: 800;
          font-style: italic;
          letter-spacing: 0.04em;
          color: var(--text-main);
        }

        .modal-title-text p {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .modal-close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .modal-close-btn:hover {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .modal-content {
          flex: 1;
          overflow-y: auto;
          margin-top: 20px;
          padding-right: 4px;
        }

        .modal-servers-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 24px;
        }

        .modal-server-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          transition: var(--transition-smooth);
        }

        .modal-server-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .modal-card-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .modal-card-logo-container {
          width: 56px;
          height: 56px;
          border-radius: 10px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .modal-server-logo {
          width: 100%;
          height: 100%;
          object-fit: cover;
          image-rendering: pixelated;
        }

        .server-logo-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.25);
        }

        .server-logo-placeholder.loading {
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%);
          background-size: 200% 100%;
          animation: loading-shimmer 1.5s infinite;
        }

        @keyframes loading-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .modal-card-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .modal-card-name {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--text-main);
          font-family: 'Outfit', sans-serif;
        }

        .modal-card-ip {
          font-size: 0.82rem;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
          width: fit-content;
        }

        .modal-card-ip:hover {
          color: var(--text-main);
          text-decoration: underline;
        }

        .modal-card-right {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .modal-status-online-info {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(34, 197, 94, 0.08);
          border: 1px solid rgba(34, 197, 94, 0.15);
          padding: 6px 14px;
          border-radius: 20px;
        }

        .modal-status-online-info.offline {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.15);
        }

        .modal-status-players {
          font-size: 0.82rem;
          font-weight: 700;
          color: #4ade80;
        }

        .modal-status-players.offline {
          color: #f87171;
        }

        .modal-card-copy-btn {
          background: #ffffff;
          color: #000000;
          border: 1px solid #ffffff;
          font-size: 0.82rem;
          font-weight: 700;
          padding: 8px 18px;
          border-radius: 8px;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .modal-card-copy-btn:hover {
          background: #000000;
          color: #ffffff;
        }

        .status-indicator {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .status-indicator.online {
          background: #4ade80;
          box-shadow: 0 0 6px #4ade80;
        }

        .status-indicator.offline {
          background: #ef4444;
          box-shadow: 0 0 6px #ef4444;
        }

        .pulsing {
          animation: pulse-glow 2s infinite;
        }

        @keyframes pulse-glow {
          0% { opacity: 0.6; }
          50% { opacity: 1; box-shadow: 0 0 8px #4ade80; }
          100% { opacity: 0.6; }
        }

        @media (min-height: 850px) {
          .servers-modal-panel {
            max-width: 1050px;
            height: 75%;
            padding: 40px;
          }
          .modal-title-text h2 {
            font-size: 1.5rem;
          }
          .modal-title-text p {
            font-size: 0.85rem;
          }
          .modal-card-name {
            font-size: 1.3rem;
          }
          .modal-card-ip {
            font-size: 0.9rem;
          }
          .modal-status-players {
            font-size: 0.9rem;
          }
          .modal-card-copy-btn {
            font-size: 0.9rem;
            padding: 10px 22px;
          }
        }
      `}</style>
    </div>
  );
};

export default App;


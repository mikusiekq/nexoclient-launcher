import React, { useState, useEffect, useRef } from 'react';
import { Play, ShieldAlert, Terminal, Layers, ChevronDown, Server, Zap, Compass, Swords, Sparkles, Gamepad2 } from 'lucide-react';
import { LogViewer } from '../components/LogViewer';
import { SkinViewer, WalkingAnimation } from 'skinview3d';
import mcBg from '../assets/mc_bg.png';
import logoIcon from '../assets/logo-icon.png';
import { useLanguage } from '../context/LanguageContext';

const getProfileIcon = (name: string, modSet: string, size = 14) => {
  const n = name.toLowerCase();
  if (modSet === 'optimization' || n.includes('fps') || n.includes('opt') || n.includes('speedrun')) {
    return <Zap size={size} style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.4))' }} />;
  }
  if (n.includes('survival') || n.includes('surv') || n.includes('hardcore')) {
    return <Compass size={size} style={{ color: '#34d399', filter: 'drop-shadow(0 0 4px rgba(52, 211, 153, 0.4))' }} />;
  }
  if (n.includes('pvp') || n.includes('bedwars') || n.includes('wars') || n.includes('combat')) {
    return <Swords size={size} style={{ color: '#f87171', filter: 'drop-shadow(0 0 4px rgba(248, 113, 113, 0.4))' }} />;
  }
  if (n.includes('creative') || n.includes('build')) {
    return <Sparkles size={size} style={{ color: '#38bdf8', filter: 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.4))' }} />;
  }
  return <Gamepad2 size={size} style={{ color: '#c084fc', filter: 'drop-shadow(0 0 4px rgba(192, 132, 252, 0.4))' }} />;
};


interface HomeViewProps {
  config: LauncherConfig | null;
  versions: string[];
  latestLoader: string;
  loadingVersions: boolean;
  selectedVersion: string;
  activeProfile: Profile | null;
  isLaunching: boolean;
  isGameRunning: boolean;
  launchStatus: string;
  launchProgress: { type: string; percentage: number; task: number; total: number } | null;
  onLaunch: () => Promise<void>;
  openLoginModal: () => void;
  onNavigateToProfiles: () => void;
  onSetActiveProfile: (id: string) => void;
  logs: string[];
  clearLogs: () => void;
  showLogs: boolean;
  setShowLogs: (show: boolean) => void;
  fetchError: string | null;
  partnerServer: {
    online: boolean;
    playersOnline: number;
    playersMax: number;
    icon: string | null;
    loading: boolean;
  };
  server22mc: {
    online: boolean;
    playersOnline: number;
    playersMax: number;
    icon: string | null;
    loading: boolean;
  };
  serverBombamc: {
    online: boolean;
    playersOnline: number;
    playersMax: number;
    icon: string | null;
    loading: boolean;
  };
  serverShieldmc: {
    online: boolean;
    playersOnline: number;
    playersMax: number;
    icon: string | null;
    loading: boolean;
  };
  setServersModalOpen: (open: boolean) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  config,
  versions,
  loadingVersions,
  activeProfile,
  isLaunching,
  isGameRunning,
  launchStatus,
  launchProgress,
  onLaunch,
  openLoginModal,
  onNavigateToProfiles,
  onSetActiveProfile,
  logs,
  clearLogs,
  showLogs,
  setShowLogs,
  fetchError,
  partnerServer,
  server22mc,
  serverBombamc,
  serverShieldmc,
  setServersModalOpen,
}) => {
  const { t } = useLanguage();
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [profilePopupOpen, setProfilePopupOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  const profileBtnRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const username = config?.account?.username || null;
  const isLoggedIn = !!config?.account;
  const accountType = config?.account?.type || 'offline';
  const profiles = config?.profiles || [];

  useEffect(() => {
    if (!canvasRef.current) return;
    const skinName = username || 'Steve';
    const skinUrl = `https://minotar.net/skin/${skinName}`;

    if (viewerRef.current) {
      viewerRef.current.dispose();
      viewerRef.current = null;
    }

    let resizeObserver: ResizeObserver | null = null;
    
    // Head target pitch and yaw rotation angles
    let targetHeadYaw = -0.4;
    let targetHeadPitch = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;
      
      // Calculate target rotation relative to body's default rotation (0.4)
      targetHeadYaw = Math.max(-1.0, Math.min(1.0, (deltaX * 0.0025) - 0.4));
      targetHeadPitch = Math.max(-0.6, Math.min(0.6, deltaY * 0.0025));
    };

    document.addEventListener('mousemove', handleMouseMove);

    try {
      const viewer = new SkinViewer({
        canvas: canvasRef.current,
        width: 280,
        height: 320,
        skin: skinUrl,
      });
      viewerRef.current = viewer;
      viewer.controls.enableRotate = true;
      viewer.controls.enableZoom = false;
      viewer.controls.enablePan = false;
      viewer.playerObject.rotation.y = 0.4;

      try {
        const walk = new WalkingAnimation();
        walk.speed = 0.6;
        // Hook into animation to apply head target rotation on each frame
        walk.addAnimation((player) => {
          player.skin.head.rotation.y = targetHeadYaw;
          player.skin.head.rotation.x = targetHeadPitch;
        });
        viewer.animation = walk;
      } catch (_) {}

      // Add ResizeObserver to make the skin canvas responsive
      if (containerRef.current) {
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              const targetHeight = Math.min(580, height);
              const targetWidth = targetHeight * (280 / 320);
              const finalWidth = Math.min(width, targetWidth);
              const finalHeight = finalWidth * (320 / 280);
              viewer.setSize(finalWidth, finalHeight);
            }
          }
        });
        resizeObserver.observe(containerRef.current);
      }
    } catch (e) {
      console.error('Failed to initialize skin viewer:', e);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (viewerRef.current) {
        viewerRef.current.dispose();
        viewerRef.current = null;
      }
    };
  }, [username]);

  const handleLaunchClick = async () => {
    if (!config?.account) {
      openLoginModal();
      return;
    }
    setLaunchError(null);
    try {
      await onLaunch();
    } catch (e: any) {
      setLaunchError(e.message || 'Błąd podczas uruchamiania gry.');
    }
  };

  const getButtonText = () => {
    if (isGameRunning) return t('home.game_running');
    if (isLaunching) return t('home.launching');
    return t('home.play');
  };

  const getProgressLabel = () => {
    if (!launchProgress) return launchStatus;
    const type = launchProgress.type === 'assets' ? 'Asety' : launchProgress.type === 'client' ? 'Klient' : 'Biblioteki';
    return `${type} · ${launchProgress.task}/${launchProgress.total}`;
  };

  return (
    <div className="home-layout animate-fade-in">
      {/* Main Launch Panel */}
      <div className="home-main-panel glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Full panel background */}
        <img src={mcBg} alt="" className="panel-full-bg" />
        <div className="panel-full-bg-overlay" />

        {/* Top bar - 3 columns */}
        <div className="panel-top-bar">
          {/* LEFT: profile + version */}
          <div className="topbar-left">
            {activeProfile ? (
              <>
                <div className="topbar-profile-name">{getProfileIcon(activeProfile.name, activeProfile.modSet, 12)} <span style={{ marginLeft: '4px' }}>{activeProfile.name}</span></div>
                <div className="topbar-version">{activeProfile.version} · {activeProfile.modSet === 'optimization' ? '⚡ Opt' : '◇ Vanilla'}</div>
              </>
            ) : (
              <div className="topbar-no-profile">{t('home.no_profile_active')}</div>
            )}
          </div>

          {/* CENTER: username + badge */}
          <div className="topbar-center">
            <h2 className="display-username">{username || 'Gość'}</h2>
            {isLoggedIn && (
              <span className={`online-badge ${accountType}`}>
                {accountType === 'microsoft' ? 'Premium' : 'Offline'}
              </span>
            )}
          </div>

          {/* RIGHT: quick links */}
          <div className="quick-links">
            <button className="quick-link-btn" onClick={() => setShowLogs(!showLogs)}>
              <Terminal size={14} />
              <span>Console</span>
            </button>

            {/* Profile button with popup */}
            <div className="profile-btn-wrap">
              <button
                ref={profileBtnRef}
                className={`quick-link-btn profile-quick-btn ${profilePopupOpen ? 'active' : ''}`}
                onClick={() => setProfilePopupOpen(!profilePopupOpen)}
              >
                {activeProfile ? getProfileIcon(activeProfile.name, activeProfile.modSet, 13) : <Layers size={13} />}
                <span>{activeProfile ? activeProfile.name : 'Profile'}</span>
                <ChevronDown size={11} className={`btn-chevron ${profilePopupOpen ? 'rotate' : ''}`} />
              </button>

              {profilePopupOpen && (
                <>
                  <div className="popup-overlay" onClick={() => setProfilePopupOpen(false)} />
                  <div className="profile-popup glass-panel animate-fade-in">
                    {activeProfile ? (
                      <>
                        <div className="popup-section-label">AKTYWNY PROFIL</div>
                        <div className="popup-active-profile">
                          <div className="popup-profile-icon">{getProfileIcon(activeProfile.name, activeProfile.modSet, 15)}</div>
                          <div className="popup-profile-info">
                            <div className="popup-profile-name">{activeProfile.name}</div>
                            <div className="popup-profile-sub">{activeProfile.version} · {activeProfile.modSet === 'optimization' ? '⚡ Optymalizacja' : '◇ Vanilla'}</div>
                          </div>
                        </div>

                        {profiles.length > 1 && (
                          <>
                            <div className="popup-divider" />
                            <div className="popup-section-label">INNE PROFILE</div>
                            {profiles.filter(p => p.id !== activeProfile.id).map(p => (
                              <button
                                key={p.id}
                                className="popup-profile-item"
                                onClick={() => { onSetActiveProfile(p.id); setProfilePopupOpen(false); }}
                              >
                                {getProfileIcon(p.name, p.modSet, 12)}
                                <div className="popup-pitem-info" style={{ marginLeft: '4px' }}>
                                  <span className="popup-pitem-name">{p.name}</span>
                                  <span className="popup-pitem-ver">{p.version}</span>
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                        <div className="popup-divider" />
                      </>
                    ) : (
                      <div className="popup-no-profile">{t('home.no_profile_active')}</div>
                    )}
                    <button className="popup-manage-btn" onClick={() => { setProfilePopupOpen(false); onNavigateToProfiles(); }}>
                      <Layers size={13} />
                      <span>{t('nav.profiles')}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 3D Skin viewer */}
        <div ref={containerRef} className="skin-scene-container">
          <canvas ref={canvasRef} className="skin-canvas" />
        </div>

        {/* Errors */}
        {fetchError && (
          <div className="alert-card alert-error">
            <ShieldAlert size={15} />
            <span>{fetchError}</span>
          </div>
        )}
        {launchError && (
          <div className="alert-card alert-error">
            <ShieldAlert size={15} />
            <span>{launchError}</span>
          </div>
        )}

        {/* ===== PLAY BUTTON ===== */}
        <button
          className="play-button"
          onClick={handleLaunchClick}
          disabled={isLaunching || isGameRunning || loadingVersions || versions.length === 0}
        >
          <Play size={16} fill="currentColor" />
          <span>{getButtonText()}</span>
        </button>

        {/* ===== PROGRESS SECTION ===== */}
        {isLaunching && (
          <div className="progress-section animate-fade-in">
            <div className="progress-status-row">
              <img src={logoIcon} className="progress-spin-icon" alt="" style={{ width: '13px', height: '13px', objectFit: 'contain' }} />
              <span className="progress-status-text">{launchStatus || 'Inicjalizacja...'}</span>
              {launchProgress && <span className="progress-pct">{launchProgress.percentage}%</span>}
            </div>
            {launchProgress && (
              <>
                <div className="progress-bar-wrap">
                  <div className="progress-bar-fill" style={{ width: `${launchProgress.percentage}%` }} />
                  <div className="progress-bar-glow" style={{ left: `${launchProgress.percentage}%` }} />
                </div>
                <div className="progress-detail">{getProgressLabel()}</div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Partner Servers Panel */}
      <div className="home-servers-panel glass-panel animate-fade-in">
        <div className="servers-page-header">
          <div className="servers-header-icon">
            <Server size={18} />
          </div>
          <div className="servers-header-left">
            <h3 className="servers-title">{t('home.partners')}</h3>
            <span className="servers-subtitle">{t('home.partners')}</span>
          </div>
          <button className="servers-view-all-btn" onClick={() => setServersModalOpen(true)}>
            {t('home.server_status')}
          </button>
        </div>

        <div className="servers-list">
          <div className="server-item">
            <div className="server-logo-container">
              {partnerServer.loading ? (
                <div className="server-logo-placeholder loading" />
              ) : partnerServer.icon ? (
                <img src={partnerServer.icon} alt="surferhub Logo" className="server-logo" />
              ) : (
                <img src="https://api.mcsrvstat.us/icon/surferhub.pl" alt="surferhub Logo" className="server-logo" />
              )}
            </div>
            
            <div className="server-details">
              <span className="server-name">SURFERHUB</span>
              <span className="server-ip">surferhub.pl</span>
            </div>

            <div className="server-status">
              {partnerServer.loading ? (
                <span className="status-players loading">...</span>
              ) : partnerServer.online ? (
                <div className="status-online-info">
                  <div className="status-indicator online pulsing" />
                  <span className="status-players">{partnerServer.playersOnline} <span className="players-label">{t('home.players').toLowerCase()}</span></span>
                </div>
              ) : (
                <div className="status-online-info">
                  <div className="status-indicator offline" />
                  <span className="status-players offline">Offline</span>
                </div>
              )}
            </div>
          </div>

          {/* 22MC */}
          <div className="server-item">
            <div className="server-logo-container">
              {server22mc.loading ? (
                <div className="server-logo-placeholder loading" />
              ) : server22mc.icon ? (
                <img src={server22mc.icon} alt="22MC Logo" className="server-logo" />
              ) : (
                <img src="https://api.mcsrvstat.us/icon/22mc.pl" alt="22MC Logo" className="server-logo" />
              )}
            </div>
            <div className="server-details">
              <span className="server-name">22MC</span>
              <span className="server-ip">22mc.pl</span>
            </div>
            <div className="server-status">
              {server22mc.loading ? (
                <span className="status-players loading">...</span>
              ) : server22mc.online ? (
                <div className="status-online-info">
                  <div className="status-indicator online pulsing" />
                  <span className="status-players">{server22mc.playersOnline} <span className="players-label">{t('home.players').toLowerCase()}</span></span>
                </div>
              ) : (
                <div className="status-online-info">
                  <div className="status-indicator offline" />
                  <span className="status-players offline">Offline</span>
                </div>
              )}
            </div>
          </div>

          {/* BombaMC */}
          <div className="server-item">
            <div className="server-logo-container">
              {serverBombamc.loading ? (
                <div className="server-logo-placeholder loading" />
              ) : serverBombamc.icon ? (
                <img src={serverBombamc.icon} alt="BombaMC Logo" className="server-logo" />
              ) : (
                <img src="https://api.mcsrvstat.us/icon/bombamc.pl" alt="BombaMC Logo" className="server-logo" />
              )}
            </div>
            <div className="server-details">
              <span className="server-name">BombaMC</span>
              <span className="server-ip">bombamc.pl</span>
            </div>
            <div className="server-status">
              {serverBombamc.loading ? (
                <span className="status-players loading">...</span>
              ) : serverBombamc.online ? (
                <div className="status-online-info">
                  <div className="status-indicator online pulsing" />
                  <span className="status-players">{serverBombamc.playersOnline} <span className="players-label">{t('home.players').toLowerCase()}</span></span>
                </div>
              ) : (
                <div className="status-online-info">
                  <div className="status-indicator offline" />
                  <span className="status-players offline">Offline</span>
                </div>
              )}
            </div>
          </div>

          {/* ShieldMC */}
          <div className="server-item">
            <div className="server-logo-container">
              {serverShieldmc.loading ? (
                <div className="server-logo-placeholder loading" />
              ) : serverShieldmc.icon ? (
                <img src={serverShieldmc.icon} alt="ShieldMC Logo" className="server-logo" />
              ) : (
                <img src="https://i.ibb.co/BJ92jpL/logo.png" alt="ShieldMC Logo" className="server-logo" />
              )}
            </div>
            <div className="server-details">
              <span className="server-name">ShieldMC</span>
              <span className="server-ip">shieldmc.pl</span>
            </div>
            <div className="server-status">
              {serverShieldmc.loading ? (
                <span className="status-players loading">...</span>
              ) : serverShieldmc.online ? (
                <div className="status-online-info">
                  <div className="status-indicator online pulsing" />
                  <span className="status-players">{serverShieldmc.playersOnline} <span className="players-label">{t('home.players').toLowerCase()}</span></span>
                </div>
              ) : (
                <div className="status-online-info">
                  <div className="status-indicator offline" />
                  <span className="status-players offline">Offline</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Console overlay */}
      {showLogs && (
        <div className="console-overlay-backdrop" onClick={() => setShowLogs(false)}>
          <div className="console-overlay-panel glass-panel animate-fade-in" onClick={e => e.stopPropagation()}>
            <LogViewer logs={logs} clearLogs={clearLogs} showLogs={showLogs} setShowLogs={setShowLogs} />
          </div>
        </div>
      )}



      <style>{`
        /* Full panel background image */
        .panel-full-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
          opacity: 0.45;
          pointer-events: none;
        }

        .panel-full-bg-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.7) 100%);
          z-index: 1;
          pointer-events: none;
        }

        .home-main-panel > *:not(.panel-full-bg):not(.panel-full-bg-overlay) {
          position: relative;
          z-index: 2;
        }

        .home-layout {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          height: 100%;
          overflow: hidden;
        }

        .home-main-panel {
          display: flex;
          flex-direction: column;
          padding: 20px 24px 20px;
          width: 55%;
          min-width: 700px;
          max-width: 1200px;
          height: 80%;
          max-height: 800px;
          overflow: hidden;
          position: relative;
        }

        .home-servers-panel {
          display: flex;
          flex-direction: column;
          padding: 16px 20px;
          width: 300px;
          height: 80%;
          max-height: 800px;
          overflow: hidden;
          position: relative;
        }

        .servers-page-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          flex-shrink: 0;
        }

        .servers-header-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-main);
          flex-shrink: 0;
        }

        .servers-header-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .servers-title {
          font-family: 'Outfit', sans-serif;
          font-size: 0.95rem;
          font-weight: 800;
          font-style: italic;
          letter-spacing: 0.06em;
          color: var(--text-main);
        }

        .servers-subtitle {
          font-size: 0.65rem;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .servers-list {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 16px;
          overflow-y: auto;
        }

        .server-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          transition: var(--transition-smooth);
        }

        .server-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .servers-view-all-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
          font-size: 0.65rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: var(--transition-fast);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .servers-view-all-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-main);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .server-logo-default-avatar {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
          color: #ffffff;
          font-weight: 800;
          font-family: 'Outfit', sans-serif;
          font-size: 1.1rem;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }



        .server-logo-container {
          width: 38px;
          height: 38px;
          border-radius: 6px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .server-logo {
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

        .placeholder-icon {
          opacity: 0.35;
        }

        .server-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .server-name {
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .server-ip {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 500;
          margin-top: 1px;
        }

        .server-status {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .status-online-info {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(34, 197, 94, 0.08);
          border: 1px solid rgba(34, 197, 94, 0.15);
          padding: 3px 8px;
          border-radius: 12px;
          transition: var(--transition-fast);
        }

        .status-online-info:hover {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.25);
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

        .status-online-info:has(.status-indicator.offline) {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.15);
        }

        .status-online-info:has(.status-indicator.offline):hover {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.25);
        }

        .status-players {
          font-size: 0.72rem;
          font-weight: 700;
          color: #4ade80;
        }

        .status-players.offline {
          color: #f87171;
        }

        .status-players.loading {
          color: var(--text-muted);
          opacity: 0.5;
        }

        .players-label {
          font-size: 0.65rem;
          font-weight: 500;
          opacity: 0.85;
          margin-left: 1px;
        }

        .pulsing {
          animation: pulse-glow 2s infinite;
        }

        @keyframes pulse-glow {
          0% { opacity: 0.6; }
          50% { opacity: 1; box-shadow: 0 0 8px #4ade80; }
          100% { opacity: 0.6; }
        }

        @keyframes loading-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* Top bar - 3 columns */
        .panel-top-bar {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          margin-bottom: 12px;
          z-index: 10;
          position: relative;
          gap: 8px;
        }

        .topbar-left {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .topbar-profile-name {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-main);
        }

        .topbar-version {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .topbar-no-profile {
          font-size: 0.78rem;
          color: var(--text-muted);
          opacity: 0.5;
        }

        .topbar-center {
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
        }

        .display-username {
          font-family: 'Outfit', sans-serif;
          font-size: 1.35rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          white-space: nowrap;
        }

        .online-badge {
          font-size: 0.6rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        .online-badge.microsoft {
          background: rgba(34,197,94,0.15);
          color: #4ade80;
          border: 1px solid rgba(34,197,94,0.3);
        }

        .online-badge.offline {
          background: rgba(255,255,255,0.06);
          color: #a1a1aa;
          border: 1px solid rgba(255,255,255,0.12);
        }

        .quick-links {
          display: flex;
          gap: 6px;
          align-items: center;
          justify-content: flex-end;
        }

        .quick-link-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          font-size: 0.75rem;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .quick-link-btn:hover, .quick-link-btn.active {
          background: rgba(255,255,255,0.08);
          color: var(--text-main);
          border-color: rgba(255,255,255,0.2);
        }

        .btn-chevron {
          color: var(--text-muted);
          transition: transform 0.2s;
          flex-shrink: 0;
        }

        .btn-chevron.rotate { transform: rotate(180deg); }

        /* Profile popup */
        .profile-btn-wrap { position: relative; }

        .popup-overlay {
          position: fixed;
          inset: 0;
          z-index: 98;
        }

        .profile-popup {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          width: 240px;
          border-radius: 10px;
          padding: 8px;
          z-index: 99;
          box-shadow: 0 12px 40px rgba(0,0,0,0.9) !important;
          border-color: rgba(255,255,255,0.1) !important;
        }

        .popup-section-label {
          font-size: 0.58rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.08em;
          padding: 4px 8px 6px;
          opacity: 0.6;
        }

        .popup-active-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border-radius: 7px;
          background: rgba(255,255,255,0.03);
        }

        .popup-profile-icon {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .popup-profile-info { flex: 1; min-width: 0; }
        .popup-profile-name { font-size: 0.82rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .popup-profile-sub { font-size: 0.62rem; color: var(--text-muted); margin-top: 2px; }

        .popup-divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 6px 0;
        }

        .popup-no-profile {
          font-size: 0.78rem;
          color: var(--text-muted);
          padding: 8px;
          text-align: center;
        }

        .popup-profile-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          background: transparent;
          border: none;
          color: var(--text-muted);
          padding: 6px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: var(--transition-fast);
          text-align: left;
        }

        .popup-profile-item:hover { background: rgba(255,255,255,0.05); color: var(--text-main); }
        .popup-pitem-info { display: flex; flex-direction: column; }
        .popup-pitem-name { font-size: 0.78rem; font-weight: 700; color: var(--text-main); }
        .popup-pitem-ver { font-size: 0.62rem; color: var(--text-muted); }

        .popup-manage-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          background: transparent;
          border: none;
          color: var(--text-muted);
          padding: 7px 8px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.78rem;
          font-weight: 600;
          transition: var(--transition-fast);
        }

        .popup-manage-btn:hover { background: rgba(255,255,255,0.05); color: var(--text-main); }

        /* Skin scene */
        .skin-scene-container {
          flex: 1;
          position: relative;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 10px;
          min-height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .skin-canvas {
          cursor: grab;
          display: block;
        }

        .skin-canvas:active { cursor: grabbing; }

        /* Play button - smaller */
        .play-button {
          width: 100%;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #ffffff;
          color: #000000;
          border: 1px solid #ffffff;
          border-radius: 9px;
          font-size: 0.9rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          cursor: pointer;
          transition: var(--transition-smooth);
          flex-shrink: 0;
        }

        .play-button:hover:not(:disabled) {
          background: #000000;
          color: #ffffff;
          box-shadow: 0 0 14px rgba(255,255,255,0.2);
        }

        .play-button:active:not(:disabled) { transform: scale(0.98); }

        .play-button:disabled {
          background: #161616;
          border-color: #1c1c1c;
          color: #4a4a4a;
          cursor: not-allowed;
        }

        /* Progress section */
        .progress-section {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex-shrink: 0;
        }

        .progress-status-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .progress-spin-icon {
          color: var(--text-muted);
          flex-shrink: 0;
          animation: spin 1.5s linear infinite;
        }

        .progress-status-text {
          flex: 1;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .progress-pct {
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--text-main);
          flex-shrink: 0;
        }

        .progress-bar-wrap {
          position: relative;
          height: 4px;
          border-radius: 4px;
          background: rgba(255,255,255,0.06);
          overflow: visible;
        }

        .progress-bar-fill {
          height: 100%;
          border-radius: 4px;
          background: linear-gradient(90deg, rgba(255,255,255,0.3), rgba(255,255,255,0.9));
          transition: width 0.3s ease-out;
          position: relative;
        }

        .progress-bar-glow {
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%);
          pointer-events: none;
          transition: left 0.3s ease-out;
        }

        .progress-detail {
          font-size: 0.65rem;
          font-weight: 600;
          color: var(--text-muted);
          opacity: 0.7;
        }

        /* Console overlay */
        .console-overlay-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(4px);
          z-index: 200;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 24px;
        }

        .console-overlay-panel {
          width: 100%;
          max-width: 860px;
          border-radius: 14px !important;
          padding: 4px 8px 12px;
          max-height: 55vh;
          display: flex;
          flex-direction: column;
        }

        .console-overlay-panel .log-viewer-container {
          margin-top: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .console-overlay-panel .log-terminal {
          flex: 1;
          height: auto !important;
          max-height: 42vh;
        }

        @media (min-height: 850px) {
          .home-main-panel {
            padding: 30px 36px 30px;
          }
          .display-username {
            font-size: 1.8rem;
          }
          .play-button {
            height: 52px;
            font-size: 1.05rem;
            border-radius: 11px;
          }
          .topbar-profile-name {
            font-size: 0.95rem;
          }
          .topbar-version {
            font-size: 0.8rem;
          }
          .quick-link-btn {
            font-size: 0.85rem;
            padding: 7px 16px;
          }
          .online-badge {
            font-size: 0.7rem;
            padding: 3px 10px;
          }
          .progress-status-text, .progress-pct {
            font-size: 0.85rem;
          }
          .progress-detail {
            font-size: 0.75rem;
          }
          .progress-bar-wrap {
            height: 6px;
          }

          .home-servers-panel {
            padding: 24px 28px;
            width: 350px;
          }
          .servers-title {
            font-size: 1.15rem;
          }
          .servers-subtitle {
            font-size: 0.75rem;
          }
          .server-item {
            padding: 14px 16px;
            gap: 16px;
          }
          .server-logo-container {
            width: 44px;
            height: 44px;
          }
          .server-name {
            font-size: 1rem;
          }
          .server-ip {
            font-size: 0.8rem;
          }
          .status-players {
            font-size: 0.8rem;
          }


        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

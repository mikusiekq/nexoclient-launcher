import React, { useState, useEffect, useRef } from 'react';
import { Play, ShieldAlert, ChevronDown, Layers, Terminal } from 'lucide-react';
import { SkinViewer } from 'skinview3d';
import mcBg from '../assets/mc_bg.png';
import logoIcon from '../assets/logo.png';
import { useLanguage } from '../context/LanguageContext';


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
  onOpenConsole: () => void;
  fetchError: string | null;

  profiles: Profile[];
  activeProfileId: string | null;
  onSetActiveProfile: (id: string) => Promise<void>;
  onNavigateToProfiles: () => void;
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
  onOpenConsole,
  fetchError,

  profiles,
  activeProfileId,
  onSetActiveProfile,
  onNavigateToProfiles,
}) => {
  const { t } = useLanguage();
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const username = config?.account?.username || null;
  const isLoggedIn = !!config?.account;
  const accountType = config?.account?.type || 'offline';

  useEffect(() => {
    if (!canvasRef.current) return;
    const skinName = username || 'Signal_is_lost';
    const skinUrl = `https://minotar.net/skin/${skinName}`;

    if (viewerRef.current) {
      viewerRef.current.dispose();
      viewerRef.current = null;
    }

    let resizeObserver: ResizeObserver | null = null;

    try {
      const viewer = new SkinViewer({
        canvas: canvasRef.current,
        width: 280,
        height: 320,
        skin: skinUrl,
      });
      viewerRef.current = viewer;
      viewer.controls.enableRotate = false;
      viewer.controls.enableZoom = false;
      viewer.controls.enablePan = false;

      viewer.playerObject.rotation.y = 0.4;
      viewer.playerObject.rotation.x = 0.05;
      viewer.playerObject.skin.head.rotation.y = -0.15;
      viewer.playerObject.skin.leftArm.rotation.z = 0.12;
      viewer.playerObject.skin.rightArm.rotation.z = -0.12;
      viewer.playerObject.skin.leftLeg.rotation.z = 0.06;
      viewer.playerObject.skin.rightLeg.rotation.z = -0.06;

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
      resizeObserver?.disconnect();
      if (viewerRef.current) {
        viewerRef.current.dispose();
        viewerRef.current = null;
      }
    };
  }, [username]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const btn = document.querySelector('.profile-card-btn') as HTMLElement | null;
      const popup = document.querySelector('.profile-popup') as HTMLElement | null;
      if (profileDropdownOpen && btn && popup) {
        if (!btn.contains(e.target as Node) && !popup.contains(e.target as Node)) {
          setProfileDropdownOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileDropdownOpen]);

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

  const toggleProfileDropdown = () => setProfileDropdownOpen(v => !v);

  const handleSelectProfile = async (id: string) => {
    await onSetActiveProfile(id);
    setProfileDropdownOpen(false);
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
      {/* Full page background */}
      <img src={mcBg} alt="" className="panel-full-bg" />

      {/* Main Launch Panel */}
      <div className="home-main-panel">

        {/* Top bar - 3 columns */}
        <div className="panel-top-bar">
          {/* LEFT: empty */}
          <div className="topbar-left">
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

          {/* RIGHT: empty */}
          <div className="quick-links">
          </div>
        </div>

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

        {/* ===== PLAY BUTTON + PROFILE SELECTOR ===== */}
        <div className="home-play-row">
          <button
            className="play-button"
            onClick={handleLaunchClick}
            disabled={!activeProfile || isLaunching || isGameRunning || loadingVersions || versions.length === 0}
          >
            <Play size={20} fill="currentColor" className="play-btn-icon" />
            <div className="play-btn-content">
              <span className="play-btn-action">{getButtonText()}</span>
              <span className="play-btn-subtext">
                {activeProfile ? `${activeProfile.name} (${activeProfile.version})` : 'Utwórz profil, aby zagrać'}
              </span>
            </div>
          </button>

          {/* Console button - appears while the game is launching/running */}
          {(isLaunching || isGameRunning) && (
            <button className="console-open-btn animate-fade-in" onClick={onOpenConsole}>
              <Terminal size={18} />
              <span>Konsola</span>
            </button>
          )}

          {/* Profile selector - right of play button */}
          <div className="home-profile-section">
            <div className="profile-btn-wrap">
              <button className="profile-card-btn" onClick={toggleProfileDropdown}>
                {activeProfile ? (
                  <>
                    {(activeProfile as any).icon ? (
                      <img
                        src={`https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21/assets/minecraft/textures/block/${(activeProfile as any).icon}.png`}
                        alt=""
                        className="profile-card-icon"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <img src={logoIcon} alt="" className="profile-card-icon" />
                    )}
                    <div className="profile-card-info">
                      <span className="profile-card-name">{activeProfile.name}</span>
                      <span className="profile-card-meta">{activeProfile.version} · {activeProfile.engine}</span>
                    </div>
                    <ChevronDown size={14} className={`profile-card-chevron ${profileDropdownOpen ? 'rotate' : ''}`} />
                  </>
                ) : (
                  <>
                    <div className="profile-card-icon profile-card-icon--ghost">
                      <Layers size={16} />
                    </div>
                    <span className="profile-card-ghost">Utwórz profil</span>
                  </>
                )}
              </button>
              {profileDropdownOpen && (
                <div className="profile-popup glass-panel">
                  {profiles.length > 0 ? (
                    <>
                      <div className="popup-section-label">Profile</div>
                      {profiles.map(p => (
                        <button
                          key={p.id}
                          className={`popup-profile-item ${p.id === activeProfileId ? 'popup-active' : ''}`}
                          onClick={() => handleSelectProfile(p.id)}
                        >
                          <div className="popup-profile-icon">
                            {(p as any).icon ? (
                              <img
                                src={`https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21/assets/minecraft/textures/block/${(p as any).icon}.png`}
                                alt=""
                                style={{ width: '18px', height: '18px', imageRendering: 'pixelated', borderRadius: '3px' }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <img src={logoIcon} alt="" style={{ width: '18px', height: '18px' }} />
                            )}
                          </div>
                          <div className="popup-pitem-info">
                            <span className="popup-pitem-name">{p.name}</span>
                            <span className="popup-pitem-ver">{p.version} · {p.engine}</span>
                          </div>
                          {p.id === activeProfileId && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6L5 9L10 3" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                      ))}
                      <div className="popup-divider" />
                      <button
                        className="popup-manage-btn"
                        onClick={() => { setProfileDropdownOpen(false); onNavigateToProfiles?.(); }}
                      >
                        <Layers size={14} />
                        <span>Zarządzaj profilami</span>
                      </button>
                    </>
                  ) : (
                    <div className="popup-no-profile">Brak profili — utwórz nowy</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

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

      <style>{`
        /* Full panel background image */
        .panel-full-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
          opacity: 1;
          pointer-events: none;
        }

        .home-layout > *:not(.panel-full-bg) {
          position: relative;
          z-index: 2;
        }

        .home-layout {
          display: flex;
          align-items: stretch;
          justify-content: space-between;
          gap: 0;
          height: calc(100% + 40px);
          width: calc(100% + 40px);
          overflow: hidden;
          position: relative;
          margin: -20px;
        }

        .home-main-panel {
          display: flex;
          flex-direction: column;
          padding: 50px 40px 50px 60px;
          flex-grow: 1;
          height: 100%;
          overflow: hidden;
          position: relative;
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
          gap: 6px;
        }

        .topbar-profile-name {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-main);
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
        .popup-profile-item.popup-active { background: rgba(255,255,255,0.06); }
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

        .skin-canvas { cursor: grab; display: block; }
        .skin-canvas:active { cursor: grabbing; }

        /* Play button + profile section - horizontal row */
        .home-play-row {
          display: flex;
          align-items: stretch;
          gap: 12px;
          width: 100%;
          flex-shrink: 0;
        }

        .home-play-row .play-button {
          flex: 1;
          min-width: 0;
        }

        .home-profile-section {
          flex-shrink: 0;
        }

        /* Profile card button */
        .profile-card-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: var(--text-main);
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          min-height: 56px;
          width: fit-content;
          max-width: 220px;
          overflow: hidden;
          white-space: nowrap;
        }

        .profile-card-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.2);
        }

        .profile-card-btn:active {
          transform: scale(0.98);
        }

        .profile-card-icon {
          width: 28px;
          height: 28px;
          image-rendering: pixelated;
          border-radius: 6px;
          flex-shrink: 0;
        }

        .profile-card-icon--ghost {
          background: rgba(255,255,255,0.06);
          border: 1px dashed rgba(255,255,255,0.15);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }

        .profile-card-info {
          display: flex;
          flex-direction: column;
          text-align: left;
          min-width: 0;
          max-width: 130px;
          overflow: hidden;
        }

        .profile-card-name {
          font-size: 0.82rem;
          font-weight: 800;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .profile-card-meta {
          font-size: 0.65rem;
          color: var(--text-muted);
          opacity: 0.7;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .profile-card-chevron {
          flex-shrink: 0;
          color: var(--text-muted);
          transition: transform 0.2s ease;
        }

        .profile-card-chevron.rotate {
          transform: rotate(180deg);
        }

        .profile-card-ghost {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        /* Profile popup */
        .profile-btn-wrap { position: relative; }

        .profile-popup {
          position: absolute;
          right: 0;
          bottom: calc(100% + 8px);
          top: auto;
          width: 260px;
          border-radius: 12px;
          padding: 8px;
          z-index: 99;
          box-shadow: 0 12px 40px rgba(0,0,0,0.9) !important;
          border-color: rgba(255,255,255,0.1) !important;
        }

        /* Play button - dual line */
        .play-button {
          width: 100%;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: #ffffff;
          color: #000000;
          border: 1px solid #ffffff;
          border-radius: 12px;
          cursor: pointer;
          transition: var(--transition-smooth);
          flex-shrink: 0;
          padding: 8px 24px;
        }

        .play-btn-icon {
          flex-shrink: 0;
        }

        .play-btn-content {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          min-width: 0;
        }

        .play-btn-action {
          font-size: 0.95rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          line-height: 1.15;
        }

        .play-btn-subtext {
          font-size: 0.72rem;
          font-weight: 700;
          color: rgba(0, 0, 0, 0.65);
          margin-top: 1px;
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 220px;
        }

        .play-button:hover:not(:disabled) {
          background: #000000;
          color: #ffffff;
          box-shadow: 0 0 14px rgba(255,255,255,0.2);
        }

        .play-button:hover:not(:disabled) .play-btn-subtext {
          color: rgba(255, 255, 255, 0.6);
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

        /* Console button next to the (then narrower) play button */
        .console-open-btn {
          flex: 0 0 34%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 12px;
          color: var(--text-main);
          font-size: 0.9rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .console-open-btn:hover {
          background: rgba(255,255,255,0.12);
          border-color: rgba(255,255,255,0.3);
        }

        .console-open-btn:active {
          transform: scale(0.98);
        }

        @media (min-height: 850px) {
          .home-main-panel {
            padding: 30px 36px 30px;
          }
          .display-username {
            font-size: 1.8rem;
          }
          .play-button {
            height: 60px;
            border-radius: 12px;
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



        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

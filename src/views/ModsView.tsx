import React, { useState, useEffect } from 'react';
import { Search, Download, Package, Cpu, Check, X, AlertCircle, HelpCircle } from 'lucide-react';

interface ModsViewProps {
  config: LauncherConfig | null;
  onSaveConfig: (config: LauncherConfig) => Promise<void>;
}

interface ModrinthMod {
  project_id: string;
  title: string;
  description: string;
  icon_url?: string;
  downloads?: number;
  author?: string;
  categories?: string[];
}

const MC_BASE = 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21/assets/minecraft/textures/block/';

export const ModsView: React.FC<ModsViewProps> = ({ config }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ModrinthMod[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Selection popup states
  const [activeModForInstall, setActiveModForInstall] = useState<ModrinthMod | null>(null);
  const [installStatus, setInstallStatus] = useState<{ type: 'success' | 'error' | 'loading'; message: string } | null>(null);
  const [installingModId, setInstallingModId] = useState<string | null>(null);

  const profiles = config?.profiles || [];

  // Load popular mods on mount
  useEffect(() => {
    fetchPopularMods();
  }, []);

  const fetchPopularMods = async () => {
    setSearching(true);
    setSearchError(null);
    try {
      const facets = [["project_type:mod"]];
      const res = await fetch(`https://api.modrinth.com/v2/search?limit=15&facets=${encodeURIComponent(JSON.stringify(facets))}`);
      if (!res.ok) throw new Error('Błąd połączenia z Modrinth');
      const data = await res.json();
      setSearchResults(data.hits || []);
    } catch (e: any) {
      setSearchError('Nie udało się pobrać popularnych modów.');
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      fetchPopularMods();
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const facets = [["project_type:mod"]];
      const res = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(searchQuery)}&limit=24&facets=${encodeURIComponent(JSON.stringify(facets))}`);
      if (!res.ok) throw new Error('Błąd połączenia z Modrinth');
      const data = await res.json();
      setSearchResults(data.hits || []);
    } catch (e: any) {
      setSearchError('Błąd podczas wyszukiwania modów.');
    } finally {
      setSearching(false);
    }
  };

  const startInstallFlow = (mod: ModrinthMod) => {
    setActiveModForInstall(mod);
    setInstallStatus(null);
  };

  const installToProfile = async (profile: Profile) => {
    if (!activeModForInstall) return;
    
    setInstallStatus({ type: 'loading', message: `Sprawdzanie kompatybilności dla profilu ${profile.name}...` });
    setInstallingModId(activeModForInstall.project_id);

    try {
      // 1. Check if already installed
      const currentInstalled = await window.electronAPI.getInstalledMods(profile.id);
      if (currentInstalled.some((m: any) => m.projectId === activeModForInstall.project_id)) {
        setInstallStatus({ type: 'error', message: `Ten mod jest już zainstalowany w profilu ${profile.name}!` });
        return;
      }

      // 2. Fetch compatible version from Modrinth
      const loader = 'fabric';
      const version = profile.version;
      
      const queryUrl = `https://api.modrinth.com/v2/project/${activeModForInstall.project_id}/version?loaders=%5B%22${loader}%22%5D&game_versions=%5B%22${version}%22%5D`;
      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error('Nie udało się sprawdzić wersji moda.');
      
      const versionsData = await res.json();
      if (!versionsData || versionsData.length === 0) {
        setInstallStatus({ 
          type: 'error', 
          message: `Brak wersji tego moda dla Fabric ${version} (profil ${profile.name})` 
        });
        return;
      }

      const compatibleVersion = versionsData[0];
      const file = compatibleVersion.files.find((f: any) => f.primary) || compatibleVersion.files[0];
      if (!file) throw new Error('Brak pliku do pobrania w kompatybilnej wersji.');

      setInstallStatus({ type: 'loading', message: `Pobieranie i instalowanie ${activeModForInstall.title}...` });

      // 3. Install
      const success = await window.electronAPI.installProfileMod(
        profile.id,
        activeModForInstall.project_id,
        activeModForInstall.title,
        compatibleVersion.id,
        file.url,
        file.filename,
        activeModForInstall.icon_url
      );

      if (success) {
        setInstallStatus({ type: 'success', message: `Pomyślnie zainstalowano mod ${activeModForInstall.title} w profilu ${profile.name}!` });
        setTimeout(() => {
          setActiveModForInstall(null);
          setInstallStatus(null);
          setInstallingModId(null);
        }, 1800);
      } else {
        throw new Error('Instalacja nie powiodła się.');
      }
    } catch (e: any) {
      console.error(e);
      setInstallStatus({ type: 'error', message: `Błąd instalacji: ${e.message || 'Nieznany błąd'}` });
    }
  };

  return (
    <div className="mods-view animate-fade-in">
      {/* Header */}
      <div className="mods-page-header">
        <div className="mods-header-icon">
          <Package size={22} />
        </div>
        <div className="mods-header-left">
          <h1 className="mods-title">MODY</h1>
          <span className="mods-subtitle">Szukaj i instaluj modyfikacje z bazy Modrinth bezpośrednio do swoich profili</span>
        </div>
      </div>

      {/* Search form */}
      <div className="mods-search-bar-wrapper">
        <form onSubmit={handleSearch} className="mods-search-form">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="custom-input search-input"
              placeholder="Wyszukaj mody (np. Sodium, Zoom, Iris, Litematica, JourneyMap)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button type="submit" className="search-btn-large" disabled={searching}>
            {searching ? <Cpu size={16} className="spin" /> : <span>Szukaj</span>}
          </button>
        </form>

        {/* Quick suggestions */}
        <div className="mods-suggestions">
          <span className="suggest-label">Popularne:</span>
          {['sodium', 'iris', 'xaero', 'zoom', 'modmenu', 'chunky'].map(s => (
            <button
              key={s}
              className="suggest-btn"
              onClick={() => { setSearchQuery(s); setTimeout(() => handleSearch(), 50); }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mods-content">
        {searching && searchResults.length === 0 ? (
          <div className="mods-loading-state">
            <Cpu size={32} className="spin loading-icon" />
            <span>Przeszukiwanie bazy Modrinth...</span>
          </div>
        ) : searchError ? (
          <div className="mods-error-state">
            <AlertCircle size={28} />
            <span>{searchError}</span>
            <button className="retry-btn" onClick={fetchPopularMods}>Spróbuj ponownie</button>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="mods-empty-state">
            <Package size={48} className="empty-icon" />
            <p>Brak wyników</p>
            <span>Nie znaleziono modów pasujących do Twojego zapytania.</span>
          </div>
        ) : (
          <div className="mods-grid">
            {searchResults.map(mod => (
              <div key={mod.project_id} className="mod-card glass-panel animate-fade-in">
                <div className="mod-card-header">
                  {mod.icon_url ? (
                    <img src={mod.icon_url} alt={mod.title} className="mod-icon" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="mod-icon-placeholder"><Package size={20} /></div>
                  )}
                  <div className="mod-card-title-wrap">
                    <h4 className="mod-title-text">{mod.title}</h4>
                    {mod.downloads !== undefined && (
                      <span className="mod-downloads">
                        <Download size={10} />
                        <span>{(mod.downloads / 1000000).toFixed(1)}M</span>
                      </span>
                    )}
                  </div>
                </div>

                <p className="mod-desc-text">{mod.description}</p>

                <div className="mod-card-footer">
                  <div className="mod-categories">
                    {(mod.categories || []).slice(0, 3).map(c => (
                      <span key={c} className="mod-cat-badge">{c}</span>
                    ))}
                  </div>
                  <button 
                    className="mod-install-btn" 
                    onClick={() => startInstallFlow(mod)}
                    disabled={installingModId === mod.project_id}
                  >
                    {installingModId === mod.project_id ? (
                      <>
                        <Cpu size={12} className="spin" />
                        <span>Instalacja...</span>
                      </>
                    ) : (
                      <>
                        <Download size={12} />
                        <span>Zainstaluj</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Install modal — centered fancy */}
      {activeModForInstall && (
        <div className="install-modal-backdrop" onClick={() => installStatus?.type !== 'loading' && setActiveModForInstall(null)}>
          <div className="install-modal-panel animate-fade-in" onClick={e => e.stopPropagation()}>

            {/* Close button */}
            <button
              className="install-modal-close"
              onClick={() => setActiveModForInstall(null)}
              disabled={installStatus?.type === 'loading'}
            >
              <X size={14} />
            </button>

            {/* Hero section */}
            <div className="install-modal-hero">
              <div className="install-hero-glow" />
              <div className="install-hero-icon-wrap">
                {activeModForInstall.icon_url ? (
                  <img src={activeModForInstall.icon_url} alt={activeModForInstall.title} className="install-hero-icon" />
                ) : (
                  <div className="install-hero-icon-placeholder"><Package size={28} /></div>
                )}
              </div>
              <div className="install-hero-info">
                <span className="install-hero-label">Zainstaluj mod</span>
                <h2 className="install-hero-title">{activeModForInstall.title}</h2>
                {activeModForInstall.downloads !== undefined && (
                  <span className="install-hero-downloads">
                    <Download size={11} />
                    {(activeModForInstall.downloads / 1_000_000).toFixed(1)}M pobrań
                  </span>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="install-modal-divider" />

            {/* Body */}
            <div className="install-modal-body">
              {installStatus ? (
                <div className="install-status-center">
                  <div className={`install-status-icon-ring ${
                    installStatus.type === 'loading' ? 'ring-loading' :
                    installStatus.type === 'success' ? 'ring-success' : 'ring-error'
                  }`}>
                    {installStatus.type === 'loading' ? (
                      <Cpu size={32} className="spin status-spinner" />
                    ) : installStatus.type === 'success' ? (
                      <Check size={32} className="status-success-icon" />
                    ) : (
                      <AlertCircle size={32} className="status-error-icon" />
                    )}
                  </div>
                  <p className="install-status-msg">{installStatus.message}</p>
                  {installStatus.type === 'error' && (
                    <button className="install-back-btn" onClick={() => setInstallStatus(null)}>
                      ← Wróć do wyboru profilu
                    </button>
                  )}
                </div>
              ) : profiles.length === 0 ? (
                <div className="install-no-profiles">
                  <HelpCircle size={36} />
                  <p>Brak profili</p>
                  <span>Utwórz profil w zakładce Profile, aby instalować mody.</span>
                </div>
              ) : (
                <div className="install-profiles-list">
                  <p className="install-profiles-label">Wybierz profil do zainstalowania:</p>
                  {profiles.map(profile => {
                    return (
                      <button
                        key={profile.id}
                        className="install-profile-row"
                        onClick={() => installToProfile(profile)}
                      >
                        <div className="ipr-icon">
                          {profile.icon ? (
                            <img
                              src={`${MC_BASE}${profile.icon}.png`}
                              alt=""
                              className="ipr-block-icon"
                              style={{ imageRendering: 'pixelated', width: '22px', height: '22px', borderRadius: '4px' }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : <Cpu size={18} className="prof-icon-zap" />}
                        </div>
                        <div className="ipr-info">
                          <span className="ipr-name">{profile.name}</span>
                          <span className="ipr-meta">{profile.version} · <span className="ipr-engine">{profile.engine}</span></span>
                        </div>
                        <div className="ipr-arrow">
                          <Download size={15} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .mods-view {
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: radial-gradient(circle at 50% -20%, rgba(255, 255, 255, 0.02) 0%, transparent 60%);
        }

        .mods-page-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 24px 32px 18px;
          flex-shrink: 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }

        .mods-header-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01));
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-main);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          flex-shrink: 0;
        }

        .mods-header-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .mods-title {
          font-family: var(--font-display);
          font-size: 1.6rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          color: var(--text-main);
        }

        .mods-subtitle {
          font-size: 0.78rem;
          color: var(--text-muted);
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        .mods-search-bar-wrapper {
          padding: 20px 32px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex-shrink: 0;
        }

        .mods-search-form {
          display: flex;
          gap: 14px;
          align-items: center;
        }

        .search-input-wrapper {
          position: relative;
          flex: 1;
        }

        .search-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          transition: var(--transition-fast);
        }

        .search-input {
          padding-left: 48px !important;
          height: 48px !important;
          font-size: 0.9rem !important;
          border-radius: 12px !important;
          background: rgba(255, 255, 255, 0.02) !important;
          border: 1px solid rgba(255, 255, 255, 0.06) !important;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
          transition: var(--transition-smooth) !important;
        }

        .search-input:focus {
          border-color: rgba(255, 255, 255, 0.25) !important;
          background: rgba(255, 255, 255, 0.04) !important;
          box-shadow: 0 0 15px rgba(255, 255, 255, 0.05), inset 0 2px 4px rgba(0, 0, 0, 0.4) !important;
        }

        .search-input:focus + .search-icon {
          color: var(--text-main);
        }

        .search-btn-large {
          height: 48px;
          padding: 0 28px;
          background: #ffffff;
          color: #000000;
          border: 1px solid #ffffff;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition-smooth);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15);
        }

        .search-btn-large:hover {
          background: #000000;
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.25);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
          transform: translateY(-1px);
        }

        .search-btn-large:active {
          transform: translateY(0);
        }

        .mods-suggestions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          padding-left: 4px;
        }

        .suggest-label {
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .suggest-btn {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 4px 10px;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .suggest-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-main);
          border-color: rgba(255, 255, 255, 0.18);
          transform: translateY(-1px);
        }

        .mods-content {
          flex: 1;
          overflow-y: auto;
          padding: 0 32px 32px;
          display: flex;
          flex-direction: column;
        }

        /* Scrollbar styles */
        .mods-content::-webkit-scrollbar {
          width: 6px;
          display: block !important;
        }
        .mods-content::-webkit-scrollbar-track {
          background: transparent;
        }
        .mods-content::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .mods-content::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .mods-loading-state, .mods-empty-state, .mods-error-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          text-align: center;
          color: var(--text-muted);
          min-height: 300px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px dashed rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 32px;
        }

        .loading-icon {
          color: var(--text-main);
          filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.3));
        }

        .empty-icon {
          opacity: 0.15;
          color: var(--text-main);
        }

        .mods-loading-state span {
          font-size: 0.88rem;
          font-weight: 500;
          color: var(--text-main);
        }

        .mods-error-state span {
          font-size: 0.88rem;
          color: #f87171;
          font-weight: 500;
        }

        .retry-btn {
          margin-top: 8px;
          padding: 8px 18px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: var(--text-main);
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .retry-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .mods-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          width: 100%;
        }

        .mod-card {
          padding: 20px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%);
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s, box-shadow 0.3s;
        }

        .mod-card:hover {
          border-color: rgba(255, 255, 255, 0.16) !important;
          transform: translateY(-4px) scale(1.01);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 255, 255, 0.02);
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
        }

        .mod-card-header {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .mod-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          object-fit: cover;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }

        .mod-icon-placeholder {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }

        .mod-card-title-wrap {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .mod-title-text {
          font-family: 'Outfit', sans-serif;
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--text-main);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: 0.01em;
        }

        .mod-downloads {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.7rem;
          color: #10b981;
          font-weight: 700;
        }

        .mod-desc-text {
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.5;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          height: 36px;
        }

        .mod-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 2px;
          gap: 8px;
        }

        .mod-categories {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          min-width: 0;
        }

        .mod-cat-badge {
          font-size: 0.65rem;
          font-weight: 600;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 5px;
          padding: 2px 6px;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .mod-install-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: var(--text-main);
          font-size: 0.75rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition-fast);
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        }

        .mod-install-btn:hover {
          background: #ffffff;
          color: #000000;
          border-color: #ffffff;
          box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
        }

        /* ===== INSTALL MODAL ===== */
        .install-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: fade-in-backdrop 0.2s ease;
        }

        @keyframes fade-in-backdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .install-modal-panel {
          position: relative;
          width: 100%;
          max-width: 520px;
          border-radius: 24px;
          background: linear-gradient(145deg, rgba(18,18,22,0.98) 0%, rgba(12,12,16,0.99) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow:
            0 40px 80px rgba(0, 0, 0, 0.7),
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 1px 0 rgba(255,255,255,0.06) inset;
          overflow: hidden;
          animation: install-modal-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes install-modal-enter {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }

        .install-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          cursor: pointer;
          z-index: 10;
          transition: var(--transition-fast);
        }
        .install-modal-close:hover { background: rgba(255,255,255,0.1); color: var(--text-main); }
        .install-modal-close:disabled { opacity: 0.3; cursor: not-allowed; }

        /* Hero */
        .install-modal-hero {
          position: relative;
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 32px 32px 28px;
          overflow: hidden;
        }

        .install-hero-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 70%);
          pointer-events: none;
        }

        .install-hero-icon-wrap {
          position: relative;
          flex-shrink: 0;
          width: 72px;
          height: 72px;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.03);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04) inset;
        }

        .install-hero-icon {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .install-hero-icon-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }

        .install-hero-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .install-hero-label {
          font-size: 0.68rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }

        .install-hero-title {
          font-family: 'Outfit', sans-serif;
          font-size: 1.45rem;
          font-weight: 900;
          color: #fff;
          margin: 0;
          line-height: 1.15;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .install-hero-downloads {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .install-modal-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
          margin: 0;
        }

        /* Body */
        .install-modal-body {
          padding: 24px 32px 32px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Profile list */
        .install-profiles-label {
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          margin: 0 0 4px;
        }

        .install-profiles-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .install-profile-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.02);
          cursor: pointer;
          text-align: left;
          transition: transform 0.22s cubic-bezier(0.16,1,0.3,1), border-color 0.22s, background 0.22s, box-shadow 0.22s;
          position: relative;
          overflow: hidden;
        }

        .install-profile-row::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          border-radius: 14px 0 0 14px;
          background: var(--row-accent, rgba(255,255,255,0.15));
          transition: opacity 0.2s;
        }

        .install-profile-row { --row-accent: #3b82f6; }

        .install-profile-row:hover {
          border-color: rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.05);
          transform: translateX(4px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        .ipr-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-main);
          flex-shrink: 0;
        }

        .ipr-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .ipr-name {
          font-family: 'Outfit', sans-serif;
          font-size: 0.9rem;
          font-weight: 800;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ipr-meta {
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        .ipr-engine {
          text-transform: capitalize;
          font-weight: 700;
          color: var(--row-accent);
        }

        .ipr-arrow {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          transition: var(--transition-fast);
          flex-shrink: 0;
        }

        .install-profile-row:hover .ipr-arrow {
          background: #fff;
          color: #000;
          border-color: #fff;
          box-shadow: 0 0 12px rgba(255,255,255,0.25);
        }

        /* Status screen */
        .install-status-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 16px;
          padding: 20px 0 8px;
          animation: install-modal-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .install-status-icon-ring {
          width: 76px;
          height: 76px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .ring-loading {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 0 30px rgba(255,255,255,0.05);
        }

        .ring-success {
          background: rgba(74,222,128,0.07);
          border: 1px solid rgba(74,222,128,0.25);
          box-shadow: 0 0 30px rgba(74,222,128,0.15);
        }

        .ring-error {
          background: rgba(248,113,113,0.07);
          border: 1px solid rgba(248,113,113,0.25);
          box-shadow: 0 0 30px rgba(248,113,113,0.15);
        }

        .status-spinner {
          color: #ffffff;
          filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.4));
        }

        .status-success-icon {
          color: #4ade80;
          filter: drop-shadow(0 0 12px rgba(74, 222, 128, 0.5));
          animation: pop-scale-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .status-error-icon {
          color: #f87171;
          filter: drop-shadow(0 0 12px rgba(248, 113, 113, 0.5));
          animation: pop-scale-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @keyframes pop-scale-in {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .install-status-msg {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-main);
          line-height: 1.6;
          max-width: 340px;
          margin: 0;
        }

        .install-back-btn {
          padding: 9px 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: var(--text-main);
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .install-back-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.2);
          transform: translateY(-1px);
        }

        /* No profiles */
        .install-no-profiles {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 10px;
          padding: 20px 0;
          color: var(--text-muted);
        }

        .install-no-profiles p {
          font-size: 1rem;
          font-weight: 800;
          color: var(--text-main);
          margin: 0;
        }

        .install-no-profiles span {
          font-size: 0.78rem;
          line-height: 1.7;
        }
      `}</style>
    </div>
  );
};

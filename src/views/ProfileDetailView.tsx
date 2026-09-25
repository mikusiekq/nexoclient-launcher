import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Package, Trash2, Cpu, FolderOpen, Tag, Box,
  Settings, Sliders, Flame, Shield, Palette, Gamepad2, Check, X, RefreshCw
} from 'lucide-react';

interface ProfileDetailViewProps {
  profileId: string;
  config: LauncherConfig | null;
  versions: string[];
  loadingVersions: boolean;
  onSaveConfig: (config: LauncherConfig) => Promise<void>;
  initialTab?: 'mods' | 'settings';
  onBack: () => void;
}

const getProfileIcon = (name: string, engine: string, size = 18) => {
  const n = name.toLowerCase();
  if (engine === 'fabric' || engine === 'quilt') return <Cpu size={size} className="prof-icon-zap" />;
  if (engine === 'forge' || engine === 'neoforge') return <Flame size={size} className="prof-icon-swords" />;
  if (n.includes('survival') || n.includes('surv') || n.includes('hardcore')) return <Shield size={size} className="prof-icon-compass" />;
  if (n.includes('creative') || n.includes('build')) return <Palette size={size} className="prof-icon-sparkles" />;
  return <Gamepad2 size={size} className="prof-icon-default" />;
};

const getTheme = (name: string, engine: string) => {
  if (engine === 'fabric' || engine === 'quilt') return { color: '#ffffff', rgb: '255,255,255' };
  if (engine === 'forge' || engine === 'neoforge') return { color: '#f87171', rgb: '248,113,113' };
  const n = name.toLowerCase();
  if (n.includes('survival') || n.includes('hardcore')) return { color: '#34d399', rgb: '52,211,153' };
  if (n.includes('creative') || n.includes('build')) return { color: '#38bdf8', rgb: '56,189,248' };
  return { color: '#c084fc', rgb: '192,132,252' };
};

export const ProfileDetailView: React.FC<ProfileDetailViewProps> = ({
  profileId, config, versions, loadingVersions, onSaveConfig, initialTab, onBack,
}) => {
  const [tab, setTab] = useState<'mods' | 'settings'>(initialTab || 'mods');

  // Settings form state
  const [formName, setFormName] = useState('');
  const [formVersion, setFormVersion] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // Mods state
  const [installedMods, setInstalledMods] = useState<any[]>([]);
  const [loadingMods, setLoadingMods] = useState(true);
  const [uninstallingMap, setUninstallingMap] = useState<Record<string, boolean>>({});
  const [modsError, setModsError] = useState<string | null>(null);

  const profiles = config?.profiles || [];
  const profile = profiles.find(p => p.id === profileId) || null;
  const theme = profile ? getTheme(profile.name, profile.engine) : { color: '#ffffff', rgb: '255,255,255' };

  // Init form from profile
  useEffect(() => {
    if (profile) {
      setFormName(profile.name);
      setFormVersion(profile.version || versions[0] || '');
    }
  }, [profile?.id]);

  // Update tab if initialTab changes
  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab, profileId]);

  // Load mods when switching to mods tab
  const loadMods = async () => {
    if (!profile) return;
    setLoadingMods(true);
    setModsError(null);
    try {
      const mods = await window.electronAPI.getInstalledMods(profile.id);
      setInstalledMods(mods);
    } catch (e: any) {
      setModsError('Nie udało się załadować listy modów.');
    } finally {
      setLoadingMods(false);
    }
  };

  useEffect(() => {
    if (tab === 'mods') loadMods();
  }, [tab, profileId]);

  const handleUninstall = async (projectId: string) => {
    if (!profile) return;
    setUninstallingMap(prev => ({ ...prev, [projectId]: true }));
    try {
      await window.electronAPI.uninstallProfileMod(profile.id, projectId);
      await loadMods();
    } catch (err: any) {
      alert(`Odinstalowanie nie powiodło się: ${err.message}`);
    } finally {
      setUninstallingMap(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleSaveSettings = async () => {
    if (!config || !profile || !formName.trim()) return;
    setSaving(true);
    const updated = profiles.map(p =>
      p.id === profileId
        ? { ...p, name: formName.trim(), version: formVersion, engine: 'fabric' as const }
        : p
    );
    await onSaveConfig({ ...config, profiles: updated });
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  };

  const handleDeleteProfile = async () => {
    if (!config || !profile) return;
    const confirmDelete = window.confirm(`Czy na pewno chcesz usunąć profil "${profile.name}"?`);
    if (!confirmDelete) return;

    const updated = profiles.filter(p => p.id !== profile.id);
    const activeProfileId = config.activeProfileId;
    const newActive = activeProfileId === profile.id ? (updated[0]?.id || null) : (activeProfileId || null);
    await onSaveConfig({ ...config, profiles: updated, activeProfileId: newActive });
    onBack();
  };

  if (!profile) {
    return (
      <div className="pdv-not-found">
        <p>Nie znaleziono profilu.</p>
        <button onClick={onBack} className="pdv-back-btn"><ArrowLeft size={16} /> Wróć</button>
      </div>
    );
  }

  return (
    <div className="pdv-root animate-fade-in">
      {/* Header */}
      <div className="pdv-header">
        <button className="pdv-back-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Profile</span>
        </button>
        <div className="pdv-hero">
          <div className="pdv-icon-wrap">
            {(profile as any).icon ? (
              <img
                src={`https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21/assets/minecraft/textures/block/${(profile as any).icon}.png`}
                alt=""
                className="pdv-block-icon"
                style={{ imageRendering: 'pixelated', width: '48px', height: '48px', borderRadius: '6px' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : getProfileIcon(profile.name, profile.engine, 40)}
          </div>
          <div className="pdv-hero-info">
            <h1 className="pdv-profile-name">{profile.name}</h1>
            <div className="pdv-badges">
              <span className="pdv-badge pdv-badge-ver"><Tag size={10} />{profile.version || '–'}</span>
              <span className="pdv-badge pdv-badge-engine"><Box size={10} /><span style={{ textTransform: 'capitalize' }}>{profile.engine}</span></span>
            </div>
          </div>
          <div className="pdv-hero-actions">
            <button className="pdv-folder-btn" onClick={() => window.electronAPI.openFolder('mods', profile.id)}>
              <FolderOpen size={14} />
              <span>Folder modów</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="pdv-tabs">
          <button
            className={`pdv-tab ${tab === 'mods' ? 'active' : ''}`}
            onClick={() => setTab('mods')}
          >
            <Package size={14} />
            <span>Mody</span>
            {installedMods.length > 0 && <span className="pdv-tab-count">{installedMods.length}</span>}
          </button>
          <button
            className={`pdv-tab ${tab === 'settings' ? 'active' : ''}`}
            onClick={() => setTab('settings')}
          >
            <Sliders size={14} />
            <span>Ustawienia</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="pdv-content">
        {/* ============ MODS TAB ============ */}
        {tab === 'mods' && (
          <div className="pdv-mods-tab">
            <div className="pdv-mods-header">
              <div>
                <h2 className="pdv-section-title">Zainstalowane mody</h2>
                <p className="pdv-section-sub">Mody przypisane do profilu <strong>{profile.name}</strong></p>
              </div>
              <button className="pdv-refresh-btn" onClick={loadMods} disabled={loadingMods}>
                <RefreshCw size={14} className={loadingMods ? 'spin' : ''} />
              </button>
            </div>

            {loadingMods ? (
              <div className="pdv-state-center">
                <Cpu size={28} className="spin" style={{ color: theme.color }} />
                <span>Wczytywanie modów...</span>
              </div>
            ) : modsError ? (
              <div className="pdv-state-center pdv-state-error">
                <X size={28} />
                <span>{modsError}</span>
                <button className="pdv-retry-btn" onClick={loadMods}>Spróbuj ponownie</button>
              </div>
            ) : installedMods.length === 0 ? (
              <div className="pdv-state-center">
                <Package size={48} className="pdv-empty-icon" />
                <p className="pdv-empty-title">Brak zainstalowanych modów</p>
                <span className="pdv-empty-sub">Przejdź do zakładki <strong>Mody</strong> na pasku bocznym, aby wyszukać i zainstalować mody z bazy Modrinth.</span>
              </div>
            ) : (
              <div className="pdv-mods-list">
                {installedMods.map(mod => {
                  const isUninstalling = uninstallingMap[mod.projectId];
                  return (
                    <div key={mod.projectId} className="pdv-mod-item glass-panel">
                      {mod.iconUrl ? (
                        <img src={mod.iconUrl} alt={mod.title} className="pdv-mod-icon" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="pdv-mod-icon-placeholder"><Package size={14} /></div>
                      )}
                      <div className="pdv-mod-info">
                        <span className="pdv-mod-name">{mod.title}</span>
                        <span className="pdv-mod-file">{mod.fileName}</span>
                      </div>
                      <button
                        className="pdv-uninstall-btn"
                        disabled={isUninstalling}
                        onClick={() => handleUninstall(mod.projectId)}
                      >
                        {isUninstalling ? <Cpu size={12} className="spin" /> : <Trash2 size={12} />}
                        <span>{isUninstalling ? 'Usuwanie...' : 'Odinstaluj'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============ SETTINGS TAB ============ */}
        {tab === 'settings' && (
          <div className="pdv-settings-tab">
            <div className="pdv-settings-section">
              <h2 className="pdv-section-title">Ustawienia profilu</h2>
              <p className="pdv-section-sub">Zmień nazwę, wersję Minecraft lub silnik gry</p>
            </div>

            {/* Name */}
            <div className="pdv-form-group">
              <label className="pdv-form-label">Nazwa profilu</label>
              <input
                className="custom-input pdv-input"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Np. Survival, Speedrun..."
                maxLength={32}
              />
            </div>

            {/* Version */}
            <div className="pdv-form-group">
              <label className="pdv-form-label">Wersja Minecraft</label>
              {loadingVersions ? (
                <div className="pdv-versions-loading"><Cpu size={14} className="spin" /><span>Ładowanie wersji...</span></div>
              ) : (
                <div className="pdv-versions-grid">
                  {versions.slice(0, 20).map(v => (
                    <button
                      key={v}
                      className={`pdv-ver-tile ${formVersion === v ? 'selected' : ''}`}
                      onClick={() => setFormVersion(v)}
                    >
                      {formVersion === v && <Check size={10} className="pdv-ver-check" />}
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pdv-settings-footer">
              <button
                className="pdv-save-btn"
                onClick={handleSaveSettings}
                disabled={saving || !formName.trim()}
              >
                {saving ? (
                  <><Cpu size={14} className="spin" /><span>Zapisywanie...</span></>
                ) : savedOk ? (
                  <><Check size={14} /><span>Zapisano!</span></>
                ) : (
                  <><Settings size={14} /><span>Zapisz ustawienia</span></>
                )}
              </button>

              <button
                className="pdv-delete-btn"
                onClick={handleDeleteProfile}
                type="button"
              >
                <Trash2 size={14} />
                <span>Usuń profil</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .pdv-root {
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .pdv-header {
          flex-shrink: 0;
          padding: 16px 28px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          background: transparent;
        }

        .pdv-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          margin-bottom: 16px;
          transition: var(--transition-fast);
        }
        .pdv-back-btn:hover { color: var(--text-main); }

        .pdv-hero {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 20px;
        }

        .pdv-icon-wrap {
          width: 72px;
          height: 72px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .pdv-hero-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pdv-profile-name {
          font-family: var(--font-display);
          font-size: 1.8rem;
          font-weight: 900;
          color: var(--text-main);
          letter-spacing: 0.02em;
          margin: 0;
        }

        .pdv-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .pdv-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
        }

        .pdv-badge-ver {
          background: rgba(96,165,250,0.06);
          border: 1px solid rgba(96,165,250,0.18);
          color: #60a5fa;
        }

        .pdv-badge-engine {
          background: rgba(192, 132, 252, 0.06);
          border: 1px solid rgba(192, 132, 252, 0.2);
          color: #c084fc;
        }



        .pdv-hero-actions {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-shrink: 0;
        }

        .pdv-set-active-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 18px;
          background: var(--theme-color);
          color: #000;
          border: 1px solid var(--theme-color);
          border-radius: 10px;
          font-size: 0.82rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition-smooth);
          box-shadow: 0 4px 14px rgba(var(--theme-rgb), 0.25);
        }

        .pdv-set-active-btn:hover {
          background: transparent;
          color: var(--theme-color);
          border-color: var(--theme-color);
          box-shadow: 0 0 20px rgba(var(--theme-rgb), 0.3);
        }

        .pdv-folder-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 16px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .pdv-folder-btn:hover { background: rgba(255,255,255,0.06); color: var(--text-main); }

        /* Tabs */
        .pdv-tabs {
          display: flex;
          gap: 0;
          padding-top: 4px;
        }

        .pdv-tab {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 11px 20px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-muted);
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: -1px;
          transition: var(--transition-fast);
        }

        .pdv-tab:hover { color: var(--text-main); }
        .pdv-tab.active {
          color: var(--text-main);
          border-bottom-color: var(--theme-color);
        }

        .pdv-tab-count {
          background: rgba(var(--theme-rgb), 0.12);
          border: 1px solid rgba(var(--theme-rgb), 0.2);
          color: var(--theme-color);
          font-size: 0.65rem;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
        }

        /* Content */
        .pdv-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px 28px 32px;
        }

        .pdv-content::-webkit-scrollbar { width: 6px; display: block !important; }
        .pdv-content::-webkit-scrollbar-track { background: transparent; }
        .pdv-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .pdv-content::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }

        /* ======= MODS TAB ======= */
        .pdv-mods-tab {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .pdv-mods-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .pdv-section-title {
          font-family: 'Outfit', sans-serif;
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--text-main);
          margin: 0 0 4px 0;
        }

        .pdv-section-sub {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin: 0;
        }

        .pdv-section-sub strong { color: var(--text-main); }

        .pdv-refresh-btn {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          color: var(--text-muted);
          cursor: pointer;
          flex-shrink: 0;
          transition: var(--transition-fast);
        }
        .pdv-refresh-btn:hover { background: rgba(255,255,255,0.07); color: var(--text-main); }
        .pdv-refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .pdv-state-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 60px 32px;
          text-align: center;
          color: var(--text-muted);
          background: rgba(255,255,255,0.01);
          border: 1px dashed rgba(255,255,255,0.05);
          border-radius: 16px;
          font-size: 0.85rem;
        }

        .pdv-state-error { color: #f87171; }

        .pdv-empty-icon { opacity: 0.12; color: var(--text-main); }
        .pdv-empty-title { font-size: 1rem; font-weight: 700; color: var(--text-main); margin: 0; }
        .pdv-empty-sub { font-size: 0.8rem; line-height: 1.6; max-width: 360px; }
        .pdv-empty-sub strong { color: var(--text-main); }

        .pdv-retry-btn {
          padding: 7px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 7px;
          color: var(--text-main);
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .pdv-retry-btn:hover { background: rgba(255,255,255,0.08); }

        .pdv-mods-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .pdv-mod-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 12px;
          background: rgba(255,255,255,0.015) !important;
          border: 1px solid rgba(255,255,255,0.05) !important;
          transition: var(--transition-fast);
        }

        .pdv-mod-item:hover {
          background: rgba(255,255,255,0.03) !important;
          border-color: rgba(255,255,255,0.1) !important;
        }

        .pdv-mod-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.08);
        }

        .pdv-mod-icon-placeholder {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .pdv-mod-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .pdv-mod-name {
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pdv-mod-file {
          font-size: 0.68rem;
          color: var(--text-muted);
          font-family: monospace;
          opacity: 0.7;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pdv-uninstall-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          background: rgba(239,68,68,0.06);
          border: 1px solid rgba(239,68,68,0.15);
          border-radius: 7px;
          color: #f87171;
          font-size: 0.72rem;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
          transition: var(--transition-fast);
        }

        .pdv-uninstall-btn:hover:not(:disabled) {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.3);
        }

        .pdv-uninstall-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ======= SETTINGS TAB ======= */
        .pdv-settings-tab {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 800px;
        }

        .pdv-settings-section { display: flex; flex-direction: column; gap: 4px; }

        .pdv-form-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .pdv-form-label {
          font-size: 0.72rem;
          font-weight: 800;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .pdv-input {
          max-width: 400px;
        }

        .pdv-versions-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-muted);
          font-size: 0.82rem;
        }

        .pdv-versions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
          gap: 8px;
          max-height: 200px;
          overflow-y: auto;
          padding: 2px;
        }

        .pdv-versions-grid::-webkit-scrollbar { width: 5px; display: block !important; }
        .pdv-versions-grid::-webkit-scrollbar-track { background: transparent; }
        .pdv-versions-grid::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 8px; }

        .pdv-ver-tile {
          position: relative;
          padding: 9px 8px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.02);
          color: var(--text-muted);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .pdv-ver-tile:hover {
          border-color: rgba(255,255,255,0.15);
          color: var(--text-main);
          background: rgba(255,255,255,0.04);
        }

        .pdv-ver-tile.selected {
          border-color: rgba(255,255,255,0.35);
          background: rgba(255,255,255,0.07);
          color: var(--text-main);
          font-weight: 800;
          box-shadow: 0 0 12px rgba(255,255,255,0.06);
        }

        .pdv-ver-check { color: #4ade80; flex-shrink: 0; }

        .pdv-engine-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }

        .pdv-engine-tile {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 76px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.01);
          cursor: pointer;
          transition: border-color 0.25s, background 0.25s, box-shadow 0.25s;
          text-align: center;
          overflow: hidden;
        }

        .pdv-engine-tile:hover {
          border-color: rgba(var(--eng-rgb), 0.35);
          background: rgba(var(--eng-rgb), 0.05);
        }

        .pdv-engine-tile.selected {
          border-color: rgba(var(--eng-rgb), 0.6);
          background: rgba(var(--eng-rgb), 0.09);
          box-shadow: 0 0 14px rgba(var(--eng-rgb), 0.12);
        }

        .pdv-eng-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
          opacity: 0.08;
          transition: opacity 0.25s;
          pointer-events: none;
          z-index: 0;
        }

        .pdv-engine-tile:hover .pdv-eng-bg,
        .pdv-engine-tile.selected .pdv-eng-bg {
          opacity: 0.16;
        }

        .pdv-eng-name {
          position: relative;
          z-index: 1;
          font-family: 'Outfit', sans-serif;
          font-size: 0.8rem;
          font-weight: 800;
          color: var(--eng-color);
          text-shadow: 0 1px 4px rgba(0,0,0,0.6);
        }

        .pdv-eng-check {
          position: absolute;
          top: 6px;
          right: 6px;
          color: var(--eng-color);
          z-index: 2;
        }

        .pdv-settings-footer {
          padding-top: 16px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .pdv-save-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: #ffffff;
          color: #000000;
          border: 1px solid #ffffff;
          border-radius: 10px;
          font-size: 0.88rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition-smooth);
          box-shadow: 0 4px 12px rgba(255,255,255,0.15);
        }

        .pdv-save-btn:hover:not(:disabled) {
          background: #000;
          color: #fff;
          border-color: rgba(255,255,255,0.25);
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }

        .pdv-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .pdv-delete-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 10px;
          color: #f87171;
          font-size: 0.88rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .pdv-delete-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: #ef4444;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
        }

        .pdv-not-found {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 16px;
          color: var(--text-muted);
        }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Profile icon themes */
        .prof-icon-zap { color: #ffffff; filter: drop-shadow(0 0 8px rgba(255,255,255,0.6)); }
        .prof-icon-swords { color: #f87171; filter: drop-shadow(0 0 8px rgba(248,113,113,0.6)); }
        .prof-icon-compass { color: #34d399; filter: drop-shadow(0 0 8px rgba(52,211,153,0.6)); }
        .prof-icon-sparkles { color: #38bdf8; filter: drop-shadow(0 0 8px rgba(56,189,248,0.6)); }
        .prof-icon-default { color: #c084fc; filter: drop-shadow(0 0 8px rgba(192,132,252,0.6)); }
      `}</style>
    </div>
  );
};

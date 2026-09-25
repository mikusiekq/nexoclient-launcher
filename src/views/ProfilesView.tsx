import React, { useState } from 'react';
import {
  Layers, Plus, Check, Cpu, X,
  Tag, Sliders, Box, Gamepad2,
  Shield, Flame, Palette, ChevronRight, ChevronLeft, Play
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const MC_BASE = 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21/assets/minecraft/textures/block/';
const MC_BLOCKS = [
  'grass_block_top','stone','dirt','oak_planks','cobblestone','bricks',
  'diamond_block','gold_block','iron_block','emerald_block','netherite_block',
  'obsidian','crying_obsidian','bedrock','tnt_side','crafting_table_top',
  'furnace_front_on','bookshelf','oak_log_top','sand','gravel','snow',
  'ice','blue_ice','magma','soul_sand','mycelium_top','podzol_top',
  'nether_bricks','deepslate_tiles','ancient_debris_top','amethyst_block',
] as const;



const getProfileIcon = (name: string, engine: string, size = 18) => {
  const n = name.toLowerCase();
  if (engine === 'fabric' || engine === 'quilt') {
    return <Cpu size={size} className="prof-icon-zap" />;
  }
  if (engine === 'forge' || engine === 'neoforge') {
    return <Flame size={size} className="prof-icon-swords" />;
  }
  if (n.includes('survival') || n.includes('surv') || n.includes('hardcore')) {
    return <Shield size={size} className="prof-icon-compass" />;
  }
  if (n.includes('creative') || n.includes('build')) {
    return <Palette size={size} className="prof-icon-sparkles" />;
  }
  return <Gamepad2 size={size} className="prof-icon-default" />;
};


const getProfileTheme = (name: string, engine: string) => {
  const n = name.toLowerCase();
  if (engine === 'fabric' || engine === 'quilt') {
    return 'theme-zap';
  }
  if (engine === 'forge' || engine === 'neoforge') {
    return 'theme-swords';
  }
  if (n.includes('survival') || n.includes('surv') || n.includes('hardcore')) {
    return 'theme-compass';
  }
  if (n.includes('creative') || n.includes('build')) {
    return 'theme-sparkles';
  }
  return 'theme-default';
};


interface ProfilesViewProps {
  config: LauncherConfig | null;
  versions: string[];
  loadingVersions: boolean;
  onSaveConfig: (config: LauncherConfig) => Promise<void>;
  onNavigateHome: () => void;
  onOpenProfile: (id: string, initialTab?: 'mods' | 'settings') => void;
  onLaunch: () => Promise<void>;
}


function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const ProfilesView: React.FC<ProfilesViewProps> = ({
  config,
  versions,
  loadingVersions,
  onSaveConfig,
  onNavigateHome,
  onOpenProfile,
  onLaunch,
}) => {
  const { t } = useLanguage();

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formVersion, setFormVersion] = useState('');
  const [formIcon, setFormIcon] = useState<string>('grass_block_top');

  const [savingStatus, setSavingStatus] = useState<string | null>(null);

  const profiles = config?.profiles || [];
  const savedAccounts = config?.savedAccounts || [];
  const activeProfileId = config?.activeProfileId || null;

  const openCreate = () => {
    setEditingId(null);
    setFormName('Nowy profil');
    setFormVersion(versions[0] || '');
    setFormIcon('grass_block_top');
    setWizardStep(1);
    setBlockPickerOpen(false);
    setWizardOpen(true);
  };



  const closeWizard = () => {
    setWizardOpen(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!config || !formName.trim()) return;

    const targetProfileId = editingId || genId();
    const targetVersion = formVersion || versions[0] || '';

    setSavingStatus('Zapisywanie profilu...');

    if (editingId) {
      const updated = profiles.map(p =>
        p.id === editingId
          ? { ...p, name: formName.trim(), version: formVersion, engine: 'fabric' as const, icon: formIcon }
          : p
      );
      await onSaveConfig({ ...config, profiles: updated });
    } else {
      const newProfile: Profile = {
        id: targetProfileId,
        name: formName.trim(),
        version: targetVersion,
        accountUuid: null,
        engine: 'fabric',
        icon: formIcon,
        createdAt: Date.now(),
      } as any;
      const updated = [...profiles, newProfile];
      const newActive = profiles.length === 0 ? newProfile.id : activeProfileId;
      await onSaveConfig({ ...config, profiles: updated, activeProfileId: newActive });
    }

    setSavingStatus(null);
    closeWizard();
  };



  const handleSetActive = async (id: string) => {
    if (!config) return;
    const profile = profiles.find(p => p.id === id);
    let account = config.account;
    if (profile?.accountUuid) {
      const acc = savedAccounts.find(a => a.uuid === profile.accountUuid);
      if (acc) account = acc;
    }
    await onSaveConfig({ ...config, activeProfileId: id, account });
  };

  const handlePlayProfile = async (id: string) => {
    // 1. Set the profile active
    await handleSetActive(id);
    // 2. Go back to Home tab
    onNavigateHome();
    // 3. Trigger launch
    setTimeout(() => {
      onLaunch();
    }, 50);
  };

  return (
    <div className="profiles-view animate-fade-in">
      {/* Page Header */}
      <div className="profiles-page-header">
        <div className="profiles-header-icon">
          <Layers size={22} />
        </div>
        <div className="profiles-header-left">
          <h1 className="profiles-title">{t('profiles.title')}</h1>
          <span className="profiles-subtitle">{t('profiles.subtitle')}</span>
        </div>
        <button className="create-profile-btn" onClick={openCreate}>
          <Plus size={15} />
          <span>{t('profiles.create_new')}</span>
        </button>
      </div>

      {/* Profiles list */}
      <div className="profiles-content">
        {profiles.length === 0 ? (
          <div className="profiles-empty">
            <Layers size={48} className="empty-icon" />
            <p>Brak profili</p>
            <span>Utworz profil aby zarzadzac wersjami i modami</span>
            <button className="create-profile-btn-empty" onClick={openCreate}>
              <Plus size={14} />
              <span>Utworz pierwszy profil</span>
            </button>
          </div>
        ) : (
          <div className="profiles-list">
            {profiles.map(profile => {
              const theme = getProfileTheme(profile.name, profile.engine);
              return (
                <div key={profile.id} className={`profile-card glass-panel ${theme}`} onClick={() => onOpenProfile(profile.id, 'mods')} style={{ cursor: 'pointer' }}>
                  <div className="profile-card-icon">
                    {(profile as any).icon ? (
                      <img
                        src={`${MC_BASE}${(profile as any).icon}.png`}
                        alt={(profile as any).icon}
                        className="profile-block-icon"
                        style={{ imageRendering: 'pixelated' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : getProfileIcon(profile.name, profile.engine, 36)}
                  </div>

                  <div className="profile-card-info">
                    <div className="profile-card-name">{profile.name}</div>
                    <div className="profile-card-meta">
                      <span className="profile-ver-badge">
                        <Tag size={10} />
                        <span>{profile.version || '–'}</span>
                      </span>
                      <span className="profile-modset-badge">
                        <Box size={10} />
                        <span style={{ textTransform: 'capitalize' }}>{profile.engine}</span>
                      </span>
                    </div>
                  </div>

                  <div className="profile-card-right-actions">
                    <button
                      className="profile-play-btn"
                      onClick={e => {
                        e.stopPropagation();
                        handlePlayProfile(profile.id);
                      }}
                    >
                      <Play size={12} fill="currentColor" />
                      <span>Graj</span>
                    </button>

                    <button
                      className="profile-card-settings-btn"
                      onClick={e => {
                        e.stopPropagation();
                        onOpenProfile(profile.id, 'settings');
                      }}
                      title="Ustawienia profilu"
                    >
                      <Sliders size={13} />
                      <span>Ustawienia</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3-Step Wizard */}
      {wizardOpen && (
        <div className="modal-backdrop" onClick={() => !savingStatus && closeWizard()}>
          <div className="wizard-window glass-panel animate-fade-in" onClick={e => e.stopPropagation()}>
            {savingStatus && (
              <div className="modal-saving-overlay">
                <Cpu size={36} className="spin saving-spinner" />
                <span className="saving-status-text">{savingStatus}</span>
              </div>
            )}

            {/* Wizard Header */}
            <div className="wizard-header">
              <div className="wizard-steps-indicator">
                {[1, 2].map(s => (
                  <div key={s} className={`wizard-step-dot ${wizardStep === s ? 'active' : wizardStep > s ? 'done' : ''}`}>
                    {wizardStep > s ? <Check size={10} /> : s}
                  </div>
                ))}
                <div className="wizard-steps-labels">
                  <span className={wizardStep === 1 ? 'wsl-active' : ''}>Wersja</span>
                  <span className={wizardStep === 2 ? 'wsl-active' : ''}>Profil</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={closeWizard} disabled={!!savingStatus}><X size={16} /></button>
            </div>

            {/* Step 1 — Choose Minecraft Version */}
            {wizardStep === 1 && (
              <div className="wizard-body">
                <div className="wizard-step-title">
                  <h2>Wybierz wersję Minecraft</h2>
                  <p>Kliknij kafelek z wersją gry, która chcesz używać</p>
                </div>
                {loadingVersions ? (
                  <div className="wiz-loading"><Cpu size={20} className="spin" /><span>Ładowanie wersji...</span></div>
                ) : (
                  <div className="wiz-versions-grid">
                    {versions.slice(0, 30).map(v => (
                      <button
                        key={v}
                        className={`wiz-ver-tile ${formVersion === v ? 'selected' : ''}`}
                        onClick={() => setFormVersion(v)}
                      >
                        {formVersion === v && <Check size={10} className="wiz-ver-check" />}
                        <span>{v}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="wizard-footer">
                  <button className="wizard-cancel-btn" onClick={closeWizard}>Anuluj</button>
                  <button
                    className="wizard-next-btn"
                    disabled={!formVersion}
                    onClick={() => setWizardStep(2)}
                  >
                    <span>Dalej</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 — Name + Engine */}
            {wizardStep === 2 && (
              <div className="wizard-body">
                <div className="wizard-step-title">
                  <h2>{editingId ? 'Edytuj profil' : 'Nazwij i skonfiguruj'}</h2>
                  <p>Wpisz nazwę profilu i wybierz ikonę</p>
                </div>

                {/* Icon + Name row */}
                <div className="wiz-form-group">
                  <label className="wiz-label">Ikona i nazwa profilu</label>
                  <div className="wiz-name-row">
                    {/* Block icon picker trigger */}
                    <div className="wiz-icon-picker-wrap">
                      <button
                        className="wiz-icon-btn"
                        type="button"
                        title="Zmień ikonę"
                        onClick={() => setBlockPickerOpen(v => !v)}
                      >
                        <img
                          src={`${MC_BASE}${formIcon}.png`}
                          alt={formIcon}
                          className="wiz-icon-preview"
                          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                        />
                        <span className="wiz-icon-edit-badge">✎</span>
                      </button>
                      {blockPickerOpen && (
                        <div className="wiz-block-picker">
                          <div className="wiz-block-picker-grid">
                            {MC_BLOCKS.map(block => (
                              <button
                                key={block}
                                className={`wiz-block-tile ${formIcon === block ? 'selected' : ''}`}
                                title={block.replace(/_/g, ' ')}
                                onClick={() => { setFormIcon(block); setBlockPickerOpen(false); }}
                              >
                                <img
                                  src={`${MC_BASE}${block}.png`}
                                  alt={block}
                                  className="wiz-block-img"
                                  style={{ imageRendering: 'pixelated' }}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <input
                      className="custom-input wiz-name-input"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="Np. Survival, Speedrun, Mody..."
                      maxLength={32}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="wizard-footer">
                  <button className="wizard-back-btn" onClick={() => { setBlockPickerOpen(false); !editingId && setWizardStep(1); }}>
                    <ChevronLeft size={16} />
                    <span>{editingId ? 'Anuluj' : 'Wstecz'}</span>
                  </button>
                  <button
                    className="wizard-next-btn"
                    disabled={!formName.trim() || !!savingStatus}
                    onClick={() => { setBlockPickerOpen(false); handleSave(); }}
                  >
                    <Check size={15} />
                    <span>{editingId ? 'Zapisz zmiany' : 'Utwórz profil'}</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}


      <style>{`
        .profiles-view {
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .profiles-page-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 20px 24px 16px;
          flex-shrink: 0;
        }

        .profiles-header-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-main);
          flex-shrink: 0;
        }

        .profiles-header-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .profiles-title {
          font-family: var(--font-display);
          font-size: 1.6rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          color: var(--text-main);
        }

        .profiles-subtitle {
          font-size: 0.78rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .create-profile-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: #ffffff;
          color: #000000;
          border: 1px solid #ffffff;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition-smooth);
          flex-shrink: 0;
        }

        .create-profile-btn:hover { background: #000000; color: #ffffff; }

        /* Onboarding */

        /* Content */
        .profiles-content {
          flex: 1;
          overflow-y: auto;
          padding: 0 24px 24px;
          display: flex;
          flex-direction: column;
        }

        .profiles-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--text-muted);
          text-align: center;
          padding: 40px;
          min-height: 300px;
        }

        .profiles-empty .empty-icon { opacity: 0.25; margin-bottom: 12px; }
        .profiles-empty p { font-size: 1rem; font-weight: 700; color: var(--text-main); margin: 0; }
        .profiles-empty span { font-size: 0.82rem; }

        .create-profile-btn-empty {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 16px;
          padding: 10px 24px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          color: var(--text-main);
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .create-profile-btn-empty:hover { background: rgba(255,255,255,0.1); }

        .profiles-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
          max-width: 100%;
        }

        /* Themes custom variables */
        .profile-card.theme-zap {
          --theme-color: #ffffff;
          --theme-color-rgb: 255, 255, 255;
          --theme-glow-color: rgba(255, 255, 255, 0.05);
        }
        .profile-card.theme-compass {
          --theme-color: #34d399;
          --theme-color-rgb: 52, 211, 153;
          --theme-glow-color: rgba(52, 211, 153, 0.05);
        }
        .profile-card.theme-swords {
          --theme-color: #f87171;
          --theme-color-rgb: 248, 113, 113;
          --theme-glow-color: rgba(248, 113, 113, 0.05);
        }
        .profile-card.theme-sparkles {
          --theme-color: #38bdf8;
          --theme-color-rgb: 56, 189, 248;
          --theme-glow-color: rgba(56, 189, 248, 0.05);
        }
        .profile-card.theme-default {
          --theme-color: #c084fc;
          --theme-color-rgb: 192, 132, 252;
          --theme-glow-color: rgba(192, 132, 252, 0.05);
        }

        .profile-card {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 16px 20px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: all 0.22s ease-in-out;
          position: relative;
          overflow: hidden;
        }

        .profile-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(var(--theme-color-rgb), 0.25);
        }

        .profile-card.profile-active {
          border-color: rgba(var(--theme-color-rgb), 0.45);
          background: rgba(var(--theme-color-rgb), 0.07);
        }

        .profile-card-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s ease;
          background: transparent;
          border: none;
        }

        .profile-card-icon svg { transition: transform 0.2s ease; }
        .profile-card:hover .profile-card-icon svg { transform: scale(1.1); }

        .profile-card-icon img {
          width: 42px;
          height: 42px;
          image-rendering: pixelated;
          border-radius: 6px;
        }

        .prof-icon-zap { color: #ffffff; }
        .prof-icon-compass { color: #34d399; }
        .prof-icon-swords { color: #f87171; }
        .prof-icon-sparkles { color: #38bdf8; }
        .prof-icon-default { color: #c084fc; }

        .profile-card-info {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }

        .profile-card-name {
          font-family: 'Outfit', sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .profile-card-meta {
          display: flex;
          gap: 8px;
          margin-top: 4px;
          flex-wrap: wrap;
        }

        .profile-ver-badge, .profile-modset-badge, .profile-acc-badge {
          font-size: 0.68rem;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .profile-ver-badge {
          background: rgba(96, 165, 250, 0.08);
          color: #60a5fa;
          border: 1px solid rgba(96, 165, 250, 0.15);
        }

        .profile-modset-badge {
          background: rgba(192, 132, 252, 0.08);
          color: #c084fc;
          border: 1px solid rgba(192, 132, 252, 0.15);
        }

        .profile-acc-badge {
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-muted);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .profile-card-right-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .profile-card-settings-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          font-weight: 700;
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .profile-card-settings-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          color: var(--text-main);
        }

        .profile-active-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 6px 12px;
          border-radius: 20px;
          color: #4ade80;
          background: rgba(74, 222, 128, 0.1);
          border: 1px solid rgba(74, 222, 128, 0.25);
        }

        .profile-active-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 8px #4ade80;
          animation: active-pulse 1.8s infinite ease-in-out;
        }

        @keyframes active-pulse {
          0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 8px #4ade80; }
          50% { transform: scale(1.25); opacity: 0.7; box-shadow: 0 0 14px #4ade80; }
        }

        .profile-active-dot-marker {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 10px #4ade80;
          margin-right: 4px;
        }

        .profile-play-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
          color: #000000;
          background: var(--theme-color);
          border: 1px solid var(--theme-color);
        }
        .profile-play-btn:hover { background: transparent; color: var(--theme-color); }

        .profile-block-icon {
          width: 32px;
          height: 32px;
          image-rendering: pixelated;
          border-radius: 6px;
        }

        /* ===== MODAL ===== */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(6px);
          z-index: 300;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .modal-window {
          position: relative;
          width: 100%;
          max-width: 520px;
          border-radius: 16px !important;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          max-height: 90vh;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px 0;
          flex-shrink: 0;
        }

        .modal-title {
          font-size: 1rem;
          font-weight: 800;
          color: var(--text-main);
        }

        .modal-close-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .modal-close-btn:hover { color: var(--text-main); background: rgba(255,255,255,0.08); }

        .open-folder-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          color: var(--text-main);
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
          margin-left: auto;
          margin-right: 12px;
        }

        .open-folder-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.12);
        }

        .modal-tabs {
          display: flex;
          gap: 2px;
          padding: 14px 20px 0;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }

        .modal-tab {
          padding: 8px 16px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: var(--transition-fast);
        }

        .modal-tab:hover { color: var(--text-main); }
        .modal-tab.active { color: var(--text-main); border-bottom-color: #ffffff; }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
        }

        .modal-tab-content {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group { display: flex; flex-direction: column; gap: 6px; }

        .form-label {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .form-hint { font-size: 0.68rem; color: var(--text-muted); opacity: 0.7; }

        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }

        .modal-cancel-btn {
          padding: 9px 18px;
          background: transparent;
          border: 1px solid var(--border-color);
          border-radius: 7px;
          color: var(--text-muted);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .modal-cancel-btn:hover { color: var(--text-main); background: rgba(255,255,255,0.05); }

        .modal-save-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 20px;
          background: #ffffff;
          color: #000000;
          border: 1px solid #ffffff;
          border-radius: 7px;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .modal-save-btn:hover:not(:disabled) { background: #000; color: #fff; }
        .modal-save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Modset */
        .modset-options { display: flex; flex-direction: column; gap: 8px; }

        .modset-option {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 10px;
          border: 1px solid var(--border-color);
          background: rgba(255,255,255,0.02);
          cursor: pointer;
          transition: var(--transition-fast);
          text-align: left;
        }

        .modset-option:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.15); }
        .modset-option.selected { border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.06); }

        .modset-option-icon { font-size: 1.3rem; width: 32px; text-align: center; flex-shrink: 0; }
        .modset-option-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .modset-option-name { font-size: 0.88rem; font-weight: 700; color: var(--text-main); }
        .modset-option-desc { font-size: 0.72rem; color: var(--text-muted); }
        .modset-check { color: #4ade80; flex-shrink: 0; }

        .mods-list-section { display: flex; flex-direction: column; gap: 8px; }

        .mods-list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .mods-list-title {
          font-size: 0.62rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.08em;
          opacity: 0.6;
        }

        .refresh-mods-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .refresh-mods-btn:hover { color: var(--text-main); background: rgba(255,255,255,0.05); }
        .refresh-mods-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .mods-loading, .mods-error {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.78rem;
          color: var(--text-muted);
          padding: 8px 0;
        }

        .mods-error { color: #f87171; }

        .mods-list { display: flex; flex-direction: column; gap: 6px; }

        .mod-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border-color);
          border-radius: 8px;
        }

        .mod-icon {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          flex-shrink: 0;
          object-fit: contain;
          background: rgba(255,255,255,0.04);
        }

        .mod-icon-placeholder {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .mod-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .mod-name { font-size: 0.82rem; font-weight: 700; color: var(--text-main); }
        .mod-desc { font-size: 0.68rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .mod-downloads {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 0.65rem;
          color: var(--text-muted);
          font-weight: 600;
          flex-shrink: 0;
        }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ===== PROFILE MODS MODAL ===== */
        .mods-modal-window {
          max-width: 680px !important;
          width: 100%;
        }
        .mods-modal-body {
          min-height: 400px;
          max-height: 65vh;
        }
        .mods-modal-content {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: 100%;
          min-height: 0;
        }
        .mods-modal-title-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
          text-align: left;
        }
        .mods-modal-subtitle {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 500;
        }
        .mods-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 32px 16px;
          color: var(--text-muted);
        }
        .mods-empty-icon {
          opacity: 0.15;
          margin-bottom: 12px;
          color: var(--text-main);
        }
        .mods-empty-state h3 {
          font-size: 1.1rem;
          color: var(--text-main);
          font-weight: 700;
          margin: 0 0 6px 0;
        }
        .mods-empty-state p {
          font-size: 0.8rem;
          line-height: 1.5;
          max-width: 420px;
          margin: 0 0 20px 0;
        }
        .recommended-box {
          display: flex;
          gap: 14px;
          padding: 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.02) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          text-align: left;
          max-width: 500px;
          margin-top: 10px;
        }
        .rec-icon {
          color: #ffffff;
          filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.4));
          flex-shrink: 0;
          margin-top: 2px;
        }
        .rec-details {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .rec-details h4 {
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--text-main);
          margin: 0;
        }
        .rec-details p {
          font-size: 0.75rem;
          color: var(--text-muted);
          line-height: 1.5;
          margin: 0 0 8px 0;
        }
        .install-recommended-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: #ffffff;
          border: 1px solid #ffffff;
          border-radius: 6px;
          padding: 8px 16px;
          color: #000000;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          align-self: flex-start;
        }
        .install-recommended-btn:hover:not(:disabled) {
          background: #000000;
          color: #ffffff;
          border-color: #ffffff;
        }
        .install-recommended-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .mods-installed-list, .mods-search-results {
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
          max-height: 380px;
          padding-right: 4px;
        }
        .installed-mod-item, .search-mod-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          transition: all 0.2s ease;
          text-align: left;
        }
        .installed-mod-item:hover, .search-mod-item:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.12);
        }
        .mod-file-name {
          font-size: 0.68rem;
          color: var(--text-muted);
          font-family: monospace;
          opacity: 0.7;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 320px;
        }
        .uninstall-mod-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: rgba(239, 68, 68, 0.06);
          border: 1px solid rgba(239, 68, 68, 0.15);
          border-radius: 6px;
          padding: 6px 12px;
          color: #f87171;
          font-size: 0.72rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
          margin-left: auto;
        }
        .uninstall-mod-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }
        .uninstall-mod-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .install-mod-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: #ffffff;
          border: 1px solid #ffffff;
          border-radius: 6px;
          padding: 6px 12px;
          color: #000000;
          font-size: 0.72rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
          margin-left: auto;
        }
        .install-mod-btn:hover:not(:disabled) {
          background: #000000;
          color: #ffffff;
          border-color: #ffffff;
        }
        .install-mod-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .mods-search-form {
          display: flex;
          gap: 10px;
          width: 100%;
        }
        .search-input-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 0 12px;
          flex: 1;
        }
        .search-input-wrapper .search-icon {
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .search-input {
          border: none !important;
          background: transparent !important;
          padding: 10px 0 !important;
          outline: none !important;
          width: 100%;
          color: var(--text-main);
          font-size: 0.85rem;
        }
        .search-btn {
          flex-shrink: 0;
          height: 38px;
          padding: 0 20px !important;
        }
        .mod-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .mod-downloads-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.65rem;
          color: var(--text-muted);
        }
        .search-uninstall-btn {
          margin-left: auto;
        }
        .profile-card-top-actions {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          gap: 6px;
          z-index: 10;
          opacity: 0;
          transform: translateY(-4px);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .profile-card:hover .profile-card-top-actions {
          opacity: 1;
          transform: translateY(0);
        }
        .active-profile-mods-btn {
          width: 100% !important;
        }

        .modal-saving-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          z-index: 100;
          border-radius: 16px;
        }

        .saving-spinner {
          color: #ffffff;
          filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.5));
        }

        .saving-status-text {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-main);
          text-align: center;
          padding: 0 24px;
        }

        /* ===== WIZARD ===== */
        .wizard-window {
          position: relative;
          width: 100%;
          max-width: 680px;
          border-radius: 20px !important;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          max-height: 90vh;
        }

        .wizard-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 0;
          flex-shrink: 0;
        }

        .wizard-steps-indicator {
          display: flex;
          align-items: center;
          gap: 0;
          flex-direction: column;
        }

        .wizard-steps-indicator {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .wizard-step-dot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.72rem;
          font-weight: 800;
          background: rgba(255,255,255,0.03);
          border: 1.5px solid rgba(255,255,255,0.1);
          color: var(--text-muted);
          transition: var(--transition-fast);
        }

        .wizard-step-dot.active {
          background: #ffffff;
          color: #000000;
          border-color: #ffffff;
          box-shadow: 0 0 12px rgba(255,255,255,0.3);
        }

        .wizard-step-dot.done {
          background: rgba(74,222,128,0.1);
          border-color: #4ade80;
          color: #4ade80;
        }

        .wizard-steps-labels {
          display: flex;
          gap: 4px;
          margin-left: 4px;
        }

        .wizard-steps-labels span {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-muted);
          padding: 2px 6px;
          transition: var(--transition-fast);
        }

        .wizard-steps-labels span.wsl-active {
          color: var(--text-main);
          font-weight: 800;
        }

        .wizard-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-height: 0;
        }

        .wizard-body::-webkit-scrollbar { width: 5px; display: block !important; }
        .wizard-body::-webkit-scrollbar-track { background: transparent; }
        .wizard-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 8px; }

        .wizard-step-title h2 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.3rem;
          font-weight: 900;
          color: var(--text-main);
          margin: 0 0 4px 0;
        }

        .wizard-step-title p {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin: 0;
        }

        .wiz-loading {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-muted);
          font-size: 0.85rem;
          padding: 20px 0;
        }

        /* Version tiles */
        .wiz-versions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
          gap: 8px;
          max-height: 280px;
          overflow-y: auto;
        }

        .wiz-versions-grid::-webkit-scrollbar { width: 5px; display: block !important; }
        .wiz-versions-grid::-webkit-scrollbar-track { background: transparent; }
        .wiz-versions-grid::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 8px; }

        .wiz-ver-tile {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 10px 8px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          color: var(--text-muted);
          font-size: 0.76rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .wiz-ver-tile:hover {
          border-color: rgba(255,255,255,0.18);
          color: var(--text-main);
          background: rgba(255,255,255,0.05);
        }

        .wiz-ver-tile.selected {
          border-color: rgba(255,255,255,0.4);
          background: rgba(255,255,255,0.08);
          color: var(--text-main);
          font-weight: 800;
          box-shadow: 0 0 14px rgba(255,255,255,0.06);
        }

        .wiz-ver-check { color: #4ade80; flex-shrink: 0; }

        /* Engine tiles */
        .wiz-form-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .wiz-label {
          font-size: 0.72rem;
          font-weight: 800;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .wiz-engine-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }

        .wiz-engine-tile {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 8px 16px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.01);
          cursor: pointer;
          transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.25s, background 0.25s, box-shadow 0.25s;
          text-align: center;
          overflow: hidden;
        }

        .wiz-engine-tile:hover {
          border-color: rgba(var(--eng-rgb), 0.3);
          background: rgba(var(--eng-rgb), 0.04);
          transform: translateY(-2px);
        }

        .wiz-engine-tile.selected {
          border-color: rgba(var(--eng-rgb), 0.6);
          background: rgba(var(--eng-rgb), 0.1);
          box-shadow: 0 0 20px rgba(var(--eng-rgb), 0.15);
          transform: translateY(-3px);
        }

        .wiz-eng-emoji { font-size: 1.5rem; line-height: 1; }

        .wiz-eng-name {
          position: relative;
          z-index: 1;
          font-family: 'Outfit', sans-serif;
          font-size: 0.8rem;
          font-weight: 800;
          color: var(--eng-color);
          text-shadow: 0 1px 4px rgba(0,0,0,0.6);
        }

        .wiz-eng-desc {
          position: relative;
          z-index: 1;
          font-size: 0.6rem;
          color: var(--text-muted);
          line-height: 1.4;
        }

        .wiz-eng-check {
          position: absolute;
          top: 8px;
          right: 8px;
          color: var(--eng-color);
          filter: drop-shadow(0 0 4px rgba(var(--eng-rgb), 0.5));
          z-index: 2;
        }

        /* Wizard footer/buttons */
        .wizard-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 8px;
          border-top: 1px solid rgba(255,255,255,0.06);
          margin-top: auto;
          gap: 10px;
          flex-shrink: 0;
        }

        .wizard-cancel-btn {
          padding: 9px 18px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: var(--text-muted);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .wizard-cancel-btn:hover { color: var(--text-main); background: rgba(255,255,255,0.05); }

        .wizard-back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: var(--text-muted);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .wizard-back-btn:hover { color: var(--text-main); background: rgba(255,255,255,0.05); }

        .wizard-next-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 22px;
          background: #ffffff;
          color: #000000;
          border: 1px solid #ffffff;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition-smooth);
          box-shadow: 0 4px 12px rgba(255,255,255,0.15);
          margin-left: auto;
        }

        .wizard-next-btn:hover:not(:disabled) {
          background: #000;
          color: #fff;
          border-color: rgba(255,255,255,0.2);
        }

        .wizard-next-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        /* Engine logo image */
        .wiz-eng-logo {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          object-fit: cover;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.3);
          flex-shrink: 0;
        }

        /* Engine tile background image */
        .wiz-eng-bg {
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

        .wiz-engine-tile:hover .wiz-eng-bg,
        .wiz-engine-tile.selected .wiz-eng-bg {
          opacity: 0.15;
        }

        /* Name + icon row */
        .wiz-name-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .wiz-name-input {
          flex: 1;
        }

        /* Block icon picker */
        .wiz-icon-picker-wrap {
          position: relative;
          flex-shrink: 0;
        }

        .wiz-icon-btn {
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: 12px;
          border: 1.5px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.03);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition-fast);
          overflow: visible;
        }

        .wiz-icon-btn:hover {
          border-color: rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.07);
        }

        .wiz-icon-preview {
          width: 36px;
          height: 36px;
          image-rendering: pixelated;
          border-radius: 6px;
        }

        .wiz-icon-edit-badge {
          position: absolute;
          bottom: -4px;
          right: -4px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          color: #000000;
          font-size: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1.5px solid rgba(0,0,0,0.5);
          line-height: 1;
        }

        .wiz-block-picker {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          z-index: 999;
          background: rgba(14,14,18,0.98);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.7);
          animation: picker-pop 0.2s cubic-bezier(0.16,1,0.3,1);
          min-width: 260px;
        }

        @keyframes picker-pop {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .wiz-block-picker-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 6px;
        }

        .wiz-block-tile {
          width: 100%;
          aspect-ratio: 1;
          border-radius: 8px;
          border: 1.5px solid transparent;
          background: rgba(255,255,255,0.02);
          padding: 3px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, transform 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .wiz-block-tile:hover {
          border-color: rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.08);
          transform: scale(1.1);
        }

        .wiz-block-tile.selected {
          border-color: rgba(255,255,255,0.7);
          background: rgba(255,255,255,0.1);
          box-shadow: 0 0 10px rgba(255,255,255,0.15);
        }

        .wiz-block-img {
          width: 100%;
          height: 100%;
          image-rendering: pixelated;
          border-radius: 4px;
        }

        /* Profile card block icon */
        .profile-block-icon {
          width: 40px;
          height: 40px;
          image-rendering: pixelated;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
        }
      `}</style>


    </div>
  );
};


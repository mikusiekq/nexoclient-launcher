import React, { useState, useEffect } from 'react';
import {
  Layers, Plus, Trash2, Check, Package, Download, FolderOpen, RefreshCw, User, Cpu, X,
  Tag, Sliders, Box, Zap, Sparkles, Gamepad2, Server, FileText, Search,
  Shield, Flame, Palette
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';


const getProfileIcon = (name: string, modSet: string, size = 18) => {
  const n = name.toLowerCase();
  if (modSet === 'optimization' || n.includes('fps') || n.includes('opt') || n.includes('speedrun')) {
    return <Cpu size={size} className="prof-icon-zap" />;
  }
  if (n.includes('survival') || n.includes('surv') || n.includes('hardcore')) {
    return <Shield size={size} className="prof-icon-compass" />;
  }
  if (n.includes('pvp') || n.includes('bedwars') || n.includes('wars') || n.includes('combat')) {
    return <Flame size={size} className="prof-icon-swords" />;
  }
  if (n.includes('creative') || n.includes('build')) {
    return <Palette size={size} className="prof-icon-sparkles" />;
  }
  return <Gamepad2 size={size} className="prof-icon-default" />;
};


const getProfileTheme = (name: string, modSet: string) => {
  const n = name.toLowerCase();
  if (modSet === 'optimization' || n.includes('fps') || n.includes('opt') || n.includes('speedrun')) {
    return 'theme-zap';
  }
  if (n.includes('survival') || n.includes('surv') || n.includes('hardcore')) {
    return 'theme-compass';
  }
  if (n.includes('pvp') || n.includes('bedwars') || n.includes('wars') || n.includes('combat')) {
    return 'theme-swords';
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
  isOnboarding?: boolean;
}

interface ModrinthMod {
  project_id: string;
  title: string;
  description: string;
  icon_url?: string;
  downloads?: number;
}

const OPTIMIZATION_MOD_IDS = [
  'AANobbMI', // Sodium
  'gvQqBUqZ', // Lithium
  'YL57xq9U', // Iris Shaders
  'P7dR8mSH', // Fabric API
  'mOgUt4GM', // Mod Menu
  'uXXizFIs', // FerriteCore
  'NNAgCjsB', // EntityCulling
  '5ZwTheSi', // ImmediatelyFast
  'fQEb0iXm', // Krypton
  'mfzaZK3z', // More Culling
  'LQ3K71Q1', // Dynamic FPS
  'OVuFYfre', // Enhanced Block Entities
  'PtjYWJkn', // Sodium Extra
  'Bh37bMuy', // Reese's Sodium Options
  'VSNURh3q', // C2ME
  'KuNKN7d2', // Noisium
  'g96Z4WVZ', // BadOptimizations
  'Wnxd13zP', // Clumps
  'DynYZEae', // Exordium
  'SeH5bGbO', // MemoryLeakFix
  'nmDcB62a', // ModernFix
  '9s6osm5g', // Cloth Config API
  'rcTfTZr3', // Chunky
  '1eAoo2KR', // Particle Core
  'hEOCdOgW', // Iceberg
  'pM1eBxaX', // Plasticity (Smooth Lighting)
  'eXts2L7r', // Methane
];

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const ProfilesView: React.FC<ProfilesViewProps> = ({
  config,
  versions,
  loadingVersions,
  onSaveConfig,
  isOnboarding = false,
}) => {
  const { t } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'modset' | 'import'>('general');
  const [selectedModsProfile, setSelectedModsProfile] = useState<Profile | null>(null);

  const [formName, setFormName] = useState('');
  const [formVersion, setFormVersion] = useState('');
  const [formAccountUuid, setFormAccountUuid] = useState<string | null>(null);
  const [formModSet, setFormModSet] = useState<'vanilla' | 'optimization'>('vanilla');

  const [modrinthMods, setModrinthMods] = useState<ModrinthMod[]>([]);
  const [loadingMods, setLoadingMods] = useState(false);
  const [modsError, setModsError] = useState<string | null>(null);

  const [useDefaultMcPath, setUseDefaultMcPath] = useState(true);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);

  const profiles = config?.profiles || [];
  const savedAccounts = config?.savedAccounts || [];
  const activeProfileId = config?.activeProfileId || null;

  useEffect(() => {
    if (activeTab === 'modset' && modrinthMods.length === 0 && !loadingMods) {
      fetchModrinthMods();
    }
  }, [activeTab]);

  const fetchModrinthMods = async () => {
    setLoadingMods(true);
    setModsError(null);
    try {
      const ids = JSON.stringify(OPTIMIZATION_MOD_IDS);
      const res = await fetch(`https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(ids)}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setModrinthMods(data);
    } catch (e: any) {
      setModsError('Nie udalo sie pobrac listy modow z Modrinth.');
    } finally {
      setLoadingMods(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormName('Nowy profil');
    setFormVersion(versions[0] || '');
    setFormAccountUuid(config?.account?.uuid || null);
    setFormModSet('vanilla');
    setActiveTab('general');
    setImportStatus(null);
    setUseDefaultMcPath(true);
    setModalOpen(true);
  };

  const openEdit = (profile: Profile) => {
    setEditingId(profile.id);
    setFormName(profile.name);
    setFormVersion(profile.version || versions[0] || '');
    setFormAccountUuid(profile.accountUuid);
    setFormModSet(profile.modSet);
    setActiveTab('general');
    setImportStatus(null);
    setUseDefaultMcPath(true);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setImportStatus(null);
  };

  const handleSave = async () => {
    if (!config || !formName.trim()) return;

    const targetProfileId = editingId || genId();
    const targetVersion = formVersion || versions[0] || '';

    // Helper to install a single mod by Modrinth ID
    const installMod = async (id: string, title: string, currentInstalled: any[], label: string) => {
      if (currentInstalled.some((m: any) => m.projectId === id)) return;
      setSavingStatus(`Pobieranie: ${label}...`);
      try {
        const pRes = await fetch(`https://api.modrinth.com/v2/project/${id}`);
        let iconUrl = undefined;
        if (pRes.ok) { const pData = await pRes.json(); iconUrl = pData.icon_url; }
        const res = await fetch(`https://api.modrinth.com/v2/project/${id}/version?loaders=%5B%22fabric%22%5D&game_versions=%5B%22${targetVersion}%22%5D`);
        if (!res.ok) return;
        const versionsData = await res.json();
        if (!versionsData || versionsData.length === 0) return;
        const version = versionsData[0];
        const file = version.files.find((f: any) => f.primary) || version.files[0];
        if (!file) return;
        await window.electronAPI.installProfileMod(targetProfileId, id, title, version.id, file.url, file.filename, iconUrl);
      } catch (e) {
        console.error(`Błąd instalacji ${title}:`, e);
      }
    };

    // Get current installed mods to avoid duplicates
    let currentInstalled: any[] = [];
    try {
      currentInstalled = await window.electronAPI.getInstalledMods(targetProfileId);
    } catch (e) {
      console.error(e);
    }

    // Always install Fabric API (required by nexoclient and most mods)
    await installMod('P7dR8mSH', 'Fabric API', currentInstalled, 'Fabric API (wymagane)');

    // If optimization is selected, download mods first
    if (formModSet === 'optimization') {
      const recommended = [
        { id: 'AANobbMI', title: 'Sodium' },
        { id: 'gvQqBUqZ', title: 'Lithium' },
        { id: 'YL57xq9U', title: 'Iris Shaders' },
        { id: 'mOgUt4GM', title: 'Mod Menu' },
        { id: 'uXXizFIs', title: 'FerriteCore' },
        { id: 'NNAgCjsB', title: 'EntityCulling' },
        { id: '5ZwTheSi', title: 'ImmediatelyFast' },
        { id: 'fQEb0iXm', title: 'Krypton' },
        { id: 'mfzaZK3z', title: 'More Culling' },
        { id: 'LQ3K71Q1', title: 'Dynamic FPS' },
        { id: 'OVuFYfre', title: 'Enhanced Block Entities' },
        { id: 'PtjYWJkn', title: 'Sodium Extra' },
        { id: 'Bh37bMuy', title: "Reese's Sodium Options" },
        { id: 'VSNURh3q', title: 'C2ME' },
        { id: 'KuNKN7d2', title: 'Noisium' },
        { id: 'g96Z4WVZ', title: 'BadOptimizations' },
        { id: 'Wnxd13zP', title: 'Clumps' },
        { id: 'DynYZEae', title: 'Exordium' },
        { id: 'SeH5bGbO', title: 'MemoryLeakFix' },
        { id: 'nmDcB62a', title: 'ModernFix' },
        { id: '9s6osm5g', title: 'Cloth Config API' },
        { id: 'rcTfTZr3', title: 'Chunky' },
        { id: 'hEOCdOgW', title: 'Iceberg' },
        { id: 'FWumhS4T', title: 'Smooth Boot (Fabric)' },
        { id: 'mim1s31R', title: 'ThreadTweak' },
        { id: 'wnEe9vMi', title: 'Debugify' },
        { id: 'YoRusyb4', title: 'Noxesium' },
        { id: 'GNxdLCoP', title: 'Concurrent Chunk Management Engine' },
      ];

      // Indium is not compatible/needed on Minecraft 1.21.4+ and causes crashes, so we skip it.
      const parts = targetVersion.split('.').map(Number);
      const isAtLeast1_21_4 = parts[0] > 1 || (parts[0] === 1 && (parts[1] > 21 || (parts[1] === 21 && (parts[2] || 0) >= 4)));
      if (!isAtLeast1_21_4) {
        recommended.push({ id: 'Orvt0mRa', title: 'Indium' });
      }

      // Reload current installed after Fabric API install
      try {
        currentInstalled = await window.electronAPI.getInstalledMods(targetProfileId);
      } catch (e) {}

      for (let i = 0; i < recommended.length; i++) {
        const mod = recommended[i];
        await installMod(mod.id, mod.title, currentInstalled, `${mod.title} (${i + 1}/${recommended.length})`);
      }
    }

    setSavingStatus('Zapisywanie profilu...');

    if (editingId) {
      const updated = profiles.map(p =>
        p.id === editingId
          ? { ...p, name: formName.trim(), version: formVersion, accountUuid: formAccountUuid, modSet: formModSet }
          : p
      );
      await onSaveConfig({ ...config, profiles: updated });
    } else {
      const newProfile: Profile = {
        id: targetProfileId,
        name: formName.trim(),
        version: targetVersion,
        accountUuid: formAccountUuid,
        modSet: formModSet,
        createdAt: Date.now(),
      };
      const updated = [...profiles, newProfile];
      const newActive = profiles.length === 0 ? newProfile.id : activeProfileId;
      await onSaveConfig({ ...config, profiles: updated, activeProfileId: newActive });
    }

    setSavingStatus(null);
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (!config) return;
    const updated = profiles.filter(p => p.id !== id);
    const newActive = activeProfileId === id ? (updated[0]?.id || null) : activeProfileId;
    await onSaveConfig({ ...config, profiles: updated, activeProfileId: newActive });
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

  const handleImport = async () => {
    setImportLoading(true);
    setImportStatus(null);
    try {
      let folder: string | null = null;
      if (useDefaultMcPath) {
        folder = '';
      } else {
        folder = await window.electronAPI.browseMcFolder();
        if (!folder) { setImportLoading(false); return; }
      }
      const result = await window.electronAPI.importMinecraftSettings(folder);
      if (result.success) {
        const parts: string[] = [];
        if (result.copiedOptions) parts.push('opcje gry (options.txt)');
        if (result.copiedServers) parts.push('lista serwerow (servers.dat)');
        setImportStatus(parts.length > 0
          ? `\u2713 Zaimportowano: ${parts.join(', ')}`
          : '\u26a0 Nie znaleziono plikow do importu w wybranym folderze');
      } else {
        setImportStatus('\u2717 Blad podczas importu ustawien');
      }
    } catch (e: any) {
      setImportStatus('\u2717 ' + (e.message || 'Blad importu'));
    } finally {
      setImportLoading(false);
    }
  };

  const showOnboarding = isOnboarding && profiles.length === 0;

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
        {!showOnboarding && (
          <button className="create-profile-btn" onClick={openCreate}>
            <Plus size={15} />
            <span>{t('profiles.create_new')}</span>
          </button>
        )}
      </div>

      {/* Onboarding screen */}
      {showOnboarding && (
        <div className="onb-profiles-center-wrap">
          <div className="onb-profiles-layout">
            <div className="onb-profiles-left">
              <div className="onb-badge-profiles"><Sparkles size={12} className="onb-sparkle" /><span>Pierwsze kroki</span></div>
              <h2 className="onb-profiles-title">Utworz swoj pierwszy profil</h2>
              <p className="onb-profiles-desc">Profil pozwala dostosowac Minecraft - wybierz wersje i dodaj mody wydajnosci. Mozesz tworzyc wiele profili dla roznych stylow gry.</p>
              <div className="onb-features-label">Co mozesz dostosowac:</div>
              <div className="onb-features-grid">
                <div className="onb-feature"><Check size={12} className="onb-check" /> Wersje Minecraft</div>
                <div className="onb-feature"><Check size={12} className="onb-check" /> Mody wydajnosci</div>
                <div className="onb-feature"><Check size={12} className="onb-check" /> Przypisane konto</div>
                <div className="onb-feature"><Check size={12} className="onb-check" /> Import ustawien</div>
              </div>
            </div>
            <div className="onb-profiles-right">
              <div className="onb-qs-card">
                <div className="onb-qs-header">
                  <div className="onb-qs-icon"><Layers size={18} /></div>
                  <div>
                    <div className="onb-qs-title">Nowy profil</div>
                    <div className="onb-qs-sub">Skonfiguruj ustawienia gry</div>
                  </div>
                </div>
                <button className="onb-qs-btn" onClick={openCreate}>
                  <Plus size={15} />
                  <span>Utworz profil</span>
                </button>
                <div className="onb-qs-hint">Wszystko mozesz dostosowac w kreatorze</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profiles list */}
      {!showOnboarding && (
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
                const isActive = profile.id === activeProfileId;
                const assignedAcc = savedAccounts.find(a => a.uuid === profile.accountUuid);
                const theme = getProfileTheme(profile.name, profile.modSet);
                return (
                  <div key={profile.id} className={`profile-card glass-panel ${theme} ${isActive ? 'profile-active' : ''}`}>
                    {isActive && (
                      <div className="profile-active-badge">
                        <div className="profile-active-dot"></div>
                        <span>Aktywny</span>
                      </div>
                    )}
                    
                    <div className="profile-card-top-actions">
                      <button className="profile-edit-btn" onClick={() => openEdit(profile)} title="Edytuj">
                        <Sliders size={13} />
                      </button>
                      <button className="profile-delete-btn" onClick={() => handleDelete(profile.id)} title="Usun">
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="profile-card-icon">
                      {getProfileIcon(profile.name, profile.modSet, 36)}
                    </div>
                    
                    <div className="profile-card-info">
                      <div className="profile-card-name">{profile.name}</div>
                      <div className="profile-card-meta">
                        <span className="profile-ver-badge">
                          <Tag size={10} />
                          <span>{profile.version || '–'}</span>
                        </span>
                        <span className="profile-modset-badge">
                          {profile.modSet === 'optimization' ? (
                            <>
                              <Cpu size={10} />
                              <span>Optymalizacja</span>
                            </>
                          ) : (
                            <>
                              <Box size={10} />
                              <span>Vanilla</span>
                            </>
                          )}
                        </span>
                        {assignedAcc && (
                          <span className="profile-acc-badge">
                            <User size={10} />
                            <span>{assignedAcc.username}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="profile-card-actions">
                      {!isActive ? (
                        <>
                          <button className="profile-use-btn" onClick={() => handleSetActive(profile.id)}>
                              {t('accounts.use')}
                          </button>
                          <button className="profile-mods-btn" onClick={() => setSelectedModsProfile(profile)}>
                            <Package size={13} />
                             <span>{t('profiles.mods')}</span>
                          </button>
                        </>
                      ) : (
                        <button className="profile-mods-btn active-profile-mods-btn" onClick={() => setSelectedModsProfile(profile)}>
                          <Package size={13} />
                          <span>{t('profiles.mods')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => !savingStatus && closeModal()}>
          <div className="modal-window glass-panel animate-fade-in" onClick={e => e.stopPropagation()}>
            {savingStatus && (
              <div className="modal-saving-overlay">
                <Cpu size={36} className="spin saving-spinner" />
                <span className="saving-status-text">{savingStatus}</span>
              </div>
            )}
            <div className="modal-header">
              <span className="modal-title">{editingId ? 'Edytuj profil' : 'Nowy profil'}</span>
              <button className="modal-close-btn" onClick={closeModal} disabled={!!savingStatus}><X size={16} /></button>
            </div>

            <div className="modal-tabs">
              <button className={`modal-tab ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>
                <Sliders size={13} />
                <span>Ogolne</span>
              </button>
              <button className={`modal-tab ${activeTab === 'modset' ? 'active' : ''}`} onClick={() => setActiveTab('modset')}>
                <Box size={13} />
                <span>Zestawy modow</span>
              </button>
              <button className={`modal-tab ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>
                <Download size={13} />
                <span>Import</span>
              </button>
            </div>

            <div className="modal-body">
              {activeTab === 'general' && (
                <div className="modal-tab-content">
                  <div className="form-group">
                    <label className="form-label">Nazwa profilu</label>
                    <input
                      className="custom-input"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="Np. Survival, Speedrun..."
                      maxLength={32}
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Wersja Minecraft</label>
                    <div className="custom-select-wrapper">
                      <select
                        className="custom-select"
                        value={formVersion}
                        onChange={e => setFormVersion(e.target.value)}
                        disabled={loadingVersions}
                      >
                        {loadingVersions ? (
                          <option>Ladowanie...</option>
                        ) : versions.length > 0 ? (
                          versions.map(v => <option key={v} value={v}>{v}</option>)
                        ) : (
                          <option value="">Brak wersji</option>
                        )}
                      </select>
                      <span className="custom-select-arrow">&#9660;</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Przypisane konto</label>
                    <div className="custom-select-wrapper">
                      <select
                        className="custom-select"
                        value={formAccountUuid || ''}
                        onChange={e => setFormAccountUuid(e.target.value || null)}
                      >
                        <option value="">— Brak przypisanego konta —</option>
                        {savedAccounts.map(acc => (
                          <option key={acc.uuid} value={acc.uuid}>
                            {acc.username} ({acc.type === 'microsoft' ? 'Microsoft' : 'Offline'})
                          </option>
                        ))}
                      </select>
                      <span className="custom-select-arrow">&#9660;</span>
                    </div>
                    <span className="form-hint">Przy wyborze tego profilu konto zostanie automatycznie przelaczone</span>
                  </div>
                </div>
              )}

              {activeTab === 'modset' && (
                <div className="modal-tab-content">
                  <div className="modset-options">
                    <button
                      className={`modset-option ${formModSet === 'vanilla' ? 'selected' : ''}`}
                      onClick={() => setFormModSet('vanilla')}
                    >
                      <div className="modset-option-icon">
                        <Box size={18} className="modset-svg-vanilla" />
                      </div>
                      <div className="modset-option-info">
                        <span className="modset-option-name">Vanilla</span>
                        <span className="modset-option-desc">Czyste Minecraft bez zadnych modow</span>
                      </div>
                      {formModSet === 'vanilla' && <Check size={16} className="modset-check" />}
                    </button>
                    <button
                      className={`modset-option ${formModSet === 'optimization' ? 'selected' : ''}`}
                      onClick={() => setFormModSet('optimization')}
                    >
                      <div className="modset-option-icon">
                        <Zap size={18} className="modset-svg-opt" />
                      </div>
                      <div className="modset-option-info">
                        <span className="modset-option-name">Mody optymalizacyjne</span>
                        <span className="modset-option-desc">Zwieksza FPS i zmniejsza zuzycie pamieci</span>
                      </div>
                      {formModSet === 'optimization' && <Check size={16} className="modset-check" />}
                    </button>
                  </div>

                  {formModSet === 'optimization' && (
                    <div className="mods-list-section">
                      <div className="mods-list-header">
                        <span className="mods-list-title">MODY W ZESTAWIE</span>
                        <button className="refresh-mods-btn" onClick={fetchModrinthMods} disabled={loadingMods}>
                          <RefreshCw size={12} className={loadingMods ? 'spin' : ''} />
                        </button>
                      </div>
                      {loadingMods ? (
                        <div className="mods-loading"><Cpu size={14} className="spin" /><span>Pobieranie z Modrinth...</span></div>
                      ) : modsError ? (
                        <div className="mods-error">{modsError}</div>
                      ) : (
                        <div className="mods-list">
                          {modrinthMods.map(mod => (
                            <div key={mod.project_id} className="mod-item">
                              {mod.icon_url ? (
                                <img src={mod.icon_url} alt={mod.title} className="mod-icon" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <div className="mod-icon-placeholder"><Package size={14} /></div>
                              )}
                              <div className="mod-info">
                                <span className="mod-name">{mod.title}</span>
                                <span className="mod-desc">{mod.description}</span>
                              </div>
                              {mod.downloads !== undefined && (
                                <span className="mod-downloads"><Download size={11} />{(mod.downloads / 1000000).toFixed(1)}M</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'import' && (
                <div className="modal-tab-content">
                  <div className="import-info-box">
                    <FolderOpen size={20} />
                    <div>
                      <div className="import-info-title">Importuj ustawienia z Minecraft</div>
                      <div className="import-info-desc">
                        Skopiuje <strong>options.txt</strong> (ustawienia) i <strong>servers.dat</strong> (serwery) do folderu NEXOCLIENT.
                      </div>
                    </div>
                  </div>

                  <div className="import-toggle-row">
                    <label className="import-toggle-label">
                      <div className="import-checkbox-wrap">
                        <input
                          type="checkbox"
                          className="import-checkbox"
                          checked={useDefaultMcPath}
                          onChange={e => setUseDefaultMcPath(e.target.checked)}
                        />
                        <span className="import-checkbox-custom"></span>
                      </div>
                      <div>
                        <div className="import-toggle-title">Importuj z domyslnego folderu .minecraft</div>
                        <div className="import-toggle-desc">%APPDATA%\.minecraft (automatyczne wykrywanie)</div>
                      </div>
                    </label>
                  </div>

                  <div className="import-files-list">
                    <div className="import-file-item">
                      <span className="import-file-icon">
                        <FileText size={18} style={{ color: '#60a5fa', filter: 'drop-shadow(0 0 4px rgba(96, 165, 250, 0.4))' }} />
                      </span>
                      <div>
                        <div className="import-file-name">options.txt</div>
                        <div className="import-file-desc">Ustawienia graficzne, sterowanie, dzwiek</div>
                      </div>
                    </div>
                    <div className="import-file-item">
                      <span className="import-file-icon">
                        <Server size={18} style={{ color: '#34d399', filter: 'drop-shadow(0 0 4px rgba(52, 211, 153, 0.4))' }} />
                      </span>
                      <div>
                        <div className="import-file-name">servers.dat</div>
                        <div className="import-file-desc">Zapisana lista serwerow multiplayer</div>
                      </div>
                    </div>
                  </div>

                  <button className="import-btn" onClick={handleImport} disabled={importLoading}>
                    {importLoading ? (
                      <><Cpu size={15} className="spin" /><span>Importowanie...</span></>
                    ) : useDefaultMcPath ? (
                      <><FolderOpen size={15} /><span>Importuj z .minecraft</span></>
                    ) : (
                      <><FolderOpen size={15} /><span>Wybierz folder i importuj</span></>
                    )}
                  </button>

                  {importStatus && (
                    <div className={`import-status ${importStatus.startsWith('\u2713') ? 'success' : importStatus.startsWith('\u26a0') ? 'warn' : 'error'}`}>
                      {importStatus}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="modal-cancel-btn" onClick={closeModal} disabled={!!savingStatus}>Anuluj</button>
              <button className="modal-save-btn" onClick={handleSave} disabled={!formName.trim() || !!savingStatus}>
                <Check size={15} />
                <span>{editingId ? 'Zapisz zmiany' : 'Utworz profil'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedModsProfile && (
        <ProfileModsModal
          profile={selectedModsProfile}
          onClose={() => setSelectedModsProfile(null)}
        />
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
          font-family: 'Outfit', sans-serif;
          font-size: 1.6rem;
          font-weight: 800;
          font-style: italic;
          letter-spacing: 0.06em;
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
        .onb-profiles-center-wrap { flex: 1; display: flex; align-items: center; justify-content: center; }
        .onb-profiles-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; max-width: 900px; width: 100%; padding: 0 40px 32px; }
        .onb-badge-profiles { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; color: var(--text-main); font-size: 0.75rem; font-weight: 700; margin-bottom: 20px; }
        .onb-profiles-title { font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin-bottom: 14px; line-height: 1.25; }
        .onb-profiles-desc { font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; margin-bottom: 24px; }
        .onb-features-label { font-size: 0.8rem; font-weight: 700; color: var(--text-main); margin-bottom: 12px; }
        .onb-features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
        .onb-feature { font-size: 0.82rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
        .onb-feat-check { color: #4ade80; font-weight: 700; }
        .onb-profiles-right { display: flex; flex-direction: column; justify-content: center; }
        .onb-qs-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .onb-qs-header { display: flex; align-items: center; gap: 12px; }
        .onb-qs-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; color: var(--text-main); flex-shrink: 0; }
        .onb-qs-title { font-size: 0.9rem; font-weight: 700; color: var(--text-main); }
        .onb-qs-sub { font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; }
        .onb-qs-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 13px; background: #ffffff; color: #000000; border: 1px solid #ffffff; border-radius: 8px; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: var(--transition-fast); }
        .onb-qs-btn:hover { background: #000; color: #fff; }
        .onb-qs-hint { text-align: center; font-size: 0.72rem; color: var(--text-muted); opacity: 0.7; }

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
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
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
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 24px 20px 20px 20px;
          border-radius: 18px;
          background: radial-gradient(circle at 50% 0%, var(--theme-glow-color) 0%, rgba(9, 9, 9, 0.95) 75%), rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.04);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
          transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
          position: relative;
          overflow: hidden;
          text-align: center;
          min-height: 310px;
        }

        .profile-card:hover {
          border-color: rgba(var(--theme-color-rgb), 0.2) !important;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(var(--theme-color-rgb), 0.1);
          background: radial-gradient(circle at 50% 0%, rgba(var(--theme-color-rgb), 0.08) 0%, rgba(12, 12, 12, 0.97) 80%), rgba(255, 255, 255, 0.02) !important;
        }

        /* Active states by theme */
        .profile-card.profile-active {
          border-color: rgba(var(--theme-color-rgb), 0.45) !important;
          background: radial-gradient(circle at 50% 0%, rgba(var(--theme-color-rgb), 0.12) 0%, rgba(10, 10, 10, 0.96) 80%), rgba(255, 255, 255, 0.025) !important;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.75), 0 0 25px rgba(var(--theme-color-rgb), 0.18) !important;
        }

        .profile-card-icon {
          width: 80px;
          height: 80px;
          border-radius: 20px !important;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
          margin-bottom: 16px;
          background: rgba(var(--theme-color-rgb), 0.04);
          border: 1px solid rgba(var(--theme-color-rgb), 0.15);
          box-shadow: 0 0 12px rgba(var(--theme-color-rgb), 0.08);
          position: relative;
        }

        .profile-card:hover .profile-card-icon {
          background: rgba(var(--theme-color-rgb), 0.12);
          border-color: rgba(var(--theme-color-rgb), 0.35);
          box-shadow: 0 0 20px rgba(var(--theme-color-rgb), 0.25);
          transform: scale(1.05);
        }

        .profile-card-icon svg {
          transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        .profile-card:hover .profile-card-icon svg {
          transform: scale(1.1) rotate(6deg);
        }

        /* Icon themes & backgrounds */
        .prof-icon-zap {
          color: #ffffff;
          filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.6));
        }
        .profile-card:hover .prof-icon-zap {
          filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.85));
        }

        .prof-icon-compass {
          color: #34d399;
          filter: drop-shadow(0 0 8px rgba(52, 211, 153, 0.6));
        }
        .profile-card:hover .prof-icon-compass {
          filter: drop-shadow(0 0 12px rgba(52, 211, 153, 0.85));
        }

        .prof-icon-swords {
          color: #f87171;
          filter: drop-shadow(0 0 8px rgba(248, 113, 113, 0.6));
        }
        .profile-card:hover .prof-icon-swords {
          filter: drop-shadow(0 0 12px rgba(248, 113, 113, 0.85));
        }

        .prof-icon-sparkles {
          color: #38bdf8;
          filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.6));
        }
        .profile-card:hover .prof-icon-sparkles {
          filter: drop-shadow(0 0 12px rgba(56, 189, 248, 0.85));
        }

        .prof-icon-default {
          color: #c084fc;
          filter: drop-shadow(0 0 8px rgba(192, 132, 252, 0.6));
        }
        .profile-card:hover .prof-icon-default {
          filter: drop-shadow(0 0 12px rgba(192, 132, 252, 0.85));
        }

        .profile-card-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          flex: 1;
        }

        .profile-card-name {
          font-family: 'Outfit', sans-serif;
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: 0.02em;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        }

        .profile-card-meta {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .profile-ver-badge, .profile-modset-badge, .profile-acc-badge {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
          letter-spacing: 0.02em;
          transition: all 0.2s ease;
        }

        .profile-ver-badge {
          background: rgba(96, 165, 250, 0.04);
          color: #60a5fa;
          border: 1px solid rgba(96, 165, 250, 0.12);
        }
        .profile-card:hover .profile-ver-badge {
          background: rgba(96, 165, 250, 0.08);
          border-color: rgba(96, 165, 250, 0.25);
          box-shadow: 0 0 8px rgba(96, 165, 250, 0.15);
        }

        .profile-modset-badge {
          background: rgba(192, 132, 252, 0.04);
          color: #c084fc;
          border: 1px solid rgba(192, 132, 252, 0.12);
        }
        .profile-card:hover .profile-modset-badge {
          background: rgba(192, 132, 252, 0.08);
          border-color: rgba(192, 132, 252, 0.25);
          box-shadow: 0 0 8px rgba(192, 132, 252, 0.15);
        }

        .profile-acc-badge {
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-muted);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .profile-card:hover .profile-acc-badge {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.15);
          color: var(--text-main);
        }

        .profile-card-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          justify-content: center;
          margin-top: 20px;
          flex-shrink: 0;
        }

        /* Active badge styles */
        .profile-active-badge {
          position: absolute;
          top: 14px;
          left: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 5px 10px;
          border-radius: 20px;
          z-index: 10;
          color: var(--theme-color);
          background: rgba(var(--theme-color-rgb), 0.08);
          border: 1px solid rgba(var(--theme-color-rgb), 0.2);
          backdrop-filter: blur(4px);
        }

        .profile-active-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--theme-color);
          box-shadow: 0 0 8px var(--theme-color);
          animation: active-pulse 1.8s infinite ease-in-out;
        }

        @keyframes active-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
            box-shadow: 0 0 6px var(--theme-color);
          }
          50% {
            transform: scale(1.25);
            opacity: 0.7;
            box-shadow: 0 0 12px var(--theme-color);
          }
        }

        .profile-use-btn, .profile-mods-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 9px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .profile-use-btn {
          color: #000000;
          background: var(--theme-color);
          border: 1px solid var(--theme-color);
          box-shadow: 0 2px 10px rgba(var(--theme-color-rgb), 0.2);
          flex: 1.2;
        }

        .profile-use-btn:hover {
          background: transparent;
          color: var(--theme-color);
          border-color: var(--theme-color);
          box-shadow: 0 0 15px rgba(var(--theme-color-rgb), 0.35);
        }

        .profile-mods-btn {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(var(--theme-color-rgb), 0.18);
        }

        .profile-mods-btn:hover {
          background: rgba(var(--theme-color-rgb), 0.06);
          border-color: rgba(var(--theme-color-rgb), 0.4);
          box-shadow: 0 0 12px rgba(var(--theme-color-rgb), 0.15);
        }

        .active-profile-mods-btn {
          flex: 1;
          width: 100% !important;
          background: rgba(var(--theme-color-rgb), 0.04);
          border-color: rgba(var(--theme-color-rgb), 0.3);
        }

        .active-profile-mods-btn:hover {
          background: rgba(var(--theme-color-rgb), 0.08);
          border-color: rgba(var(--theme-color-rgb), 0.5);
          box-shadow: 0 0 16px rgba(var(--theme-color-rgb), 0.2);
        }

        .profile-card-top-actions {
          position: absolute;
          top: 14px;
          right: 14px;
          display: flex;
          gap: 6px;
          z-index: 10;
          opacity: 0;
          transform: translateY(-6px);
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        .profile-card:hover .profile-card-top-actions {
          opacity: 1;
          transform: translateY(0);
        }

        .profile-edit-btn, .profile-delete-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(9, 9, 9, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          color: var(--text-muted);
          cursor: pointer;
          backdrop-filter: blur(4px);
          transition: all 0.2s ease;
        }

        .profile-edit-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.2);
          color: var(--text-main);
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.1);
        }

        .profile-delete-btn:hover {
          color: #f87171;
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.25);
          box-shadow: 0 0 8px rgba(239, 68, 68, 0.15);
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

        /* Import tab */
        .import-info-box {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          background: rgba(59,130,246,0.06);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 10px;
          color: #60a5fa;
        }

        .import-info-box svg { flex-shrink: 0; margin-top: 2px; }
        .import-info-title { font-size: 0.88rem; font-weight: 700; color: var(--text-main); margin-bottom: 4px; }
        .import-info-desc { font-size: 0.74rem; color: var(--text-muted); line-height: 1.5; }
        .import-info-desc strong { color: var(--text-main); }

        .import-toggle-row {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 12px 14px;
        }

        .import-toggle-label {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          user-select: none;
        }

        .import-checkbox-wrap {
          position: relative;
          flex-shrink: 0;
        }

        .import-checkbox {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .import-checkbox-custom {
          display: block;
          width: 18px;
          height: 18px;
          border-radius: 5px;
          border: 2px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.04);
          transition: var(--transition-fast);
          position: relative;
        }

        .import-checkbox:checked + .import-checkbox-custom {
          background: #ffffff;
          border-color: #ffffff;
        }

        .import-checkbox:checked + .import-checkbox-custom::after {
          content: '';
          position: absolute;
          top: 1px;
          left: 4px;
          width: 6px;
          height: 10px;
          border: 2px solid #000;
          border-top: none;
          border-left: none;
          transform: rotate(45deg);
        }

        .import-toggle-title { font-size: 0.82rem; font-weight: 700; color: var(--text-main); }
        .import-toggle-desc { font-size: 0.68rem; color: var(--text-muted); margin-top: 2px; }

        .import-files-list { display: flex; flex-direction: column; gap: 6px; }

        .import-file-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border-color);
          border-radius: 8px;
        }

        .import-file-icon { font-size: 1.2rem; flex-shrink: 0; }
        .import-file-name { font-size: 0.82rem; font-weight: 700; color: var(--text-main); }
        .import-file-desc { font-size: 0.68rem; color: var(--text-muted); margin-top: 1px; }

        .import-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          color: var(--text-main);
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .import-btn:hover:not(:disabled) { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.3); }
        .import-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .import-status {
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 600;
        }

        .import-status.success { background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.2); color: #4ade80; }
        .import-status.warn { background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.2); color: #fbbf24; }
        .import-status.error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #f87171; }

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
      `}</style>
    </div>
  );
};

interface ProfileModsModalProps {
  profile: Profile;
  onClose: () => void;
}

const ProfileModsModal: React.FC<ProfileModsModalProps> = ({ profile, onClose }) => {
  const [activeTab, setActiveTab] = useState<'installed' | 'search'>('installed');
  const [installedMods, setInstalledMods] = useState<any[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const [installingMap, setInstallingMap] = useState<Record<string, boolean>>({});
  const [uninstallingMap, setUninstallingMap] = useState<Record<string, boolean>>({});

  const loadInstalledMods = async () => {
    setLoadingInstalled(true);
    try {
      const mods = await window.electronAPI.getInstalledMods(profile.id);
      setInstalledMods(mods);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInstalled(false);
    }
  };

  const loadPopularMods = async () => {
    setSearching(true);
    setSearchError(null);
    try {
      const facets = [
        ["project_type:mod"],
        ["categories:fabric"],
        [`versions:${profile.version}`]
      ];
      const res = await fetch(`https://api.modrinth.com/v2/search?facets=${encodeURIComponent(JSON.stringify(facets))}`);
      if (!res.ok) throw new Error('Błąd wyszukiwania na Modrinth');
      const data = await res.json();
      setSearchResults(data.hits || []);
    } catch (err: any) {
      console.error(err);
      setSearchError('Błąd połączenia z Modrinth API. Spróbuj ponownie.');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    loadInstalledMods();
  }, [profile.id]);

  useEffect(() => {
    if (activeTab === 'search') {
      if (searchQuery.trim() === '') {
        loadPopularMods();
      }
    }
  }, [activeTab, searchQuery, profile.version]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const facets = [
        ["project_type:mod"],
        ["categories:fabric"],
        [`versions:${profile.version}`]
      ];
      const res = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(searchQuery)}&facets=${encodeURIComponent(JSON.stringify(facets))}`);
      if (!res.ok) throw new Error('Błąd wyszukiwania na Modrinth');
      const data = await res.json();
      setSearchResults(data.hits || []);
    } catch (err: any) {
      console.error(err);
      setSearchError('Błąd połączenia z Modrinth API. Spróbuj ponownie.');
    } finally {
      setSearching(false);
    }
  };

  const handleInstall = async (mod: { project_id: string; title: string; icon_url?: string }) => {
    setInstallingMap(prev => ({ ...prev, [mod.project_id]: true }));
    try {
      const res = await fetch(`https://api.modrinth.com/v2/project/${mod.project_id}/version?loaders=%5B%22fabric%22%5D&game_versions=%5B%22${profile.version}%22%5D`);
      if (!res.ok) throw new Error('Nie udało się pobrać wersji moda.');
      const versions = await res.json();
      if (!versions || versions.length === 0) {
        alert(`Brak kompatybilnej wersji tego moda dla wersji Minecraft ${profile.version} (Fabric)`);
        return;
      }
      const version = versions[0];
      const file = version.files.find((f: any) => f.primary) || version.files[0];
      if (!file) throw new Error('Brak poprawnego pliku w wersji moda.');

      await window.electronAPI.installProfileMod(
        profile.id,
        mod.project_id,
        mod.title,
        version.id,
        file.url,
        file.filename,
        mod.icon_url
      );
      await loadInstalledMods();
    } catch (err: any) {
      console.error(err);
      alert(`Instalacja nie powiodła się: ${err.message}`);
    } finally {
      setInstallingMap(prev => ({ ...prev, [mod.project_id]: false }));
    }
  };

  const handleUninstall = async (projectId: string) => {
    setUninstallingMap(prev => ({ ...prev, [projectId]: true }));
    try {
      await window.electronAPI.uninstallProfileMod(profile.id, projectId);
      await loadInstalledMods();
    } catch (err: any) {
      console.error(err);
      alert(`Odinstalowanie nie powiodła się: ${err.message}`);
    } finally {
      setUninstallingMap(prev => ({ ...prev, [projectId]: false }));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window mods-modal-window glass-panel animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="mods-modal-title-wrap">
            <span className="modal-title">MODY: {profile.name.toUpperCase()}</span>
            <span className="mods-modal-subtitle">Wersja profilu: {profile.version} (Fabric)</span>
          </div>
          <button className="open-folder-btn" onClick={() => window.electronAPI.openFolder('mods', profile.id)}>
            <FolderOpen size={13} />
            <span>Otwórz folder</span>
          </button>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'installed' ? 'active' : ''}`}
            onClick={() => setActiveTab('installed')}
          >
            <Package size={13} />
            <span>Zainstalowane ({installedMods.length})</span>
          </button>
          <button
            className={`modal-tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <Search size={13} />
            <span>Szukaj w Modrinth</span>
          </button>
        </div>

        <div className="modal-body mods-modal-body">
          {activeTab === 'installed' && (
            <div className="mods-modal-content">
              {loadingInstalled ? (
                <div className="mods-loading">
                  <Cpu size={16} className="spin" />
                  <span>Wczytywanie zainstalowanych modów...</span>
                </div>
              ) : installedMods.length === 0 ? (
                <div className="mods-empty-state">
                  <Package size={48} className="mods-empty-icon" />
                  <h3>Brak zainstalowanych modów</h3>
                  <p>Ten profil jest czysty. Przejdź do zakładki "Szukaj w Modrinth" aby zainstalować mody.</p>
                </div>
              ) : (
                <div className="mods-installed-list">
                  {installedMods.map(mod => {
                    const isUninstalling = uninstallingMap[mod.projectId];
                    return (
                      <div key={mod.projectId} className="installed-mod-item glass-panel">
                        {mod.iconUrl ? (
                          <img src={mod.iconUrl} alt={mod.title} className="mod-icon" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="mod-icon-placeholder"><Package size={14} /></div>
                        )}
                        <div className="mod-info">
                          <span className="mod-name">{mod.title}</span>
                          <span className="mod-file-name">{mod.fileName}</span>
                        </div>
                        <button
                          className="uninstall-mod-btn"
                          disabled={isUninstalling}
                          onClick={() => handleUninstall(mod.projectId)}
                        >
                          {isUninstalling ? <Cpu size={12} className="spin" /> : <Trash2 size={12} />}
                          <span>Odinstaluj</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <div className="mods-modal-content">
              <form onSubmit={handleSearch} className="mods-search-form">
                <div className="search-input-wrapper">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    className="custom-input search-input"
                    placeholder="Wyszukaj mody (np. Sodium, Zoom, Capes)..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                <button type="submit" className="modal-save-btn search-btn" disabled={searching || !searchQuery.trim()}>
                  {searching ? <Cpu size={14} className="spin" /> : <span>Szukaj</span>}
                </button>
              </form>

              {searching && (
                <div className="mods-loading">
                  <Cpu size={16} className="spin" />
                  <span>Przeszukiwanie Modrinth API...</span>
                </div>
              )}

              {searchError && <div className="mods-error">{searchError}</div>}

              {!searching && !searchError && searchResults.length > 0 && (
                <div className="mods-search-results">
                  {searchResults.map(mod => {
                    const isInstalled = installedMods.some(m => m.projectId === mod.project_id);
                    const isInstalling = installingMap[mod.project_id];
                    const isUninstalling = uninstallingMap[mod.project_id];

                    return (
                      <div key={mod.project_id} className="search-mod-item glass-panel">
                        {mod.icon_url ? (
                          <img src={mod.icon_url} alt={mod.title} className="mod-icon" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="mod-icon-placeholder"><Package size={14} /></div>
                        )}
                        <div className="mod-info">
                          <div className="mod-name-row">
                            <span className="mod-name">{mod.title}</span>
                            {mod.downloads !== undefined && (
                              <span className="mod-downloads-badge">
                                <Download size={10} />
                                <span>{(mod.downloads / 1000000).toFixed(1)}M</span>
                              </span>
                            )}
                          </div>
                          <span className="mod-desc">{mod.description}</span>
                        </div>
                        <div className="mod-actions">
                          {isInstalled ? (
                            <button
                              className="uninstall-mod-btn search-uninstall-btn"
                              disabled={isUninstalling}
                              onClick={() => handleUninstall(mod.project_id)}
                            >
                              {isUninstalling ? <Cpu size={12} className="spin" /> : <Trash2 size={12} />}
                              <span>Odinstaluj</span>
                            </button>
                          ) : (
                            <button
                              className="install-mod-btn"
                              disabled={isInstalling}
                              onClick={() => handleInstall(mod)}
                            >
                              {isInstalling ? (
                                <>
                                  <Cpu size={12} className="spin" />
                                  <span>Pobieranie...</span>
                                </>
                              ) : (
                                <>
                                  <Download size={12} />
                                  <span>Zainstaluj</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!searching && !searchError && searchResults.length === 0 && searchQuery.trim() && (
                <div className="mods-empty-state">
                  <Package size={36} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <p>Brak wyników wyszukiwania dla "{searchQuery}"</p>
                  <span>Spróbuj wpisać inną frazę lub skróć nazwę</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
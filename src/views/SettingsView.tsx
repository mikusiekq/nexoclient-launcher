import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, FolderOpen, RefreshCw, Cpu, FileCode, CheckCircle2, HardDrive } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface SettingsViewProps {
  config: LauncherConfig | null;
  onSaveConfig: (newConfig: LauncherConfig) => Promise<void>;
}

function getJavaLabel(p: string): string {
  if (!p) return 'Bundled (wbudowana w launcher)';
  if (p === 'java') return 'Systemowa Java';
  const parts = p.replace(/\\/g, '/').split('/');
  const binIdx = parts.indexOf('bin');
  if (binIdx > 0) return parts[binIdx - 1];
  return parts[parts.length - 1];
}

export const SettingsView: React.FC<SettingsViewProps> = ({ config, onSaveConfig }) => {
  const { t } = useLanguage();
  const [ram, setRam] = useState(4);
  const [maxRam, setMaxRam] = useState(16);
  const [javaPath, setJavaPath] = useState('');
  const [gamePath, setGamePath] = useState('');
  const [discordRpc, setDiscordRpc] = useState(true);

  const [detectedJavas, setDetectedJavas] = useState<string[]>([]);
  const [scanningJava, setScanningJava] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (config && !initialized.current) {
      setRam(config.ram);
      setJavaPath(config.javaPath);
      setGamePath(config.gamePath);
      setDiscordRpc(config.discordRpc ?? true);
      initialized.current = true;
    }
    window.electronAPI.getSystemRam().then((total: number) => {
      setMaxRam(total);
    }).catch(() => {});
    scanJava();
  }, [config]);

  const autoSave = useCallback((overrides?: Partial<LauncherConfig>) => {
    if (!config) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = setTimeout(async () => {
      const updated: LauncherConfig = {
        ...config,
        ram,
        javaPath,
        gamePath,
        fullscreen: false,
        closeOnLaunch: false,
        discordRpc,
        ...overrides,
      };
      await onSaveConfig(updated);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 600);
  }, [config, ram, javaPath, gamePath, discordRpc, onSaveConfig]);

  const scanJava = async () => {
    setScanningJava(true);
    try {
      const paths = await window.electronAPI.detectJava();
      setDetectedJavas(paths);
    } catch (e) {
      console.error(e);
    } finally {
      setScanningJava(false);
    }
  };

  const handleBrowseJava = async () => {
    try {
      const p = await window.electronAPI.browseJava();
      if (p) {
        setJavaPath(p);
        if (!detectedJavas.includes(p)) setDetectedJavas(prev => [p, ...prev]);
        autoSave({ javaPath: p });
      }
    } catch (e) { console.error(e); }
  };

  const handleBrowseGamePath = async () => {
    try {
      const p = await window.electronAPI.browseGamePath();
      if (p) { setGamePath(p); autoSave({ gamePath: p }); }
    } catch (e) { console.error(e); }
  };

  const openFolder = (folderName: string) => window.electronAPI.openFolder(folderName);

  const handleRamChange = (v: number) => { setRam(v); autoSave({ ram: v }); };
  const handleJavaChange = (v: string) => { setJavaPath(v); autoSave({ javaPath: v }); };
  const handleDiscordRpcChange = (v: boolean) => { setDiscordRpc(v); autoSave({ discordRpc: v }); };

  const ramPercent = ((ram - 2) / Math.max(maxRam - 2, 1)) * 100;

  return (
    <div className="settings-container animate-fade-in">
      {/* Page Header */}
      <div className="settings-page-header">
        <div className="settings-header-icon">
          <Settings size={22} />
        </div>
        <div className="settings-header-left">
          <h1 className="settings-title">{t('settings.title')}</h1>
          <span className="settings-subtitle">{t('settings.subtitle')}</span>
        </div>
        <div className="autosave-indicator">
          {saveStatus === 'saving' && <span className="autosave-dot"></span>}
          {saveStatus === 'saved' && <><CheckCircle2 size={13} className="autosave-check" /><span className="autosave-text">{t('settings.saved')}</span></>}
        </div>
      </div>

      <div className="settings-body">
        {/* RAM Card */}
        <div className="settings-card glass-panel">
          <div className="card-header">
            <div className="card-icon-wrap">
              <Cpu size={16} />
            </div>
            <div>
              <div className="card-title">{t('settings.ram_title')}</div>
              <div className="card-desc">{t('settings.ram_desc')}</div>
            </div>
            <div className="ram-badge">{ram} GB</div>
          </div>
          <div className="ram-slider-wrap">
            <span className="ram-limit">2 GB</span>
            <div className="slider-track-wrap">
              <div className="slider-fill" style={{ width: `${ramPercent}%` }}></div>
              <input
                type="range" min="2" max={maxRam} step="1"
                className="custom-slider fancy-slider"
                value={ram}
                onChange={(e) => handleRamChange(Number(e.target.value))}
              />
            </div>
            <span className="ram-limit">{maxRam} GB</span>
          </div>
          <p className="card-hint">Zalecane: 4–6 GB. Max RAM systemu: <strong>{maxRam} GB</strong></p>
        </div>

        {/* Discord RPC Card */}
        <div className="settings-card glass-panel discord-card">
          <div className="card-header">
            <div className="card-icon-wrap discord-icon-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.175 13.175 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div className="card-title">Discord Rich Presence</div>
              <div className="card-desc">Pokaż w statusie Discord że grasz na NEXOCLIENT</div>
            </div>
            <button
              className={`rpc-toggle ${discordRpc ? 'on' : 'off'}`}
              onClick={() => handleDiscordRpcChange(!discordRpc)}
            >
              <span className="rpc-toggle-knob"></span>
            </button>
          </div>
          <div className={`rpc-status-row ${discordRpc ? 'rpc-on' : 'rpc-off'}`}>
            <span className="rpc-status-dot"></span>
            <span className="rpc-status-label">{discordRpc ? 'Włączony — status widoczny w Discord' : 'Wyłączony'}</span>
          </div>
        </div>

        {/* Java Card */}
        <div className="settings-card glass-panel">
          <div className="card-header">
            <div className="card-icon-wrap">
              <FileCode size={16} />
            </div>
            <div>
              <div className="card-title">{t('settings.java_title')}</div>
              <div className="card-desc">{t('settings.java_desc')}</div>
            </div>
            <button className="scan-btn" onClick={scanJava} disabled={scanningJava}>
              <RefreshCw size={13} className={scanningJava ? 'spin' : ''} />
              <span>{t('settings.scan')}</span>
            </button>
          </div>
          <div className="java-options">
            {(['', ...detectedJavas]).map((p) => (
              <button
                key={p || '__bundled__'}
                className={`java-option ${javaPath === p ? 'selected' : ''}`}
                onClick={() => handleJavaChange(p)}
              >
                <div className="java-option-dot"></div>
                <span className="java-option-label">{getJavaLabel(p)}</span>
                {!p && <span className="java-badge">Zalecane</span>}
              </button>
            ))}
            <button className="java-browse-btn" onClick={handleBrowseJava}>
              <FolderOpen size={13} />
              <span>{t('settings.java_browse')}</span>
            </button>
          </div>
        </div>

        {/* Game Path Card */}
        <div className="settings-card glass-panel gamepath-card">
          <div className="card-header">
            <div className="card-icon-wrap">
              <HardDrive size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="card-title">{t('settings.game_dir')}</div>
              <div className="card-desc">{t('settings.game_dir_desc')}</div>
            </div>
            <button className="change-path-btn" onClick={handleBrowseGamePath}>
              <FolderOpen size={13} />
              <span>{t('settings.change')}</span>
            </button>
          </div>

          <div className="gamepath-fancy">
            <div className="gamepath-icon-big">📁</div>
            <div className="gamepath-text-wrap">
              <div className="gamepath-folder-name">.nexoclient</div>
              <div className="gamepath-full">{gamePath || '—'}</div>
            </div>
          </div>

          <div className="folder-shortcuts">
            <button className="folder-shortcut-item" onClick={() => openFolder('game')}>
              <span className="fsi-icon">🗂️</span>
              <div className="fsi-info">
                <span className="fsi-name">{t('settings.main_folder')}</span>
                <span className="fsi-desc">{t('settings.main_folder_desc')}</span>
              </div>
            </button>
            <button className="folder-shortcut-item" onClick={() => openFolder('mods')}>
              <span className="fsi-icon">⚙️</span>
              <div className="fsi-info">
                <span className="fsi-name">{t('settings.mods_folder')}</span>
                <span className="fsi-desc">{t('settings.mods_folder_desc')}</span>
              </div>
            </button>
            <button className="folder-shortcut-item" onClick={() => openFolder('resourcepacks')}>
              <span className="fsi-icon">🎨</span>
              <div className="fsi-info">
                <span className="fsi-name">{t('settings.resourcepacks_folder')}</span>
                <span className="fsi-desc">{t('settings.resourcepacks_folder_desc')}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .settings-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
        }

        .settings-page-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 20px 24px 16px;
          flex-shrink: 0;
        }

        .settings-header-icon {
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

        .settings-header-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .settings-title {
          font-family: 'Outfit', sans-serif;
          font-size: 1.6rem;
          font-weight: 800;
          font-style: italic;
          letter-spacing: 0.06em;
          color: var(--text-main);
        }

        .settings-subtitle {
          font-size: 0.78rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .autosave-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 80px;
          justify-content: flex-end;
        }

        .autosave-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-primary);
          animation: pulse 1s infinite;
        }

        .autosave-check { color: #4ade80; }

        .autosave-text {
          font-size: 0.75rem;
          color: #4ade80;
          font-weight: 600;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .settings-body {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          padding: 8px 24px 32px;
          flex: 1;
        }

        .settings-card {
          padding: 20px;
          border-radius: 14px !important;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .card-icon-wrap {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .card-title {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-main);
        }

        .card-desc {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 500;
          margin-top: 2px;
        }

        .card-hint {
          font-size: 0.72rem;
          color: var(--text-muted);
          line-height: 1.4;
        }

        .card-hint strong { color: var(--text-main); }

        /* RAM */
        .ram-badge {
          margin-left: auto;
          font-family: 'Outfit', sans-serif;
          font-size: 1.3rem;
          font-weight: 800;
          color: var(--text-main);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          padding: 4px 14px;
          border-radius: 8px;
        }

        .ram-slider-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .slider-track-wrap {
          flex: 1;
          position: relative;
          height: 6px;
        }

        .slider-fill {
          position: absolute;
          left: 0;
          top: 0;
          height: 6px;
          background: linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.9));
          border-radius: 3px;
          pointer-events: none;
          z-index: 1;
        }

        .fancy-slider {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          left: 0;
          width: 100%;
          -webkit-appearance: none;
          appearance: none;
          background: rgba(255,255,255,0.08);
          height: 6px;
          border-radius: 3px;
          outline: none;
          border: none;
          cursor: pointer;
          z-index: 2;
        }

        .fancy-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          border: 3px solid #000;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.5);
          cursor: pointer;
          transition: transform 0.15s;
        }

        .fancy-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }

        .ram-limit {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 600;
          white-space: nowrap;
        }

        /* Discord */
        .discord-card { border-color: rgba(88,101,242,0.2) !important; }

        .discord-icon-wrap {
          background: rgba(88,101,242,0.1) !important;
          border-color: rgba(88,101,242,0.2) !important;
          color: #5865F2 !important;
        }

        .rpc-toggle {
          width: 44px;
          height: 24px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }

        .rpc-toggle.on { background: #5865F2; }
        .rpc-toggle.off { background: rgba(255,255,255,0.1); }

        .rpc-toggle-knob {
          position: absolute;
          top: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          transition: left 0.2s;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        }

        .rpc-toggle.on .rpc-toggle-knob { left: 23px; }
        .rpc-toggle.off .rpc-toggle-knob { left: 3px; }

        .rpc-status-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 8px;
        }

        .rpc-status-row.rpc-on {
          background: rgba(88,101,242,0.08);
          border: 1px solid rgba(88,101,242,0.2);
        }

        .rpc-status-row.rpc-off {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border-color);
        }

        .rpc-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .rpc-on .rpc-status-dot {
          background: #5865F2;
          box-shadow: 0 0 6px rgba(88,101,242,0.6);
        }

        .rpc-off .rpc-status-dot { background: rgba(255,255,255,0.2); }

        .rpc-status-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .rpc-on .rpc-status-label { color: #7289da; }

        /* Java */
        .scan-btn {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-muted);
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 5px 10px;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .scan-btn:hover:not(:disabled) {
          color: var(--text-main);
          background: rgba(255,255,255,0.08);
        }

        .scan-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .java-options {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .java-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: rgba(255,255,255,0.02);
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
          text-align: left;
          font-size: 0.82rem;
          font-weight: 600;
        }

        .java-option:hover { background: rgba(255,255,255,0.05); color: var(--text-main); }

        .java-option.selected {
          border-color: rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.06);
          color: var(--text-main);
        }

        .java-option-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 2px solid currentColor;
          flex-shrink: 0;
          transition: background 0.15s;
        }

        .java-option.selected .java-option-dot { background: currentColor; }

        .java-option-label {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .java-badge {
          font-size: 0.62rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 4px;
          background: rgba(74,222,128,0.1);
          border: 1px solid rgba(74,222,128,0.2);
          color: #4ade80;
          flex-shrink: 0;
        }

        .java-browse-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 14px;
          border-radius: 8px;
          border: 1px dashed rgba(255,255,255,0.12);
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.78rem;
          font-weight: 600;
          transition: var(--transition-fast);
        }

        .java-browse-btn:hover {
          border-color: rgba(255,255,255,0.25);
          color: var(--text-main);
          background: rgba(255,255,255,0.03);
        }

        /* Game Path */
        .change-path-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-muted);
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 5px 10px;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .change-path-btn:hover { color: var(--text-main); background: rgba(255,255,255,0.08); }

        .gamepath-fancy {
          display: flex;
          align-items: center;
          gap: 14px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 14px 16px;
        }

        .gamepath-icon-big { font-size: 2rem; flex-shrink: 0; }

        .gamepath-text-wrap { min-width: 0; }

        .gamepath-folder-name {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-main);
        }

        .gamepath-full {
          font-size: 0.68rem;
          color: var(--text-muted);
          margin-top: 3px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .folder-shortcuts { display: flex; flex-direction: column; gap: 6px; }

        .folder-shortcut-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: rgba(255,255,255,0.02);
          cursor: pointer;
          transition: var(--transition-fast);
          text-align: left;
        }

        .folder-shortcut-item:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.15);
        }

        .fsi-icon { font-size: 1.1rem; flex-shrink: 0; }

        .fsi-info { display: flex; flex-direction: column; gap: 1px; }

        .fsi-name {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text-main);
        }

        .fsi-desc {
          font-size: 0.68rem;
          color: var(--text-muted);
        }

        .spin { animation: spin 1s linear infinite; }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

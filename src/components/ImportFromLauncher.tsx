import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Cpu, Download, FolderSearch, ShieldAlert } from 'lucide-react';

interface ImportFromLauncherProps {
  versions: string[];
  onBack: () => void;
  onImported: (config: LauncherConfig) => Promise<void>;
}

type Choice = keyof Omit<ImportOptions, 'name' | 'version'>;

// Wizard body for importing a profile from another launcher: launcher -> profile -> what to bring over
export const ImportFromLauncher: React.FC<ImportFromLauncherProps> = ({ versions, onBack, onImported }) => {
  const [sources, setSources] = useState<ImportSource[] | null>(null);
  const [source, setSource] = useState<ImportSource | null>(null);
  const [profile, setProfile] = useState<ImportableProfile | null>(null);
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [choices, setChoices] = useState<Record<Choice, boolean>>({
    mods: true,
    worlds: true,
    servers: true,
    options: true,
    modConfigs: true,
    resourcePacks: true,
  });
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.listImportSources().then(setSources).catch(() => setSources([]));
  }, []);

  const pickProfile = (p: ImportableProfile) => {
    setProfile(p);
    setName(p.name);
    setVersion(p.version || versions[0] || '');
    setChoices({
      mods: p.mods > 0,
      worlds: p.worlds.length > 0,
      servers: p.hasServers,
      options: p.hasOptions,
      modConfigs: p.modConfigs > 0,
      resourcePacks: p.resourcePacks > 0,
    });
    setError(null);
  };

  const runImport = async () => {
    if (!source || !profile) return;
    setImporting(true);
    setError(null);
    try {
      const config = await window.electronAPI.importProfile(source.id, profile.key, { name, version, ...choices });
      await onImported(config);
    } catch (e: any) {
      setError(e?.message || 'Import nie powiódł się.');
      setImporting(false);
    }
  };

  // Versions offered in the picker: the one the other launcher used first, even if it's not in our list
  const versionOptions = Array.from(new Set([...(profile?.version ? [profile.version] : []), ...versions]));

  const items: { key: Choice; label: string; detail: string; available: boolean }[] = profile
    ? [
        { key: 'mods', label: 'Mody', detail: `${profile.mods} plików`, available: profile.mods > 0 },
        {
          key: 'worlds',
          label: 'Światy',
          detail: profile.worlds.length ? profile.worlds.join(', ') : 'brak',
          available: profile.worlds.length > 0,
        },
        { key: 'servers', label: 'Lista serwerów', detail: 'zastąpi obecną (kopia .bak)', available: profile.hasServers },
        { key: 'options', label: 'Ustawienia Minecrafta', detail: 'grafika, sterowanie, dźwięk — zastąpi obecne (kopia .bak)', available: profile.hasOptions },
        {
          key: 'modConfigs',
          label: 'Ustawienia modów',
          detail: `${profile.modConfigs} plików (config) — nadpisane trafią do config-backup`,
          available: profile.modConfigs > 0,
        },
        { key: 'resourcePacks', label: 'Paczki zasobów', detail: `${profile.resourcePacks}`, available: profile.resourcePacks > 0 },
      ]
    : [];

  return (
    <div className="wizard-body">
      {importing && (
        <div className="modal-saving-overlay">
          <Cpu size={36} className="spin saving-spinner" />
          <span className="saving-status-text">Importowanie profilu...</span>
        </div>
      )}

      {!source && (
        <>
          <div className="wizard-step-title">
            <h2>Importuj z clienta</h2>
            <p>Wybierz launcher, z którego chcesz przenieść profil</p>
          </div>
          {!sources ? (
            <div className="wiz-loading"><Cpu size={20} className="spin" /><span>Szukanie launcherów...</span></div>
          ) : (
            <div className="imp-list">
              {sources.map(s => {
                const usable = s.found && s.profiles.length > 0;
                return (
                  <button key={s.id} className="imp-row" disabled={!usable} onClick={() => setSource(s)}>
                    <div className="imp-row-icon"><FolderSearch size={17} /></div>
                    <div className="imp-row-info">
                      <span className="imp-row-name">{s.name}</span>
                      <span className="imp-row-meta">
                        {!s.found ? 'Nie znaleziono na tym komputerze' : `Profile: ${s.profiles.length}`}
                      </span>
                    </div>
                    {usable && <ChevronRight size={16} className="imp-row-chevron" />}
                  </button>
                );
              })}
            </div>
          )}
          <div className="wizard-footer">
            <button className="wizard-back-btn" onClick={onBack}>
              <ChevronLeft size={16} />
              <span>Wstecz</span>
            </button>
          </div>
        </>
      )}

      {source && !profile && (
        <>
          <div className="wizard-step-title">
            <h2>Profile z {source.name}</h2>
            <p>Wybierz profil, który chcesz przenieść</p>
          </div>
          <div className="imp-list">
            {source.profiles.map(p => (
              <button key={p.key} className="imp-row" onClick={() => pickProfile(p)}>
                <div className="imp-row-icon"><Download size={17} /></div>
                <div className="imp-row-info">
                  <span className="imp-row-name">{p.name}</span>
                  <span className="imp-row-meta">
                    {p.version || 'wersja nieznana'} · mody: {p.mods} · światy: {p.worlds.length}
                  </span>
                </div>
                <ChevronRight size={16} className="imp-row-chevron" />
              </button>
            ))}
          </div>
          <div className="wizard-footer">
            <button className="wizard-back-btn" onClick={() => setSource(null)}>
              <ChevronLeft size={16} />
              <span>Wstecz</span>
            </button>
          </div>
        </>
      )}

      {source && profile && (
        <>
          <div className="wizard-step-title">
            <h2>Przenieś „{profile.name}”</h2>
            <p>Wybierz, co zaimportować z {source.name}</p>
          </div>

          <div className="imp-fields">
            <div className="wiz-form-group">
              <label className="wiz-label">Nazwa profilu</label>
              <input className="custom-input" value={name} onChange={e => setName(e.target.value)} maxLength={32} />
            </div>
            <div className="wiz-form-group">
              <label className="wiz-label">Wersja Minecraft</label>
              <select className="custom-input imp-select" value={version} onChange={e => setVersion(e.target.value)}>
                {versionOptions.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="imp-choices">
            {items.map(item => (
              <label key={item.key} className={`imp-choice ${item.available ? '' : 'disabled'}`}>
                <input
                  type="checkbox"
                  checked={item.available && choices[item.key]}
                  disabled={!item.available}
                  onChange={e => setChoices(c => ({ ...c, [item.key]: e.target.checked }))}
                />
                <span className="imp-choice-label">{item.label}</span>
                <span className="imp-choice-detail">{item.detail}</span>
              </label>
            ))}
          </div>

          {error && (
            <div className="alert-card alert-error">
              <ShieldAlert size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="wizard-footer">
            <button className="wizard-back-btn" onClick={() => setProfile(null)} disabled={importing}>
              <ChevronLeft size={16} />
              <span>Wstecz</span>
            </button>
            <button className="wizard-next-btn" onClick={runImport} disabled={importing || !name.trim() || !version}>
              <Download size={15} />
              <span>Importuj</span>
            </button>
          </div>
        </>
      )}

      <style>{`
        .imp-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 320px;
          overflow-y: auto;
        }

        .imp-row {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          color: var(--text-main);
          text-align: left;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .imp-row:hover:not(:disabled) {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.22);
        }

        .imp-row:disabled { opacity: 0.4; cursor: default; }

        .imp-row-icon {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.06);
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .imp-row-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .imp-row-name { font-size: 0.86rem; font-weight: 700; }
        .imp-row-meta { font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; }
        .imp-row-chevron { color: var(--text-muted); flex-shrink: 0; }

        .imp-fields {
          display: grid;
          grid-template-columns: 1fr 160px;
          gap: 12px;
        }

        .imp-select { cursor: pointer; }
        .imp-select option { background: #0b0b0b; }

        .imp-choices {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .imp-choice {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-color);
          border-radius: 9px;
          cursor: pointer;
          font-size: 0.8rem;
        }

        .imp-choice.disabled { opacity: 0.4; cursor: default; }
        .imp-choice input { accent-color: #ffffff; width: 15px; height: 15px; cursor: inherit; }
        .imp-choice-label { font-weight: 700; color: var(--text-main); }
        .imp-choice-detail {
          margin-left: auto;
          color: var(--text-muted);
          font-size: 0.7rem;
          max-width: 55%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
};

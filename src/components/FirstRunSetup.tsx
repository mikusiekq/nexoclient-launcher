import React, { useState } from 'react';
import { User, ChevronRight, ChevronLeft, LogIn, ShieldAlert, Check, Layers } from 'lucide-react';
import logoIcon from '../assets/logo.png';

interface FirstRunSetupProps {
  config: LauncherConfig;
  versions: string[];
  onLoginOffline: (username: string) => Promise<void>;
  onLoginMicrosoft: () => Promise<void>;
  onSaveConfig: (config: LauncherConfig) => Promise<void>;
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Shown once on first launch: step 1 adds an account, step 2 creates the first profile (optional)
export const FirstRunSetup: React.FC<FirstRunSetupProps> = ({
  config,
  versions,
  onLoginOffline,
  onLoginMicrosoft,
  onSaveConfig,
}) => {
  const hasAccount = !!config.account;
  const [step, setStep] = useState<1 | 2>(hasAccount ? 2 : 1);
  const [showOfflineInput, setShowOfflineInput] = useState(false);
  const [nick, setNick] = useState('');
  const [profileName, setProfileName] = useState('Nowy profil');
  const [profileVersion, setProfileVersion] = useState(versions[0] || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>, fallbackError: string) => {
    setLoading(true);
    setError(null);
    try {
      await action();
    } catch (e: any) {
      setError(e?.message || fallbackError);
    } finally {
      setLoading(false);
    }
  };

  const handleOffline = () => {
    const name = nick.trim();
    if (name.length < 3) return setError('Nick musi mieć co najmniej 3 znaki!');
    if (!/^[a-zA-Z0-9_]+$/.test(name)) return setError('Nick może zawierać tylko litery, cyfry i _');
    run(async () => {
      await onLoginOffline(name);
      setStep(2);
    }, 'Błąd dodawania konta.');
  };

  const handleMicrosoft = () =>
    run(async () => {
      await onLoginMicrosoft();
      setStep(2);
    }, 'Błąd logowania Microsoft.');

  const finish = (withProfile: boolean) =>
    run(async () => {
      if (!withProfile) {
        await onSaveConfig({ ...config, setupCompleted: true });
        return;
      }
      const profile = {
        id: genId(),
        name: profileName.trim(),
        version: profileVersion,
        accountUuid: null,
        engine: 'fabric',
        icon: 'grass_block_top',
        createdAt: Date.now(),
      } as Profile;
      await onSaveConfig({
        ...config,
        profiles: [...config.profiles, profile],
        activeProfileId: profile.id,
        setupCompleted: true,
      });
    }, 'Nie udało się zapisać profilu.');

  return (
    <div className="frs-backdrop">
      <div className="frs-window animate-fade-in">
        <div className="frs-header">
          <img src={logoIcon} alt="" className="frs-logo" />
          <div>
            <h1 className="frs-title">Pierwsza konfiguracja</h1>
            <p className="frs-subtitle">Dodaj konto i utwórz profil, aby zacząć grać</p>
          </div>
        </div>

        <div className="frs-steps">
          <div className={`frs-step ${step === 1 ? 'active' : 'done'}`}>
            <span className="frs-step-num">{step > 1 ? <Check size={12} /> : 1}</span>
            <span>Konto</span>
          </div>
          <div className="frs-step-line" />
          <div className={`frs-step ${step === 2 ? 'active' : ''}`}>
            <span className="frs-step-num">2</span>
            <span>Profil</span>
          </div>
        </div>

        {error && (
          <div className="alert-card alert-error frs-error">
            <ShieldAlert size={15} />
            <span>{error}</span>
          </div>
        )}

        {step === 1 && (
          <div className="frs-body">
            {!showOfflineInput ? (
              <>
                <button className="frs-option" onClick={() => { setError(null); setShowOfflineInput(true); }} disabled={loading}>
                  <div className="frs-option-icon"><User size={17} /></div>
                  <div className="frs-option-info">
                    <div className="frs-option-name">Konto offline</div>
                    <div className="frs-option-desc">Tylko nick, bez logowania</div>
                  </div>
                  <ChevronRight size={16} className="frs-option-chevron" />
                </button>
                <button className="frs-option" onClick={handleMicrosoft} disabled={loading}>
                  <div className="frs-option-icon">
                    <svg viewBox="0 0 23 23" width="16" height="16">
                      <rect x="0" y="0" width="11" height="11" fill="#f25022" />
                      <rect x="12" y="0" width="11" height="11" fill="#7fba00" />
                      <rect x="0" y="12" width="11" height="11" fill="#00a4ef" />
                      <rect x="12" y="12" width="11" height="11" fill="#ffb900" />
                    </svg>
                  </div>
                  <div className="frs-option-info">
                    <div className="frs-option-name">{loading ? 'Czekam na logowanie...' : 'Konto Microsoft'}</div>
                    <div className="frs-option-desc">Konto z licencją Minecraft, dostęp do serwerów premium</div>
                  </div>
                  <ChevronRight size={16} className="frs-option-chevron" />
                </button>
              </>
            ) : (
              <div className="frs-form">
                <label className="frs-label">Nazwa gracza (nick)</label>
                <input
                  className="custom-input"
                  placeholder="Wpisz nick..."
                  value={nick}
                  onChange={e => setNick(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleOffline()}
                  maxLength={16}
                  disabled={loading}
                  autoFocus
                />
                <div className="frs-footer">
                  <button className="frs-back-btn" onClick={() => { setError(null); setShowOfflineInput(false); }} disabled={loading}>
                    <ChevronLeft size={16} />
                    <span>Wstecz</span>
                  </button>
                  <button className="frs-next-btn" onClick={handleOffline} disabled={loading || nick.trim().length < 3}>
                    <LogIn size={15} />
                    <span>{loading ? 'Dodawanie...' : 'Dalej'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="frs-body">
            {config.account && (
              <div className="frs-account-chip">
                <img src={config.account.avatar} alt="" />
                <span>Zalogowano jako <strong>{config.account.username}</strong></span>
              </div>
            )}

            <div className="frs-form">
              <label className="frs-label">Nazwa profilu</label>
              <div className="frs-name-row">
                <div className="frs-name-icon"><Layers size={16} /></div>
                <input
                  className="custom-input"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  maxLength={32}
                  disabled={loading}
                />
              </div>

              <label className="frs-label">Wersja Minecraft</label>
              <div className="frs-versions">
                {versions.slice(0, 24).map(v => (
                  <button
                    key={v}
                    className={`frs-version ${profileVersion === v ? 'selected' : ''}`}
                    onClick={() => setProfileVersion(v)}
                    disabled={loading}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="frs-footer">
              <button className="frs-skip-btn" onClick={() => finish(false)} disabled={loading}>
                Pomiń — utworzę później
              </button>
              <button
                className="frs-next-btn"
                onClick={() => finish(true)}
                disabled={loading || !profileName.trim() || !profileVersion}
              >
                <Check size={15} />
                <span>Utwórz profil i zacznij</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .frs-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(10px);
          -webkit-app-region: drag;
        }

        .frs-window {
          width: 100%;
          max-width: 520px;
          max-height: 100%;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding: 28px;
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: 18px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.8);
          -webkit-app-region: no-drag;
        }

        .frs-header {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .frs-logo {
          width: 52px;
          height: 52px;
          object-fit: contain;
          flex-shrink: 0;
        }

        .frs-title {
          font-family: var(--font-display);
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          color: var(--text-main);
        }

        .frs-subtitle {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .frs-steps {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .frs-step {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-muted);
        }

        .frs-step.active { color: var(--text-main); }
        .frs-step.done { color: #4ade80; }

        .frs-step-num {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          border: 1px solid rgba(255,255,255,0.2);
        }

        .frs-step.active .frs-step-num { background: #fff; color: #000; border-color: #fff; }
        .frs-step.done .frs-step-num { background: rgba(74,222,128,0.15); border-color: rgba(74,222,128,0.4); }

        .frs-step-line {
          flex: 1;
          height: 1px;
          background: var(--border-color);
        }

        .frs-error { margin: 0; }

        .frs-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .frs-option {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 14px 16px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: var(--text-main);
          cursor: pointer;
          text-align: left;
          transition: var(--transition-fast);
        }

        .frs-option:hover:not(:disabled) {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.22);
        }

        .frs-option:disabled { opacity: 0.6; cursor: default; }

        .frs-option-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.06);
          flex-shrink: 0;
        }

        .frs-option-info { flex: 1; min-width: 0; }
        .frs-option-name { font-size: 0.88rem; font-weight: 700; }
        .frs-option-desc { font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; }
        .frs-option-chevron { color: var(--text-muted); flex-shrink: 0; }

        .frs-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .frs-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .frs-name-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .frs-name-row .custom-input { flex: 1; }

        .frs-name-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .frs-versions {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
          gap: 6px;
          max-height: 150px;
          overflow-y: auto;
          padding-right: 2px;
        }

        .frs-version {
          padding: 8px 6px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-muted);
          font-size: 0.76rem;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .frs-version:hover:not(:disabled) { color: var(--text-main); border-color: rgba(255,255,255,0.22); }
        .frs-version.selected { background: #fff; border-color: #fff; color: #000; }

        .frs-account-chip {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: rgba(74,222,128,0.08);
          border: 1px solid rgba(74,222,128,0.25);
          border-radius: 10px;
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .frs-account-chip img { width: 22px; height: 22px; border-radius: 4px; image-rendering: pixelated; }
        .frs-account-chip strong { color: var(--text-main); }

        .frs-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 8px;
        }

        .frs-next-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 18px;
          background: #fff;
          color: #000;
          border: 1px solid #fff;
          border-radius: 10px;
          font-size: 0.82rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .frs-next-btn:hover:not(:disabled) { background: #000; color: #fff; }
        .frs-next-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .frs-back-btn,
        .frs-skip-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 12px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          border-radius: 8px;
        }

        .frs-back-btn:hover:not(:disabled),
        .frs-skip-btn:hover:not(:disabled) { color: var(--text-main); background: rgba(255,255,255,0.05); }
      `}</style>
    </div>
  );
};

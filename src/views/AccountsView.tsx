import React, { useState } from 'react';
import { WifiOff, Trash2, Check, LogIn, ShieldAlert, ChevronRight, User } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface AccountsViewProps {
  config: LauncherConfig | null;
  onSaveConfig: (config: LauncherConfig) => Promise<void>;
  onLoginOffline: (username: string) => Promise<void>;
  onLoginMicrosoft: () => Promise<void>;
  isOnboarding?: boolean;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  config,
  onSaveConfig,
  onLoginOffline,
  onLoginMicrosoft,
  isOnboarding = false,
}) => {
  const { t } = useLanguage();
  const [offlineUsername, setOfflineUsername] = useState('');
  const [showOfflineInput, setShowOfflineInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedAccounts = config?.savedAccounts || [];
  const activeUuid = config?.account?.uuid || null;

  const handleAddOffline = async () => {
    if (offlineUsername.trim().length < 3) {
      setError('Nick musi mieć co najmniej 3 znaki!');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(offlineUsername)) {
      setError('Nick może zawierać tylko litery, cyfry i _');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onLoginOffline(offlineUsername.trim());
      setOfflineUsername('');
      setShowOfflineInput(false);
    } catch (e: any) {
      setError(e.message || 'Błąd dodawania konta.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMicrosoft = async () => {
    setLoading(true);
    setError(null);
    try {
      await onLoginMicrosoft();
    } catch (e: any) {
      setError(e.message || 'Błąd logowania Microsoft.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = (account: AccountInfo) => {
    if (!config) return;
    onSaveConfig({ ...config, account });
  };

  const handleDeleteAccount = (uuid: string) => {
    if (!config) return;
    const filtered = savedAccounts.filter(a => a.uuid !== uuid);
    const newActive = config.account?.uuid === uuid ? (filtered[0] || null) : config.account;
    onSaveConfig({ ...config, savedAccounts: filtered, account: newActive });
  };

  const showOnboarding = isOnboarding && savedAccounts.length === 0;

  if (showOnboarding) {
    return (
      <div className="accounts-view animate-fade-in onboarding-mode">
        {/* Page header */}
        <div className="accounts-page-header">
          <div className="accounts-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="accounts-header-left">
            <h1 className="accounts-title">{t('accounts.title')}</h1>
            <span className="accounts-subtitle">{t('accounts.subtitle')}</span>
          </div>
        </div>

        <div className="onb-center-wrap">
          <div className="onb-layout">
            {/* LEFT */}
            <div className="onb-left">
              <div className="onb-badge">
                <span className="onb-badge-icon">✦</span>
                <span>Pierwsze kroki</span>
              </div>
              <h2 className="onb-title">Witaj! Skonfigurujmy Twoje konto</h2>
              <p className="onb-desc">Przed grą w Minecraft musisz dodać konto. Wybierz konto offline do gry jednoosobowej lub zaloguj się pełnoprawnym kontem Microsoft.</p>
              <div className="onb-steps">
                <div className="onb-step onb-step-active">
                  <div className="onb-step-num">1</div>
                  <div className="onb-step-text">
                    <div className="onb-step-title">Dodaj konto</div>
                    <div className="onb-step-desc">Wybierz konto offline lub Microsoft</div>
                  </div>
                </div>
                <div className="onb-step">
                  <div className="onb-step-num onb-step-num-dim">2</div>
                  <div className="onb-step-text">
                    <div className="onb-step-title">Utwórz profil</div>
                    <div className="onb-step-desc">Skonfiguruj ustawienia gry</div>
                  </div>
                </div>
                <div className="onb-step">
                  <div className="onb-step-num onb-step-num-dim">3</div>
                  <div className="onb-step-text">
                    <div className="onb-step-title">Graj!</div>
                    <div className="onb-step-desc">Uruchom Minecraft i baw się</div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="onb-right">
              <div className="onb-right-label">Wybierz metodę logowania:</div>
              {error && (
                <div className="alert-card alert-error" style={{ marginBottom: '8px' }}>
                  <ShieldAlert size={15} />
                  <span>{error}</span>
                </div>
              )}
              {!showOfflineInput ? (
                <>
                  <button className="login-method-card" onClick={() => setShowOfflineInput(true)}>
                    <div className="lmc-icon lmc-offline"><User size={16} /></div>
                    <div className="lmc-info">
                      <div className="lmc-name">Konto offline</div>
                      <div className="lmc-desc">Graj bez konta – tylko nick, żadnych haseł</div>
                    </div>
                    <ChevronRight size={16} className="lmc-chevron" />
                  </button>
                  <button className="login-method-card" onClick={handleAddMicrosoft} disabled={loading}>
                    <div className="lmc-icon lmc-microsoft">
                      <svg viewBox="0 0 23 23" width="16" height="16">
                        <rect x="0" y="0" width="11" height="11" fill="#f25022" />
                        <rect x="12" y="0" width="11" height="11" fill="#7fba00" />
                        <rect x="0" y="12" width="11" height="11" fill="#00a4ef" />
                        <rect x="12" y="12" width="11" height="11" fill="#ffb900" />
                      </svg>
                    </div>
                    <div className="lmc-info">
                      <div className="lmc-name">Konto Microsoft</div>
                      <div className="lmc-desc">Pełny dostęp do serwerów multiplayer</div>
                    </div>
                    <ChevronRight size={16} className="lmc-chevron" />
                  </button>
                </>
              ) : (
                <div className="onb-offline-form">
                  <div className="onb-offline-title">
                    <button className="onb-back-btn" onClick={() => setShowOfflineInput(false)}>←</button>
                    Konto offline
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Nazwa gracza (Nick)</label>
                    <input
                      type="text"
                      className="custom-input"
                      placeholder="Wpisz nick..."
                      value={offlineUsername}
                      onChange={(e) => setOfflineUsername(e.target.value)}
                      maxLength={16}
                      disabled={loading}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleAddOffline()}
                    />
                  </div>
                  <button className="onb-confirm-btn" onClick={handleAddOffline} disabled={loading || offlineUsername.trim().length < 3}>
                    <LogIn size={15} />
                    <span>{loading ? t('accounts.confirm_loading') : t('accounts.confirm_add')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <style>{`
          .onboarding-mode {
            flex-direction: column !important;
          }

          .accounts-page-header {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 20px 24px 16px;
            flex-shrink: 0;
          }
          .accounts-header-icon {
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
          .accounts-header-left {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .accounts-title {
            font-family: 'Outfit', sans-serif;
            font-size: 1.6rem;
            font-weight: 800;
            font-style: italic;
            letter-spacing: 0.06em;
            color: var(--text-main);
          }
          .accounts-subtitle {
            font-size: 0.78rem;
            color: var(--text-muted);
            font-weight: 500;
          }
          .onb-center-wrap {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .onb-layout {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 48px;
            max-width: 860px;
            width: 100%;
            padding: 0 40px 32px;
          }
          .onb-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 14px;
            background: rgba(255,255,255,0.07);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 20px;
            color: var(--text-main);
            font-size: 0.75rem;
            font-weight: 700;
            margin-bottom: 20px;
          }
          .onb-badge-icon { font-size: 0.85rem; }
          .onb-title {
            font-size: 1.5rem;
            font-weight: 800;
            color: var(--text-main);
            margin-bottom: 14px;
            line-height: 1.25;
          }
          .onb-desc {
            font-size: 0.85rem;
            color: var(--text-muted);
            line-height: 1.6;
            margin-bottom: 28px;
          }
          .onb-steps { display: flex; flex-direction: column; gap: 16px; }
          .onb-step { display: flex; align-items: flex-start; gap: 12px; }
          .onb-step-num {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #ffffff;
            color: #000000;
            font-size: 0.8rem;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .onb-step-num-dim {
            background: rgba(255,255,255,0.1);
            color: var(--text-muted);
          }
          .onb-step-title { font-size: 0.88rem; font-weight: 700; color: var(--text-main); }
          .onb-step-desc { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }
          .onb-right { display: flex; flex-direction: column; gap: 10px; justify-content: center; }
          .onb-right-label { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 4px; font-weight: 600; }
          .login-method-card {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 16px;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            cursor: pointer;
            transition: var(--transition-smooth);
            text-align: left;
            color: var(--text-main);
            width: 100%;
          }
          .login-method-card:hover:not(:disabled) {
            background: rgba(255,255,255,0.07);
            border-color: rgba(255,255,255,0.2);
          }
          .login-method-card:disabled { opacity: 0.5; cursor: not-allowed; }
          .lmc-icon {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .lmc-offline { background: rgba(255,255,255,0.08); color: var(--text-main); }
          .lmc-microsoft { background: rgba(255,255,255,0.06); }
          .lmc-info { flex: 1; }
          .lmc-name { font-size: 0.88rem; font-weight: 700; color: var(--text-main); }
          .lmc-desc { font-size: 0.72rem; color: var(--text-muted); margin-top: 3px; }
          .lmc-chevron { color: var(--text-muted); flex-shrink: 0; }
          .onb-offline-form { display: flex; flex-direction: column; gap: 12px; }
          .onb-offline-title { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 700; color: var(--text-main); }
          .onb-back-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1rem; padding: 0; }
          .onb-back-btn:hover { color: var(--text-main); }
          .onb-confirm-btn {
            display: flex; align-items: center; justify-content: center; gap: 8px;
            padding: 12px;
            background: #ffffff;
            color: #000000;
            border: 1px solid #ffffff;
            border-radius: 8px;
            font-size: 0.88rem;
            font-weight: 700;
            cursor: pointer;
            transition: var(--transition-fast);
          }
          .onb-confirm-btn:hover:not(:disabled) { background: #000; color: #fff; }
          .onb-confirm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="accounts-view animate-fade-in">
      {/* Header */}
      <div className="accounts-page-header">
        <div className="accounts-header-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div className="accounts-header-left">
          <h1 className="accounts-title">{t('accounts.title')}</h1>
          <span className="accounts-subtitle">{t('accounts.subtitle')}</span>
        </div>
      </div>

      <div className="accounts-content">
        {/* Add account buttons */}
        <div className="add-buttons-row">
          <button
            className="add-btn offline-add-btn"
            onClick={() => setShowOfflineInput(!showOfflineInput)}
            disabled={loading}
          >
            <WifiOff size={16} />
            <span>{t('accounts.add_offline')}</span>
          </button>
          <button
            className="add-btn microsoft-add-btn"
            onClick={handleAddMicrosoft}
            disabled={loading}
          >
            <svg viewBox="0 0 23 23" width="15" height="15">
              <rect x="0" y="0" width="11" height="11" fill="#f25022" />
              <rect x="12" y="0" width="11" height="11" fill="#7fba00" />
              <rect x="0" y="12" width="11" height="11" fill="#00a4ef" />
              <rect x="12" y="12" width="11" height="11" fill="#ffb900" />
            </svg>
            <span>{loading ? t('accounts.confirm_loading') : t('accounts.add_microsoft')}</span>
          </button>
        </div>

        {/* Offline input panel */}
        {showOfflineInput && (
          <div className="offline-input-panel glass-panel animate-fade-in">
            <label className="input-label">Nazwa gracza (Nick)</label>
            <div className="offline-input-row">
              <input
                type="text"
                className="custom-input"
                placeholder="Wpisz nick..."
                value={offlineUsername}
                onChange={(e) => setOfflineUsername(e.target.value)}
                maxLength={16}
                disabled={loading}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddOffline()}
              />
              <button className="btn btn-primary" onClick={handleAddOffline} disabled={loading}>
                <LogIn size={16} />
                <span>Dodaj</span>
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="alert-card alert-error">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* TWOJE KONTA section */}
        <div className="your-accounts-header">
          <span className="your-accounts-title">{t('accounts.your_accounts')}</span>
          <span className="your-accounts-count">{savedAccounts.length}</span>
        </div>

        <div className="accounts-list">
          {savedAccounts.length === 0 ? (
            <div className="no-accounts-empty">
              <WifiOff size={32} className="empty-icon" />
              <p>{t('accounts.no_accounts')}</p>
              <span>{t('accounts.no_accounts_hint')}</span>
            </div>
          ) : (
            savedAccounts.map((acc) => {
              const isActive = acc.uuid === activeUuid;
              return (
                <div key={acc.uuid} className={`account-card glass-panel ${isActive ? 'active' : ''}`}>
                  <img
                    src={acc.avatar}
                    alt={acc.username}
                    className="account-card-avatar"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://minotar.net/helm/Steve/32.png';
                    }}
                  />
                  <div className="account-card-info">
                    <span className="account-card-name">{acc.username}</span>
                    <span className="account-card-type">
                      {acc.type === 'microsoft' ? 'Microsoft Premium' : 'Offline'}
                    </span>
                  </div>
                  <div className="account-card-actions">
                    {isActive ? (
                      <div className="active-indicator">
                        <Check size={14} />
                        <span>{t('accounts.active')}</span>
                      </div>
                    ) : (
                      <button
                        className="switch-btn"
                        onClick={() => handleSwitchAccount(acc)}
                      >
                          {t('accounts.use')}
                      </button>
                    )}
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteAccount(acc.uuid)}
                      title="Usuń konto"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <style>{`
        .accounts-view {
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }

        /* Page Header */
        .accounts-page-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 20px 24px 16px;
          flex-shrink: 0;
        }

        .accounts-header-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .accounts-title {
          font-family: 'Outfit', sans-serif;
          font-size: 1.6rem;
          font-weight: 800;
          font-style: italic;
          letter-spacing: 0.06em;
          color: var(--text-main);
        }

        .accounts-subtitle {
          font-size: 0.78rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .accounts-header-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-main);
          flex-shrink: 0;
        }

        .accounts-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px 24px 32px;
        }

        /* Add buttons */
        .add-buttons-row {
          display: flex;
          gap: 10px;
        }

        .add-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 0;
          border-radius: 10px;
          border: 1px solid var(--border-color);
          background: var(--bg-panel);
          color: var(--text-main);
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .add-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        .add-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .offline-add-btn:hover:not(:disabled) {
          border-color: rgba(161, 161, 170, 0.4);
        }

        .microsoft-add-btn:hover:not(:disabled) {
          border-color: rgba(0, 164, 239, 0.4);
        }

        /* Offline input panel */
        .offline-input-panel {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .offline-input-row {
          display: flex;
          gap: 10px;
        }

        .offline-input-row .custom-input {
          flex: 1;
        }

        .offline-input-row .btn {
          white-space: nowrap;
        }

        /* TWOJE KONTA header */
        .your-accounts-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 8px;
        }

        .your-accounts-title {
          font-family: 'Outfit', sans-serif;
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .your-accounts-count {
          font-size: 0.65rem;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          padding: 2px 8px;
          border-radius: 10px;
        }

        /* Accounts list */
        .accounts-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .no-accounts-empty {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-muted);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .empty-icon {
          opacity: 0.3;
          margin-bottom: 8px;
        }

        .no-accounts-empty p {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-main);
        }

        .no-accounts-empty span {
          font-size: 0.8rem;
        }

        /* Account card */
        .account-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 10px;
          transition: var(--transition-fast);
        }

        .account-card.active {
          border-color: rgba(74, 222, 128, 0.25) !important;
          background: rgba(74, 222, 128, 0.03) !important;
        }

        .account-card-avatar {
          width: 38px;
          height: 38px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: #111;
          image-rendering: pixelated;
          flex-shrink: 0;
        }

        .account-card-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .account-card-name {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-main);
        }

        .account-card-type {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        .account-card-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .active-indicator {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.75rem;
          font-weight: 700;
          color: #4ade80;
          padding: 5px 12px;
          border-radius: 6px;
          background: rgba(74, 222, 128, 0.08);
          border: 1px solid rgba(74, 222, 128, 0.2);
        }

        .switch-btn {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-color);
          padding: 5px 14px;
          border-radius: 6px;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .switch-btn:hover {
          background: #ffffff;
          color: #000000;
          border-color: #ffffff;
        }

        .delete-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 6px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .delete-btn:hover {
          color: #f87171;
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.2);
        }
      `}</style>
    </div>
  );
};

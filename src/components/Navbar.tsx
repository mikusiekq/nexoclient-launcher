import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Home, Settings as SettingsIcon, Users, User, LogOut, Layers, Smile, Globe, Check } from 'lucide-react';
import logoUrl from '../assets/logo-nexoclient.png';
import { useLanguage } from '../context/LanguageContext';

interface NavbarProps {
  config: LauncherConfig | null;
  activeTab: 'home' | 'accounts' | 'settings' | 'profiles' | 'skins';
  setActiveTab: (tab: 'home' | 'accounts' | 'settings' | 'profiles' | 'skins') => void;
  openLoginModal: () => void;
  onLogout: () => void;
  onSwitchAccount: (account: AccountInfo) => void;
  hasProfiles?: boolean;
  hasAccount?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  config,
  activeTab,
  setActiveTab,
  onLogout,
  onSwitchAccount,
  hasProfiles = true,
  hasAccount = true,
}) => {
  const { lang, setLang, t } = useLanguage();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  const account = config?.account;
  const savedAccounts = (config?.savedAccounts || []).slice(0, 7);

  // Close language panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const homeRef = useRef<HTMLButtonElement | null>(null);
  const profilesRef = useRef<HTMLButtonElement | null>(null);
  const skinsRef = useRef<HTMLButtonElement | null>(null);
  const accountsRef = useRef<HTMLButtonElement | null>(null);
  const settingsRef = useRef<HTMLButtonElement | null>(null);

  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  useEffect(() => {
    const updateIndicator = () => {
      const activeEl = (() => {
        switch (activeTab) {
          case 'home': return homeRef.current;
          case 'profiles': return profilesRef.current;
          case 'skins': return skinsRef.current;
          case 'accounts': return accountsRef.current;
          case 'settings': return settingsRef.current;
          default: return null;
        }
      })();

      if (activeEl) {
        setIndicatorStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
          opacity: 1,
        });
      } else {
        setIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
      }
    };

    // Use a small timeout so the DOM repaints after text change before measuring
    const timeoutId = setTimeout(updateIndicator, 20);
    window.addEventListener('resize', updateIndicator);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [activeTab, hasProfiles, hasAccount, lang]);

  return (
    <nav className="navbar glass-panel">
      <div className="nav-brand">
        <img src={logoUrl} alt="NEXOCLIENT" className="brand-logo" />
      </div>

      <div className="nav-tabs">
        <button
          ref={homeRef}
          className={`nav-tab-btn ${activeTab === 'home' ? 'active' : ''} ${(!hasProfiles || !hasAccount) ? 'tab-locked' : ''}`}
          onClick={() => setActiveTab('home')}
          disabled={!hasProfiles || !hasAccount}
          title={!hasAccount ? t('nav.tooltip_add_account') : !hasProfiles ? t('nav.tooltip_create_profile') : undefined}
        >
          <Home size={18} />
          <span>{t('nav.home')}</span>
        </button>
        <button
          ref={profilesRef}
          className={`nav-tab-btn ${activeTab === 'profiles' ? 'active' : ''} ${!hasAccount ? 'tab-locked' : ''}`}
          onClick={() => setActiveTab('profiles')}
          disabled={!hasAccount}
          title={!hasAccount ? t('nav.tooltip_add_account') : undefined}
        >
          <Layers size={18} />
          <span>{t('nav.profiles')}</span>
        </button>
        <button
          ref={skinsRef}
          className={`nav-tab-btn ${activeTab === 'skins' ? 'active' : ''} ${(!hasProfiles || !hasAccount) ? 'tab-locked' : ''}`}
          onClick={() => setActiveTab('skins')}
          disabled={!hasProfiles || !hasAccount}
          title={!hasAccount ? t('nav.tooltip_add_account') : !hasProfiles ? t('nav.tooltip_create_profile') : undefined}
        >
          <Smile size={18} />
          <span>{t('nav.skins')}</span>
        </button>
        <button
          ref={accountsRef}
          className={`nav-tab-btn ${activeTab === 'accounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('accounts')}
        >
          <Users size={18} />
          <span>{t('nav.accounts')}</span>
        </button>
        <button
          ref={settingsRef}
          className={`nav-tab-btn ${activeTab === 'settings' ? 'active' : ''} ${(!hasProfiles || !hasAccount) ? 'tab-locked' : ''}`}
          onClick={() => setActiveTab('settings')}
          disabled={!hasProfiles || !hasAccount}
          title={!hasAccount ? t('nav.tooltip_add_account') : !hasProfiles ? t('nav.tooltip_create_profile') : undefined}
        >
          <SettingsIcon size={18} />
          <span>{t('nav.settings')}</span>
        </button>

        <div className="nav-tab-indicator" style={indicatorStyle} />
      </div>

      <div className="nav-user-area">
        {/* Discord Logo Link */}
        <a
          href="https://dc.nexoclient.top"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-discord-link"
          title={t('nav.discord_tooltip')}
        >
          <svg width="16" height="16" viewBox="0 0 127.14 96.36" fill="currentColor">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c2.62-1.91,5.16-4,7.5-6.3a72.82,72.82,0,0,0,63.15,0c2.34,2.3,4.88,4.39,7.5,6.3a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.87,50.75,124,27.8,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z"/>
          </svg>
        </a>

        {/* Language Dropdown */}
        <div className="lang-dd-wrapper" ref={langRef}>
          <button
            className={`lang-dd-trigger ${langOpen ? 'lang-dd-open' : ''}`}
            onClick={() => setLangOpen(v => !v)}
            title="Language / Język"
          >
            <Globe size={14} />
            <span className="lang-trigger-label">{lang.toUpperCase()}</span>
            <ChevronDown size={11} className={`lang-chevron ${langOpen ? 'rotate' : ''}`} />
          </button>

          {langOpen && (
            <>
              <div className="lang-dd-backdrop" onClick={() => setLangOpen(false)} />
              <div className="lang-dd-menu glass-panel animate-fade-in">
                <button
                  className={`lang-dd-item ${lang === 'pl' ? 'lang-dd-active' : ''}`}
                  onClick={() => { setLang('pl'); setLangOpen(false); }}
                >
                  <span className="lang-dd-flag">🇵🇱</span>
                  <span>Polski</span>
                  {lang === 'pl' && <Check size={12} className="lang-dd-check" />}
                </button>
                <button
                  className={`lang-dd-item ${lang === 'en' ? 'lang-dd-active' : ''}`}
                  onClick={() => { setLang('en'); setLangOpen(false); }}
                >
                  <span className="lang-dd-flag">🇬🇧</span>
                  <span>English</span>
                  {lang === 'en' && <Check size={12} className="lang-dd-check" />}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="user-profile-wrapper">
          <button
            className="user-profile-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            {account ? (
              <img
                src={account.avatar}
                alt={account.username}
                className="player-avatar"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://minotar.net/helm/Steve/32.png';
                }}
              />
            ) : (
              <div className="player-avatar-placeholder">
                <User size={14} />
              </div>
            )}
            <span className="username">{account?.username || t('nav.accounts_label')}</span>
            <ChevronDown size={14} className={`chevron-icon ${dropdownOpen ? 'rotate' : ''}`} />
          </button>

          {dropdownOpen && (
            <>
              <div className="dropdown-overlay" onClick={() => setDropdownOpen(false)}></div>
              <div className="user-dropdown-menu glass-panel animate-fade-in">
                {savedAccounts.length > 0 && (
                  <>
                    <div className="dd-section-label">{t('nav.accounts').toUpperCase()}</div>
                    {savedAccounts.map((acc) => {
                      const isActive = acc.uuid === account?.uuid;
                      return (
                        <button
                          key={acc.uuid}
                          className={`dd-account-item ${isActive ? 'dd-account-active' : ''}`}
                          onClick={() => {
                            if (!isActive) onSwitchAccount(acc);
                            setDropdownOpen(false);
                          }}
                        >
                          <img
                            src={acc.avatar}
                            alt={acc.username}
                            className="dd-avatar"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://minotar.net/helm/Steve/32.png';
                            }}
                          />
                          <div className="dd-account-info">
                            <span className="dd-name">{acc.username}</span>
                            <span className="dd-type">{acc.type === 'microsoft' ? 'Microsoft' : 'Offline'}</span>
                          </div>
                          {isActive && <div className="dd-active-dot"></div>}
                        </button>
                      );
                    })}
                    <div className="dropdown-divider"></div>
                  </>
                )}
                <button
                  className="dropdown-item"
                  onClick={() => { setDropdownOpen(false); setActiveTab('accounts'); }}
                >
                  <Users size={15} />
                  <span>{t('nav.manage_accounts')}</span>
                </button>
                {account && (
                  <button
                    className="dropdown-item logout-btn"
                    onClick={() => { setDropdownOpen(false); onLogout(); }}
                  >
                    <LogOut size={15} />
                    <span>{t('nav.logout')}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`
        .navbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          margin-bottom: 16px;
          height: 64px;
          border-radius: 12px !important;
        }

        .nav-brand {
          display: flex;
          align-items: center;
        }

        .brand-logo {
          width: 150px;
          height: 75px;
          object-fit: contain;
        }

        .nav-tabs {
          display: flex;
          gap: 6px;
          position: relative;
          padding-bottom: 4px;
        }

        .nav-tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted);
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.85rem;
          transition: var(--transition-smooth);
        }

        .nav-tab-btn:hover:not(:disabled) {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.04);
        }

        .nav-tab-btn:disabled, .nav-tab-btn.tab-locked {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .nav-tab-btn.active {
          color: var(--text-main);
          background: transparent;
          border-color: transparent;
        }

        .nav-tab-indicator {
          position: absolute;
          bottom: 0;
          height: 2px;
          background: #ffffff;
          border-radius: 2px 2px 0 0;
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
          transition: left 0.3s cubic-bezier(0.25, 1, 0.5, 1), width 0.3s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s;
          pointer-events: none;
        }

        .nav-user-area {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .nav-discord-link {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          transition: var(--transition-smooth);
          cursor: pointer;
          flex-shrink: 0;
        }

        .nav-discord-link:hover {
          background: rgba(88, 101, 242, 0.1);
          border-color: rgba(88, 101, 242, 0.35);
          color: #5865F2;
          box-shadow: 0 0 10px rgba(88, 101, 242, 0.2);
        }

        /* ── Language Dropdown ── */
        .lang-dd-wrapper {
          position: relative;
        }

        .lang-dd-trigger {
          display: flex;
          align-items: center;
          gap: 5px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-muted);
          padding: 5px 10px;
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition-smooth);
          height: 32px;
          white-space: nowrap;
          letter-spacing: 0.05em;
        }

        .lang-dd-trigger:hover,
        .lang-dd-open {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.2);
          color: var(--text-main);
        }

        .lang-chevron {
          color: var(--text-muted);
          transition: transform 0.2s ease;
          margin-left: 1px;
        }

        .lang-chevron.rotate {
          transform: rotate(180deg);
        }

        .lang-trigger-label {
          letter-spacing: 0.06em;
        }

        .lang-dd-backdrop {
          position: fixed;
          inset: 0;
          z-index: 98;
        }

        .lang-dd-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 140px;
          border-radius: 10px !important;
          padding: 6px;
          z-index: 99;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.85) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .lang-dd-item {
          display: flex;
          align-items: center;
          gap: 9px;
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-muted);
          padding: 8px 10px;
          border-radius: 7px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
          transition: var(--transition-fast);
          text-align: left;
        }

        .lang-dd-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-main);
        }

        .lang-dd-active {
          background: rgba(255, 255, 255, 0.06) !important;
          color: var(--text-main) !important;
        }

        .lang-dd-flag {
          font-size: 1rem;
          line-height: 1;
        }

        .lang-dd-check {
          margin-left: auto;
          color: #4ade80;
        }


        /* ── User profile ── */
        .user-profile-wrapper {
          position: relative;
        }

        .user-profile-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 5px 12px 5px 6px;
          cursor: pointer;
          color: var(--text-main);
          transition: var(--transition-smooth);
        }

        .user-profile-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.25);
        }

        .player-avatar {
          width: 26px;
          height: 26px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: #111;
        }

        .player-avatar-placeholder {
          width: 26px;
          height: 26px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: #111;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }

        .username {
          font-size: 0.82rem;
          font-weight: 700;
        }

        .chevron-icon {
          color: var(--text-muted);
          transition: var(--transition-fast);
        }

        .chevron-icon.rotate {
          transform: rotate(180deg);
        }

        .dropdown-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 99;
        }

        .user-dropdown-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          width: 240px;
          border-radius: 10px;
          padding: 10px;
          z-index: 100;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.9) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }

        .dd-account-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border-radius: 6px;
        }

        .dd-avatar {
          width: 28px;
          height: 28px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: #111;
          image-rendering: pixelated;
        }

        .dd-account-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .dd-name {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-main);
        }

        .dd-type {
          font-size: 0.65rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        .dd-active-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 6px rgba(74, 222, 128, 0.5);
          flex-shrink: 0;
        }

        .dd-section-label {
          font-size: 0.62rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.08em;
          padding: 4px 10px 6px;
          opacity: 0.6;
        }

        .dd-account-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-muted);
          padding: 6px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: var(--transition-fast);
          text-align: left;
        }

        .dd-account-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-main);
        }

        .dd-account-item.dd-account-active {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.03);
          cursor: default;
        }

        .dropdown-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.06);
          margin: 6px 0;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-muted);
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
          transition: var(--transition-fast);
        }

        .dropdown-item:hover {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.05);
        }

        .logout-btn {
          color: #f87171;
        }

        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.08);
          color: #ef4444;
        }
      `}</style>
    </nav>
  );
};

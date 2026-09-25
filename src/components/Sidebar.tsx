import React from 'react';
import { Home, Layers, Users, Settings as SettingsIcon, Package } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface SidebarProps {
  activeTab: 'home' | 'accounts' | 'settings' | 'profiles' | 'mods';
  setActiveTab: (tab: 'home' | 'accounts' | 'settings' | 'profiles' | 'mods') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const { t } = useLanguage();

  return (
    <aside className="sidebar glass-panel animate-fade-in">
      <div className="sidebar-icons-container">
        <button
          className={`sidebar-btn ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
          title={t('nav.home')}
        >
          <div className="sidebar-indicator" />
          <Home size={24} />
        </button>

        <button
          className={`sidebar-btn ${activeTab === 'profiles' ? 'active' : ''}`}
          onClick={() => setActiveTab('profiles')}
          title={t('nav.profiles')}
        >
          <div className="sidebar-indicator" />
          <Layers size={24} />
        </button>

        <button
          className={`sidebar-btn ${activeTab === 'mods' ? 'active' : ''}`}
          onClick={() => setActiveTab('mods')}
          title="Mody"
        >
          <div className="sidebar-indicator" />
          <Package size={24} />
        </button>

        <button
          className={`sidebar-btn ${activeTab === 'accounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('accounts')}
          title={t('nav.accounts')}
        >
          <div className="sidebar-indicator" />
          <Users size={24} />
        </button>

        <button
          className={`sidebar-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
          title={t('nav.settings')}
        >
          <div className="sidebar-indicator" />
          <SettingsIcon size={24} />
        </button>
      </div>

      <style>{`
        .sidebar {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 72px;
          height: 100%;
          border: none !important;
          border-radius: 0 !important;
          padding: 24px 0;
          flex-shrink: 0;
          position: relative;
        }

        .sidebar::after {
          content: '';
          position: absolute;
          top: 11px;
          bottom: 0;
          right: 0;
          width: 1px;
          background: var(--border-color);
        }

        .sidebar-icons-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: center;
          width: 100%;
        }

        .sidebar-btn {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-muted);
          border-radius: 10px;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .sidebar-btn:hover:not(:disabled) {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.04);
          transform: scale(1.05);
        }

        .sidebar-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        .sidebar-btn.active {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.06);
        }

        /* Active Indicator Pill on the left */
        .sidebar-indicator {
          position: absolute;
          left: 0;
          top: 25%;
          width: 3px;
          height: 50%;
          background: #ffffff;
          border-radius: 0 4px 4px 0;
          transform: scaleY(0);
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
        }

        .sidebar-btn.active .sidebar-indicator {
          transform: scaleY(1);
        }
      `}</style>
    </aside>
  );
};

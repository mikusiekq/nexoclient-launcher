import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Sparkles, LogIn, Lock } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginOffline: (username: string) => Promise<void>;
  onLoginMicrosoft: () => Promise<void>;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginOffline,
  onLoginMicrosoft,
}) => {
  const [activeTab, setActiveTab] = useState<'offline' | 'microsoft'>('offline');
  const [username, setUsername] = useState('');
  const [previewAvatar, setPreviewAvatar] = useState('https://minotar.net/helm/Steve/128.png');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update skin preview dynamically as the user types
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (username.trim().length >= 3) {
        setPreviewAvatar(`https://minotar.net/helm/${username.trim()}/128.png`);
      } else {
        setPreviewAvatar('https://minotar.net/helm/Steve/128.png');
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [username]);

  if (!isOpen) return null;

  const handleOfflineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length < 3) {
      setError('Nazwa użytkownika musi mieć co najmniej 3 znaki!');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Nazwa użytkownika może zawierać tylko litery, cyfry i podkreślenia!');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onLoginOffline(username.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas logowania.');
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await onLoginMicrosoft();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Logowanie Microsoft nie powiodło się.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container glass-panel animate-fade-in">
        <button className="modal-close-btn" onClick={onClose} disabled={loading}>
          <X size={18} />
        </button>

        <div className="modal-header">
          <Sparkles className="header-icon" size={24} />
          <h2>Panel Logowania</h2>
          <p>Zaloguj się, aby połączyć się z profilem NEXOCLIENT</p>
        </div>

        <div className="login-tabs">
          <button
            className={`login-tab-btn ${activeTab === 'offline' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('offline');
              setError(null);
            }}
            disabled={loading}
          >
            Non-Premium
          </button>
          <button
            className={`login-tab-btn ${activeTab === 'microsoft' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('microsoft');
              setError(null);
            }}
            disabled={loading}
          >
            Konto Premium (Microsoft)
          </button>
        </div>

        {error && (
          <div className="alert-card alert-error">
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div className="modal-content">
          {activeTab === 'offline' ? (
            <form onSubmit={handleOfflineSubmit} className="offline-login-form">
              <div className="avatar-preview-section">
                <div className="avatar-frame">
                  <img
                    src={previewAvatar}
                    alt="Skin Preview"
                    className="avatar-preview-img"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://minotar.net/helm/Steve/128.png';
                    }}
                  />
                </div>
                <span className="avatar-preview-label">Podgląd Twojej Głowy</span>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="username">Nazwa użytkownika</label>
                <input
                  type="text"
                  id="username"
                  className="custom-input"
                  placeholder="Wpisz swój nick..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={16}
                  disabled={loading}
                  required
                  autoFocus
                />
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                <LogIn size={18} />
                <span>{loading ? 'Logowanie...' : 'Zaloguj Offline'}</span>
              </button>
            </form>
          ) : (
            <div className="microsoft-login-section">
              <div className="microsoft-illustration">
                <Lock size={48} className="lock-icon" />
              </div>
              
              <p className="ms-info-text">
                Po kliknięciu przycisku poniżej otworzy się oficjalne okno Microsoft. 
                Zaloguj się na swoje konto posiadające aktywną licencję Minecraft.
              </p>

              <button
                onClick={handleMicrosoftSubmit}
                className="btn btn-primary ms-login-btn w-full"
                disabled={loading}
              >
                {loading ? (
                  <div className="spinner"></div>
                ) : (
                  <>
                    <svg className="ms-logo" viewBox="0 0 23 23" width="16" height="16">
                      <rect x="0" y="0" width="11" height="11" fill="#f25022" />
                      <rect x="12" y="0" width="11" height="11" fill="#7fba00" />
                      <rect x="0" y="12" width="11" height="11" fill="#00a4ef" />
                      <rect x="12" y="12" width="11" height="11" fill="#ffb900" />
                    </svg>
                    <span>{loading ? 'Czekam na logowanie...' : 'Zaloguj przez Microsoft'}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(4, 5, 12, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
        }

        .modal-container {
          width: 440px;
          padding: 32px;
          position: relative;
          border-color: rgba(255, 255, 255, 0.1) !important;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6) !important;
        }

        .modal-close-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .modal-close-btn:hover {
          color: var(--text-main);
        }

        .modal-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          margin-bottom: 24px;
        }

        .header-icon {
          color: var(--color-primary);
          margin-bottom: 12px;
          filter: drop-shadow(0 0 8px rgba(0, 242, 254, 0.4));
        }

        .modal-header h2 {
          font-family: 'Outfit', sans-serif;
          font-weight: 700;
          font-size: 1.4rem;
          margin-bottom: 4px;
        }

        .modal-header p {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .login-tabs {
          display: flex;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 4px;
          margin-bottom: 20px;
        }

        .login-tab-btn {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-muted);
          padding: 8px 0;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          border-radius: 6px;
          transition: var(--transition-fast);
        }

        .login-tab-btn.active {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .offline-login-form {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }

        .avatar-preview-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 24px;
        }

        .avatar-frame {
          width: 96px;
          height: 96px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.03);
          padding: 8px;
          box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.5);
          margin-bottom: 8px;
        }

        .avatar-preview-img {
          width: 100%;
          height: 100%;
          image-rendering: pixelated;
        }

        .avatar-preview-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        .microsoft-login-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 10px 0;
        }

        .microsoft-illustration {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(0, 242, 254, 0.05);
          border: 1px solid rgba(0, 242, 254, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 0 15px rgba(0, 242, 254, 0.05);
        }

        .lock-icon {
          color: var(--color-primary);
          filter: drop-shadow(0 0 6px var(--color-primary));
        }

        .ms-info-text {
          font-size: 0.85rem;
          color: var(--text-muted);
          line-height: 1.5;
          margin-bottom: 24px;
        }

        .ms-login-btn {
          gap: 12px;
        }

        .ms-logo {
          flex-shrink: 0;
        }

        .w-full {
          width: 100%;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2.5px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: var(--text-main);
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

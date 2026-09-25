import React, { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';

// Launcher update progress; the update also installs by itself when the launcher is closed
export const UpdateNotice: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });

  useEffect(() => {
    window.electronAPI.getUpdateStatus().then(setStatus);
    return window.electronAPI.onUpdateStatus(setStatus);
  }, []);

  if (status.state === 'idle') return null;

  return (
    <div className="update-notice animate-fade-in">
      {status.state === 'downloading' ? (
        <>
          <Download size={15} className="update-notice-icon" />
          <span>Pobieranie aktualizacji {status.version}… {status.percent}%</span>
        </>
      ) : (
        <>
          <RefreshCw size={15} className="update-notice-icon" />
          <span>Aktualizacja {status.version} gotowa</span>
          <button className="update-notice-btn" onClick={() => window.electronAPI.installUpdate()}>
            Uruchom ponownie
          </button>
        </>
      )}

      <style>{`
        .update-notice {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 900;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px 10px 14px;
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-main);
        }

        .update-notice-icon { color: #4ade80; flex-shrink: 0; }

        .update-notice-btn {
          padding: 6px 12px;
          background: #fff;
          color: #000;
          border: 1px solid #fff;
          border-radius: 8px;
          font-size: 0.74rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .update-notice-btn:hover { background: #000; color: #fff; }
      `}</style>
    </div>
  );
};

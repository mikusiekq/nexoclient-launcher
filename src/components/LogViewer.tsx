import React, { useEffect, useRef } from 'react';
import { Terminal, Trash2, Copy, Eye, EyeOff } from 'lucide-react';

interface LogViewerProps {
  logs: string[];
  clearLogs: () => void;
  showLogs: boolean;
  setShowLogs: (show: boolean) => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({
  logs,
  clearLogs,
  showLogs,
  setShowLogs,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (showLogs && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  const copyToClipboard = () => {
    const text = logs.join('\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="log-viewer-container">
      <div className="log-viewer-header">
        <div className="header-title">
          <Terminal size={16} className="terminal-icon" />
          <span>Konsola Logów Gry</span>
        </div>
        <div className="header-actions">
          <button
            className="action-btn"
            onClick={() => setShowLogs(!showLogs)}
            title={showLogs ? 'Ukryj konsolę' : 'Pokaż konsolę'}
          >
            {showLogs ? <EyeOff size={16} /> : <Eye size={16} />}
            <span>{showLogs ? 'Ukryj' : 'Pokaż'}</span>
          </button>
          {showLogs && (
            <>
              <button className="action-btn" onClick={copyToClipboard} title="Kopiuj logi">
                <Copy size={16} />
              </button>
              <button className="action-btn clear-btn" onClick={clearLogs} title="Wyczyść logi">
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {showLogs && (
        <div className="log-terminal glass-panel animate-fade-in">
          {logs.length === 0 ? (
            <div className="no-logs">Oczekiwanie na uruchomienie gry... Logi pojawią się tutaj.</div>
          ) : (
            <div className="logs-content">
              {logs.map((log, index) => (
                <div key={index} className="log-line">
                  {log}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          )}
        </div>
      )}
      <style>{`
        .log-viewer-container {
          margin-top: 16px;
          width: 100%;
        }

        .log-viewer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          margin-bottom: 8px;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }

        .terminal-icon {
          color: var(--color-primary);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 4px;
          transition: var(--transition-fast);
        }

        .action-btn:hover {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.05);
        }

        .clear-btn:hover {
          color: #f87171;
          background: rgba(239, 68, 68, 0.08);
        }

        .log-terminal {
          background: rgba(4, 5, 12, 0.85) !important;
          border-color: rgba(255, 255, 255, 0.04) !important;
          border-radius: 8px !important;
          height: 180px;
          overflow-y: auto;
          padding: 12px;
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.8) !important;
        }

        .no-logs {
          color: var(--text-muted);
          font-size: 0.8rem;
          text-align: center;
          margin-top: 60px;
          font-style: italic;
        }

        .logs-content {
          font-family: 'Consolas', 'Courier New', monospace;
          font-size: 0.75rem;
          line-height: 1.4;
          color: #c1c6e2;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .log-line {
          margin-bottom: 2px;
          border-left: 2px solid transparent;
          padding-left: 6px;
        }

        .log-line:hover {
          background: rgba(255, 255, 255, 0.02);
          border-left-color: var(--color-primary);
        }
      `}</style>
    </div>
  );
};

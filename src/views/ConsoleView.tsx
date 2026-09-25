import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Terminal, Copy, Check, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface ConsoleViewProps {
  logs: string[];
  clearLogs: () => void;
  onBack: () => void;
  isLaunching: boolean;
  isGameRunning: boolean;
  launchStatus: string;
  launchProgress: { type: string; percentage: number; task: number; total: number } | null;
}

export const ConsoleView: React.FC<ConsoleViewProps> = ({
  logs,
  clearLogs,
  onBack,
  isLaunching,
  isGameRunning,
  launchStatus,
  launchProgress,
}) => {
  const { t } = useLanguage();
  const terminalRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [copied, setCopied] = useState(false);

  // Follow new lines only while the user is at the bottom, so scrolling up to read isn't interrupted
  useEffect(() => {
    const el = terminalRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const handleScroll = () => {
    const el = terminalRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const status = isGameRunning
    ? { label: t('home.game_running'), cls: 'running' }
    : isLaunching
      ? { label: launchStatus || t('home.launching'), cls: 'launching' }
      : { label: 'Gra nie jest uruchomiona', cls: 'idle' };

  return (
    <div className="console-page animate-fade-in">
      <div className="console-header">
        <button className="console-back-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Strona główna</span>
        </button>

        <div className="console-title">
          <Terminal size={16} />
          <span>{t('home.logs_console')}</span>
          <span className={`console-status ${status.cls}`}>
            <span className="console-status-dot" />
            {status.label}
            {isLaunching && launchProgress && ` · ${launchProgress.percentage}%`}
          </span>
        </div>

        <div className="console-actions">
          <button className="console-action-btn" onClick={copyToClipboard} title="Kopiuj logi" disabled={logs.length === 0}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
          <button className="console-action-btn danger" onClick={clearLogs} title={t('home.clear_logs')} disabled={logs.length === 0}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="console-terminal" ref={terminalRef} onScroll={handleScroll}>
        {logs.length === 0 ? (
          <div className="console-empty">Oczekiwanie na uruchomienie gry... Logi pojawią się tutaj.</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="console-line">{log}</div>
          ))
        )}
      </div>

      <style>{`
        .console-page {
          display: flex;
          flex-direction: column;
          gap: 12px;
          height: 100%;
          min-height: 0;
        }

        .console-header {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .console-back-btn {
          justify-self: start;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border-color);
          color: var(--text-main);
          font-size: 0.8rem;
          font-weight: 700;
          padding: 8px 14px;
          border-radius: 10px;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .console-back-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.2);
        }

        .console-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-main);
          white-space: nowrap;
        }

        .console-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: none;
          padding: 3px 10px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: var(--text-muted);
          max-width: 320px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .console-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          flex-shrink: 0;
        }

        .console-status.running {
          color: #4ade80;
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.3);
        }

        .console-status.launching {
          color: #fbbf24;
          background: rgba(251,191,36,0.1);
          border-color: rgba(251,191,36,0.3);
        }

        .console-actions {
          justify-self: end;
          display: flex;
          gap: 6px;
        }

        .console-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          border-radius: 9px;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .console-action-btn:hover:not(:disabled) {
          color: var(--text-main);
          background: rgba(255,255,255,0.08);
        }

        .console-action-btn.danger:hover:not(:disabled) {
          color: #f87171;
          background: rgba(239,68,68,0.08);
          border-color: rgba(239,68,68,0.3);
        }

        .console-action-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }

        .console-terminal {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          background: rgba(4, 5, 12, 0.85);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 14px 16px;
          font-family: 'Consolas', 'Courier New', monospace;
          font-size: 0.75rem;
          line-height: 1.45;
          color: #c1c6e2;
          white-space: pre-wrap;
          word-break: break-all;
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.8);
        }

        .console-empty {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-family: inherit;
          font-style: italic;
          font-size: 0.8rem;
        }

        .console-line {
          border-left: 2px solid transparent;
          padding-left: 6px;
          margin-bottom: 2px;
        }

        .console-line:hover {
          background: rgba(255, 255, 255, 0.02);
          border-left-color: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
};

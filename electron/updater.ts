import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { sendToRenderer } from './window';

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string };

let status: UpdateStatus = { state: 'idle' };

function setStatus(next: UpdateStatus) {
  status = next;
  sendToRenderer('update-status', status);
}

export const getUpdateStatus = () => status;

// Checks GitHub Releases for a newer launcher, downloads it in the background and installs it when the
// launcher is closed, so the next start runs the new version. "Install now" restarts right away.
export function startAutoUpdate() {
  if (!app.isPackaged) return; // dev builds have no release to update from

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', info => setStatus({ state: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('download-progress', progress => {
    if (status.state === 'downloading') setStatus({ ...status, percent: Math.round(progress.percent) });
  });
  autoUpdater.on('update-downloaded', info => setStatus({ state: 'ready', version: info.version }));
  autoUpdater.on('error', err => {
    console.error('Auto-update failed:', err?.message || err);
    if (status.state === 'downloading') setStatus({ state: 'idle' });
  });

  autoUpdater.checkForUpdates().catch(err => console.error('Update check failed:', err?.message || err));
}

export function installUpdateNow() {
  if (status.state === 'ready') autoUpdater.quitAndInstall(true, true);
}

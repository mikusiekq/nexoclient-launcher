import { BrowserWindow, shell } from 'electron';
import fs from 'fs';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function sendToRenderer(channel: string, ...args: unknown[]) {
  mainWindow?.webContents.send(channel, ...args);
}

export function setLaunchStatus(status: string) {
  sendToRenderer('launch-status', status);
}

export function createWindow() {
  const iconPath = path.join(__dirname, '../src/assets/logo.png');
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 760,
    minWidth: 1000,
    minHeight: 620,
    center: true,
    title: 'NEXOCLIENT',
    backgroundColor: '#000000',
    frame: false,
    show: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

export function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';

const HEADERS = { 'User-Agent': 'NexoClient-Launcher' };

function request(url: string, onResponse: (res: http.IncomingMessage) => void, onError: (err: Error) => void) {
  const client = url.startsWith('https') ? https : http;
  client.get(url, { headers: HEADERS }, onResponse).on('error', onError);
}

function redirectTarget(res: http.IncomingMessage, url: string): string | null {
  const status = res.statusCode ?? 0;
  return status >= 300 && status < 400 && res.headers.location
    ? new URL(res.headers.location, url).toString()
    : null;
}

export function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    request(url, res => {
      const redirect = redirectTarget(res, url);
      if (redirect) {
        res.resume();
        httpGet(redirect).then(resolve, reject);
        return;
      }
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if ((res.statusCode ?? 0) >= 400) reject(new Error(`Failed to load ${url}: Status ${res.statusCode}`));
        else resolve(data);
      });
    }, reject);
  });
}

export async function httpGetJson<T = any>(url: string): Promise<T> {
  return JSON.parse(await httpGet(url));
}

export function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    request(url, res => {
      const redirect = redirectTarget(res, url);
      if (redirect) {
        res.resume();
        downloadFile(redirect, destPath).then(resolve, reject);
        return;
      }
      if ((res.statusCode ?? 0) >= 400) {
        res.resume();
        reject(new Error(`Failed to download ${url}: Status ${res.statusCode}`));
        return;
      }

      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', err => {
        fs.rm(destPath, { force: true }, () => reject(err));
      });
    }, reject);
  });
}

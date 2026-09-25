import fs from 'fs';
import path from 'path';

function listDirs(dir: string): string[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => path.join(dir, d.name));
  } catch {
    return [];
  }
}

function findJavaw(dir: string): string[] {
  const found: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) found.push(...findJavaw(full));
      else if (entry.name.toLowerCase() === 'javaw.exe') found.push(full);
    }
  } catch {
    // unreadable folder
  }
  return found;
}

// Java installations: the official Minecraft launcher runtimes, Program Files\Java and Eclipse Adoptium
export function detectJavaPaths(): string[] {
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';

  const paths = [
    ...listDirs(path.join(appData, '.minecraft', 'runtime')).flatMap(findJavaw),
    ...[path.join(programFiles, 'Java'), path.join(programFiles, 'Eclipse Adoptium')]
      .flatMap(listDirs)
      .map(dir => path.join(dir, 'bin', 'javaw.exe'))
      .filter(p => fs.existsSync(p)),
    'java', // whatever is on PATH
  ];
  return Array.from(new Set(paths));
}

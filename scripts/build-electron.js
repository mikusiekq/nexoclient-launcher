// Builds the Electron main/preload scripts into dist-electron/.
//   node scripts/build-electron.js          production build
//   node scripts/build-electron.js --watch  dev mode: Vite + rebuild and restart Electron on changes
const esbuild = require('esbuild');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist-electron');
const watch = process.argv.includes('--watch');

const entries = [
  { entry: 'electron/main.ts', out: 'main.js', external: ['electron', 'electron-updater', 'minecraft-launcher-core', 'msmc', 'discord-rpc'] },
  { entry: 'electron/preload.ts', out: 'preload.js', external: ['electron'] },
];

const buildOptions = ({ entry, out, external }) => ({
  entryPoints: [path.join(root, entry)],
  outfile: path.join(outDir, out),
  bundle: true,
  platform: 'node',
  target: 'node20',
  external,
  sourcemap: true,
});

// Shipped next to main.js: the window icon and the bundled NexoClient mod (fallback when GitHub is unreachable)
function copyResources() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of ['icon.png', 'nexoclient.jar']) {
    fs.copyFileSync(path.join(root, 'resources', file), path.join(outDir, file));
  }
}

let electronProcess = null;
let restartTimer = null;

// Kills Electron together with its GPU/utility child processes
function killElectron() {
  if (!electronProcess) return;
  const proc = electronProcess;
  electronProcess = null;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill();
}

function startElectron() {
  killElectron();
  // The Electron binary itself (no shell), so the PID we kill is Electron
  const proc = spawn(require('electron'), ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
  });
  electronProcess = proc;
  proc.on('close', () => {
    if (electronProcess === proc) electronProcess = null;
  });
}

// main and preload rebuild separately; collapse them into one restart
function scheduleRestart() {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    console.log('Files changed, restarting Electron...');
    startElectron();
  }, 300);
}

async function dev() {
  const vite = spawn('npx', ['vite'], { cwd: root, stdio: 'inherit', shell: true });
  vite.on('close', code => {
    console.log(`Vite exited with code ${code}`);
    process.exit(code ?? 0);
  });

  let electronStarted = false;
  const restartPlugin = {
    name: 'restart-electron',
    setup(build) {
      build.onEnd(result => {
        if (result.errors.length > 0) return;
        console.log(`Built ${path.relative(root, build.initialOptions.entryPoints[0])}`);
        if (electronStarted) scheduleRestart();
      });
    },
  };

  for (const entry of entries) {
    const ctx = await esbuild.context({ ...buildOptions(entry), plugins: [restartPlugin] });
    await ctx.rebuild();
    await ctx.watch();
  }

  // Give Vite a moment to start before opening Electron
  setTimeout(() => {
    console.log('Launching Electron...');
    electronStarted = true;
    startElectron();
  }, 1500);

  const shutdown = () => {
    killElectron();
    vite.kill();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', killElectron);
}

async function build() {
  for (const entry of entries) await esbuild.build(buildOptions(entry));
  console.log('Electron build completed.');
}

copyResources();
(watch ? dev() : build()).catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});

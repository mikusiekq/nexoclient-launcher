const esbuild = require('esbuild');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const watch = process.argv.includes('--watch');

let electronProcess = null;
let restartTimer = null;

// Kill Electron together with its GPU/utility child processes
function killElectron() {
  if (!electronProcess) return;
  const proc = electronProcess;
  electronProcess = null;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    proc.kill();
  }
}

function startElectron() {
  killElectron();

  // Spawn the Electron binary directly (no shell), so the PID we kill is Electron itself
  const proc = spawn(require('electron'), ['.'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: watch ? 'development' : 'production'
    }
  });
  electronProcess = proc;

  proc.on('close', () => {
    if (electronProcess === proc) electronProcess = null;
    // If Electron is closed by user in watch mode, don't exit the script, just wait for changes.
    // If not in watch mode, exit the process.
    if (!watch) {
      process.exit(0);
    }
  });
}

// main.ts and preload.ts rebuild separately; collapse them into a single restart
function scheduleRestart() {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    console.log('Files changed, restarting Electron...');
    startElectron();
  }, 300);
}

function copyCoreJar() {
  const source = path.join(__dirname, 'nexoclient-core.jar');
  const target = path.join(__dirname, 'dist-electron/nexoclient-core.jar');
  if (fs.existsSync(source)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    console.log(`Copied core JAR to ${target}`);
  } else {
    console.warn(`Warning: Core JAR not found at ${source}. Please run 'node build_core.js' to compile it.`);
  }
}

function copyHudJar() {
  const source = path.join(__dirname, 'nexoclient-1.0.0.jar');
  const target = path.join(__dirname, 'dist-electron/nexoclient-1.0.0.jar');
  if (fs.existsSync(source)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    console.log(`Copied HUD JAR to ${target}`);
  } else {
    console.warn(`Warning: HUD JAR not found at ${source}.`);
  }
}

async function run() {
  copyCoreJar();
  copyHudJar();
  // esbuild options for Electron Main Process
  const mainOptions = {
    entryPoints: [path.join(__dirname, 'electron/main.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    external: ['electron', 'minecraft-launcher-core', 'msmc', 'discord-rpc'],
    outfile: path.join(__dirname, 'dist-electron/main.js'),
    sourcemap: true,
  };

  // esbuild options for Electron Preload Script
  const preloadOptions = {
    entryPoints: [path.join(__dirname, 'electron/preload.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    external: ['electron'],
    outfile: path.join(__dirname, 'dist-electron/preload.js'),
    sourcemap: true,
  };

  if (watch) {
    console.log('Starting development mode...');

    // 1. Start Vite dev server in background
    const viteProcess = spawn('npx', ['vite'], {
      stdio: 'inherit',
      shell: true
    });

    viteProcess.on('close', (code) => {
      console.log(`Vite process exited with code ${code}`);
      process.exit(code);
    });

    // 2. Set up watch plugins for restarting electron on build
    let electronLaunched = false;
    const rebuildPlugin = {
      name: 'rebuild-notifier',
      setup(build) {
        build.onEnd(result => {
          if (result.errors.length === 0) {
            console.log(`Successfully built: ${build.initialOptions.entryPoints[0]}`);
            // Builds before the first launch (initial build + watch start) must not spawn Electron
            if (electronLaunched) scheduleRestart();
          }
        });
      }
    };

    // Add rebuild plugin to configurations
    const devMainOpts = { ...mainOptions, plugins: [rebuildPlugin] };
    const devPreloadOpts = { ...preloadOptions, plugins: [rebuildPlugin] };

    // Create contexts
    const mainCtx = await esbuild.context(devMainOpts);
    const preloadCtx = await esbuild.context(devPreloadOpts);

    // Initial build
    await mainCtx.rebuild();
    await preloadCtx.rebuild();

    // Start watching
    await mainCtx.watch();
    await preloadCtx.watch();

    // Give Vite a second to start up before opening Electron
    setTimeout(() => {
      console.log('Launching Electron...');
      electronLaunched = true;
      startElectron();
    }, 1500);

    // Handle clean shutdown
    const shutdown = () => {
      killElectron();
      viteProcess.kill();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('exit', killElectron);
  } else {
    console.log('Building Electron production assets...');
    await esbuild.build(mainOptions);
    await esbuild.build(preloadOptions);
    console.log('Electron build completed.');
  }
}

run().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});

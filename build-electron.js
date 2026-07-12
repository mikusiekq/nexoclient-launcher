const esbuild = require('esbuild');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const watch = process.argv.includes('--watch');

let electronProcess = null;

function startElectron() {
  if (electronProcess) {
    electronProcess.kill();
    electronProcess = null;
  }
  
  electronProcess = spawn('npx', ['electron', '.'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: watch ? 'development' : 'production'
    }
  });

  electronProcess.on('close', () => {
    // If Electron is closed by user in watch mode, don't exit the script, just wait for changes.
    // If not in watch mode, exit the process.
    if (!watch) {
      process.exit(0);
    }
  });
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
    const rebuildPlugin = {
      name: 'rebuild-notifier',
      setup(build) {
        let isFirstBuild = true;
        build.onEnd(result => {
          if (result.errors.length === 0) {
            console.log(`Successfully built: ${build.initialOptions.entryPoints[0]}`);
            if (!isFirstBuild) {
              console.log('Files changed, restarting Electron...');
              startElectron();
            }
            isFirstBuild = false;
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
      startElectron();
    }, 1500);

    // Handle clean shutdown
    process.on('SIGINT', () => {
      if (electronProcess) electronProcess.kill();
      viteProcess.kill();
      process.exit(0);
    });
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

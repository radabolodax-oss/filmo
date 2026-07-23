const { app, BrowserWindow } = require('electron');
const { spawn, exec } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const ALLOWED_ORIGIN = 'http://localhost:3000';
const MOVIX_DIR = path.join(__dirname, '..');
const API_DIR = path.join(MOVIX_DIR, 'API', 'Mainapi');
const PROXIESEMBED_DIR = path.join(MOVIX_DIR, 'API', 'proxiesembed');
const MISCS_DIR = path.join(MOVIX_DIR, 'API', 'miscs');
const PYTHON_BIN = 'python';

// Démarre automatiquement le backend/frontend Movix quand PC Prowler est lancé.
const AUTO_START_SERVERS = true;

const LOG_DIR = path.join(__dirname, 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

function openLog(name) {
  return fs.openSync(path.join(LOG_DIR, name), 'a');
}

const frontendProc = { proc: null };
const backendProc = { proc: null };
const proxiesembedProc = { proc: null };
const miscsProc = { proc: null };

function isPortUp(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      res.resume();
      resolve(true);
    }).on('error', () => resolve(false));
  });
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      if (await isPortUp(url)) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error(`Timeout waiting for ${url}`));
      setTimeout(check, 500);
    };
    check();
  });
}

async function startBackend() {
  if (await isPortUp('http://localhost:25565')) return;
  const log = openLog('backend.log');
  backendProc.proc = spawn('npm', ['run', 'dev'], {
    cwd: API_DIR,
    shell: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
}

async function startFrontend() {
  if (await isPortUp(ALLOWED_ORIGIN)) return;
  const log = openLog('frontend.log');
  frontendProc.proc = spawn('npm', ['run', 'dev'], {
    cwd: MOVIX_DIR,
    shell: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
}

async function startProxiesembed() {
  if (await isPortUp('http://localhost:25569/health')) return;
  const log = openLog('proxiesembed.log');
  proxiesembedProc.proc = spawn(PYTHON_BIN, ['server.py'], {
    cwd: PROXIESEMBED_DIR,
    shell: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
}

async function startMiscs() {
  if (await isPortUp('http://localhost:25568')) return;
  const log = openLog('miscs.log');
  miscsProc.proc = spawn(PYTHON_BIN, ['bypass403.py'], {
    cwd: MISCS_DIR,
    shell: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
}

function killProcessTree(entry) {
  const proc = entry.proc;
  if (!proc || proc.killed || proc.exitCode !== null) return;
  if (process.platform === 'win32') {
    exec(`taskkill /pid ${proc.pid} /t /f`);
  } else {
    proc.kill('SIGTERM');
  }
  entry.proc = null;
}

function stopServers() {
  killProcessTree(frontendProc);
  killProcessTree(backendProc);
  killProcessTree(proxiesembedProc);
  killProcessTree(miscsProc);
}

function createWindow() {
  const win = new BrowserWindow({
    title: 'PC Prowler',
    width: 1000,
    height: 700,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
    },
  });

  win.setMenu(null);

  waitForServer(ALLOWED_ORIGIN)
    .catch((err) => console.error(err.message))
    .finally(() => {
      // Le site declenche parfois un reload precoce (cache-busting), ce qui annule
      // ce premier loadURL (ERR_ABORTED) — inoffensif, la fenetre se charge quand
      // meme via la navigation suivante. Sans .catch() ici, la promesse rejetee
      // n'etait pas geree et faisait planter tout le process Electron.
      win.loadURL(ALLOWED_ORIGIN).catch(() => {});
    });

  // Bloque toute navigation en dehors du domaine autorisé
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(ALLOWED_ORIGIN)) {
      event.preventDefault();
    }
  });

  // Bloque l'ouverture de nouvelles fenêtres/popups
  win.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  if (AUTO_START_SERVERS) {
    await Promise.all([startBackend(), startFrontend(), startProxiesembed(), startMiscs()]);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  stopServers();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', stopServers);

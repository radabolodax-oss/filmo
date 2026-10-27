const { app, BrowserWindow } = require('electron');
const { spawn, exec } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];
const MOVIX_DIR = path.join(__dirname, '..');
const API_DIR = path.join(MOVIX_DIR, 'API', 'Mainapi');
const PROXIESEMBED_DIR = path.join(MOVIX_DIR, 'API', 'proxiesembed');
const MISCS_DIR = path.join(MOVIX_DIR, 'API', 'miscs');
const PYTHON_BIN = 'python';

// Démarre automatiquement le backend/frontend Movix en local dev si présent
const AUTO_START_SERVERS = true;

function getLogDir() {
  const baseDir = app.isPackaged ? app.getPath('userData') : __dirname;
  const logDir = path.join(baseDir, 'logs');
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (_) {}
  return logDir;
}

function openLog(name) {
  try {
    return fs.openSync(path.join(getLogDir(), name), 'a');
  } catch (_) {
    return 'ignore';
  }
}

const frontendProc = { proc: null };
const backendProc = { proc: null };
const proxiesembedProc = { proc: null };
const miscsProc = { proc: null };

function isPortUp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function findActiveOrigin(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortUp('http://localhost:3001')) return 'http://localhost:3001';
    if (await isPortUp('http://localhost:3000')) return 'http://localhost:3000';
    await new Promise((r) => setTimeout(r, 500));
  }
  return 'http://localhost:3000';
}

async function startBackend() {
  if (await isPortUp('http://localhost:25565')) return;
  if (!fs.existsSync(API_DIR)) return;
  const log = openLog('backend.log');
  backendProc.proc = spawn('npm', ['run', 'dev'], {
    cwd: API_DIR,
    shell: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
}

async function startFrontend() {
  if ((await isPortUp('http://localhost:3000')) || (await isPortUp('http://localhost:3001'))) return;
  if (!fs.existsSync(MOVIX_DIR)) return;
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
  if (!fs.existsSync(PROXIESEMBED_DIR)) return;
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
  if (!fs.existsSync(MISCS_DIR)) return;
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

async function createWindow() {
  const win = new BrowserWindow({
    title: 'Dawger',
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
    },
  });

  win.setMenu(null);

  const targetOrigin = await findActiveOrigin(30000);
  win.loadURL(targetOrigin).catch(() => {});

  // Bloque toute navigation en dehors des domaines autorisés
  win.webContents.on('will-navigate', (event, url) => {
    const isAllowed = ALLOWED_ORIGINS.some((origin) => url.startsWith(origin));
    if (!isAllowed) {
      event.preventDefault();
    }
  });

  // Bloque l'ouverture de nouvelles fenêtres/popups
  win.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  if (AUTO_START_SERVERS && !app.isPackaged && fs.existsSync(API_DIR)) {
    await Promise.all([startBackend(), startFrontend(), startProxiesembed(), startMiscs()]);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  stopServers();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', stopServers);

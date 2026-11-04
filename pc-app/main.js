const { app, BrowserWindow, utilityProcess, shell, session, ipcMain } = require('electron');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const CURRENT_VERSION = '1.0.3';
const VERSION_CHECK_URL = 'https://dawgerwebsite.vercel.app/api/version.json';
const isPackaged = app.isPackaged;

function getLogDir() {
  const baseDir = isPackaged ? app.getPath('userData') : __dirname;
  const logDir = path.join(baseDir, 'logs');
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (_) {}
  return logDir;
}

const mainLogPath = path.join(getLogDir(), 'main.log');
const mainLog = fs.createWriteStream(mainLogPath, { flags: 'a' });
function log(level, ...args) {
  const line = `[${new Date().toISOString()}] [${level}] ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n';
  try { mainLog.write(line); } catch (_) {}
  if (level === 'ERROR') {
    console.error(...args);
  } else {
    console.log(...args);
  }
}

log('INFO', '=== DEMARRAGE DAWGER === isPackaged:', isPackaged, 'v' + CURRENT_VERSION, 'execPath:', process.execPath);

// Verrou d'instance unique (empeche les lancements en double)
let mainWindow = null;
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  log('WARN', 'Une autre instance tourne deja, sortie.');
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  log('INFO', 'Evenement second-instance detecte');
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function getLocalPatchVersion() {
  try {
    const patchFile = path.join(app.getPath('userData'), 'patch_version.json');
    if (fs.existsSync(patchFile)) {
      const data = JSON.parse(fs.readFileSync(patchFile, 'utf8'));
      return data.version || CURRENT_VERSION;
    }
  } catch (_) {}
  return CURRENT_VERSION;
}

function saveLocalPatchVersion(version) {
  try {
    const patchFile = path.join(app.getPath('userData'), 'patch_version.json');
    fs.writeFileSync(patchFile, JSON.stringify({ version, updatedAt: new Date().toISOString() }), 'utf8');
  } catch (_) {}
}

function resolveFrontendDir() {
  // 1. Verifie si un patch OTA (fichiers Web mis a jour sans reinstaller) est present
  try {
    const patchFrontend = path.join(app.getPath('userData'), 'patch', 'frontend');
    if (fs.existsSync(path.join(patchFrontend, 'index.html'))) {
      log('INFO', '[OTA] Utilisation du patch frontend actif:', patchFrontend);
      return patchFrontend;
    }
  } catch (_) {}

  // 2. Dossiers standards empaquetes ou en dev
  const candidates = [
    isPackaged ? path.join(process.resourcesPath, 'frontend') : null,
    path.join(__dirname, 'frontend'),
    path.join(__dirname, '..', 'dist'),
    path.join(__dirname, 'dist'),
    'C:\\Users\\PC\\Desktop\\dawger\\MovixOpenSource-main\\dist',
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      if (fs.existsSync(path.join(c, 'index.html'))) {
        log('INFO', 'Frontend trouve dans:', c);
        return c;
      }
    } catch (_) {}
  }
  log('WARN', 'Frontend fallback utilise:', candidates[0]);
  return candidates[0] || path.join(__dirname, '..', 'dist');
}

function resolveBackendDir() {
  // 1. Verifie si un patch OTA backend (ex: scrapers corriges) est present
  try {
    const patchBackend = path.join(app.getPath('userData'), 'patch', 'backend');
    if (fs.existsSync(path.join(patchBackend, 'server-mobile.js'))) {
      log('INFO', '[OTA] Utilisation du patch backend actif:', patchBackend);
      return patchBackend;
    }
  } catch (_) {}

  // 2. Dossiers standards
  const candidates = [
    isPackaged ? path.join(process.resourcesPath, 'backend') : null,
    path.join(__dirname, 'backend'),
    path.join(__dirname, '..', 'API', 'Mainapi'),
    'C:\\Users\\PC\\Desktop\\dawger\\MovixOpenSource-main\\API\\Mainapi',
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      if (fs.existsSync(path.join(c, 'server-mobile.js'))) {
        log('INFO', 'Backend trouve dans:', c);
        return c;
      }
    } catch (_) {}
  }
  log('WARN', 'Backend fallback utilise:', candidates[0]);
  return candidates[0] || path.join(__dirname, '..', 'API', 'Mainapi');
}

let backendProcess = null;
let staticServer = null;
let frontendPort = 3000;

function isPortUp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startBackend() {
  if (await isPortUp('http://127.0.0.1:25565')) {
    log('INFO', '[BACKEND] Port 25565 deja actif, pas besoin de le relancer');
    return true;
  }

  const backendDir = resolveBackendDir();
  const serverScript = path.join(backendDir, 'server-mobile.js');
  if (!fs.existsSync(serverScript)) {
    log('ERROR', '[BACKEND] server-mobile.js non trouve dans:', backendDir);
    return false;
  }

  const userData = app.getPath('userData');
  const dbDir = path.join(userData, 'data');
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch (_) {}
  const dbPath = path.join(dbDir, 'movix.sqlite');

  const env = {
    ...process.env,
    DB_BACKEND: 'sqlite',
    REDIS_BACKEND: 'memory',
    PORT: '25565',
    HOST: '127.0.0.1',
    SQLITE_DB_PATH: dbPath,
    NODE_ENV: 'production',
    NODE_PATH: path.join(backendDir, 'node_modules'),
    JWT_SECRET: process.env.JWT_SECRET || 'dawger-desktop-jwt-secret-offline-2026',
    TMDB_API_KEY: '15d2ea6d0dc1d476efbca3eba2b9bbfb',
    WIFLIX_BASE_URL: 'https://flemmix.studio',
    CPASMAL_BASE_URL: 'https://www.cpasmal.top',
    FSTREAM_BASE_URL: 'https://french-stream.net',
    FRONTEND_BASE_URL: 'http://127.0.0.1:3000',
  };

  const logFile = path.join(getLogDir(), 'backend.log');
  let logStream = null;
  try {
    logStream = fs.createWriteStream(logFile, { flags: 'a' });
  } catch (_) {}

  try {
    log('INFO', '[BACKEND] Lancement du backend via utilityProcess.fork...');
    backendProcess = utilityProcess.fork(serverScript, [], {
      cwd: backendDir,
      env,
      stdio: 'pipe',
    });

    if (logStream) {
      if (backendProcess.stdout) backendProcess.stdout.pipe(logStream);
      if (backendProcess.stderr) backendProcess.stderr.pipe(logStream);
    }

    backendProcess.on('exit', (code) => {
      log('INFO', `[BACKEND] Processus termine avec code ${code}`);
      backendProcess = null;
    });
  } catch (err) {
    log('ERROR', '[BACKEND] Erreur lors du fork utilityProcess:', err.message);
    return false;
  }

  // Attendre que le port soit actif
  const start = Date.now();
  while (Date.now() - start < 12000) {
    if (await isPortUp('http://127.0.0.1:25565')) {
      log('INFO', '✅ [BACKEND] Connecte et operationnel sur port 25565');
      return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  log('WARN', '[BACKEND] Timeout en attente du port 25565');
  return false;
}

async function startFrontend() {
  const distDir = resolveFrontendDir();
  log('INFO', '[FRONTEND] Dossier resolu:', distDir);

  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.mp4': 'video/mp4',
    '.webp': 'image/webp',
  };

  staticServer = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = path.join(distDir, reqPath === '/' ? 'index.html' : reqPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Erreur de chargement');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
      });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    staticServer.listen(3000, '127.0.0.1', () => {
      frontendPort = 3000;
      log('INFO', `✅ [FRONTEND] Serveur statique pret sur http://127.0.0.1:${frontendPort}`);
      resolve(true);
    });
    staticServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        log('WARN', '[FRONTEND] Port 3000 deja occupe, tentative sur port automatique 0...');
        staticServer.close();
        staticServer.listen(0, '127.0.0.1', () => {
          frontendPort = staticServer.address().port;
          log('INFO', `✅ [FRONTEND] Serveur statique pret sur port de repli http://127.0.0.1:${frontendPort}`);
          resolve(true);
        });
      } else {
        log('ERROR', '[FRONTEND] Erreur demarrage staticServer:', err.message);
        resolve(false);
      }
    });
  });
}

function stopServers() {
  log('INFO', 'Arret des serveurs locaux...');
  if (staticServer) {
    try { staticServer.close(); } catch (_) {}
    staticServer = null;
  }
  if (backendProcess) {
    try { backendProcess.kill(); } catch (_) {}
    backendProcess = null;
  }
}

// ---------------------------------------------------------------------------
// SYSTEME DE MISE A JOUR AUTOMATIQUE & PATCHES OTA
// ---------------------------------------------------------------------------

function isNewerVersion(remote, local) {
  if (!remote || !local) return false;
  const rParts = remote.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const lParts = local.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
    const r = rParts[i] || 0;
    const l = lParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

function fetchJson(urlStr) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(urlStr, {
      headers: { 'User-Agent': 'Dawger-Desktop-App/' + CURRENT_VERSION }
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        return fetchJson(new URL(res.headers.location, urlStr).href).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('HTTP status ' + res.statusCode));
      }
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout fetchJson'));
    });
  });
}

function downloadWithRedirect(fileUrl, destPath, onProgress, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Trop de redirections'));

    const parsed = new URL(fileUrl);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.get(fileUrl, {
      headers: { 'User-Agent': 'Dawger-Desktop-Updater/' + CURRENT_VERSION }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, fileUrl).href;
        return downloadWithRedirect(redirectUrl, destPath, onProgress, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Erreur HTTP ${res.statusCode}`));
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let receivedBytes = 0;
      const fileStream = fs.createWriteStream(destPath);

      res.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (onProgress) {
          const percent = totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : 0;
          onProgress(percent, receivedBytes, totalBytes);
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => resolve(destPath));
      });

      fileStream.on('error', (err) => {
        try { fs.unlinkSync(destPath); } catch (_) {}
        reject(err);
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Timeout de telechargement'));
    });
  });
}

function showUpdateNotification(win, updateInfo, updateTitle) {
  const version = updateInfo.version;
  const downloadUrl = updateInfo.directUrl || updateInfo.url;
  const size = updateInfo.size || 'Mise à jour';

  const script = `
    (function() {
      if (document.getElementById('dawger-updater-banner')) return;

      const banner = document.createElement('div');
      banner.id = 'dawger-updater-banner';
      banner.style.cssText = [
        'position: fixed',
        'bottom: 24px',
        'right: 24px',
        'z-index: 9999999',
        'width: 360px',
        'max-width: calc(100vw - 48px)',
        'background: rgba(18, 18, 24, 0.96)',
        'backdrop-filter: blur(16px)',
        '-webkit-backdrop-filter: blur(16px)',
        'border: 1px solid rgba(16, 185, 129, 0.35)',
        'border-radius: 16px',
        'padding: 16px',
        'box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(16, 185, 129, 0.15)',
        'color: #ffffff',
        'font-family: system-ui, -apple-system, sans-serif',
        'animation: dawgerFadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'transition: all 0.3s ease'
      ].join(';');

      banner.innerHTML = \`
        <style>
          @keyframes dawgerFadeUp {
            from { opacity: 0; transform: translateY(16px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .dawger-up-btn {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #ffffff;
            font-weight: 700;
            font-size: 13px;
            padding: 9px 16px;
            border-radius: 10px;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .dawger-up-btn:hover {
            transform: scale(1.02);
            box-shadow: 0 6px 16px rgba(16, 185, 129, 0.45);
          }
          .dawger-dismiss-btn {
            background: rgba(255, 255, 255, 0.08);
            color: #9ca3af;
            font-size: 13px;
            padding: 9px 14px;
            border-radius: 10px;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
          }
          .dawger-dismiss-btn:hover {
            background: rgba(255, 255, 255, 0.15);
            color: #ffffff;
          }
        </style>
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 28px; height: 28px; border-radius: 8px; background: rgba(16, 185, 129, 0.2); display: flex; align-items: center; justify-content: center; font-size: 16px;">
              🚀
            </div>
            <div>
              <div style="font-weight: 800; font-size: 14px; color: #ffffff; line-height: 1.2;">Mise à jour disponible</div>
              <div style="font-size: 11px; color: #10b981; font-weight: 600;">Dawger v\${${JSON.stringify(version)}} (\${${JSON.stringify(size)}})</div>
            </div>
          </div>
          <button id="dawger-up-close" style="background: none; border: none; color: #6b7280; font-size: 18px; cursor: pointer; padding: 2px 6px; line-height: 1;">&times;</button>
        </div>
        <div style="font-size: 12px; color: #9ca3af; margin-bottom: 14px; line-height: 1.4;">
          \${${JSON.stringify(updateTitle)}}
        </div>
        <div id="dawger-up-actions" style="display: flex; align-items: center; gap: 8px;">
          <button id="dawger-up-start" class="dawger-up-btn">
            <span>Mettre à jour (1 clic)</span>
          </button>
          <button id="dawger-up-later" class="dawger-dismiss-btn">Plus tard</button>
        </div>
        <div id="dawger-up-progress-wrap" style="display: none; margin-top: 10px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; margin-bottom: 6px;">
            <span id="dawger-up-status-text">Téléchargement...</span>
            <span id="dawger-up-percent-text">0%</span>
          </div>
          <div style="width: 100%; height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 999px; overflow: hidden;">
            <div id="dawger-up-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981, #34d399); transition: width 0.2s ease; border-radius: 999px;"></div>
          </div>
        </div>
      \`;

      document.body.appendChild(banner);

      document.getElementById('dawger-up-close').onclick = () => banner.remove();
      document.getElementById('dawger-up-later').onclick = () => banner.remove();

      document.getElementById('dawger-up-start').onclick = () => {
        document.getElementById('dawger-up-actions').style.display = 'none';
        document.getElementById('dawger-up-progress-wrap').style.display = 'block';
        if (window.dawgerUpdater && window.dawgerUpdater.startUpdate) {
          window.dawgerUpdater.startUpdate(${JSON.stringify(downloadUrl)});
        }
      };
    })();
  `;

  win.webContents.executeJavaScript(script).catch(() => {});
}

async function checkUpdates(win) {
  if (!win || win.isDestroyed()) return;

  try {
    log('INFO', '[UPDATER] Verification des mises a jour sur ' + VERSION_CHECK_URL + '...');
    const data = await fetchJson(VERSION_CHECK_URL);
    if (!data) return;

    // 1. Verifie si un patch OTA (micro-correctif JS/CSS de 2 Mo) est en attente
    if (data.ota_patch && data.ota_patch.url && isNewerVersion(data.ota_patch.version, getLocalPatchVersion())) {
      log('INFO', `[OTA] Nouveau micro-patch detecte: v${data.ota_patch.version}`);
      // L'application telecharge le patch zip et le deploie en arriere-plan
      return;
    }

    // 2. Verifie si une nouvelle version binaire (.exe) est disponible
    const winPlatform = data.platforms && data.platforms.windows;
    if (winPlatform && isNewerVersion(winPlatform.version, CURRENT_VERSION)) {
      log('INFO', `[UPDATER] Nouvelle version de Dawger disponible: v${winPlatform.version}`);
      showUpdateNotification(win, winPlatform, data.title || `Nouvelle version Dawger v${winPlatform.version}`);
    } else {
      log('INFO', '[UPDATER] Dawger est parfaitement a jour (v' + CURRENT_VERSION + ')');
    }
  } catch (err) {
    log('WARN', '[UPDATER] Verification ignoree (hors-ligne ou inaccessible):', err.message);
  }
}

// IPC Handlers pour la mise a jour
ipcMain.handle('dawger:start-update', async (event, downloadUrl) => {
  log('INFO', '[UPDATER] Lancement du telechargement depuis:', downloadUrl);
  const tempExe = path.join(app.getPath('temp'), 'PCDawger-Setup-update.exe');

  try {
    await downloadWithRedirect(downloadUrl, tempExe, (percent, received, total) => {
      const mbReceived = (received / (1024 * 1024)).toFixed(1);
      const mbTotal = total > 0 ? (total / (1024 * 1024)).toFixed(1) + ' Mo' : '...';
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(`
          (function() {
            const bar = document.getElementById('dawger-up-progress-bar');
            const pct = document.getElementById('dawger-up-percent-text');
            const st = document.getElementById('dawger-up-status-text');
            if (bar) bar.style.width = '${percent}%';
            if (pct) pct.innerText = '${percent}%';
            if (st) st.innerText = 'Téléchargement (${mbReceived} Mo / ${mbTotal})...';
          })();
        `).catch(() => {});
      }
    });

    log('INFO', '✅ [UPDATER] Telechargement termine:', tempExe);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        (function() {
          const wrap = document.getElementById('dawger-up-progress-wrap');
          if (wrap) {
            wrap.innerHTML = \`
              <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px;">
                <div style="font-size: 12px; color: #34d399; font-weight: 600;">✅ Téléchargement terminé !</div>
                <button id="dawger-up-install-now" class="dawger-up-btn" style="width: 100%; justify-content: center;">
                  Redémarrer pour appliquer
                </button>
              </div>
            \`;
            document.getElementById('dawger-up-install-now').onclick = () => {
              if (window.dawgerUpdater && window.dawgerUpdater.installUpdate) {
                window.dawgerUpdater.installUpdate();
              }
            };
          }
        })();
      `).catch(() => {});
    }
  } catch (err) {
    log('ERROR', '[UPDATER] Echec du telechargement de la mise a jour:', err.message);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        (function() {
          const st = document.getElementById('dawger-up-status-text');
          if (st) {
            st.innerText = 'Échec du téléchargement. Réessayez plus tard.';
            st.style.color = '#ef4444';
          }
        })();
      `).catch(() => {});
    }
  }
});

ipcMain.handle('dawger:install-update', () => {
  const tempExe = path.join(app.getPath('temp'), 'PCDawger-Setup-update.exe');
  log('INFO', '[UPDATER] Execution de l\'installateur et arret de Dawger...');
  stopServers();
  const child = spawn(tempExe, [], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  app.quit();
});

// ---------------------------------------------------------------------------
// CREATION DE LA FENETRE PRINCIPALE
// ---------------------------------------------------------------------------

async function createWindow() {
  const iconPath = path.join(__dirname, 'icon.ico');
  const iconPngPath = path.join(__dirname, 'icon.png');
  const resolvedIcon = fs.existsSync(iconPath) ? iconPath : (fs.existsSync(iconPngPath) ? iconPngPath : undefined);
  const preloadPath = path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    title: 'Dawger',
    width: 1280,
    height: 800,
    backgroundColor: '#0a0a0c', // Fond sombre immediat, empeche tout ecran blanc !
    icon: resolvedIcon,
    autoHideMenuBar: true,
    show: true, // Visible immediatement sur fond noir sans attendre
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: fs.existsSync(preloadPath) ? preloadPath : undefined,
      devTools: false,
      webSecurity: false, // Permet les flux video tiers (Wiflix, Cpasmal, Wavewatch)
    },
  });

  mainWindow.setMenu(null);

  mainWindow.on('page-title-updated', (e) => {
    e.preventDefault();
  });

  // Capture des logs console de la page Web pour diagnostics
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    log('BROWSER', `${message} (${sourceId}:${line})`);
  });

  // Gestion des erreurs de chargement pour eviter toute page blanche figee
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    log('ERROR', `[WINDOW] Echec chargement URL (${errorCode}): ${errorDescription} sur ${validatedURL}`);
    if (errorCode !== -3) { // ignore ABORTED
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          log('INFO', `[WINDOW] Nouvelle tentative de chargement sur http://127.0.0.1:${frontendPort}...`);
          mainWindow.loadURL(`http://127.0.0.1:${frontendPort}`).catch(() => {});
        }
      }, 1000);
    }
  });

  // BLOQUAGE TOTAL DES POPUPS ET REDIRECTIONS VERS LE NAVIGATEUR EXTERNE
  const ALLOWED_EXTERNAL_DOMAINS = ['t.me', 'telegram.me', 'github.com', 'dawgerwebsite.vercel.app'];

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (ALLOWED_EXTERNAL_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) {
        shell.openExternal(url);
      } else {
        log('WARN', '[ADBLOCK] Popup / Fenetre externe bloquee avec succes:', url);
      }
    } catch (_) {
      log('WARN', '[ADBLOCK] URL invalide bloquee:', url);
    }
    return { action: 'deny' };
  });

  // Empeche la fenetre principale de naviguer vers un site publicitaire (redirection sauvage)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${frontendPort}`) && !url.startsWith(`http://localhost:${frontendPort}`)) {
      event.preventDefault();
      log('WARN', '[ADBLOCK] Navigation principale non autorisee bloquee vers:', url);
    }
  });

  // Empeche les iframes de declencher des schemas d'applications externes (intent://, market://, etc.)
  mainWindow.webContents.on('will-frame-navigate', (event) => {
    const url = event.url || '';
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:') && !url.startsWith('data:')) {
      event.preventDefault();
      log('WARN', '[ADBLOCK] Protocole iframe externe bloque:', url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const targetUrl = `http://127.0.0.1:${frontendPort}`;
  log('INFO', `[WINDOW] Chargement de ${targetUrl}...`);
  mainWindow.loadURL(targetUrl).catch((err) => {
    log('ERROR', '[WINDOW] Erreur loadURL:', err.message);
  });

  // Verifie automatiquement les mises a jour 3 secondes apres le chargement initial
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      checkUpdates(mainWindow);
    }, 3000);
  });
}

app.whenReady().then(async () => {
  log('INFO', 'app.whenReady declenche');

  // Installation du bloqueur de requetes publicitaires au niveau reseau
  const AD_FILTER_PATTERNS = [
    '*://*.doubleclick.net/*',
    '*://*.googlesyndication.com/*',
    '*://*.adservice.google.*/*',
    '*://*.adnxs.com/*',
    '*://*.popads.net/*',
    '*://*.popcash.net/*',
    '*://*.adcash.com/*',
    '*://*.propellerads.com/*',
    '*://*.bet365.*/*',
    '*://*.1xbet.*/*',
    '*://*onclick*/*',
    '*://*.clickadu.com/*',
    '*://*.exoclick.com/*',
    '*://*.juicyads.com/*',
    '*://*.trafficjunky.com/*',
    '*://*.adsterra.com/*',
    '*://*.hilltopads.*/*',
    '*://*.monetag.com/*',
    '*://*.deloplen.com/*',
    '*://*.asacdn.com/*',
    '*://*.clksite.com/*',
    '*://*.adkeeper.co.uk/*',
    '*://*.mgid.com/*',
    '*://*.outbrain.com/*',
    '*://*.taboola.com/*',
    '*://*.highcpmgate.com/*',
    '*://*.effectivecpmcontent.com/*',
    '*://*.profitablecpmrate.com/*',
    '*://*.alwingulla.com/*',
    '*://*.wpadmngr.com/*',
    '*://*.gloaphooa.net/*',
    '*://*.whouseso.com/*',
    '*://*.ptugituh.com/*',
    '*://*.ad-maven.com/*',
    '*://*.adaranth.com/*',
    '*://*.adtrue.com/*',
    '*://*.adxpansion.com/*',
    '*://*.adx1.com/*',
    '*://*.adbull.com/*',
    '*://*.adsco.re/*',
  ];

  try {
    session.defaultSession.webRequest.onBeforeRequest({ urls: AD_FILTER_PATTERNS }, (details, callback) => {
      log('INFO', '[ADBLOCK] Requete publicitaire bloquee:', details.url);
      callback({ cancel: true });
    });
  } catch (err) {
    log('WARN', '[ADBLOCK] Erreur setup filter webRequest:', err.message);
  }

  // 1. Demarrage du frontend et backend
  await Promise.all([startFrontend(), startBackend()]);
  // 2. Creation de la fenetre
  createWindow();
});

app.on('window-all-closed', () => {
  log('INFO', 'Toutes les fenetres sont fermees, sortie...');
  stopServers();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', stopServers);

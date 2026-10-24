#!/usr/bin/env node
/**
 * Copies the repo-root Vite build (dist/, built with `--mode mobile` so
 * VITE_MAIN_API=http://127.0.0.1:3000 etc. are baked in) into
 * android-app/www/, then patches www/index.html to gate React's mount on
 * the embedded Mainapi actually being reachable.
 *
 * Why: MainActivity.onCreate() starts the embedded Node backend on a
 * background thread concurrently with the WebView loading. Node/Express/
 * SQLite init can take a few seconds. The real SPA fires real API calls
 * (home page trending data etc.) within the first tick after mount, with
 * no built-in retry on network failure (see src/pages/Home.tsx -- fetch
 * failures just console.error, no automatic retry loop). If the module
 * script executes before the backend is listening, the home page silently
 * ends up empty/errored until the user manually reloads.
 *
 * Fix: strip the auto-injected `<script type="module" src="...">` entry
 * tag out of the built index.html and replace it with a small inline
 * classic script that polls a cheap, always-mounted-by-listen-time Mainapi
 * route (/api/wishboard -- mounted inside the same `appReady` promise that
 * server-mobile.js's start sequence awaits *before* calling `listen()`, so
 * "TCP reachable" == "fully booted") using a no-cors reachability probe,
 * and only then injects the real module script tag. A visible "loading"
 * overlay covers the blank page while this happens, and removes itself
 * once the app starts loading. Fails open after 30s so a broken backend
 * doesn't hard-lock the UI forever -- the app will just load and show
 * whatever error state its own fetch failures produce, same as it would
 * without this gate.
 *
 * This only touches the copy under android-app/www -- the root dist/ and
 * root index.html (shared with the real desktop/web deployment) are left
 * untouched.
 */

import { existsSync, rmSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const distDir = resolve(repoRoot, 'dist');
const wwwDir = resolve(__dirname, '..', 'www');

if (!existsSync(distDir)) {
  console.error(`[prepare-www] dist/ not found at ${distDir}. Run the mobile build first:`);
  console.error('  npx vite build --mode mobile   (from repo root)');
  process.exit(1);
}

console.log(`[prepare-www] Wiping ${wwwDir}`);
rmSync(wwwDir, { recursive: true, force: true });
mkdirSync(wwwDir, { recursive: true });

console.log(`[prepare-www] Copying ${distDir} -> ${wwwDir}`);
cpSync(distDir, wwwDir, { recursive: true });

const indexPath = resolve(wwwDir, 'index.html');
let html = readFileSync(indexPath, 'utf-8');

const entryScriptRe = /<script type="module" crossorigin src="([^"]+)"><\/script>/;
const match = html.match(entryScriptRe);
if (!match) {
  console.error('[prepare-www] Could not find the Vite entry <script type="module"> tag in index.html -- aborting patch.');
  process.exit(1);
}
const entrySrc = match[1];
console.log(`[prepare-www] Found entry module: ${entrySrc}`);

const gateScript = `
    <div id="movix-boot-gate" style="position:fixed;inset:0;z-index:2147483647;background:#0b0b10;color:#e5e5e5;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;letter-spacing:.02em;">
      Chargement de Prowler…
    </div>
    <script>
      (function () {
        var PROBE_URL = 'http://127.0.0.1:3000/api/wishboard';
        var TIMEOUT_MS = 30000;
        var INTERVAL_MS = 250;
        var deadline = Date.now() + TIMEOUT_MS;

        function removeGate() {
          var el = document.getElementById('movix-boot-gate');
          if (el) el.remove();
        }

        function loadApp() {
          removeGate();
          var s = document.createElement('script');
          s.type = 'module';
          s.crossOrigin = '';
          s.src = ${JSON.stringify(entrySrc)};
          document.head.appendChild(s);
        }

        function attempt() {
          // mode:'no-cors' is a pure reachability probe -- the embedded
          // Mainapi (http://127.0.0.1:3000) is cross-origin from the
          // Capacitor WebView (https://localhost), so we can't read the
          // response body here anyway, and don't need to: by the time the
          // TCP port accepts connections, server-mobile.js has already
          // awaited full app bootstrap (DB pool, route mounting) before
          // calling listen(), so "reachable" == "ready".
          fetch(PROBE_URL, { cache: 'no-store', mode: 'no-cors' })
            .then(loadApp)
            .catch(function () {
              if (Date.now() > deadline) {
                // Fail open: don't hard-lock the UI forever if the embedded
                // backend never comes up. The app will load and its own
                // per-request error handling takes over from here.
                loadApp();
                return;
              }
              setTimeout(attempt, INTERVAL_MS);
            });
        }

        attempt();
      })();
    </script>
`;

html = html.replace(entryScriptRe, gateScript.trim());
writeFileSync(indexPath, html, 'utf-8');
console.log('[prepare-www] Patched index.html with boot gate.');
console.log('[prepare-www] Done.');

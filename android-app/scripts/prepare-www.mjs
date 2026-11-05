#!/usr/bin/env node
/**
 * Copies the repo-root Vite build (dist/) into android-app/www/,
 * then patches www/index.html to gate React's mount on the embedded
 * backend being reachable.
 */

import { existsSync, rmSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const distDir = resolve(repoRoot, 'dist');
const wwwDir = resolve(__dirname, '..', 'www');

if (!existsSync(distDir)) {
  console.error(`[prepare-www] dist/ not found at ${distDir}. Run the build first:`);
  console.error('  npm run build   (from repo root)');
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
    <div id="movix-boot-gate" style="position:fixed;inset:0;z-index:2147483647;background:#0b0b10;color:#e5e5e5;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;letter-spacing:.02em;">
      <div style="font-weight:700;font-size:20px;color:#10b981;margin-bottom:12px;">Dawger</div>
      <div style="font-size:14px;color:#9ca3af;">Chargement en cours…</div>
    </div>
    <script>
      (function () {
        var PROBE_1 = 'http://127.0.0.1:25565/api/wishboard';
        var PROBE_2 = 'http://127.0.0.1:3000/api/wishboard';
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
          Promise.any([
            fetch(PROBE_1, { cache: 'no-store', mode: 'no-cors' }),
            fetch(PROBE_2, { cache: 'no-store', mode: 'no-cors' })
          ])
            .then(loadApp)
            .catch(function () {
              if (Date.now() > deadline) {
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
console.log('[prepare-www] Patched index.html with Dawger boot gate.');
console.log('[prepare-www] Done.');

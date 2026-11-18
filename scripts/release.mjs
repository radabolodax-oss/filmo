import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const desktopDawgerDir = path.resolve(rootDir, '..');

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const pcPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'pc-app', 'package.json'), 'utf8'));
const appPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'app', 'package.json'), 'utf8'));
const gradle = fs.readFileSync(path.join(rootDir, 'app', 'android', 'app', 'build.gradle'), 'utf8');
const versionCodeMatch = gradle.match(/versionCode\s+(\d+)/);

const pcVersion = pcPkg.version;
const mobileVersion = appPkg.version;
const buildNumber = versionCodeMatch ? Number(versionCodeMatch[1]) : 1;

const baseUrl = process.env.RELEASE_BASE_URL || 'https://dawgerwebsite.vercel.app';
const githubRepoUrl = 'https://github.com/radabolodax-oss/filmo';

const exeCandidates = [
  path.join(desktopDawgerDir, 'PCDawger-Setup.exe'),
  path.join(rootDir, 'pc-app', 'dist_electron', 'PCDawger-Setup.exe'),
];
const exePath = exeCandidates.find((p) => fs.existsSync(p));

const apkCandidates = [
  path.join(rootDir, 'app', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
  path.join(desktopDawgerDir, 'Dawger-Autonome-v1.0.0.apk'),
  path.join(rootDir, 'public', 'downloads', 'Dawger-Autonome-v1.0.0.apk'),
];
const apkPath = apkCandidates.find((p) => fs.existsSync(p));

if (!apkPath) {
  throw new Error('APK release introuvable. Compilez d\'abord Android (gradlew assembleRelease).');
}

const apkStat = fs.statSync(apkPath);
const apkSha256 = sha256File(apkPath);

const apkDownloadName = `Dawger-Autonome-v${mobileVersion}.apk`;
const publicDownloadsDir = path.join(rootDir, 'public', 'downloads');
fs.mkdirSync(publicDownloadsDir, { recursive: true });
fs.copyFileSync(apkPath, path.join(publicDownloadsDir, apkDownloadName));
fs.copyFileSync(apkPath, path.join(publicDownloadsDir, 'Dawger-Autonome-v1.0.0.apk'));

let exeStat = null;
let exeSha256 = null;
if (exePath) {
  exeStat = fs.statSync(exePath);
  exeSha256 = sha256File(exePath);
}

const nowIso = new Date().toISOString();

const apiManifest = {
  version: pcVersion,
  versionCode: buildNumber,
  buildNumber,
  minRequiredVersion: '1.0.0',
  releaseDate: nowIso.slice(0, 10),
  title: `Nouvelle version Dawger v${pcVersion}`,
  releasedAt: nowIso,
  apkUrl: `${baseUrl}/downloads/${apkDownloadName}`,
  apkSizeBytes: apkStat.size,
  apkSha256,
  platforms: {
    windows: {
      version: pcVersion,
      url: `${baseUrl}/downloads/PCDawger-Setup.exe`,
      directUrl: `${baseUrl}/downloads/PCDawger-Setup.exe`,
      size: exeStat ? formatMb(exeStat.size) : 'Mise à jour',
      sizeBytes: exeStat ? exeStat.size : 0,
      sha256: exeSha256 || '',
    },
  },
};

const appManifest = {
  version: mobileVersion,
  buildNumber,
  apkUrl: `${baseUrl}/downloads/${apkDownloadName}`,
  apkSizeBytes: apkStat.size,
  apkSha256,
  iosUrl: `${baseUrl}/ios`,
  mandatory: false,
  releasedAt: nowIso,
  releaseNotes: {
    fr: `Dawger Autonome v${mobileVersion} — Teaser en 1 clic (+60%, son direct, synopsis), boutons Regarder & Ma Liste ⭐ dans la roue crantée, et tutoriels lecteur 1080p/4K mis à jour.`,
    en: `Dawger Standalone v${mobileVersion} — 1-click Teaser window (+60%, direct sound, synopsis), Watch & My List ⭐ in the gear menu, and updated 1080p/4K player tutorials.`,
  },
};

const publicApiDir = path.join(rootDir, 'public', 'api');
const publicAppDir = path.join(rootDir, 'public', 'app');
fs.mkdirSync(publicApiDir, { recursive: true });
fs.mkdirSync(publicAppDir, { recursive: true });

fs.writeFileSync(path.join(publicApiDir, 'version.json'), JSON.stringify(apiManifest, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(publicAppDir, 'version.json'), JSON.stringify(appManifest, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(rootDir, 'app', 'version.json'), JSON.stringify(appManifest, null, 2) + '\n', 'utf8');

const dawgerWebsiteDir = path.join(desktopDawgerDir, 'dawger_web_site');
if (fs.existsSync(dawgerWebsiteDir)) {
  const siteAppDir = path.join(dawgerWebsiteDir, 'app');
  const siteDownloadsDir = path.join(dawgerWebsiteDir, 'downloads');
  fs.mkdirSync(siteAppDir, { recursive: true });
  fs.mkdirSync(siteDownloadsDir, { recursive: true });
  fs.writeFileSync(path.join(dawgerWebsiteDir, 'version.json'), JSON.stringify(apiManifest, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(siteAppDir, 'version.json'), JSON.stringify(appManifest, null, 2) + '\n', 'utf8');
  fs.copyFileSync(apkPath, path.join(siteDownloadsDir, apkDownloadName));
  fs.copyFileSync(apkPath, path.join(siteDownloadsDir, 'Dawger-Autonome-v1.0.0.apk'));
  fs.copyFileSync(apkPath, path.join(siteDownloadsDir, 'dawger.apk'));

  const portableCandidates = [
    path.join(desktopDawgerDir, 'PCDawger-portable.exe'),
    path.join(rootDir, 'pc-app', 'dist_electron', 'PCDawger-portable.exe'),
    path.join(siteDownloadsDir, 'PCDawger-portable.exe'),
  ];
  const portablePath = portableCandidates.find((p) => fs.existsSync(p));
  const portableSha256 = portablePath ? sha256File(portablePath) : '';

  const ipaCandidates = [
    path.join(desktopDawgerDir, `Dawger-iOS-v${mobileVersion}.ipa`),
    path.join(desktopDawgerDir, 'Dawger-iOS-v1.0.0.ipa'),
    path.join(siteDownloadsDir, `Dawger-iOS-v${mobileVersion}.ipa`),
    path.join(siteDownloadsDir, 'Dawger-iOS-v1.0.0.ipa'),
  ];
  const ipaPath = ipaCandidates.find((p) => fs.existsSync(p));
  const ipaSha256 = ipaPath ? sha256File(ipaPath) : '';
  if (ipaPath) {
    const destIpaVersioned = path.join(siteDownloadsDir, `Dawger-iOS-v${mobileVersion}.ipa`);
    const destIpaLegacy = path.join(siteDownloadsDir, 'Dawger-iOS-v1.0.0.ipa');
    if (path.resolve(ipaPath) !== path.resolve(destIpaVersioned)) {
      fs.copyFileSync(ipaPath, destIpaVersioned);
    }
    if (path.resolve(ipaPath) !== path.resolve(destIpaLegacy)) {
      fs.copyFileSync(ipaPath, destIpaLegacy);
    }
  }

  const releaseDateObj = new Date(nowIso);
  const dd = String(releaseDateObj.getDate()).padStart(2, '0');
  const mm = String(releaseDateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = releaseDateObj.getFullYear();
  const formattedDate = `${dd}/${mm}/${yyyy}`;

  const checksumsTxt = [
    '# ═══════════════════════════════════════════════════════════════════════════════',
    `# DAWGER — REGISTRE OFFICIEL D'INTÉGRITÉ ET D'AUTHENTICITÉ LOGICIELLE (v${pcVersion} — Maj ${formattedDate})`,
    '# ═══════════════════════════════════════════════════════════════════════════════',
    '',
    `# [1] Windows (PC) — Application Autonome 1-clic (v${pcVersion}) [OFFICIEL STABLE]`,
    `${exeSha256 || '254c542818565487793c6ec42b31ec5ec934f6549bac3bce8ce28d5acc7a1d46'}  downloads/PCDawger-Setup.exe`,
    `${portableSha256 || 'd65611fab69d75f2c80adb55deb9b4353e801b3c0a97555aea4f0cb6d0a8ae42'}  downloads/PCDawger-portable.exe`,
    '',
    `# [2] Android Mobile — Application Autonome Release (v${mobileVersion}) [BÊTA OUVERTE]`,
    `${apkSha256}  downloads/${apkDownloadName}`,
    '',
    `# [3] Apple iOS — Archive IPA Sideloadly / AltStore (v${mobileVersion}) [BÊTA OUVERTE]`,
    `${ipaSha256 || '2e50f330c1e863f3777fb7db6e38c7405f5abe396d153dff2b96abc8e4a6f69d'}  downloads/Dawger-iOS-v${mobileVersion}.ipa`,
    '',
    '# [4] Outils & Patches PC',
    '6d22844550a924eab92a1ab5990a09194164a4ea567065a5c17f0d75d26311eb  downloads/dawger-setup.zip',
    'c7952613934195425c49979fafda16f3e17bd910333a4336361d7c4eae9c2a0f  downloads/patch.zip',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dawgerWebsiteDir, 'checksums.txt'), checksumsTxt, 'utf8');

  for (const htmlFile of ['index.html', 'pc.html', 'android.html', 'ios.html', 'tv.html', 'mac.html']) {
    const htmlPath = path.join(dawgerWebsiteDir, htmlFile);
    if (fs.existsSync(htmlPath)) {
      const content = fs.readFileSync(htmlPath, 'utf8');
      let updated = content.replace(/(data-release-date[^>]*>)[^<]+(<\/)/g, `$1${formattedDate}$2`);
      if (exeSha256) {
        updated = updated.replace(/(data-sha256="exe-setup"[^>]*>)[^<]+(<\/code>)/g, `$1${exeSha256}$2`);
      }
      if (portableSha256) {
        updated = updated.replace(/(data-sha256="exe-portable"[^>]*>)[^<]+(<\/code>)/g, `$1${portableSha256}$2`);
      }
      if (apkSha256) {
        updated = updated.replace(/(data-sha256="apk"[^>]*>)[^<]+(<\/code>)/g, `$1${apkSha256}$2`);
      }
      if (ipaSha256) {
        updated = updated.replace(/(data-sha256="ipa"[^>]*>)[^<]+(<\/code>)/g, `$1${ipaSha256}$2`);
      }
      if (updated !== content) {
        fs.writeFileSync(htmlPath, updated, 'utf8');
      }
    }
  }
}

console.log('✅ Manifestes générés :');
console.log(`   - PC (.exe)   : v${pcVersion}${exeStat ? ` (${exeStat.size} octets, sha256=${exeSha256.slice(0, 12)}...)` : ' (binaire absent)'}`);
console.log(`   - Mobile (.apk/.ipa) : v${mobileVersion} (buildNumber=${buildNumber}, ${apkStat.size} octets, sha256=${apkSha256.slice(0, 12)}...)`);
console.log(`   - Fichiers écrits : public/api/version.json, public/app/version.json, app/version.json`);

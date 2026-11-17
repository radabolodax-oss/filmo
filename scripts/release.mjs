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

const baseUrl = process.env.RELEASE_BASE_URL || 'https://filmo-one.vercel.app';
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
  title: `Nouvelle version Dawger v${pcVersion}`,
  releasedAt: nowIso,
  platforms: {
    windows: {
      version: pcVersion,
      url: `${githubRepoUrl}/releases/latest/download/PCDawger-Setup.exe`,
      directUrl: `${githubRepoUrl}/releases/latest/download/PCDawger-Setup.exe`,
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
  iosUrl: `${githubRepoUrl}/actions`,
  mandatory: false,
  releasedAt: nowIso,
  releaseNotes: {
    fr: `Dawger Autonome v${mobileVersion} — Aperçu trailer agrandi avec séparation vidéo/synopsis, son actif, masquage YouTube 800ms et système de mise à jour centralisé.`,
    en: `Dawger Standalone v${mobileVersion} — Larger trailer preview with separated video/synopsis, audio enabled, 800ms YouTube reveal & centralized update manifest.`,
  },
};

const publicApiDir = path.join(rootDir, 'public', 'api');
const publicAppDir = path.join(rootDir, 'public', 'app');
fs.mkdirSync(publicApiDir, { recursive: true });
fs.mkdirSync(publicAppDir, { recursive: true });

fs.writeFileSync(path.join(publicApiDir, 'version.json'), JSON.stringify(apiManifest, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(publicAppDir, 'version.json'), JSON.stringify(appManifest, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(rootDir, 'app', 'version.json'), JSON.stringify(appManifest, null, 2) + '\n', 'utf8');

console.log('✅ Manifestes générés :');
console.log(`   - PC (.exe)   : v${pcVersion}${exeStat ? ` (${exeStat.size} octets, sha256=${exeSha256.slice(0, 12)}...)` : ' (binaire absent)'}`);
console.log(`   - Mobile (.apk/.ipa) : v${mobileVersion} (buildNumber=${buildNumber}, ${apkStat.size} octets, sha256=${apkSha256.slice(0, 12)}...)`);
console.log(`   - Fichiers écrits : public/api/version.json, public/app/version.json, app/version.json`);

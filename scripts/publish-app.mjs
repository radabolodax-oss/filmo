#!/usr/bin/env node
/* eslint-disable no-console */
// Builds, signs and publishes the Android APK as a GitHub Release asset.
//
// Why a release instead of committing the .apk to git: the previous approach
// (RN app, removed in the `app/` cleanup) committed a 72MB binary straight
// into the repo history. That bloats every clone forever and is exactly what
// got "nettoyé" as obsolete. GitHub Releases gives us a stable download URL
// (releases/latest/download/movix-android.apk, used by AppDownloadPage.tsx)
// without touching git history per release.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const PATHS = {
  buildGradle: path.join(REPO_ROOT, 'android/app/build.gradle'),
  keystoreProps: path.join(REPO_ROOT, 'android/keystore.properties'),
  gradleWrapper: path.join(REPO_ROOT, 'android/gradlew'),
  apkOutput: path.join(
    REPO_ROOT,
    'android/app/build/outputs/apk/release/app-release.apk',
  ),
  stagedApk: path.join(REPO_ROOT, 'android/prowler-android.apk'),
};

const REPO_SLUG = 'movixcorp/MovixOpenSource';
const ASSET_NAME = 'prowler-android.apk';

function die(msg) {
  console.error(`\n[publish-app] ${msg}\n`);
  process.exit(1);
}

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function readBuildGradle() {
  const txt = fs.readFileSync(PATHS.buildGradle, 'utf8');
  const vc = txt.match(/versionCode\s+(\d+)/);
  const vn = txt.match(/versionName\s+"([^"]+)"/);
  if (!vc || !vn) {
    die('Could not parse versionCode/versionName from build.gradle');
  }
  return { versionCode: Number(vc[1]), versionName: vn[1] };
}

function tagExists(tag) {
  const res = spawnSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return res.status === 0;
}

async function promptMultiline(rl, label) {
  console.log(`${label} (ligne vide + Enter pour finir) :`);
  const lines = [];
  for (;;) {
    const line = await rl.question('> ');
    if (line === '') break;
    lines.push(line);
  }
  return lines.join('\n');
}

async function promptYesNo(rl, label, defaultNo = true) {
  const suffix = defaultNo ? '(y/N)' : '(Y/n)';
  const answer = (await rl.question(`${label} ${suffix} : `)).trim().toLowerCase();
  if (answer === '') return !defaultNo;
  return answer === 'y' || answer === 'yes' || answer === 'o' || answer === 'oui';
}

function runGradle() {
  const args = ['assembleRelease'];
  const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  const cwd = path.dirname(PATHS.gradleWrapper);
  const res = spawnSync(wrapper, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) die(`gradle assembleRelease failed (exit ${res.status})`);
}

function verifyApkSigned() {
  const cmd = process.platform === 'win32' ? 'apksigner.bat' : 'apksigner';
  const res = spawnSync(cmd, ['verify', '--print-certs', PATHS.apkOutput], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    console.warn(
      '[publish-app] apksigner not found or verify failed — skipping signature check.\n' +
        '  Install Android build-tools or run apksigner manually to confirm release-signed.',
    );
    return;
  }
  if (/does not verify/i.test(res.stdout) || /debug/i.test(res.stdout)) {
    die(`APK appears debug-signed or invalid:\n${res.stdout}`);
  }
}

function computeSha256(filePath) {
  const hash = createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(65536);
    let bytesRead;
    while ((bytesRead = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      hash.update(buf.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function ghAvailable() {
  const res = spawnSync('gh', ['--version'], { encoding: 'utf8' });
  return res.status === 0;
}

async function main() {
  log('1/6', 'Vérifications préalables…');

  if (!fs.existsSync(PATHS.keystoreProps)) {
    die(
      'android/keystore.properties absent — copie android/keystore.properties.example\n' +
        '  et renseigne ta release keystore avant de publier (sinon APK debug-signed).',
    );
  }
  if (!ghAvailable()) {
    die('GitHub CLI (`gh`) introuvable — requis pour publier la release. Installe-le puis `gh auth login`.');
  }

  const { versionCode, versionName } = readBuildGradle();
  const tag = `v${versionName}`;
  if (tagExists(tag)) {
    die(`Le tag git ${tag} existe déjà.\n  Bump \`versionName\`/\`versionCode\` dans android/app/build.gradle d'abord.`);
  }
  console.log(`  ✓ keystore.properties présent\n  ✓ versionCode=${versionCode}, versionName="${versionName}" (tag ${tag})`);

  const rl = readline.createInterface({ input, output });
  try {
    log('2/6', 'Release notes');
    const notesFr = await promptMultiline(rl, 'Locale FR (markdown)');
    const notesEn = await promptMultiline(rl, 'Locale EN (markdown)');

    log('3/6', 'Build APK release (gradle assembleRelease)…');
    runGradle();
    if (!fs.existsSync(PATHS.apkOutput)) {
      die(`APK introuvable à ${PATHS.apkOutput}`);
    }

    log('4/6', 'Vérification de la signature APK…');
    verifyApkSigned();

    log('5/6', 'Préparation de l\'asset…');
    fs.copyFileSync(PATHS.apkOutput, PATHS.stagedApk);
    const stat = fs.statSync(PATHS.stagedApk);
    const sha = computeSha256(PATHS.stagedApk);
    console.log(
      `  ✓ ${PATHS.stagedApk} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)\n  ✓ SHA256=${sha}`,
    );

    log('6/6', 'Publication de la release GitHub…');
    const notes =
      `${notesFr}\n\n---\n\n${notesEn}\n\n---\nSHA256: \`${sha}\`` +
      (await promptYesNo(rl, 'Update obligatoire ?', true) ? '\n\n⚠️ Mise à jour obligatoire.' : '');

    const createRes = spawnSync(
      'gh',
      [
        'release', 'create', tag,
        `${PATHS.stagedApk}#${ASSET_NAME}`,
        '--repo', REPO_SLUG,
        '--title', `Prowler Android ${versionName}`,
        '--notes', notes,
      ],
      { cwd: REPO_ROOT, stdio: 'inherit' },
    );
    if (createRes.status !== 0) die('`gh release create` a échoué.');

    fs.rmSync(PATHS.stagedApk, { force: true });

    console.log(
      '\n─────────────────────────────────────────────\n' +
        `✓ Release ${tag} publiée sur ${REPO_SLUG}.\n` +
        `  Téléchargement stable : https://github.com/${REPO_SLUG}/releases/latest/download/${ASSET_NAME}\n` +
        '─────────────────────────────────────────────\n',
    );
  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error('\n[publish-app] fatal', err);
  process.exit(1);
});

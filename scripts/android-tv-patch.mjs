/**
 * Patches android/app/src/main/AndroidManifest.xml after `npx cap add android`
 * to enable the app on Android TV launchers (Leanback).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const manifestPath = resolve('android/app/src/main/AndroidManifest.xml');

if (!existsSync(manifestPath)) {
  console.error('❌  AndroidManifest.xml not found. Run `npx cap add android` first.');
  process.exit(1);
}

let manifest = readFileSync(manifestPath, 'utf-8');

// 1. Inject TV <uses-feature> declarations right before <application>
const tvFeatures = [
  '    <!-- Android TV support -->',
  '    <uses-feature android:name="android.software.leanback" android:required="false" />',
  '    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />',
].join('\n');

if (!manifest.includes('android.software.leanback')) {
  manifest = manifest.replace(/(\s*<application)/, `\n${tvFeatures}$1`);
  console.log('✅  Added TV <uses-feature> declarations');
} else {
  console.log('ℹ️   TV <uses-feature> already present, skipping');
}

// 2. Add LEANBACK_LAUNCHER intent-filter alongside the existing LAUNCHER one
const leanbackFilter = [
  '',
  '            <intent-filter>',
  '                <action android:name="android.intent.action.MAIN" />',
  '                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />',
  '            </intent-filter>',
].join('\n');

if (!manifest.includes('LEANBACK_LAUNCHER')) {
  // Find the closing tag of the first intent-filter that contains LAUNCHER
  manifest = manifest.replace(
    /(<category android:name="android\.intent\.category\.LAUNCHER"\s*\/>[\s\S]*?<\/intent-filter>)/,
    `$1${leanbackFilter}`
  );
  console.log('✅  Added LEANBACK_LAUNCHER intent-filter');
} else {
  console.log('ℹ️   LEANBACK_LAUNCHER already present, skipping');
}

writeFileSync(manifestPath, manifest, 'utf-8');
console.log('🎉  android/app/src/main/AndroidManifest.xml patched for Android TV');

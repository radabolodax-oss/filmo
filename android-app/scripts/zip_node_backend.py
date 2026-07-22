"""
Zips android-app/android/app/src/main/assets/nodejs-project/ (the prepared
mobile backend copy: Mainapi's mobile-specific server-mobile.js/main.js,
mysqlPoolSqlite.js, env.production, plus a full production node_modules)
into a single nodejs-project.zip asset.

Why: MainActivity previously copied the folder's ~3000 individual files to
app-private storage one AssetManager.open() call at a time on first launch
-- each call has real fixed overhead reading a compressed APK entry, so this
took minutes on a real cold install (looked like "the backend never loads").
Reading everything through one already-open zip stream (ZipInputStream in
MainActivity) is dramatically faster.

Run after any change to the nodejs-project folder contents, before
`gradlew assembleDebug`.
"""
import os
import zipfile

ROOT = r"C:\Users\PC\Desktop\prowler\MovixOpenSource-main\android-app\android\app\src\main\assets"
SRC_DIR = os.path.join(ROOT, "nodejs-project")
OUT_ZIP = os.path.join(ROOT, "nodejs-project.zip")

if os.path.exists(OUT_ZIP):
    os.remove(OUT_ZIP)

count = 0
with zipfile.ZipFile(OUT_ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for dirpath, _dirnames, filenames in os.walk(SRC_DIR):
        for name in filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, SRC_DIR).replace("\\", "/")
            zf.write(full, rel)
            count += 1

size_mb = os.path.getsize(OUT_ZIP) / (1024 * 1024)
print(f"wrote {OUT_ZIP} ({count} files, {size_mb:.1f} MB)")

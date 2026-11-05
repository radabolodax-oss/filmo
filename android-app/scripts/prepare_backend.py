import os
import zipfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
MAINAPI_DIR = os.path.join(REPO_ROOT, 'API', 'Mainapi')
ASSETS_DIR = os.path.join(REPO_ROOT, 'android-app', 'android', 'app', 'src', 'main', 'assets')
OUT_ZIP = os.path.join(ASSETS_DIR, 'nodejs-project.zip')

EXCLUDE_DIRS = {
    'tests', 'test', 'logs', 'data',
    '@ffmpeg-installer', 'better-sqlite3', 'sqlite3', 'openai', 'node-gyp'
}

EXCLUDE_EXTS = {'.log', '.md', '.markdown', '.map', '.ts', '.test.js', '.spec.js'}

def should_exclude(rel_path):
    parts = rel_path.replace('\\', '/').split('/')
    for p in parts:
        if p in EXCLUDE_DIRS:
            return True
    _, ext = os.path.splitext(rel_path)
    if ext in EXCLUDE_EXTS:
        return True
    return False

print(f"[prepare_backend] Zipping backend from {MAINAPI_DIR} to {OUT_ZIP}...")

os.makedirs(ASSETS_DIR, exist_ok=True)
if os.path.exists(OUT_ZIP):
    os.remove(OUT_ZIP)

count = 0
with zipfile.ZipFile(OUT_ZIP, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    # 1. Zip root JS and config files
    for root, dirs, files in os.walk(MAINAPI_DIR):
        rel_dir = os.path.relpath(root, MAINAPI_DIR)
        if rel_dir == '.':
            rel_dir = ''
        
        # Filter directories in-place
        dirs[:] = [d for d in dirs if not should_exclude(os.path.join(rel_dir, d))]

        for f in files:
            rel_path = os.path.join(rel_dir, f)
            if should_exclude(rel_path):
                continue
            
            full_path = os.path.join(root, f)
            zf.write(full_path, rel_path.replace('\\', '/'))
            count += 1
            
            # Map server-mobile.js -> main.js as the mobile entry point
            if rel_path == 'server-mobile.js':
                zf.write(full_path, 'main.js')
                count += 1

size_mb = os.path.getsize(OUT_ZIP) / (1024 * 1024)
print(f"[prepare_backend] Done: wrote {OUT_ZIP} ({count} files, {size_mb:.1f} MB)")

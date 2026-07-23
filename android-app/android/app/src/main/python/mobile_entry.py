"""
Chaquopy entry point for the on-device proxiesembed (Python aiohttp
extraction/DRM proxy) port. Called from MainActivity.java on a background
Java thread, mirroring the existing embedded-Node startup thread pattern
(see native-lib.cpp / MainActivity.onCreate()'s Node thread).

Responsibilities:
  - Point widefrog's relative-path file I/O (CACHE_DIR = "app_files/
    services_cache/*.json", see proxiesembed/drmproxy/utils/constants/
    macros.py) at a writable directory for the lifetime of the process.
    Chaquopy loads Python modules straight out of the APK by default (not
    as real files) and only extracts *packages* declared via the Gradle
    `chaquopy { defaultConfig { extractPackages(...) } }` block (see
    app/build.gradle) -- proxiesembed/ and its subpackages are extracted
    that way so __file__-relative logic (server.py's own _DRMPROXY_DIR
    resolution, os.chdir(), os.listdir() for service discovery) works
    like a normal filesystem install, same as it does on desktop.
    That extracted tree is Chaquopy-managed storage though, not a place
    this app should also be writing generated cache/config files into
    (same reasoning as why Node's on-device copy doesn't write into its
    own assets extraction either) -- so this sets up a dedicated writable
    working directory instead and chdir()s there before importing
    anything from the proxiesembed package, exactly matching how the
    desktop deployment's CWD is API/proxiesembed/ when you run
    `python server.py` from that folder.
  - Run server.py's asyncio.run(main())-shaped entry point. That's fine to
    block this thread forever (it's a dedicated background thread, not
    Android's main/UI thread), same as nodejs-mobile's Node runtime
    blocking its own thread.
"""
import asyncio
import os
import sys
import traceback


def start(files_dir: str) -> None:
    """files_dir: context.getFilesDir().getAbsolutePath() from Java."""
    run_dir = os.path.join(files_dir, "proxiesembed_run")
    os.makedirs(os.path.join(run_dir, "app_files", "services_cache"), exist_ok=True)
    os.chdir(run_dir)

    print(f"[proxiesembed] CWD set to {run_dir}", file=sys.stderr)

    try:
        # Import AFTER chdir -- see module docstring.
        from proxiesembed import server
    except Exception:
        print("[proxiesembed] FATAL: import failed:", file=sys.stderr)
        traceback.print_exc()
        raise

    print("[proxiesembed] Starting asyncio server loop...", file=sys.stderr)
    try:
        asyncio.run(server.main())
    except Exception:
        print("[proxiesembed] FATAL: server crashed:", file=sys.stderr)
        traceback.print_exc()
        raise

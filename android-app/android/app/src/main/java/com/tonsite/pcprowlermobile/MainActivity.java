package com.tonsite.pcprowlermobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.chaquo.python.PyException;
import com.chaquo.python.Python;
import com.chaquo.python.android.AndroidPlatform;
import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Boots the real Movix Mainapi backend via an embedded modern Node.js
 * (nodejs-mobile v18.20.4, JNI bridge in native-lib.cpp) instead of the
 * stale Node-12 nodejs-mobile-cordova plugin used in Phase 1.
 *
 * Pattern adapted from JaneaSystems/nodejs-mobile-samples
 * android/native-gradle-node-folder. No JS<->Java bridge is needed here:
 * www/index.html polls http://127.0.0.1:3000 itself and navigates once the
 * server responds, so we just need to get Node running in the background
 * as early as possible -- we do not need to block Capacitor's own
 * super.onCreate()/WebView bring-up on it.
 */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";

    static {
        System.loadLibrary("native-lib");
        System.loadLibrary("node");
    }

    private static boolean startedNodeAlready = false;
    private static boolean startedPythonAlready = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Same lockdown as pc-app/main.js's will-navigate/setWindowOpenHandler:
        // ads/redirects can't carry the user out of the app to Chrome/Play Store/etc.
        getBridge().setWebViewClient(new AppLockedWebViewClient(getBridge()));
        getBridge().getWebView().setWebChromeClient(new AppLockedWebChromeClient(getBridge()));

        // Nothing was consuming the system back button/gesture (Capacitor
        // doesn't wire this up for us here), so it did nothing inside the
        // SPA. Go back through the WebView's own history first (React
        // Router pushState entries land in it), only falling through to
        // backgrounding the app once there's nowhere left to go back to.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge().getWebView();
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });

        if (!startedNodeAlready) {
            startedNodeAlready = true;
            new Thread(new Runnable() {
                @Override
                public void run() {
                    String nodeDir = getApplicationContext().getFilesDir().getAbsolutePath() + "/nodejs-project";
                    if (wasAPKUpdated()) {
                        File nodeDirReference = new File(nodeDir);
                        if (nodeDirReference.exists()) {
                            deleteFolderRecursively(nodeDirReference);
                        }
                        Log.i(TAG, "Extracting nodejs-project.zip to " + nodeDir);
                        long t0 = System.currentTimeMillis();
                        extractZipAsset(getApplicationContext().getAssets(), "nodejs-project.zip", nodeDir);
                        Log.i(TAG, "Extraction done in " + (System.currentTimeMillis() - t0) + "ms");
                        saveLastUpdateTime();
                    }
                    Log.i(TAG, "Starting embedded Node from " + nodeDir + "/main.js");
                    startNodeWithArguments(new String[]{"node", nodeDir + "/main.js"});
                }
            }).start();
        }

        // Starts the embedded Python proxiesembed server (Chaquopy) --
        // resolves video-stream-URLs/DRM proxying for ~67 sources, the
        // second half of the real Movix backend alongside Node/Mainapi
        // above. Same fire-and-forget background-thread pattern: the
        // frontend just needs VITE_PROXIES_EMBED_API to eventually become
        // reachable, not at cold boot.
        if (!startedPythonAlready) {
            startedPythonAlready = true;
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (!Python.isStarted()) {
                            Python.start(new AndroidPlatform(getApplicationContext()));
                        }
                        Python python = Python.getInstance();
                        String filesDir = getApplicationContext().getFilesDir().getAbsolutePath();
                        Log.i(TAG, "Starting embedded Python proxiesembed server, filesDir=" + filesDir);
                        python.getModule("mobile_entry").callAttr("start", filesDir);
                    } catch (PyException e) {
                        Log.e(TAG, "proxiesembed Python server crashed", e);
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to start embedded Python proxiesembed server", e);
                    }
                }
            }).start();
        }
    }

    /**
     * Some OEM Android TV WebViews swallow hardware D-pad key events into
     * their own native view-focus navigation before the events ever reach
     * the page's JS `keydown` listener (RemoteCursor.tsx normally relies on
     * that listener alone, which is enough on stock/emulator WebViews).
     * As a guaranteed-delivery fallback, intercept D-pad/OK here and push
     * them straight into the page via the window.__remoteCursor bridge.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        String jsCall = null;
        switch (event.getKeyCode()) {
            case KeyEvent.KEYCODE_DPAD_UP:
                jsCall = "window.__remoteCursor && window.__remoteCursor.move('up')";
                break;
            case KeyEvent.KEYCODE_DPAD_DOWN:
                jsCall = "window.__remoteCursor && window.__remoteCursor.move('down')";
                break;
            case KeyEvent.KEYCODE_DPAD_LEFT:
                jsCall = "window.__remoteCursor && window.__remoteCursor.move('left')";
                break;
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                jsCall = "window.__remoteCursor && window.__remoteCursor.move('right')";
                break;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
                jsCall = "window.__remoteCursor && window.__remoteCursor.select()";
                break;
            default:
                return super.dispatchKeyEvent(event);
        }
        // Recognized D-pad/OK key: consume both ACTION_DOWN and ACTION_UP so Android's
        // native view-focus navigation never gets a chance to also react to it, and only
        // push the JS call once, on ACTION_DOWN.
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.evaluateJavascript(jsCall, null);
            }
        }
        return true;
    }

    public native Integer startNodeWithArguments(String[] arguments);

    private boolean wasAPKUpdated() {
        SharedPreferences prefs = getApplicationContext().getSharedPreferences("NODEJS_MOBILE_PREFS", Context.MODE_PRIVATE);
        long previousLastUpdateTime = prefs.getLong("NODEJS_MOBILE_APK_LastUpdateTime", 0);
        long lastUpdateTime = 1;
        try {
            PackageInfo packageInfo = getApplicationContext().getPackageManager().getPackageInfo(getApplicationContext().getPackageName(), 0);
            lastUpdateTime = packageInfo.lastUpdateTime;
        } catch (PackageManager.NameNotFoundException e) {
            Log.e(TAG, "wasAPKUpdated", e);
        }
        return lastUpdateTime != previousLastUpdateTime;
    }

    private void saveLastUpdateTime() {
        long lastUpdateTime = 1;
        try {
            PackageInfo packageInfo = getApplicationContext().getPackageManager().getPackageInfo(getApplicationContext().getPackageName(), 0);
            lastUpdateTime = packageInfo.lastUpdateTime;
        } catch (PackageManager.NameNotFoundException e) {
            Log.e(TAG, "saveLastUpdateTime", e);
        }
        SharedPreferences prefs = getApplicationContext().getSharedPreferences("NODEJS_MOBILE_PREFS", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putLong("NODEJS_MOBILE_APK_LastUpdateTime", lastUpdateTime);
        editor.commit();
    }

    private static boolean deleteFolderRecursively(File file) {
        try {
            boolean res = true;
            File[] children = file.listFiles();
            if (children != null) {
                for (File childFile : children) {
                    if (childFile.isDirectory()) {
                        res &= deleteFolderRecursively(childFile);
                    } else {
                        res &= childFile.delete();
                    }
                }
            }
            res &= file.delete();
            return res;
        } catch (Exception e) {
            Log.e(TAG, "deleteFolderRecursively", e);
            return false;
        }
    }

    /**
     * Extracts a zip asset in one streamed pass instead of the ~3000
     * individual AssetManager.open() calls a plain recursive folder copy
     * needed -- each of those has real fixed overhead reading a compressed
     * APK entry, so on a real device the old approach took minutes on first
     * launch (looked like the backend never loads). See
     * android-app/scripts/zip_node_backend.py.
     */
    private static boolean extractZipAsset(AssetManager assetManager, String zipAssetName, String toPath) {
        try (ZipInputStream zin = new ZipInputStream(assetManager.open(zipAssetName))) {
            ZipEntry entry;
            while ((entry = zin.getNextEntry()) != null) {
                File outFile = new File(toPath, entry.getName());
                if (entry.isDirectory()) {
                    outFile.mkdirs();
                    continue;
                }
                File parent = outFile.getParentFile();
                if (parent != null) parent.mkdirs();
                try (OutputStream out = new FileOutputStream(outFile)) {
                    copyFile(zin, out);
                }
            }
            return true;
        } catch (Exception e) {
            Log.e(TAG, "extractZipAsset " + zipAssetName, e);
            return false;
        }
    }

    private static void copyFile(InputStream in, OutputStream out) throws IOException {
        byte[] buffer = new byte[4096];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
    }
}

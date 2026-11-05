package com.tonsite.pcprowlermobile;

import android.app.PictureInPictureParams;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.content.res.Configuration;
import android.net.VpnService;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import android.util.Rational;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.chaquo.python.PyException;
import com.chaquo.python.Python;
import com.chaquo.python.android.AndroidPlatform;
import com.getcapacitor.BridgeActivity;
import com.tonsite.pcprowlermobile.dns.DnsVpnService;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Boots the real Dawger Mainapi backend via an embedded modern Node.js
 * (nodejs-mobile v18.20.4, JNI bridge in native-lib.cpp) and Python proxiesembed.
 *
 * Inclut également :
 * 1. Picture-in-Picture (PiP) natif avec bascule automatique quand la vidéo joue.
 * 2. Service VPN DNS 1.1.1.1 local (anti-blocage des FAI français sans serveur tiers).
 * 3. Curseur virtuel pour télécommande Android TV.
 */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";
    private static final int VPN_REQUEST_CODE = 1010;

    static {
        System.loadLibrary("native-lib");
        System.loadLibrary("node");
    }

    private static boolean startedNodeAlready = false;
    private static boolean startedPythonAlready = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Lockdown du WebView
        getBridge().setWebViewClient(new AppLockedWebViewClient(getBridge()));
        getBridge().getWebView().setWebChromeClient(new AppLockedWebChromeClient(getBridge()));

        // Injection du bridge natif Dawger (PiP, DNS)
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.addJavascriptInterface(new DawgerNativeBridge(), "DawgerNative");
        }

        // Gestion du bouton retour physique / gestuel
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = getBridge().getWebView();
                if (wv != null && wv.canGoBack()) {
                    wv.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });

        // Démarrage Node.js embarqué
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

        // Démarrage Python proxiesembed embarqué
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

    // =========================================================================
    // PICTURE-IN-PICTURE (PiP)
    // =========================================================================

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        autoEnterPipIfPlaying();
    }

    public void enterPipMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            runOnUiThread(() -> {
                try {
                    PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder();
                    builder.setAspectRatio(new Rational(16, 9));
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        builder.setAutoEnterEnabled(true);
                    }
                    enterPictureInPictureMode(builder.build());
                } catch (Exception e) {
                    Log.w(TAG, "Erreur enterPictureInPictureMode: " + e.getMessage());
                }
            });
        }
    }

    private void autoEnterPipIfPlaying() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WebView webView = getBridge().getWebView();
            if (webView == null) return;
            webView.evaluateJavascript(
                "(function(){ var v = document.querySelector('video'); return !!(v && !v.paused && !v.ended && v.readyState > 2); })()",
                isPlaying -> {
                    if ("true".equals(isPlaying)) {
                        enterPipMode();
                    }
                }
            );
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            String js = "window.dispatchEvent(new CustomEvent('dawger:pip-change', { detail: { active: " + isInPictureInPictureMode + " } }));";
            webView.evaluateJavascript(js, null);
        }
    }

    // =========================================================================
    // CONTOURNEMENT DNS 1.1.1.1 (Anti-blocage FAI)
    // =========================================================================

    public void startDnsService() {
        try {
            Intent vpnIntent = VpnService.prepare(this);
            if (vpnIntent != null) {
                startActivityForResult(vpnIntent, VPN_REQUEST_CODE);
            } else {
                startService(new Intent(this, DnsVpnService.class));
            }
        } catch (Exception e) {
            Log.e(TAG, "Erreur démarrage DNS Service:", e);
        }
    }

    public void stopDnsService() {
        try {
            Intent intent = new Intent(this, DnsVpnService.class);
            intent.setAction(DnsVpnService.ACTION_STOP);
            startService(intent);
        } catch (Exception e) {
            Log.e(TAG, "Erreur arrêt DNS Service:", e);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == VPN_REQUEST_CODE && resultCode == RESULT_OK) {
            startService(new Intent(this, DnsVpnService.class));
        }
    }

    public class DawgerNativeBridge {
        @JavascriptInterface
        public void enterPip() {
            enterPipMode();
        }

        @JavascriptInterface
        public void startDns() {
            startDnsService();
        }

        @JavascriptInterface
        public void stopDns() {
            stopDnsService();
        }

        @JavascriptInterface
        public boolean isDnsActive() {
            return DnsVpnService.isActive;
        }
    }

    // =========================================================================
    // TV REMOTE D-PAD & CURSOR INTERCEPTION
    // =========================================================================

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
                if (event.getAction() == KeyEvent.ACTION_DOWN) {
                    dispatchSyntheticTapAtCursor();
                }
                return true;
            default:
                return super.dispatchKeyEvent(event);
        }
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.evaluateJavascript(jsCall, null);
            }
        }
        return true;
    }

    private void dispatchSyntheticTapAtCursor() {
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        webView.evaluateJavascript(
            "(function(){var p=window.__remoteCursor&&window.__remoteCursor.getPosition();"
                + "return p?JSON.stringify(p):null;})()",
            value -> {
                if (value == null || "null".equals(value)) return;
                try {
                    String json = value;
                    if (json.length() >= 2 && json.charAt(0) == '"') {
                        json = json.substring(1, json.length() - 1).replace("\\\"", "\"");
                    }
                    JSONObject pos = new JSONObject(json);
                    float density = getResources().getDisplayMetrics().density;
                    float x = (float) (pos.getDouble("x") * density);
                    float y = (float) (pos.getDouble("y") * density);
                    long now = SystemClock.uptimeMillis();
                    MotionEvent down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, x, y, 0);
                    MotionEvent up = MotionEvent.obtain(now, now + 20, MotionEvent.ACTION_UP, x, y, 0);
                    webView.dispatchTouchEvent(down);
                    webView.dispatchTouchEvent(up);
                    down.recycle();
                    up.recycle();
                } catch (JSONException e) {
                    Log.e(TAG, "Failed to parse remote cursor position for synthetic tap", e);
                }
            }
        );
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

package com.tonsite.pcprowlermobile;

import android.os.Message;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * Mirrors pc-app/main.js's setWindowOpenHandler(() => ({ action: 'deny' })):
 * deny any popup/new-window attempt (window.open(), target="_blank" ad
 * popunders) instead of the platform default of silently no-op'ing --
 * explicit here so the intent is documented, and future Capacitor versions
 * that might enable multi-window support don't silently regress this.
 */
public class AppLockedWebChromeClient extends BridgeWebChromeClient {

    public AppLockedWebChromeClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
        return false;
    }
}

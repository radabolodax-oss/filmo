package com.tonsite.pcprowlermobile;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import java.util.Arrays;
import java.util.List;

/**
 * Capacitor's default BridgeWebViewClient calls bridge.launchIntent(url) for
 * any navigation outside allowNavigation, which fires an external Intent
 * (opens Chrome/another app) -- that's the ad-escape hatch. This mirrors
 * pc-app/main.js's will-navigate preventDefault(): block silently instead,
 * no Intent, for anything not talking to the embedded local backend.
 */
public class AppLockedWebViewClient extends BridgeWebViewClient {

    private static final List<String> ALLOWED_HOSTS = Arrays.asList("127.0.0.1", "localhost");

    public AppLockedWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        if (ALLOWED_HOSTS.contains(url.getHost())) {
            return super.shouldOverrideUrlLoading(view, request);
        }
        return true;
    }
}

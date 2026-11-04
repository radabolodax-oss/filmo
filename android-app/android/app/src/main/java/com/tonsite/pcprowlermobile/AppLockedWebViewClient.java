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
 * no Intent, for top-level navigations not talking to the embedded local
 * backend, while letting embedded video player iframes (!isForMainFrame)
 * load their HTTPS streams inside the WebView.
 */
public class AppLockedWebViewClient extends BridgeWebViewClient {

    private static final List<String> ALLOWED_HOSTS = Arrays.asList("127.0.0.1", "localhost", "dawger.app");

    public AppLockedWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        if (url == null) return true;
        String scheme = url.getScheme() != null ? url.getScheme().toLowerCase() : "";
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            return true;
        }
        String host = url.getHost() != null ? url.getHost().toLowerCase() : "";
        if (ALLOWED_HOSTS.contains(host)) {
            return super.shouldOverrideUrlLoading(view, request);
        }
        if (!request.isForMainFrame()) {
            // Allow sub-frame (iframe) video embeds to load inside the WebView without launching Chrome
            return false;
        }
        return true;
    }
}

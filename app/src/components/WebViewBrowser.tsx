import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Linking, Platform } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewMessageEvent,
  WebViewOpenWindowEvent,
} from 'react-native-webview/lib/WebViewTypes';
import {
  isNetworkJournalEnabled,
  subscribeNetworkJournal,
} from '../services/networkJournal';
import {
  clearBridgeCapabilities,
  handleBridgeMessage,
  refreshCastShimStatus,
  startCastShimEventForwarding,
  startPictureInPictureEventForwarding,
} from '../services/bridge';
import { setLocalPlaybackAwake } from '../services/playbackAwake';
import {
  getPreparedNativePlaybackSourceProtocolVersion,
  setPictureInPicturePlaybackActive,
} from '../services/pictureInPicture';
import { buildInjectedJavaScript } from '../injection/inject';
import type { PictureInPictureShimMode } from '../injection/picture-in-picture-shim';
import { CONFIG } from '../config';

export interface WebViewBrowserRef {
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  loadUrl: (url: string) => void;
  injectJavaScript: (script: string) => void;
  refreshCastShimStatus: () => void;
}

interface WebViewBrowserProps {
  url: string;
  onNavigationStateChange?: (state: WebViewNavigation) => void;
  onError?: (error: string) => void;
  onPictureInPictureModeChange?: (active: boolean) => void;
}

function getPictureInPictureShimMode(): PictureInPictureShimMode {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 26) {
    return 'android';
  }
  if (Platform.OS === 'ios') {
    try {
      if (getPreparedNativePlaybackSourceProtocolVersion() === 1) {
        return 'ios-native-v1';
      }
    } catch {
      // A missing/older native module must leave WebKit behavior untouched.
    }
  }
  return 'disabled';
}

const BASE_INJECTION_OPTIONS = {
  pictureInPictureMode: getPictureInPictureShimMode(),
  mediaProxyRoutingEnabled:
    Platform.OS === 'android' || Platform.OS === 'ios',
  mediaProxyCapabilityEnabled: Platform.OS === 'ios',
  // WebKit bloque `http://127.0.0.1` comme contenu mixte depuis une page https,
  // là où Chromium exempte la boucle locale. Router les segments HLS par le
  // proxy local ne peut donc qu'échouer sur iOS : chaque requête payait deux
  // allers-retours de pont avant de retomber sur GM_FETCH. Le handoff natif
  // (`GM_openMediaProxy`) reste actif, lui ne passe pas par le moteur web.
  mediaProxyXhrRoutingEnabled: Platform.OS === 'android',
  // Le pendant iOS du routage par la boucle locale : WebKit la refuse depuis
  // une page https, mais route un schéma personnalisé vers le natif. Le
  // handler est enregistré sur la configuration WKWebView (patch
  // react-native-webview) et relaie vers le proxy local.
  mediaProxyScheme: Platform.OS === 'ios' ? 'movix-media' : null,
} as const;

// Construit une fois par état de capture, pas à chaque rendu : le script
// injecté est volumineux, et son contenu ne dépend que de ce booléen.
const INJECTED_JS_BY_JOURNAL_STATE = new Map<boolean, string>();

function injectedJavaScriptFor(journalConsoleEnabled: boolean): string {
  const cached = INJECTED_JS_BY_JOURNAL_STATE.get(journalConsoleEnabled);
  if (cached !== undefined) return cached;
  const built = buildInjectedJavaScript({
    ...BASE_INJECTION_OPTIONS,
    journalConsoleEnabled,
  });
  INJECTED_JS_BY_JOURNAL_STATE.set(journalConsoleEnabled, built);
  return built;
}

function isUsableHttpUrl(value: unknown): value is string {
  return (
    typeof value === 'string'
    && value.length > 0
    && !/[\u0000-\u0020\\]/.test(value)
    && /^(?:https?|movix-media):\/\/[^/?#]+(?:[/?#]|$)/i.test(value)
  );
}

function isSameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

const MIRROR_DOWN_STATUSES = new Set(['instagram.com']),
      [],
    );

    const isAllowedExternalUrl = useCallback(
      (urlStr: string): boolean => {
        try {
          const parsed = new URL(urlStr);
          const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
          return ALLOWED_EXTERNAL_HOSTS.has(host);
        } catch {
          return false;
        }
      },
      [ALLOWED_EXTERNAL_HOSTS],
    );

    // Blocage strict des pubs vers les navigateurs :
    // Les lecteurs tiers (iframes) déclenchent fréquemment des pop-ups publicitaires.
    // - Si même origine que l'app : redirection interne.
    // - Si lien officiel autorisé (GitHub, Discord, Telegram...) : ouverture navigateur externe.
    // - TOUT LE RESTE (pubs, popups, redirections) est systématiquement bloqué et ignoré !
    const onOpenWindow = useCallback((event: WebViewOpenWindowEvent) => {
      const targetUrl = event.nativeEvent.targetUrl;
      if (!isUsableHttpUrl(targetUrl)) return;
      if (isSameOrigin(targetUrl, topLevelUrlRef.current)) {
        webViewRef.current?.injectJavaScript(
          `window.location.href = ${JSON.stringify(targetUrl)}; true;`,
        );
        return;
      }
      if (isAllowedExternalUrl(targetUrl)) {
        Linking.openURL(targetUrl).catch(() => {});
        return;
      }
      // Publicité / popup tierce bloquée sans ouvrir le navigateur externe
    }, [isAllowedExternalUrl]);

    const onHttpError = useCallback(
      (event: any) => {
        // Seul un serveur en panne justifie de passer au miroir suivant. Un 403
        // ou un 503 est souvent le défi Cloudflare servi aux IP de VPN : la page
        // doit s'afficher pour que le défi se résolve.
        if (!MIRROR_DOWN_STATUSES.has(event.nativeEvent.statusCode)) return;
        onError?.(
          `HTTP ${event.nativeEvent.statusCode}: ${event.nativeEvent.url}`,
        );
      },
      [onError],
    );

    const onWebViewError = useCallback(
      (event: WebViewErrorEvent) => {
        onError?.(event.nativeEvent.description);
      },
      [onError],
    );

    // Le renvoi de la console est armé dans le script injecté : il faut donc le
    // reconstruire quand la capture change. La bascule ne prend effet qu'au
    // chargement suivant de la page, `injectedJavaScriptBeforeContentLoaded`
    // n'étant relu qu'à la navigation.
    const [journalConsole, setJournalConsole] = useState(
      isNetworkJournalEnabled,
    );
    useEffect(() => subscribeNetworkJournal(setJournalConsole), []);
    const injectedJS = useMemo(
      () => injectedJavaScriptFor(journalConsole),
      [journalConsole],
    );

    // Sur iOS, laisser WKWebView annoncer la version réelle de WebKit et de
    // l'appareil : un User-Agent Safari figé peut perturber Turnstile.
    const userAgent = Platform.OS === 'ios' ? undefined : CONFIG.USER_AGENT;

    return (
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={{ flex: 1, backgroundColor: '#0a0a0a' }}
        // Injection du bridge + userscript avant le chargement
        injectedJavaScriptBeforeContentLoaded={injectedJS}
        // Garder les iframes Turnstile sans bridge ni userscript Movix.
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly={true}
        // Bridge messages
        onMessage={onMessage}
        onShouldStartLoadWithRequest={(request) => {
          const lowerUrl = (request.url || '').toLowerCase();

          // Bloquer les schémas non http/https/about souvent poussés par les régies de pub (intent:, market:, etc.)
          if (
            lowerUrl.startsWith('intent:') ||
            lowerUrl.startsWith('market:') ||
            lowerUrl.startsWith('itms-appss:') ||
            lowerUrl.startsWith('tel:') ||
            lowerUrl.startsWith('sms:')
          ) {
            return false;
          }

          if (request.isTopFrame !== false) {
            // Empêcher les iframes tierces de rediriger le top frame vers des sites de pub (frame-busting)
            const isInternal =
              isSameOrigin(request.url, topLevelUrlRef.current) ||
              lowerUrl.includes('appassets.androidplatform.net') ||
              lowerUrl.includes('127.0.0.1') ||
              lowerUrl.includes('localhost') ||
              lowerUrl.startsWith('about:');

            if (!isInternal) {
              if (isAllowedExternalUrl(request.url)) {
                Linking.openURL(request.url).catch(() => {});
              }
              return false;
            }

            if (isUsableHttpUrl(request.url)) {
              topLevelUrlRef.current = request.url;
            }
            navigationGenerationRef.current += 1;
            clearBridgeCapabilities(webViewRef);
          }
          return true;
        }}
        // Navigation
        onNavigationStateChange={onNavigationStateChange}
        // Pop-ups : hors origine Movix -> navigateur système
        setSupportMultipleWindows={true}
        onOpenWindow={onOpenWindow}
        // Errors
        onError={onWebViewError}
        onHttpError={onHttpError}
        // Config
        userAgent={userAgent}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        allowsPictureInPictureMediaPlayback={Platform.OS === 'ios'}
        allowsFullscreenVideo={true}
        allowsBackForwardNavigationGestures={true}
        // Sécurité
        // Turnstile utilise aussi des documents internes about:srcdoc.
        // about:blank est déjà autorisé par react-native-webview.
        originWhitelist={['https://*', 'http://*', 'movix-media://*', 'about:srcdoc']}
        // « compatibility » laisse passer le contenu passif (images) mais
        // bloque toujours le contenu actif : un `fetch("http://…")` depuis la
        // page échouait donc en quelques millisecondes (« Network request
        // failed »), et le proxy de l'app ne pouvait pas récupérer les flux
        // servis par une IP nue, qui n'existent qu'en http. « always » est
        // nécessaire pour que ce proxy fonctionne.
        mixedContentMode="always"
        // Cache
        cacheEnabled={true}
        // Désactive le zoom pour un rendu app-like
        scalesPageToFit={false}
        textZoom={100}
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        // Android
        overScrollMode="never"
        thirdPartyCookiesEnabled={true}
        // iOS
        sharedCookiesEnabled={true}
        contentMode="mobile"
      />
    );
  },
);

WebViewBrowser.displayName = 'WebViewBrowser';
export default WebViewBrowser;

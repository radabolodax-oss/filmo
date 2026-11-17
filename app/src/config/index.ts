import { Platform } from 'react-native';

const STANDALONE_SITE_URL =
  Platform.OS === 'ios'
    ? 'movix-media://appassets.androidplatform.net/index.html'
    : 'https://appassets.androidplatform.net/index.html';

export const CONFIG = {
  SITE_URL: STANDALONE_SITE_URL,
  DNS_PRIMARY: '1.1.1.1',
  DNS_SECONDARY: '1.0.0.1',
  DNS_DOH_URL: 'https://cloudflare-dns.com/dns-query',
  APP_NAME: 'Dawger',
  USER_AGENT:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
};

export const UPDATE_CHECK = {
  RENTRY_URL: '',
  MANIFEST_PATH: '/app/version.json',
  GITHUB_VERSION_RAW_PATH: '/app/version.json',
  IOS_PAGE_PATH: '/ios',
  TIMEOUT_MS: 5000,
  PENDING_DOWNLOAD_KEY: 'update:pendingDownload',
};

export const FALLBACK_CONFIG = {
  RESOLVER_HOSTS: ['appassets.androidplatform.net'],
  PRIMARY_URL: STANDALONE_SITE_URL,
  MIRRORS: [
    STANDALONE_SITE_URL,
  ],
  CACHE_KEY: 'dawger_address:lastConfig_v3',
  GITHUB_URL: 'https://filmo-one.vercel.app',
  TELEGRAM_URL: '',
};

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.movix.app',
  appName: 'Movix',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'movix.app',
    cleartext: true,
    allowNavigation: ['*'],
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0f0f0f',
    loggingBehavior: 'none',
    buildOptions: {
      releaseType: 'APK',
    },
  },
  ios: {
    backgroundColor: '#0f0f0f',
    contentInset: 'automatic',
  },
};

export default config;

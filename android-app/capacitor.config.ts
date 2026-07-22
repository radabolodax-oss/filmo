import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tonsite.pcprowlermobile',
  appName: 'PC Prowler Mobile',
  webDir: 'www',
  server: {
    cleartext: true,
    allowNavigation: ['localhost', 'localhost:3000', '127.0.0.1', '127.0.0.1:3000']
  }
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tonsite.pcprowlermobile',
  appName: 'Dawger',
  webDir: 'www',
  server: {
    cleartext: true,
    allowNavigation: ['localhost', 'localhost:25565', '127.0.0.1', '127.0.0.1:25565', 'localhost:3000', '127.0.0.1:3000']
  }
};

export default config;

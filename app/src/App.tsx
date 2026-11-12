import React, { useEffect, useState } from 'react';
import {
  StatusBar,
  NativeModules,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import BrowserScreen from './screens/BrowserScreen';
import UpdateScreen from './screens/UpdateScreen';
import UpdateDialog from './components/UpdateDialog';
import { useAppUpdate } from './hooks/useAppUpdate';
import { AddressProvider, useAddress } from './context/AddressContext';
import { loadNetworkJournalPreference } from './services/networkJournal';

const { DnsModule } = NativeModules;

export default function App() {
  const [ready, setReady] = useState(false);
  const [dnsSettled, setDnsSettled] = useState(false);

  // Le tampon natif du journal réseau part éteint à chaque démarrage : sans ce
  // rappel au boot, la capture ne reprenait qu'en ouvrant les réglages, et une
  // lecture lancée juste après une mise à jour n'était pas enregistrée — soit
  // exactement le moment où on a besoin d'elle.
  useEffect(() => {
    loadNetworkJournalPreference().catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Ne pas afficher la popup DNS ni monter automatiquement le VPN 1.1.1.1 au
        // démarrage : le failover de domaines fonctionne directement dans les résolveurs.
        let nativeEnabled = false;
        if (DnsModule) {
          try {
            nativeEnabled = Boolean(await DnsModule.isEnabled());
          } catch {}
        }
        await AsyncStorage.setItem('dns_enabled', nativeEnabled ? 'true' : 'false');
      } catch {
      } finally {
        setDnsSettled(true);
        setReady(true);
      }
    })();
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <AddressProvider>
        <AppShell dnsSettled={dnsSettled} />
      </AddressProvider>
    </SafeAreaProvider>
  );
}

function AppShell({ dnsSettled }: { dnsSettled: boolean }) {
  const { config } = useAddress();
  const { state, accept, dismiss, cancel, openSettings, retry } = useAppUpdate(
    config?.githubUrl ?? null,
  );

  // No i18n in the mobile app today — FR is the primary language. The JSON
  // manifest still carries both `fr` and `en` release notes for future use.
  const locale: 'fr' | 'en' = 'fr';

  const showScreen =
    state.manifest &&
    (state.stage === 'downloading' ||
      state.stage === 'verifying' ||
      state.stage === 'installing' ||
      state.stage === 'need_permission' ||
      state.stage === 'error');

  if (showScreen && state.manifest) {
    return (
      <UpdateScreen
        manifest={state.manifest}
        stage={state.stage}
        progress={state.progress}
        error={state.error}
        locale={locale}
        onCancel={cancel}
        onOpenSettings={openSettings}
        onRetry={retry}
      />
    );
  }

  return (
    <>
      <BrowserScreen />
      {dnsSettled && state.stage === 'offered' && state.manifest && (
        <UpdateDialog
          manifest={state.manifest}
          locale={locale}
          onLater={dismiss}
          onUpdate={accept}
        />
      )}
    </>
  );
}

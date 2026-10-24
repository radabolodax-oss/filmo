import { useState, useEffect, useCallback } from 'react';
import {
  checkForAppUpdates,
  startAppUpdate,
  UpdateInfo,
  UpdateProgress,
  CURRENT_APP_VERSION,
} from '../services/updateService';

const DISMISSED_VERSION_KEY = 'dawger_dismissed_update_version';

export function useAppUpdate(autoCheck = true) {
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [progress, setProgress] = useState<UpdateProgress>({ percent: 0 });
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const check = useCallback(async (manual = false) => {
    setIsChecking(true);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await checkForAppUpdates();
      if (res.hasUpdate && res.updateInfo) {
        setHasUpdate(true);
        setUpdateInfo(res.updateInfo);

        // If manual check, always open modal; if autoCheck, verify not dismissed
        const dismissed = sessionStorage.getItem(DISMISSED_VERSION_KEY);
        if (manual || dismissed !== res.updateInfo.version) {
          setIsModalOpen(true);
        }
      } else {
        setHasUpdate(false);
        setUpdateInfo(null);
        if (manual) {
          setStatusMessage('Votre application Dawger est déjà à jour (v' + CURRENT_APP_VERSION + ').');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la vérification');
    } finally {
      setIsChecking(false);
    }
  }, []);

  const triggerUpdate = useCallback(async () => {
    if (!updateInfo) return;
    setIsUpdating(true);
    setError(null);
    setProgress({ percent: 0 });

    try {
      const res = await startAppUpdate(updateInfo, (p) => {
        setProgress(p);
      });
      if (res.success) {
        setStatusMessage(res.message || 'Mise à jour en cours...');
      } else {
        setError(res.message || 'Impossible de lancer la mise à jour.');
      }
    } catch (err: any) {
      setError(err?.message || 'Échec du téléchargement');
    } finally {
      setIsUpdating(false);
    }
  }, [updateInfo]);

  const dismiss = useCallback(() => {
    if (updateInfo) {
      sessionStorage.setItem(DISMISSED_VERSION_KEY, updateInfo.version);
    }
    setIsModalOpen(false);
  }, [updateInfo]);

  useEffect(() => {
    if (autoCheck) {
      // Delay initial check by 2 seconds so the app boots smoothly first
      const timer = setTimeout(() => {
        check(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoCheck, check]);

  return {
    hasUpdate,
    updateInfo,
    isChecking,
    isUpdating,
    progress,
    error,
    statusMessage,
    isModalOpen,
    setIsModalOpen,
    checkUpdate: () => check(true),
    startUpdate: triggerUpdate,
    dismissUpdate: dismiss,
    currentVersion: CURRENT_APP_VERSION,
  };
}

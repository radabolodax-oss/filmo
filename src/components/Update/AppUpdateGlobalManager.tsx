import React, { useEffect } from 'react';
import { useAppUpdate } from '../../hooks/useAppUpdate';
import { UpdateModal } from './UpdateModal';

export const CHECK_APP_UPDATE_EVENT = 'dawger:check_app_update';

export function triggerAppUpdateCheck() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHECK_APP_UPDATE_EVENT));
  }
}

export const AppUpdateGlobalManager: React.FC = () => {
  const {
    hasUpdate,
    updateInfo,
    isChecking,
    isUpdating,
    progress,
    error,
    statusMessage,
    isModalOpen,
    setIsModalOpen,
    checkUpdate,
    startUpdate,
    dismissUpdate,
    currentVersion,
  } = useAppUpdate(true);

  // Listen for manual trigger from Settings or other pages
  useEffect(() => {
    const handler = () => {
      checkUpdate();
    };
    window.addEventListener(CHECK_APP_UPDATE_EVENT, handler);
    return () => {
      window.removeEventListener(CHECK_APP_UPDATE_EVENT, handler);
    };
  }, [checkUpdate]);

  return (
    <UpdateModal
      isOpen={isModalOpen}
      onClose={dismissUpdate}
      updateInfo={updateInfo}
      currentVersion={currentVersion}
      isUpdating={isUpdating}
      progress={progress}
      onStartUpdate={startUpdate}
      error={error}
      statusMessage={statusMessage}
    />
  );
};

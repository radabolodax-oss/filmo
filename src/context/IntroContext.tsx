import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';

interface IntroContextProps {
  showIntro: boolean;
  setShowIntro: React.Dispatch<React.SetStateAction<boolean>>;
  introCompleted: boolean;
  completeIntro: () => void;
  skipIntro: () => void;
}

const IntroContext = createContext<IntroContextProps | undefined>(undefined);

export const IntroProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showIntro, setShowIntro] = useState(false);
  const [introCompleted, setIntroCompleted] = useState(true);

  useEffect(() => {
    const introEnabled =
      localStorage.getItem('dawger_intro_enabled') === 'true' ||
      localStorage.getItem('movix_intro_enabled') === 'true';
    const hasSeenIntro = sessionStorage.getItem('dawger_intro_seen') === 'true';

    if (introEnabled && !hasSeenIntro) {
      setShowIntro(true);
      setIntroCompleted(false);
    }
  }, []);

  // Écouter les changements de setting (toggle depuis SettingsPage)
  useEffect(() => {
    const handleIntroReset = () => {
      // Quand on active l'intro dans les settings, reset le "seen" pour la session
      sessionStorage.removeItem('dawger_intro_seen');
      localStorage.removeItem('movix_intro_seen');
    };
    window.addEventListener('intro_settings_changed', handleIntroReset);
    return () => window.removeEventListener('intro_settings_changed', handleIntroReset);
  }, []);

  const completeIntro = useCallback(() => {
    setShowIntro(false);
    setIntroCompleted(true);
    sessionStorage.setItem('dawger_intro_seen', 'true');
    localStorage.setItem('movix_intro_seen', 'true');
  }, []);

  const skipIntro = useCallback(() => {
    setShowIntro(false);
    setIntroCompleted(true);
    sessionStorage.setItem('dawger_intro_seen', 'true');
    localStorage.setItem('movix_intro_seen', 'true');
  }, []);

  const value = useMemo(
    () => ({ showIntro, setShowIntro, introCompleted, completeIntro, skipIntro }),
    [showIntro, setShowIntro, introCompleted, completeIntro, skipIntro]
  );

  return (
    <IntroContext.Provider value={value}>
      {children}
    </IntroContext.Provider>
  );
};

export const useIntro = (): IntroContextProps => {
  const context = useContext(IntroContext);
  if (context === undefined) {
    throw new Error('useIntro must be used within an IntroProvider');
  }
  return context;
};

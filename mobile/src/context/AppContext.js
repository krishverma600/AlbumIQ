import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';

import { loadSession } from '../lib/session';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [guestState, setGuestState] = useState({
    eventCode: '',
    event: null,
    selfie: null,
    matches: [],
    searchId: '',
    matchedCount: 0,
    searchError: '',
  });

  useEffect(() => {
    async function bootstrap() {
      const saved = await loadSession();
      setSession(saved);
      setReady(true);
    }
    bootstrap();
  }, []);

  const setGuestResults = useCallback((payload) => {
    setGuestState((current) => ({ ...current, ...payload }));
  }, []);

  const value = useMemo(
    () => ({
      ready,
      session,
      isLoggedIn: Boolean(session?.access),
      setSession,
      clearGuestState() {
        setGuestState({
          eventCode: '',
          event: null,
          selfie: null,
          matches: [],
          searchId: '',
          matchedCount: 0,
          searchError: '',
        });
      },
      guestState,
      setGuestEvent(eventCode, event) {
        setGuestState((current) => ({
          ...current,
          eventCode,
          event,
          selfie: null,
          matches: [],
          searchId: '',
          matchedCount: 0,
          searchError: '',
        }));
      },
      setGuestSelfie(selfie) {
        setGuestState((current) => ({
          ...current,
          selfie,
          matches: [],
          searchId: '',
          matchedCount: 0,
          searchError: '',
        }));
      },
      setGuestResults,
    }),
    [guestState, ready, session]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return context;
}

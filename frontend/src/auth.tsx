import type { User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { onLocalChange } from './api';
import * as storage from './lib/storage';
import { supabase } from './lib/supabase';
import { syncNow } from './lib/sync';

const SYNC_DELAY_MS = 1500;
export const SYNC_ERROR = '동기화하지 못했어요. 인터넷 연결을 확인해 주세요.';

interface AuthState {
  /** False when this build has no Supabase keys, so sign-in is unavailable. */
  enabled: boolean;
  ready: boolean;
  user: User | null;
  syncing: boolean;
  syncError: string | null;
  lastSynced: Date | null;
  /** Bumps whenever synced data from another device lands locally; screens reload on change. */
  dataVersion: number;
  syncNow: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const userRef = useRef<User | null>(null);
  userRef.current = user;
  const running = useRef<Promise<boolean> | null>(null);
  const rerun = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    // Supabase warns against awaiting its own calls inside this callback, so only record state here.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const runSync = useCallback((): Promise<boolean> => {
    const current = userRef.current;
    if (!current) return Promise.resolve(false);
    if (running.current) {
      // A change arrived mid-sync: go around once more so it is not left behind.
      rerun.current = true;
      return running.current;
    }
    running.current = (async () => {
      setSyncing(true);
      try {
        do {
          rerun.current = false;
          if (await syncNow(current.id)) setDataVersion((v) => v + 1);
        } while (rerun.current);
        setSyncError(null);
        setLastSynced(new Date());
        return true;
      } catch {
        setSyncError(SYNC_ERROR);
        return false;
      } finally {
        setSyncing(false);
        running.current = null;
      }
    })();
    return running.current;
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      // Data left by a different account must not leak into this one; a guest's data is adopted.
      const owner = await storage.getOwner();
      if (owner && owner !== userId) {
        await storage.clearAll();
        setDataVersion((v) => v + 1);
      }
      if (owner !== userId) await storage.setOwner(userId);
      if (!cancelled) await runSync();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, runSync]);

  useEffect(
    () =>
      onLocalChange(() => {
        if (!userRef.current) return;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void runSync(), SYNC_DELAY_MS);
      }),
    [runSync],
  );

  useEffect(() => {
    // Coming back to the tab or back online is when another device's progress is most likely waiting.
    const onVisible = () => document.visibilityState === 'visible' && void runSync();
    const onOnline = () => void runSync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [runSync]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    window.clearTimeout(timer.current);
    // Push everything first: local data is wiped below so the next person on this browser starts clean.
    if (!(await runSync())) throw new Error('동기화하지 못해서 로그아웃을 멈췄어요. 인터넷 연결을 확인해 주세요.');
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error('로그아웃하지 못했어요. 다시 시도해 주세요.');
    await storage.clearAll();
    setLastSynced(null);
    setDataVersion((v) => v + 1);
  }, [runSync]);

  return (
    <AuthContext.Provider
      value={{
        enabled: supabase !== null,
        ready,
        user,
        syncing,
        syncError,
        lastSynced,
        dataVersion,
        syncNow: runSync,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export const useDataVersion = () => useAuth().dataVersion;

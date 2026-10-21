import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';

/** Sends signed-out visitors to the login page; without Supabase keys the app stays open as guest-only. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { enabled, ready, user } = useAuth();
  const location = useLocation();
  if (!enabled) return children;
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

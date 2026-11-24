import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { StaffProvider, useStaffState } from '../../hooks/useStaffSession';
import { getSupabase } from '../../lib/supabase';
import { isSupabaseConfigured } from '../../lib/config';

const IDLE_MS = 30 * 60 * 1000; // sign out after 30 minutes without activity

/**
 * Client-side guard for the dashboard. This is for UX only — the real
 * protection is Row Level Security in the database, which refuses to return
 * any registration to a user who is not in `staff_members`.
 */
export default function RequireStaff({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured) return <Navigate to="/admin/login" replace />;
  return <Guard>{children}</Guard>;
}

function Guard({ children }: { children: ReactNode }) {
  const state = useStaffState();
  const signOut = async () => {
    await getSupabase().auth.signOut();
  };

  useEffect(() => {
    if (state.status === 'not_staff') void getSupabase().auth.signOut();
  }, [state.status]);

  // Idle timeout — important on shared clinic computers.
  useEffect(() => {
    if (state.status !== 'ready') return;
    let timer = window.setTimeout(signOut, IDLE_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(signOut, IDLE_MS);
    };
    const events = ['pointerdown', 'keydown', 'scroll'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [state.status]);

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center" role="status">
        <span className="size-8 animate-spin rounded-full border-2 border-olive border-t-transparent" />
        <span className="sr-only">Checking your access…</span>
      </div>
    );
  }
  if (state.status === 'signed_out') return <Navigate to="/admin/login" replace />;
  if (state.status === 'not_staff') return <Navigate to="/admin/login?denied=1" replace />;

  return (
    <StaffProvider value={{ role: state.role!, displayName: state.displayName, email: state.session?.user.email ?? '', signOut }}>
      {children}
    </StaffProvider>
  );
}

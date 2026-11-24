import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';

export type StaffRole = 'admin' | 'staff';

interface StaffState {
  status: 'loading' | 'signed_out' | 'not_staff' | 'ready';
  session: Session | null;
  role: StaffRole | null;
  displayName: string;
}

/**
 * Resolves the signed-in user's staff role from `staff_members` (readable only
 * for one's own row under RLS). The role is decided by the database; the UI
 * only reflects it.
 */
export function useStaffState(): StaffState {
  const [state, setState] = useState<StaffState>({ status: 'loading', session: null, role: null, displayName: '' });

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;

    const resolve = async (session: Session | null) => {
      if (!session) return active && setState({ status: 'signed_out', session: null, role: null, displayName: '' });
      const { data, error } = await supabase.from('staff_members').select('role, full_name').eq('user_id', session.user.id).maybeSingle();
      if (!active) return;
      if (error || !data) return setState({ status: 'not_staff', session, role: null, displayName: '' });
      setState({ status: 'ready', session, role: data.role as StaffRole, displayName: data.full_name || session.user.email || 'Staff' });
    };

    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') resolve(session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

interface StaffContextValue {
  role: StaffRole;
  displayName: string;
  email: string;
  signOut: () => Promise<void>;
}

const StaffContext = createContext<StaffContextValue | null>(null);

export function StaffProvider({ value, children }: { value: StaffContextValue; children: ReactNode }) {
  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

export function useStaff(): StaffContextValue {
  const v = useContext(StaffContext);
  if (!v) throw new Error('useStaff must be used inside <RequireStaff>');
  return v;
}

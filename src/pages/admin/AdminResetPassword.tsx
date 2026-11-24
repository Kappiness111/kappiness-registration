import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleAlert } from 'lucide-react';
import AuthCardLayout from '../../layouts/AuthCardLayout';
import Button from '../../components/ui/Button';
import { TextField } from '../../components/ui/fields';
import { getSupabase } from '../../lib/supabase';

/** Landing page for the password-reset email link. */
export default function AdminResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw.length < 12) return setError('Use at least 12 characters.');
    if (pw !== pw2) return setError('The passwords don’t match.');
    setLoading(true);
    const { error } = await getSupabase().auth.updateUser({ password: pw });
    setLoading(false);
    if (error) setError('Could not update the password. The link may have expired — request a new one.');
    else navigate('/admin', { replace: true });
  };

  return (
    <AuthCardLayout>
      <p className="text-[14px] font-semibold text-leaf">Administrator access</p>
      <h1 className="wide mt-2 text-[40px] font-extrabold leading-[0.95]">Set a new password.</h1>
      {!ready ? (
        <p className="mt-6 text-[15.5px] text-stone">Open this page from the link in your password reset email.</p>
      ) : (
        <form onSubmit={submit} noValidate className="mt-8 space-y-5">
          {error && (
            <p role="alert" className="flex gap-2.5 rounded-2xl bg-clay-soft p-4 text-[14.5px] text-clay">
              <CircleAlert className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          <TextField id="new-password" type="password" label="New password" autoComplete="new-password" hint="At least 12 characters." value={pw} onChange={(e) => setPw(e.target.value)} />
          <TextField id="confirm-password" type="password" label="Confirm password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          <Button type="submit" size="lg" loading={loading} block>
            Save password
          </Button>
        </form>
      )}
    </AuthCardLayout>
  );
}

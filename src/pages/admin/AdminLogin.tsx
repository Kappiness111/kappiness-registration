import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff, MailCheck } from 'lucide-react';
import AuthCardLayout from '../../layouts/AuthCardLayout';
import Button from '../../components/ui/Button';
import { TextField } from '../../components/ui/fields';
import { getSupabase } from '../../lib/supabase';
import { isSupabaseConfigured } from '../../lib/config';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'forgot' | 'sent'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(params.get('denied') ? 'This account does not have access to the staff area.' : '');

  useEffect(() => {
    document.title = 'Administrator access · Kappiness';
    if (!isSupabaseConfigured) return;
    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session && !params.get('denied')) navigate('/admin', { replace: true });
      });
  }, [navigate, params]);

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (!email.trim() || !password) return setError('Please enter your email and password.');
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      // Same message for every failure: never reveal whether an account exists.
      if (error) setError('Those details didn’t match. Please try again.');
      else navigate('/admin', { replace: true });
    } catch {
      setError('Unable to reach the server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (!email.trim()) return setError('Please enter your email.');
    setLoading(true);
    try {
      await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/admin/reset-password` });
      setMode('sent'); // shown regardless of whether the account exists
    } catch {
      setError('Unable to reach the server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCardLayout>
      <Link
        to="/"
        className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full px-2 text-[14px] text-stone transition-colors hover:text-forest"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </Link>

      <p className="mt-6 text-[14px] font-semibold text-leaf">Administrator access</p>
      <h1 className="wide mt-2 text-[40px] font-extrabold leading-[0.95]">
        {mode === 'login' ? 'Welcome back.' : mode === 'forgot' ? 'Reset password.' : 'Check your email.'}
      </h1>

      {!isSupabaseConfigured && (
        <p className="mt-6 rounded-2xl bg-clay-soft p-4 text-[14.5px] text-clay">
          Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your environment (see README).
        </p>
      )}

      {error && (
        <p role="alert" className="mt-6 flex gap-2.5 rounded-2xl bg-clay-soft p-4 text-[14.5px] text-clay">
          <CircleAlert className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {mode === 'login' && (
        <form onSubmit={signIn} noValidate className="mt-8 space-y-5">
          <TextField id="email" type="email" inputMode="email" label="Email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <div>
            <label htmlFor="password" className="mb-2 block text-[14.5px] font-medium text-ink">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-2xl border border-rule bg-sheet px-3.5 pr-14 text-[16px] outline-none transition-[border-color,box-shadow] hover:border-muted focus:border-ink focus:ring-1 focus:ring-ink"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                aria-pressed={showPw}
                className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-muted hover:text-ink"
              >
                {showPw ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => { setMode('forgot'); setError(''); }} className="min-h-10 cursor-pointer text-[14px] font-medium text-botanical underline decoration-olive underline-offset-4 hover:text-forest">
              Forgot password?
            </button>
          </div>
          <Button type="submit" size="lg" icon={ArrowRight} loading={loading} block disabled={!isSupabaseConfigured}>
            Sign In
          </Button>
          <p className="text-center text-[13px] text-stone">For authorised Kappiness staff only. Accounts are created by the clinic administrator.</p>
        </form>
      )}

      {mode === 'forgot' && (
        <form onSubmit={sendReset} noValidate className="mt-8 space-y-5">
          <p className="text-[15.5px] text-stone">Enter your staff email. If it belongs to an account, we’ll send a link to set a new password.</p>
          <TextField id="reset-email" type="email" inputMode="email" label="Email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" size="lg" loading={loading} block disabled={!isSupabaseConfigured}>
            Send reset link
          </Button>
          <Button variant="ghost" block onClick={() => setMode('login')}>
            Back to sign in
          </Button>
        </form>
      )}

      {mode === 'sent' && (
        <div className="mt-8 space-y-6">
          <p className="flex gap-3 rounded-2xl bg-mist p-4 text-[15.5px] text-forest">
            <MailCheck className="mt-0.5 size-5 shrink-0 text-botanical" aria-hidden="true" />
            If an account exists for that email, a password reset link is on its way.
          </p>
          <Button variant="secondary" block onClick={() => setMode('login')}>
            Back to sign in
          </Button>
        </div>
      )}
    </AuthCardLayout>
  );
}

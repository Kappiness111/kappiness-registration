/** Public (browser-safe) configuration. Secrets never belong here. */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
export const SUPABASE_PUBLISHABLE_KEY = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  ''
).trim();
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim();

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

/** Details as published on kappiness.in — confirm with the clinic before launch. */
export const CLINIC = {
  name: 'Kappiness',
  tagline: 'Mental Health and Therapeutic Centre',
  initiative: 'An initiative by Nadi Foundation',
  motto: 'Nourishing Minds, Pouring Happiness.',
  city: 'Thiruvananthapuram, Kerala',
  address: 'Eswaravilasam Road, Jagathy, near Carmel HSS, Vazhuthacaud, Thiruvananthapuram 695014',
  phoneDisplay: '+91 96561 91761',
  phoneTel: '+919656191761',
  email: 'infokappiness@gmail.com',
};

export const CRISIS_LINES = [
  { label: 'Emergency services (India)', number: '112', tel: '112' },
  { label: 'Tele-MANAS, 24×7 mental health helpline (Govt. of India)', number: '14416', tel: '14416' },
  { label: 'Tele-MANAS toll-free', number: '1-800-891-4416', tel: '18008914416' },
];

import { useCallback, useEffect, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, CircleAlert, Download, LogOut, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { LogoMark } from '../../components/Brand';
import Button from '../../components/ui/Button';
import { useStaff } from '../../hooks/useStaffSession';
import { getSupabase, type RegistrationListRow, type RegistrationRow } from '../../lib/supabase';
import { csvCell, downloadText, formatDate, formatDateTime } from '../../lib/format';
import { referralLabel } from '@shared/registration.ts';
import RegistrationDetail from './RegistrationDetail';

const PAGE_SIZE = 20;
const LIST_COLUMNS = 'id, registration_id, full_name, mobile_phone, created_at, referral_source, referral_other';

/** Start of a calendar day in India, as an ISO timestamp. */
const istDayStart = (date: string) => `${date}T00:00:00+05:30`;
const nextDay = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
/** Strip characters that have meaning in PostgREST filter syntax. */
const cleanSearch = (s: string) => s.replace(/[%,()*"\\:]/g, ' ').trim().slice(0, 80);

interface Stats {
  total: number;
  today: number;
  this_month: number;
}

function StatCard({ label, value, accent }: { label: string; value: number | null; accent?: boolean }) {
  return (
    <div className={`h-full rounded-2xl p-5 sm:p-6 ${accent ? 'bg-ink text-paper' : 'border border-rule bg-sheet'}`}>
      <p className={`text-[13.5px] ${accent ? 'text-white/80' : 'text-stone'}`}>{label}</p>
      <p className={`mt-2 text-[36px] font-semibold leading-none ${accent ? '' : 'text-charcoal'}`}>
        {value === null ? <span className="inline-block h-10 w-16 animate-pulse rounded-lg bg-current/10" /> : value.toLocaleString('en-IN')}
      </p>
    </div>
  );
}

export default function AdminDashboard() {
  const { role, displayName, email, signOut } = useStaff();
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<RegistrationListRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    document.title = 'Registrations · Kappiness staff';
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(cleanSearch(search)), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(0), [debounced, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = getSupabase();
    let q = supabase
      .from('patient_registrations')
      .select(LIST_COLUMNS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (debounced) q = q.or(`full_name.ilike."%${debounced}%",registration_id.ilike."%${debounced}%"`);
    if (from) q = q.gte('created_at', istDayStart(from));
    if (to) q = q.lt('created_at', istDayStart(nextDay(to)));

    const [list, s] = await Promise.all([q, supabase.rpc('registration_stats')]);
    if (list.error || s.error) setError('Could not load registrations. Please refresh, or sign in again.');
    else {
      setRows((list.data ?? []) as RegistrationListRow[]);
      setCount(list.count ?? 0);
      setStats(s.data as Stats);
    }
    setLoading(false);
  }, [page, debounced, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    const { data, error } = await getSupabase().rpc('export_registrations', { p_from: from || null, p_to: to || null });
    setExporting(false);
    if (error) return setError('Export failed. Only administrators can export registrations.');
    const cols: [string, (r: RegistrationRow) => unknown][] = [
      ['Registration ID', (r) => r.registration_id],
      ['Submitted (IST)', (r) => formatDateTime(r.created_at)],
      ['Full name', (r) => r.full_name],
      ['Date of birth', (r) => r.date_of_birth],
      ['Age', (r) => r.age],
      ['Gender', (r) => (r.gender_self_description ? `${r.gender} (${r.gender_self_description})` : r.gender)],
      ['Mobile phone', (r) => r.mobile_phone],
      ['Email', (r) => r.email],
      ['Present address', (r) => r.present_address],
      ['Present pincode', (r) => r.present_pincode],
      ['Permanent address', (r) => r.permanent_address],
      ['Permanent pincode', (r) => r.permanent_pincode],
      ['Marital status', (r) => r.marital_status],
      ['Educational level', (r) => r.educational_level],
      ['Occupation', (r) => r.occupation],
      ['Emergency contact name', (r) => r.emergency_contact_name],
      ['Emergency contact relationship', (r) => r.emergency_contact_relationship],
      ['Emergency contact number', (r) => r.emergency_contact_number],
      ['Registered before', (r) => (r.previously_registered ? 'Yes' : 'No')],
      ['Referral', (r) => referralLabel(r.referral_source, r.referral_other)],
      ['Psychological consent', (r) => (r.psychological_consent ? 'Yes' : 'No')],
      ['Research permission', (r) => (r.research_permission ? 'Yes' : 'No')],
      ['Consent given by', (r) => (r.signature_method === 'checkbox' ? `Ticked consent box (${r.digital_signature})` : r.signature_method === 'typed' ? `Typed signature: ${r.digital_signature}` : 'Drawn signature')],
      ['Consent date', (r) => r.consent_date],
      ['Consent version', (r) => r.consent_version],
    ];
    const lines = [cols.map(([h]) => csvCell(h)).join(','), ...(data as RegistrationRow[]).map((r) => cols.map(([, f]) => csvCell(f(r))).join(','))];
    downloadText(`kappiness-registrations-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\r\n'));
  };

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const hasFilters = Boolean(debounced || from || to);
  const latest = page === 0 && !hasFilters ? rows[0] : undefined;

  return (
    <div className="min-h-svh bg-ivory">
      {/* top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <LogoMark className="size-9" />
            <div className="leading-tight">
              <p className="text-[16px] font-bold lowercase leading-tight text-coffee">kappiness</p>
              <p className="text-[12.5px] text-stone">Staff</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-[14px] font-medium text-forest">{displayName}</p>
              <p className="text-[12px] capitalize text-stone">{role}</p>
            </div>
            <Button variant="secondary" size="sm" icon={LogOut} onClick={signOut} aria-label={`Sign out ${email}`}>
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <h1 className="wide text-[34px] font-extrabold">Registrations</h1>
        <p className="mt-1 text-[14.5px] text-stone">Patient details are confidential. Open only what you need for your work.</p>

        {/* stats */}
        <section aria-label="Overview" className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <StatCard label="Total registrations" value={stats?.total ?? null} accent />
          </div>
          <StatCard label="Today" value={stats?.today ?? null} />
          <StatCard label="This month" value={stats?.this_month ?? null} />
          <div className="col-span-2 min-w-0 rounded-2xl border border-line bg-cream p-5 sm:col-span-1 sm:p-6">
            <p className="text-[13.5px] text-stone">Most recent</p>
            {latest ? (
              <button type="button" onClick={() => setOpenId(latest.id)} className="mt-2 block cursor-pointer text-left">
                <span className="block truncate text-[18px] font-semibold text-charcoal hover:underline">{latest.full_name}</span>
                <span className="text-[13px] text-stone">
                  {latest.registration_id} · {formatDateTime(latest.created_at)}
                </span>
              </button>
            ) : (
              <p className="mt-2 text-[15px] text-stone">{loading ? '…' : hasFilters ? 'Clear filters to see' : 'No registrations yet'}</p>
            )}
          </div>
        </section>

        {/* toolbar */}
        <section aria-label="Search and filter" className="mt-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="relative flex-1">
              <label htmlFor="search" className="sr-only">
                Search by patient name or registration ID
              </label>
              <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-stone" aria-hidden="true" />
              <input
                id="search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or KAP-ID"
                className="h-12 w-full rounded-2xl border border-rule bg-sheet pl-11 pr-4 text-[16px] outline-none transition-[border-color,box-shadow] hover:border-olive focus:border-botanical focus:ring-4 focus:ring-olive/25"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" icon={SlidersHorizontal} iconPosition="left" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} className="flex-1 lg:hidden">
                Dates{from || to ? ' •' : ''}
              </Button>
              <Button variant="secondary" icon={RefreshCw} onClick={() => void load()} aria-label="Refresh" className="px-4" />
              {role === 'admin' && (
                <Button icon={Download} iconPosition="left" loading={exporting} onClick={exportCsv} className="flex-1 lg:flex-none">
                  Export CSV
                </Button>
              )}
            </div>
          </div>
          <div className={`${filtersOpen ? 'grid' : 'hidden'} mt-3 gap-3 rounded-2xl border border-line bg-cream p-4 sm:grid-cols-[1fr_1fr_auto] lg:grid lg:border-0 lg:bg-transparent lg:p-0`}>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-stone">
                <CalendarRange className="size-4" aria-hidden="true" /> From
              </span>
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-12 w-full rounded-2xl border border-line bg-cream px-4 text-[16px] outline-none focus:border-botanical focus:ring-4 focus:ring-olive/25" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-stone">To</span>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-12 w-full rounded-2xl border border-line bg-cream px-4 text-[16px] outline-none focus:border-botanical focus:ring-4 focus:ring-olive/25" />
            </label>
            {hasFilters && (
              <Button variant="ghost" icon={X} iconPosition="left" className="self-end" onClick={() => { setSearch(''); setFrom(''); setTo(''); }}>
                Clear
              </Button>
            )}
          </div>
        </section>

        {error && (
          <p role="alert" className="mt-5 flex gap-2.5 rounded-2xl bg-clay-soft p-4 text-[15px] text-clay">
            <CircleAlert className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        {/* list */}
        <section aria-label="Registrations" aria-busy={loading} className="mt-5">
          {/* desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-cream md:block">
            <table className="w-full text-left text-[14.5px]">
              <thead className="border-b border-line bg-ivory/70 text-[13px] font-semibold text-stone">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Registration ID</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Patient name</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Mobile</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Registered</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Referral</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer transition-colors hover:bg-mist/70" onClick={() => setOpenId(r.id)}>
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-botanical">{r.registration_id}</td>
                    <td className="px-5 py-3.5">
                      <button type="button" className="cursor-pointer text-left font-medium text-forest hover:underline" onClick={(e) => { e.stopPropagation(); setOpenId(r.id); }}>
                        {r.full_name}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-charcoal">{r.mobile_phone}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-stone">{formatDate(r.created_at)}</td>
                    <td className="px-5 py-3.5 text-stone">{referralLabel(r.referral_source, r.referral_other)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* mobile cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setOpenId(r.id)} className="block w-full cursor-pointer rounded-2xl border border-line bg-cream p-4 text-left transition-shadow active:shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[17px] font-semibold leading-tight text-charcoal">{r.full_name}</span>
                    <ChevronRight className="mt-1 size-5 shrink-0 text-olive" aria-hidden="true" />
                  </div>
                  <p className="mt-1 text-[13.5px] font-medium text-botanical">{r.registration_id}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-[13.5px]">
                    <div>
                      <dt className="text-stone">Mobile</dt>
                      <dd className="text-charcoal">{r.mobile_phone}</dd>
                    </div>
                    <div>
                      <dt className="text-stone">Registered</dt>
                      <dd className="text-charcoal">{formatDate(r.created_at)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-stone">Referral</dt>
                      <dd className="text-charcoal">{referralLabel(r.referral_source, r.referral_other)}</dd>
                    </div>
                  </dl>
                </button>
              </li>
            ))}
          </ul>

          {!loading && rows.length === 0 && !error && (
            <p className="rounded-2xl border border-dashed border-line bg-cream/60 p-10 text-center text-[15px] text-stone">
              {hasFilters ? 'No registrations match these filters.' : 'No registrations yet.'}
            </p>
          )}

          {/* pagination */}
          {count > 0 && (
            <nav aria-label="Pagination" className="mt-5 flex items-center justify-between gap-3">
              <p className="text-[14px] text-stone">
                {page * PAGE_SIZE + 1}–{Math.min(count, (page + 1) * PAGE_SIZE)} of {count.toLocaleString('en-IN')}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon={ChevronLeft} iconPosition="left" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" icon={ChevronRight} disabled={page + 1 >= pages || loading} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </nav>
          )}
        </section>
      </main>

      <RegistrationDetail id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

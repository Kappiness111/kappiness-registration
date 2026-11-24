import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  FileSpreadsheet,
  FileText,
  LogOut,
  RefreshCw,
  Search,
  Table2,
  Users,
} from 'lucide-react';
import { Wordmark } from '../../components/Brand';
import { useStaff } from '../../hooks/useStaffSession';
import { getSupabase, type RegistrationListRow, type RegistrationRow } from '../../lib/supabase';
import { formatDate, formatDateTime } from '../../lib/format';
import { downloadCsv, downloadXlsx, exportFileName } from '../../lib/exporters';
import { referralLabel, todayInZone } from '@shared/registration.ts';
import { ListPrint, RegistrationPrint, usePrint } from './PrintSheets';
import RegistrationDetail from './RegistrationDetail';
import { ABtn, Badge, Initials } from './ui';

const PAGE_SIZE = 20;
const LIST_COLUMNS =
  'id, registration_id, full_name, email, mobile_phone, age, gender, created_at, referral_source, referral_other, research_permission, previously_registered';

/** Start of a calendar day in India, as an ISO timestamp. */
const istDayStart = (date: string) => `${date}T00:00:00+05:30`;
const shiftDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/** Strip characters that have meaning in PostgREST filter syntax. */
const cleanSearch = (s: string) => s.replace(/[%,()*"\\:]/g, ' ').trim().slice(0, 80);

type Range = 'all' | 'today' | '7d' | 'month' | 'custom';
const RANGES: { id: Range; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

function rangeDates(range: Range, custom: { from: string; to: string }) {
  const today = todayInZone('Asia/Kolkata');
  switch (range) {
    case 'today':
      return { from: today, to: today };
    case '7d':
      return { from: shiftDays(today, -6), to: today };
    case 'month':
      return { from: `${today.slice(0, 8)}01`, to: today };
    case 'custom':
      return custom;
    default:
      return { from: '', to: '' };
  }
}

interface Stats {
  total: number;
  today: number;
  this_month: number;
}

const GENDER_SHORT: Record<string, string> = { Female: 'F', Male: 'M', 'Non-binary': 'NB', Transgender: 'T', Other: 'Other', 'Prefer not to say': '—' };

export default function AdminDashboard() {
  const { role, displayName, email, signOut } = useStaff();
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<RegistrationListRow[]>([]);
  const [latest, setLatest] = useState<RegistrationListRow | null>(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [range, setRange] = useState<Range>('all');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const { print, portal: printPortal } = usePrint();

  const { from, to } = rangeDates(range, custom);

  useEffect(() => {
    document.title = 'Registrations · Kappiness staff';
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(cleanSearch(search)), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(0), [debounced, from, to]);

  // close the export menu on outside click / Escape
  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: MouseEvent) => !exportRef.current?.contains(e.target as Node) && setExportOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExportOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [exportOpen]);

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
    if (to) q = q.lt('created_at', istDayStart(shiftDays(to, 1)));

    const latestQ = supabase.from('patient_registrations').select(LIST_COLUMNS).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const [list, s, l] = await Promise.all([q, supabase.rpc('registration_stats'), latestQ]);
    if (list.error || s.error) setError('Could not load registrations. Please refresh, or sign in again.');
    else {
      setRows((list.data ?? []) as RegistrationListRow[]);
      setCount(list.count ?? 0);
      setStats(s.data as Stats);
      setLatest((l.data as RegistrationListRow | null) ?? null);
    }
    setLoading(false);
  }, [page, debounced, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Bulk exports go through export_registrations: admin-only and audit-logged in the database. */
  const runExport = async (kind: 'xlsx' | 'pdf' | 'csv') => {
    setExportOpen(false);
    setExporting(true);
    setError('');
    const { data, error } = await getSupabase().rpc('export_registrations', { p_from: from || null, p_to: to || null });
    if (error) {
      setExporting(false);
      return setError('Export failed. Only administrators can export registrations.');
    }
    const all = data as RegistrationRow[];
    try {
      if (kind === 'csv') downloadCsv(all);
      else if (kind === 'xlsx') await downloadXlsx(all);
      else {
        const label = RANGES.find((r) => r.id === range)?.label ?? '';
        const rangeLabel = from || to ? `${from ? formatDate(from) : 'Start'} – ${to ? formatDate(to) : 'today'}` : label;
        print(<ListPrint rows={all} rangeLabel={rangeLabel} />, { title: exportFileName('pdf').replace(/\.pdf$/, ''), landscape: true });
      }
    } catch {
      setError('Could not create the file. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const start = count === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min(count, (page + 1) * PAGE_SIZE);
  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long', timeZone: 'Asia/Kolkata' });

  return (
    <div className="min-h-svh bg-[#f8f6f3] lg:grid lg:grid-cols-[248px_1fr]">
      {/* ── sidebar (desktop) ── */}
      <aside className="sticky top-0 hidden h-svh flex-col border-r border-rule bg-white lg:flex">
        <div className="px-5 pb-5 pt-6">
          <Wordmark size="sm" />
          <p className="mt-2 text-[12.5px] text-muted">Staff area</p>
        </div>
        <nav aria-label="Staff" className="px-3">
          <a aria-current="page" className="flex h-10 items-center gap-3 rounded-lg bg-crema px-3 text-[14.5px] font-medium text-ink">
            <Users className="size-[18px] text-leaf" aria-hidden="true" /> Registrations
          </a>
        </nav>
        <div className="mt-auto border-t border-rule p-4">
          <div className="flex items-center gap-3">
            <Initials name={displayName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-ink">{displayName}</p>
              <p className="text-[12.5px] capitalize text-muted">{role}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              aria-label={`Sign out ${email}`}
              title="Sign out"
              className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-crema hover:text-ink"
            >
              <LogOut className="size-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* ── top bar (mobile) ── */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-rule bg-white px-4 py-3 lg:hidden">
          <Wordmark size="sm" />
          <ABtn variant="ghost" icon={LogOut} onClick={signOut} aria-label={`Sign out ${email}`}>
            Sign out
          </ABtn>
        </header>

        <main id="main" className="mx-auto max-w-[1180px] px-4 pb-16 pt-6 sm:px-8 sm:pt-9">
          {/* page header */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-bold leading-tight">Registrations</h1>
              <p className="mt-1 text-[14.5px] text-muted">Everyone who registered through the website. Times are in IST.</p>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <ABtn icon={RefreshCw} onClick={() => void load()} aria-label="Refresh" className="px-3">
                <span className="sr-only sm:not-sr-only">Refresh</span>
              </ABtn>
              {role === 'admin' && (
                <div ref={exportRef} className="relative flex-1 sm:flex-none">
                  <ABtn
                    variant="solid"
                    icon={Download}
                    onClick={() => setExportOpen((o) => !o)}
                    disabled={exporting}
                    aria-expanded={exportOpen}
                    aria-haspopup="menu"
                    className="w-full"
                  >
                    {exporting ? 'Preparing…' : 'Export'}
                    <ChevronDown className="size-4 opacity-70" aria-hidden="true" />
                  </ABtn>
                  {exportOpen && (
                    <div role="menu" className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-rule bg-white p-1.5 shadow-lift">
                      {(
                        [
                          ['xlsx', FileSpreadsheet, 'Excel (.xlsx)', 'Opens in Excel or Google Sheets'],
                          ['pdf', FileText, 'PDF', 'Printable list, landscape'],
                          ['csv', Table2, 'CSV', 'Plain comma-separated file'],
                        ] as const
                      ).map(([kind, Icon, label, hint]) => (
                        <button
                          key={kind}
                          type="button"
                          role="menuitem"
                          onClick={() => void runExport(kind)}
                          className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-crema"
                        >
                          <Icon className="mt-0.5 size-[18px] shrink-0 text-leaf" aria-hidden="true" />
                          <span>
                            <span className="block text-[14.5px] font-medium text-ink">{label}</span>
                            <span className="block text-[12.5px] text-muted">{hint}</span>
                          </span>
                        </button>
                      ))}
                      <p className="border-t border-rule px-3 pb-1 pt-2 text-[12px] text-muted">
                        Exports the selected date range ({RANGES.find((r) => r.id === range)?.label.toLowerCase()}). Every export is logged.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* key numbers */}
          <section aria-label="Overview" className="mt-6 grid grid-cols-2 overflow-hidden rounded-xl border border-rule bg-white lg:grid-cols-4">
            {[
              { label: 'Total registrations', value: stats?.total, note: 'Since launch' },
              { label: 'Today', value: stats?.today, note: 'IST' },
              { label: 'This month', value: stats?.this_month, note: monthName },
            ].map((k, i) => (
              <div key={k.label} className={`p-5 ${i === 1 ? 'border-l border-rule' : ''} ${i === 2 ? 'border-t border-rule lg:border-l lg:border-t-0' : ''}`}>
                <p className="text-[13px] text-muted">{k.label}</p>
                <p className="mt-1.5 text-[28px] font-bold leading-none text-ink">
                  {k.value === undefined ? <span className="inline-block h-7 w-12 animate-pulse rounded bg-crema align-middle" /> : k.value.toLocaleString('en-IN')}
                </p>
                <p className="mt-1.5 text-[12.5px] text-muted">{k.note}</p>
              </div>
            ))}
            <div className="border-l border-t border-rule p-5 lg:border-t-0">
              <p className="text-[13px] text-muted">Most recent</p>
              {latest ? (
                <button type="button" onClick={() => setOpenId(latest.id)} className="mt-1.5 block max-w-full cursor-pointer text-left">
                  <span className="block truncate text-[16px] font-semibold text-ink hover:underline">{latest.full_name}</span>
                  <span className="mt-1 block truncate text-[12.5px] text-muted">{formatDateTime(latest.created_at)}</span>
                </button>
              ) : (
                <p className="mt-1.5 text-[15px] text-muted">{loading ? '…' : 'None yet'}</p>
              )}
            </div>
          </section>

          {/* toolbar */}
          <section aria-label="Search and filter" className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative xl:w-[340px]">
              <label htmlFor="search" className="sr-only">
                Search by name or registration ID
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                id="search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or KAP-ID"
                className="h-10 w-full rounded-lg border border-rule bg-white pl-9 pr-3 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-muted/70 hover:border-olive focus:border-ink focus:ring-2 focus:ring-honey/40"
              />
            </div>
            <div role="radiogroup" aria-label="Date range" className="flex gap-1 overflow-x-auto rounded-lg border border-rule bg-white p-1 [scrollbar-width:none]">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={range === r.id}
                  onClick={() => setRange(r.id)}
                  className={`h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-md px-3 text-[13.5px] font-medium transition-colors ${
                    range === r.id ? 'bg-ink text-white' : 'text-muted hover:bg-crema hover:text-ink'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {range === 'custom' && (
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="from">
                  From
                </label>
                <input
                  id="from"
                  type="date"
                  value={custom.from}
                  max={custom.to || undefined}
                  onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                  className="h-10 rounded-lg border border-rule bg-white px-3 text-[14px] outline-none focus:border-ink"
                />
                <span className="text-muted">–</span>
                <label className="sr-only" htmlFor="to">
                  To
                </label>
                <input
                  id="to"
                  type="date"
                  value={custom.to}
                  min={custom.from || undefined}
                  onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                  className="h-10 rounded-lg border border-rule bg-white px-3 text-[14px] outline-none focus:border-ink"
                />
              </div>
            )}
            <p className="text-[13.5px] text-muted xl:ml-auto">
              {loading ? 'Loading…' : `${count.toLocaleString('en-IN')} ${count === 1 ? 'registration' : 'registrations'}`}
            </p>
          </section>

          {error && (
            <p role="alert" className="mt-4 flex gap-2.5 rounded-lg border border-error/30 bg-error-soft p-3.5 text-[14.5px] text-error">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          {/* list */}
          <section aria-label="Registrations" aria-busy={loading} className="mt-4 overflow-hidden rounded-xl border border-rule bg-white">
            {/* desktop table */}
            <table className="hidden w-full text-left text-[14px] md:table">
              <thead className="border-b border-rule bg-[#faf8f5] text-[12.5px] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Name</th>
                  <th scope="col" className="px-4 py-3 font-medium">Registration ID</th>
                  <th scope="col" className="px-4 py-3 font-medium">Mobile</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Age · Gender</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium xl:table-cell">Heard via</th>
                  <th scope="col" className="px-4 py-3 font-medium">Research</th>
                  <th scope="col" className="px-4 py-3 font-medium">Registered</th>
                  <th scope="col" className="w-8 px-2 py-3">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {loading && rows.length === 0
                  ? Array.from({ length: 5 }, (_, i) => (
                      <tr key={i}>
                        <td colSpan={8} className="px-4 py-3">
                          <div className="h-8 animate-pulse rounded bg-crema" />
                        </td>
                      </tr>
                    ))
                  : rows.map((r) => (
                      <tr key={r.id} className="group cursor-pointer transition-colors hover:bg-[#faf8f5]" onClick={() => setOpenId(r.id)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Initials name={r.full_name} />
                            <div className="min-w-0">
                              <button
                                type="button"
                                className="block max-w-[220px] cursor-pointer truncate text-left font-medium text-ink group-hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenId(r.id);
                                }}
                              >
                                {r.full_name}
                              </button>
                              <p className="max-w-[220px] truncate text-[12.5px] text-muted">{r.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-leaf">{r.registration_id}</td>
                        <td className="whitespace-nowrap px-4 py-3">{r.mobile_phone}</td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-muted lg:table-cell">
                          {r.age} · {GENDER_SHORT[r.gender] ?? r.gender}
                        </td>
                        <td className="hidden max-w-[200px] truncate px-4 py-3 text-muted xl:table-cell">{referralLabel(r.referral_source, r.referral_other)}</td>
                        <td className="px-4 py-3">{r.research_permission ? <Badge tone="positive">Yes</Badge> : <Badge>No</Badge>}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="block">{formatDate(r.created_at)}</span>
                          <span className="block text-[12.5px] text-muted">
                            {new Date(r.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-muted">
                          <ChevronRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>

            {/* mobile list */}
            <ul className="divide-y divide-rule md:hidden">
              {rows.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setOpenId(r.id)} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left active:bg-crema">
                    <Initials name={r.full_name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[15px] font-medium text-ink">{r.full_name}</span>
                        <span className="shrink-0 text-[12.5px] text-muted">{formatDate(r.created_at)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-muted">
                        <span className="font-medium text-leaf">{r.registration_id}</span> · {r.mobile_phone}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            {!loading && rows.length === 0 && !error && (
              <div className="px-6 py-14 text-center">
                <p className="text-[15px] font-medium text-ink">{debounced || from || to ? 'No registrations match' : 'No registrations yet'}</p>
                <p className="mt-1 text-[14px] text-muted">
                  {debounced || from || to ? 'Try a different name, ID or date range.' : 'New registrations from the website will appear here.'}
                </p>
              </div>
            )}

            {/* pagination */}
            {count > 0 && (
              <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-rule bg-[#faf8f5] px-4 py-3">
                <p className="text-[13.5px] text-muted">
                  Showing <span className="font-medium text-ink">{start}</span>–<span className="font-medium text-ink">{end}</span> of{' '}
                  <span className="font-medium text-ink">{count.toLocaleString('en-IN')}</span>
                </p>
                <div className="flex gap-2">
                  <ABtn icon={ChevronLeft} disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)} aria-label="Previous page" className="px-2.5" />
                  <ABtn icon={ChevronRight} disabled={page + 1 >= pages || loading} onClick={() => setPage((p) => p + 1)} aria-label="Next page" className="px-2.5" />
                </div>
              </nav>
            )}
          </section>

          <p className="mt-6 text-[12.5px] text-muted">
            Registrations contain personal and health-related information. Open only what you need for your work.
          </p>
        </main>
      </div>

      <RegistrationDetail
        id={openId}
        onClose={() => setOpenId(null)}
        onPrint={(row) => print(<RegistrationPrint r={row} />, { title: `Kappiness ${row.registration_id}` })}
      />
      {printPortal}
    </div>
  );
}

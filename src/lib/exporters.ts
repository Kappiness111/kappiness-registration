/**
 * Export registrations (admin dashboard). One column definition shared by
 * CSV, Excel and the printable list, so every format has the same fields.
 */
import { referralLabel } from '@shared/registration.ts';
import type { RegistrationRow } from './supabase';
import { csvCell, downloadText, formatDateTime } from './format';

interface Column {
  header: string;
  width: number; // Excel column width, in characters
  get: (r: RegistrationRow) => string | number;
}

const yesNo = (b: boolean) => (b ? 'Yes' : 'No');

export function consentGivenBy(r: RegistrationRow): string {
  if (r.signature_method === 'checkbox') return `Ticked consent box (${r.digital_signature})`;
  if (r.signature_method === 'typed') return `Typed signature: ${r.digital_signature}`;
  return 'Drawn signature';
}

export const EXPORT_COLUMNS: Column[] = [
  { header: 'Registration ID', width: 16, get: (r) => r.registration_id },
  { header: 'Submitted (IST)', width: 22, get: (r) => formatDateTime(r.created_at) },
  { header: 'Full name', width: 26, get: (r) => r.full_name },
  { header: 'Date of birth', width: 13, get: (r) => r.date_of_birth },
  { header: 'Age', width: 6, get: (r) => r.age },
  { header: 'Gender', width: 18, get: (r) => (r.gender_self_description ? `${r.gender} (${r.gender_self_description})` : r.gender) },
  { header: 'Mobile phone', width: 16, get: (r) => r.mobile_phone },
  { header: 'Email', width: 28, get: (r) => r.email },
  { header: 'Present address', width: 36, get: (r) => r.present_address },
  { header: 'Present pincode', width: 10, get: (r) => r.present_pincode },
  { header: 'Permanent address', width: 36, get: (r) => (r.permanent_same_as_present ? 'Same as present' : r.permanent_address) },
  { header: 'Permanent pincode', width: 10, get: (r) => r.permanent_pincode },
  { header: 'Marital status', width: 16, get: (r) => r.marital_status },
  { header: 'Educational level', width: 24, get: (r) => r.educational_level },
  { header: 'Occupation', width: 20, get: (r) => r.occupation },
  { header: 'Emergency contact name', width: 24, get: (r) => r.emergency_contact_name },
  { header: 'Emergency contact relationship', width: 16, get: (r) => r.emergency_contact_relationship },
  { header: 'Emergency contact number', width: 16, get: (r) => r.emergency_contact_number },
  { header: 'Registered before', width: 10, get: (r) => yesNo(r.previously_registered) },
  { header: 'Heard about us via', width: 26, get: (r) => referralLabel(r.referral_source, r.referral_other) },
  { header: 'Psychological consent', width: 10, get: (r) => yesNo(r.psychological_consent) },
  { header: 'Research permission', width: 10, get: (r) => yesNo(r.research_permission) },
  { header: 'Consent given by', width: 34, get: consentGivenBy },
  { header: 'Consent date', width: 13, get: (r) => r.consent_date },
  { header: 'Consent version', width: 20, get: (r) => r.consent_version },
];

export const exportFileName = (ext: string) => `kappiness-registrations-${new Date().toISOString().slice(0, 10)}.${ext}`;

export function downloadCsv(rows: RegistrationRow[]) {
  const lines = [
    EXPORT_COLUMNS.map((c) => csvCell(c.header)).join(','),
    ...rows.map((r) => EXPORT_COLUMNS.map((c) => csvCell(c.get(r))).join(',')),
  ];
  downloadText(exportFileName('csv'), lines.join('\r\n'));
}

/** Excel workbook (.xlsx). Opens in Excel, and in Google Sheets via File → Import. */
export async function downloadXlsx(rows: RegistrationRow[]) {
  const { default: writeExcelFile } = await import('write-excel-file/browser'); // loaded only when used
  const header = EXPORT_COLUMNS.map((c) => ({ value: c.header, fontWeight: 'bold' as const }));
  // Every value is written as plain text, so nothing can be interpreted as a formula.
  const body = rows.map((r) => EXPORT_COLUMNS.map((c) => ({ value: String(c.get(r) ?? '') })));
  await writeExcelFile([header, ...body], {
    sheet: 'Registrations',
    columns: EXPORT_COLUMNS.map((c) => ({ width: c.width })),
    stickyRowsCount: 1,
  }).toFile(exportFileName('xlsx'));
}

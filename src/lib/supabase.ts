/**
 * Supabase client for the STAFF area only (lazy-loaded with the admin pages,
 * so patients never download or initialise it).
 *
 * The staff session is kept in sessionStorage — it ends when the browser tab
 * closes, which is safer on shared clinic computers. No patient data is ever
 * written to browser storage.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
  client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      storage: window.sessionStorage,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // implicit flow: password-reset links work even when opened in a new tab
      // (PKCE would need the verifier from the tab that requested the reset).
      flowType: 'implicit',
    },
  });
  return client;
}

export interface RegistrationRow {
  id: string;
  registration_id: string;
  created_at: string;
  full_name: string;
  date_of_birth: string;
  age: number;
  gender: string;
  gender_self_description: string | null;
  mobile_phone: string;
  email: string;
  present_address: string;
  present_pincode: string;
  permanent_same_as_present: boolean;
  permanent_address: string;
  permanent_pincode: string;
  marital_status: string;
  educational_level: string;
  occupation: string;
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_number: string;
  previously_registered: boolean;
  referral_source: string;
  referral_other: string | null;
  terms_accepted_at: string;
  psychological_consent: boolean;
  research_permission: boolean;
  signature_method: 'checkbox' | 'typed' | 'drawn';
  digital_signature: string;
  consent_date: string;
  consent_version: string;
}

export type RegistrationListRow = Pick<
  RegistrationRow,
  'id' | 'registration_id' | 'full_name' | 'mobile_phone' | 'created_at' | 'referral_source' | 'referral_other'
>;

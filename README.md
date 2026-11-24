# Kappiness — Patient Registration Platform

Digital registration for **Kappiness – Mental Health and Therapeutic Centre**, *an initiative by Nadi Foundation*.

- **Visitors** (mostly on phones): Home → Terms & consent → one short registration page (about a minute) → a thank-you page explaining what happens next. Each registration gets an ID (KAP-2026-00001…) for staff; it isn't shown to the visitor.
- **Staff**: a private login and dashboard to view, search and export registrations.

Built with React, Vite, TypeScript, Tailwind CSS, Lucide icons and **Supabase** (PostgreSQL, Auth, Edge Functions). Deploys to **Vercel**.

---

## Contents

1. [How it works](#1-how-it-works)
2. [Install Node.js](#2-install-nodejs)
3. [Install project dependencies](#3-install-project-dependencies)
4. [Create a Supabase account and project](#4-create-a-supabase-account-and-project)
5. [Set up the database (migrations + RLS)](#5-set-up-the-database-migrations--rls)
6. [Set up CAPTCHA (Cloudflare Turnstile)](#6-set-up-captcha-cloudflare-turnstile)
7. [Deploy the Edge Function and its secrets](#7-deploy-the-edge-function-and-its-secrets)
8. [Configure environment variables](#8-configure-environment-variables)
9. [Configure authentication (no public sign-up)](#9-configure-authentication-no-public-sign-up)
10. [Create the first administrator](#10-create-the-first-administrator)
11. [Run the app locally](#11-run-the-app-locally)
12. [Test a registration](#12-test-a-registration)
13. [Use the admin dashboard](#13-use-the-admin-dashboard)
14. [Deploy to Vercel](#14-deploy-to-vercel)
15. [Connect the deployed site to Supabase](#15-connect-the-deployed-site-to-supabase)
16. [Security & privacy notes](#16-security--privacy-notes)
17. [Project structure](#17-project-structure)
18. [Automated tests](#18-automated-tests)
19. [Changing the consent wording](#19-changing-the-consent-wording)

---

## Preview mode (no backend)

If `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are not set, the site runs in **preview mode**: the whole journey works, but pressing Submit sends nothing and saves nothing. The form and the thank-you page both say so. To jump straight to the thank-you page while designing, open `http://localhost:5173/?preview=thanks` (works in preview mode only). Set the environment variables (section 8) to go live.

## Deploy to GitHub Pages

The workflow `.github/workflows/deploy-pages.yml` runs the tests, builds the site and publishes it on every push to `main`.

1. **One-time setup:** on GitHub open the repo → **Settings → Pages** → under *Build and deployment* set **Source: GitHub Actions**.
2. Push to `main` (or open **Actions → Deploy to GitHub Pages → Run workflow**).
3. The site appears at `https://<your-user>.github.io/<repo-name>/`, e.g. `https://kappiness111.github.io/kappiness-registration/`.

Notes:
- **Private repos:** GitHub Pages for private repositories needs a paid GitHub plan (Pro/Team/Enterprise). On the free plan, either make the repository public or deploy with Vercel instead (section 14).
- **Going live:** add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_TURNSTILE_SITE_KEY` under **Settings → Secrets and variables → Actions → Variables**, add the Pages address to the Edge Function's `ALLOWED_ORIGINS`, and to Supabase Auth redirect URLs (`…/kappiness-registration/admin/reset-password`). Without them the site runs in preview mode.
- GitHub Pages can't send custom security headers, so the CSP/HSTS headers in `vercel.json` only apply on Vercel. For the live clinic deployment, Vercel is the stronger option.

## 1. How it works

```
Patient's phone ──HTTPS──▶ Edge Function "submit-registration" ──service key──▶ PostgreSQL
                            • checks origin, size, honeypot           • table patient_registrations
                            • rate limit (5 / hour / IP, hashed)      • Row Level Security ON
                            • CAPTCHA (Turnstile)                     • ID made by the DB: KAP-2026-00001
                            • validates every field again             • consent wording stored by version
                            • idempotent retries (no duplicates)

Staff browser ──HTTPS + login──▶ Supabase Auth ──▶ PostgreSQL (RLS: only rows for staff_members)
```

- The public website **cannot read** patient records and **cannot write** to the table directly — only the Edge Function can insert, using a key that never leaves Supabase.
- Staff can only read records if their account is listed in `staff_members`. That list can only be changed by someone with access to the Supabase project.
- The success page appears **only after the database confirms the insert** and returns the registration ID.

## 2. Install Node.js

1. Go to <https://nodejs.org> and download the **LTS** version (20 or newer).
2. Run the installer and accept the defaults.
3. Open a terminal (Windows: *PowerShell*; Mac: *Terminal*) and check:

   ```bash
   node -v     # should print v20.x or newer
   npm -v
   ```

## 3. Install project dependencies

In the terminal, go to the project folder (the one containing `package.json`) and install:

```bash
cd path/to/kappiness-form
npm install
```

## 4. Create a Supabase account and project

1. Sign up at <https://supabase.com> (free plan is fine to start).
2. Click **New project**.
   - **Name:** `kappiness`
   - **Database password:** generate a strong one and store it in a password manager.
   - **Region:** choose the one closest to your patients (e.g. *Mumbai – ap-south-1*).
3. Wait for the project to finish setting up.
4. Note your **Project ref** — it's the part of the URL after `/project/` in the dashboard (e.g. `abcdefghijklmno`).

## 5. Set up the database (migrations + RLS)

The file [`supabase/migrations/20261123000000_init.sql`](supabase/migrations/20261123000000_init.sql) creates every table, the registration-ID generator, **Row Level Security policies**, staff roles, dashboard functions and rate limiting. RLS is configured by the migration — there is nothing to click.

**Option A — Supabase CLI (recommended).** Run these in the project folder:

```bash
npx supabase login                         # opens the browser to authorise the CLI
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push                       # applies everything in supabase/migrations
```

**Option B — Dashboard.** Open **SQL Editor → New query**, paste the whole contents of the migration file, and click **Run**.

**Check it worked:** in **Table Editor** you should see `patient_registrations`, `staff_members`, `consent_versions`, … each showing **RLS enabled**.

## 6. Set up CAPTCHA (Cloudflare Turnstile)

Turnstile is a free, privacy-friendly CAPTCHA. It stops bots from flooding the form.

1. Create a free account at <https://dash.cloudflare.com> → **Turnstile** → **Add widget**.
2. Widget name: `Kappiness`. **Hostnames:** your site's domain (e.g. `kappiness-register.vercel.app`) and `localhost`.
3. Widget mode: **Managed**.
4. Copy the **Site key** (public → goes in `VITE_TURNSTILE_SITE_KEY`) and the **Secret key** (private → goes in the Edge Function secret `TURNSTILE_SECRET_KEY`).

> Without `TURNSTILE_SECRET_KEY` the function skips the CAPTCHA check (handy locally) and logs a warning. **Always set it in production.**

## 7. Deploy the Edge Function and its secrets

1. Copy the example secrets file and fill it in:

   ```bash
   cp supabase/functions/.env.example supabase/functions/.env
   ```

   | Secret | What to put |
   |---|---|
   | `ALLOWED_ORIGINS` | Comma-separated website addresses allowed to submit, e.g. `https://kappiness-register.vercel.app,http://localhost:5173` |
   | `TURNSTILE_SECRET_KEY` | The Turnstile **secret** key from step 6 |
   | `RATE_LIMIT_SALT` | Any long random string (used to hash IP addresses so they are never stored in clear) |

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the function **automatically** by Supabase — don't add them.

2. Upload the secrets and deploy:

   ```bash
   npx supabase secrets set --env-file supabase/functions/.env
   npx supabase functions deploy submit-registration --no-verify-jwt
   ```

   `--no-verify-jwt` is required because patients are not logged in; the function does its own checks (origin, rate limit, CAPTCHA, validation). This matches `supabase/config.toml`.

> ⚠️ `supabase/functions/.env` is git-ignored. Never commit it, and never put the service-role / secret key in any `VITE_` variable.

## 8. Configure environment variables

These are **public** values that the browser needs.

```bash
cp .env.example .env
```

Fill in from **Supabase Dashboard → Project Settings → API Keys** (and Data API for the URL):

```ini
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # or the legacy "anon" key
VITE_TURNSTILE_SITE_KEY=0x4AAAA...                 # Turnstile site key (public)
```

Everything prefixed `VITE_` ends up in the website's JavaScript and is visible to anyone. That is expected for these three values; **the publishable/anon key cannot read patient data because of RLS**.

## 9. Configure authentication (no public sign-up)

In **Supabase Dashboard → Authentication**:

1. **Sign In / Providers → Email:** keep Email enabled. **Turn OFF "Allow new users to sign up".**
2. **URL Configuration:**
   - **Site URL:** your production address, e.g. `https://kappiness-register.vercel.app`
   - **Redirect URLs:** add `https://kappiness-register.vercel.app/admin/reset-password` and `http://localhost:5173/admin/reset-password` (used by "Forgot password").
3. (Recommended) **Policies → Password:** minimum length 12+.
4. (Recommended for production) set up **custom SMTP** under *Emails* so password-reset emails are reliably delivered.

## 10. Create the first administrator

There is deliberately **no public admin sign-up**. To create staff accounts:

1. **Authentication → Users → Add user → Create new user.** Enter the staff member's email and a strong temporary password; tick **Auto Confirm User**.
2. Open [`supabase/setup/create_first_admin.sql`](supabase/setup/create_first_admin.sql), change the email/name, and run it in **SQL Editor**. Use role:
   - `admin` — can view and **export CSV**;
   - `staff` — can view only.
3. Ask them to sign in at `/admin/login` and change their password with **Forgot password?**.

Repeat for other staff. To revoke access, delete their row from `staff_members` (and optionally the Auth user).

## 11. Run the app locally

```bash
npm run dev
```

Open <http://localhost:5173>. To test on your phone over Wi-Fi: `npm run dev -- --host`, then open the "Network" address it prints (add that address to `ALLOWED_ORIGINS` too).

## 12. Test a registration

1. Open the site → **Begin Your Journey**.
2. Check that the **I Agree & Continue** button is disabled until you tick the box.
3. Fill in the form and press **Submit registration**.
4. You should see **"Thank You for Choosing Kappiness."** and a short "What happens next" card. The new record (with an ID such as `KAP-2026-00001`) appears in the staff dashboard.
5. In Supabase **Table Editor → patient_registrations**, the new row is there.
6. Function logs: **Edge Functions → submit-registration → Logs** (they never contain patient details).

## 13. Use the admin dashboard

Go to **`/admin/login`** (it isn't linked from the patient site), e.g. `http://localhost:5173/admin/login`.

- Overview: total, today, this month (India time), most recent.
- Search by name or registration ID, filter by date, page through results.
- Tap any registration to see every section, including consent and signature.
- **Export CSV** (admins only) — exports the current date range; each export is recorded in `admin_audit_log`. Treat exported files as confidential and delete them when no longer needed.
- Sessions end when the tab is closed, and automatically after 30 minutes of inactivity.

## 14. Deploy to Vercel

1. Push this project to a **private** GitHub repository (the `.gitignore` already excludes `.env` files).
2. Sign in at <https://vercel.com> with GitHub → **Add New… → Project** → import the repository.
3. Framework preset: **Vite** (build `npm run build`, output `dist` — also set in `vercel.json`).
4. Under **Environment Variables**, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_TURNSTILE_SITE_KEY`.
5. Click **Deploy**.

`vercel.json` adds HTTPS-only (HSTS), a strict Content-Security-Policy, no-referrer, anti-framing headers, SPA routing and `noindex` for `/admin`.

## 15. Connect the deployed site to Supabase

After the first deploy you'll have an address like `https://kappiness-register.vercel.app`:

1. Add it to the Edge Function's `ALLOWED_ORIGINS`, then re-run
   `npx supabase secrets set --env-file supabase/functions/.env`.
2. In **Authentication → URL Configuration**, set **Site URL** to it and add `<your address>/admin/reset-password` to **Redirect URLs**.
3. Add the hostname to your **Turnstile** widget.
4. Submit a test registration on the live site and check it in the dashboard.
5. Using a custom domain? Repeat steps 1–3 for it.

## 16. Security & privacy notes

**What is in place**

- RLS on every table; the public key cannot read, insert, update or delete registrations (verified by automated tests).
- Inserts only through the Edge Function, with server-side validation of every field, mandatory-consent check, consent-version check, CAPTCHA, honeypot, per-IP rate limiting (IPs hashed), 300 KB size limit and origin allow-list.
- Idempotent submissions: retries and double-taps reuse one `submission_key`, so no duplicate records.
- Registration IDs generated inside PostgreSQL under a row lock, so simultaneous submissions can't collide.
- Exact consent wording stored in `consent_versions`; each registration records its `consent_version`, `terms_accepted_at`, `consent_date` and `created_at`.
- Patient answers are never written to localStorage, sessionStorage, cookies or URLs, and there are no analytics trackers.
- Staff roles live in the database and can't be self-assigned; CSV export is admin-only and audit-logged.
- Function responses and logs never contain patient details.

**Before going live — please check**

- **Legal review:** confirm obligations under India's **Digital Personal Data Protection Act, 2023** (and rules), any applicable health-records guidance, and the clinic's own policies. This software doesn't make the clinic compliant by itself, and neither does Supabase.
- **Privacy notice:** review the text in `src/components/InfoDialogs.tsx` with the clinic, and add the clinic's official contact details for data requests.
- **Data region:** choose a Supabase region consistent with your obligations.
- **Retention:** decide how long registrations are kept and who deletes them.
- **Backups:** enable/verify Supabase backups (Point-in-Time Recovery on paid plans).
- **Staff accounts:** strong unique passwords; remove access promptly when staff leave. Consider enabling MFA.
- **Drawn signatures** are stored as PNG data in the table. Typed signatures are stored as text.

## 17. Project structure

```
src/
  App.tsx, main.tsx            routes (/, /admin/login, /admin, /admin/reset-password)
  pages/patient/               Home, Terms, Registration (one page), Thank you, PatientFlow (journey gate)
  pages/admin/                 Login, Reset password, Dashboard, Registration detail, RequireStaff
  features/registration/       form defaults and the Malayalam labels from the paper form
  components/                  UI kit (Button, fields, Chips, Modal), Brand (logo), SignaturePad, dialogs, Turnstile
  layouts/                     SimpleLayout (patient pages), AuthCardLayout (staff login)
  hooks/useStaffSession.tsx    staff role from the database
  lib/                         api (submit), supabase (staff client), config, format, uuid
  styles/index.css             design tokens (colours, fonts, motion)
supabase/
  migrations/                  schema, RLS, functions
  functions/_shared/           registration.ts — consent text + validation shared by browser AND server
  functions/submit-registration/  the Edge Function
  setup/create_first_admin.sql
  config.toml
public/brand/                  Kappiness logo mark and icon
tests/                         database + validation tests
```

**Design.** White pages with a Kappiness-brown band across the top (logo, progress dashes, page heading). Cards are white with rounded corners; the welcome and thank-you cards have a postage-stamp edge and overlap the band. Honey pill buttons for the main action. Typeface: Lexend. Colours live in `src/styles/index.css`.

**Logo.** `public/brand/` holds the Kappiness mark (brain in a coffee mug) taken from the clinic's site icon. For sharper large or print use, swap in the original logo file from the clinic.

## 18. Automated tests

```bash
npm test              # validation rules + database tests
npm run test:db       # runs the real migration in embedded PostgreSQL (PGlite)
npm run typecheck
```

The database tests check ID generation and uniqueness, constraints, consent-version immutability, RLS for anonymous / signed-in / staff / admin users, CSV-export permission and audit logging, and rate limiting.

## 19. Changing the consent wording

Never edit consent text that patients have already accepted. Instead:

1. Add a new `CONSENT_VERSION` and text in `supabase/functions/_shared/registration.ts`.
2. Add a new migration that `insert`s the new version into `public.consent_versions` (rows there can't be updated or deleted).
3. Deploy the migration, the Edge Function and the website together.

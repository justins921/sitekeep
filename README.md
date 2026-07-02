# SiteKeep

> Website done. Client gone? Not with SiteKeep.

A SaaS app for web designers & agencies to keep clients on a monthly
maintenance retainer — each client gets a branded dashboard (page speed,
traffic, security) plus automated monthly email reports, turning one-off
projects into recurring revenue.

## Stack

- **Next.js** (App Router, TypeScript, `src/`, Tailwind CSS v4)
- **Supabase** — Postgres + Auth (email/password) + Row Level Security
- **Stripe** — per-dashboard subscription billing ($3/dashboard/mo)
- **Resend** — transactional + scheduled report email
- **Vercel** — hosting, cron

Auth uses `@supabase/ssr` (cookie-based, middleware session refresh). The
service-role client (`src/lib/supabase/admin.ts`) is used only in trusted
server code (Stripe webhook, cron).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase (and later Stripe/Resend) values
npm run dev
```

Apply the database schema (`supabase/migrations/0001_init.sql`) to your
Supabase project. It creates the tables, RLS policies, the new-user trigger
(auto-creates each user's agency + subscription row) and the
`get_public_dashboard` RPC that powers the anonymous white-label dashboard.

## Design system

Tokens in `src/app/globals.css` are sampled directly from the live marketing
site (sitekeep-landing.webflow.io): brand blue `#0068ff`, navy ink `#0e213d`,
orange/magenta/green spark accents, Satoshi typeface. Shared primitives live in
`src/components/ui` (`Button`, `Card`, `Badge`, `StatCard`, `Avatar`,
`StarRating`, `Spark`) and are reused across the marketing page, the authed
dashboard, and the public client dashboard.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Marketing landing page |
| `/login`, `/signup` | Email/password auth (server actions) |
| `/dashboard` | Agency home — client list |
| `/dashboard/clients/new` | Add client |
| `/dashboard/clients/[id]` | Client detail — services, metrics, reports |
| `/dashboard/settings` | Agency branding |
| `/dashboard/billing` | Stripe subscription |
| `/d/[slug]` | Public white-label client dashboard |

## Build phases

1. **Foundation** — scaffold, auth, RLS, dashboard shell ✅
2. Core loop — clients CRUD + service toggles
3. Integrations — PageSpeed, security headers, GA4 (stubbed)
4. White-label public dashboard
5. Stripe billing
6. Email report automation (cron + Resend)
7. Deploy

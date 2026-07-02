@AGENTS.md

# SiteKeep — project guide

SaaS for web designers/agencies: keep clients on a monthly maintenance retainer via a
branded per-client dashboard (page speed, traffic, security) + automated monthly email
reports. Core loop: agency signs up → adds a client → toggles services → shareable
white-label dashboard → monthly report → billed $3/dashboard/month.

**Every phase must follow this file so styling and patterns don't drift.**

## Design system — sampled from the live site (do not invent new values)

Tokens were pulled from the real marketing CSS (sitekeep-landing.webflow.io) and live in
`src/app/globals.css` under `@theme` (Tailwind v4, CSS-first — there is no
`tailwind.config.js`). Use these tokens/utilities, not ad-hoc hex or arbitrary values.

- **Brand blue** `#0068ff` (`brand`/`brand-500`), hover `#2759b0` (`brand-hover`/`brand-600`).
  Scale: `brand-50 #f2f7ff` · `100 #e0edff` · `200 #b2d9ff` · `300 #63a1ff` · `400 #2c80ff`
  · `500 #0068ff` · `600 #2759b0` · `700 #1e4589`. (NB: the brief's `#4F46E5` indigo was a
  baseline — the live site is blue, so we use blue.)
- **Spark accents**: orange `#e87c2e` (`accent-orange`), magenta `#cb52cc` (`accent-magenta`),
  green `#6cad45` (`accent-green`).
- **Ink / text**: headings navy `#0e213d` (`ink`), body `#404040` (`body`), muted `#757575`
  (`muted`), faint `#b8b8b8` (`faint`).
- **Surfaces**: `surface #fff`, `canvas #fafafa`, `canvas-alt #f7f7f7`, hairline `line #e5e5e5`.
- **Pastel feature fills**: `fill-blue #f2f7ff`, `fill-pink #fdf0f6`, `fill-green #eefbf3`,
  `fill-violet #f1eefe`.
- **Typeface**: **Satoshi** (loaded from Fontshare in `globals.css`), Inter fallback via
  `next/font`. Headings are `font-bold tracking-tight` navy; hero ~`text-5xl/6xl`.
- **Radii**: cards `rounded-[var(--radius-card)]` (18px) / `--radius-card-lg` (22px); buttons
  `rounded-xl`; pills `rounded-full`. **Shadows**: `shadow-soft`, `shadow-soft-md` on hover.
- **Gradient wash**: `.bg-wash` (blue+magenta radial over `#fafafa`) behind hero/auth/canvas.

### Build from the shared UI primitives — don't hand-roll

`src/components/ui`: `Button`/`ButtonLink` (primary/secondary/ghost), `Card` (tint:
white/blue/pink/green/violet, `hover`), `Badge` (brand/green/orange/magenta/neutral),
`StatCard` (metric/label/trend), `Avatar` (initials fallback), `StarRating`, `Spark`.
The authed dashboard AND the public `/d/[slug]` dashboard are assembled from these so
branding stays consistent. Add a variant to a primitive rather than one-off styling.

## Engineering conventions

- **Server Components + server actions by default**; add `"use client"` only where
  interactivity requires it. Forms post to server actions; use `useActionState` for
  pending/error state (see `src/app/(auth)`).
- **All DB access respects RLS.** Use the request-scoped client from
  `@/lib/supabase/server` (cookies) in Server Components/actions and
  `@/lib/supabase/client` in Client Components. The **service-role** client
  (`@/lib/supabase/admin`) BYPASSES RLS and is allowed **only** in the Stripe webhook and
  cron — never in a user-facing path.
- **Auth** is `@supabase/ssr`, cookie-based. `src/proxy.ts` (Next 16 renamed Middleware →
  Proxy) refreshes the session and guards `/dashboard/*`.
- **Type everything.** Keep secrets server-side (never `NEXT_PUBLIC_` a secret).
  **Validate/normalize the client URL on input** — `normalizeUrl` in `@/lib/utils`
  (require a scheme, lowercase host, strip trailing slash). Slugs via `slugify` + a random
  suffix on collision.
- **Next.js here has breaking changes** (per AGENTS.md) — read the relevant guide in
  `node_modules/next/dist/docs/` before using an unfamiliar API; heed deprecation notices.
- **Small, reviewable commits per phase.** Run `npm run lint` and `npm run build` before
  committing. Never commit `.env.local`.

## Data model (Supabase)

`agencies` (1:1 auth user, auto-created by a trigger on signup) → `clients` →
`client_services` / `metric_snapshots` / `reports`; `subscriptions` (1:1 agency, written
only by the Stripe webhook via service role). Public dashboard is read anonymously through
one security-definer RPC `get_public_dashboard(slug)` — no broad anon table grants.
Migration: `supabase/migrations/`. The "client task/request board" is future scope — leave
model room, don't build it in the MVP.

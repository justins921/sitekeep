@AGENTS.md

# SiteKeep — project guide

Website-monitoring SaaS for freelancers/agencies who resell "we keep your site healthy" to
their own clients. The headline is one **Keep Score** (0–100) per site — uptime, form
delivery, performance, SSL/domain, broken links — visualized as a green-week grid + streak.
Core loop: scan-first onboarding (aha before signup) → Keep Score dashboard → client-ready
weekly recap email → Solo/Agency plans (14-day card-required trial). The earlier
per-client service dashboards + white-label public page still exist as secondary detail.

**Every phase must follow this file so styling and patterns don't drift.**

## Design system — "green means healthy" (dark, disciplined)

Tokens live in `src/app/globals.css` under `@theme` (Tailwind v4, CSS-first — there is no
`tailwind.config.js`) with a JS mirror in `src/lib/design-tokens.ts` (for Recharts / the
green-week grid / email). Use tokens/utilities, never ad-hoc hex. Dark, cool-tinted slate.

- **keep-green** `#35c46a` (`keep`/`accent-green`) — the ONE signature color: healthy scores,
  the green-week grid, streaks, success. Deep `#1f8a4c` (`keep-700`). Green must stay
  meaningful — never decorative.
- **amber** `#f5a524` (`accent-orange`) — degraded checks, warnings.
- **red** `#e5484d` (`accent-red`) — **active incidents only**. If red shows, something is
  genuinely wrong. Never decorative. (`accent-magenta` is a legacy alias → red.)
- **accent (blue, non-green)** `#4c8dff` (`brand`/`brand-500`), hover `#6ba1ff`
  (`brand-hover`) — the interactive color: buttons, links, focus ring, selection.
- **Ink / text (light on dark)**: headings `#e6edf3` (`ink`), body `#c4cdd6` (`body`),
  muted `#8b98a5` (`muted`), faint `#6b7885` (`faint`).
- **Surfaces**: `surface #141b22` (cards), `canvas #0b0f14` (page), `canvas-alt #1c2630`
  (inputs/insets/hover), hairline `line #2a3742`.
- **Typography**: headings/display = **Clash Display** (`font-display`, Fontshare, used with
  restraint); body = **Inter** (`font-sans`, `next/font`); numbers = **JetBrains Mono**
  (`font-mono` or the `.num` utility — tabular; use for scores, uptime %, timestamps so
  metrics align and feel instrument-like).
- **Icons**: **Lucide** (`lucide-react`) only. **No emojis anywhere in the UI.**
- **Charts**: Recharts. Micro-sparklines in site cards; **no pie charts**. One KPI appears in
  exactly one place per page — never repeat the same stat block twice on a screen.
- **Signature element**: the **green-week grid** (GitHub-contribution style, one square per
  week per site). This is the one bold visual — keep everything else quiet.
- **Radii**: `rounded-[var(--radius-card)]` (16px) / `--radius-card-lg` (20px); buttons
  `rounded-xl`; pills `rounded-full`. **Shadows**: `shadow-soft`, `shadow-soft-md`.
- **Focus**: every interactive element shows a keyboard focus ring — primitives have it; for
  hand-rolled controls add the `focus-ring` utility. **Gradient wash**: `.bg-wash` (green+blue
  radial over canvas) behind hero/auth.
- **Copy voice**: plain verbs, sentence case, active voice. Buttons say what happens ("Start
  monitoring", not "Submit"). Errors say what broke + what to do. Empty states invite the next
  action. **No exclamation marks** in system copy.

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

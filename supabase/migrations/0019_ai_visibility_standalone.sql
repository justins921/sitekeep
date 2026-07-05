-- Standalone AI-visibility (variant 'standalone') storage:
--   • ai_visibility_prompts  — tracked prompts per client (cap enforced in app)
--   • ai_visibility_snapshots — stored normalized results + per-run cost log
-- Snapshots are WRITTEN only by the monthly cron (service role, bypasses RLS);
-- members read their client's prompts + snapshots via owns_client().

create table if not exists public.ai_visibility_prompts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  text text not null,
  source text not null default 'manual' check (source in ('manual','gsc','suggested')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ai_visibility_prompts_client_idx
  on public.ai_visibility_prompts(client_id);

alter table public.ai_visibility_prompts enable row level security;

drop policy if exists ai_visibility_prompts_all on public.ai_visibility_prompts;
create policy ai_visibility_prompts_all on public.ai_visibility_prompts
  for all using (public.owns_client(client_id)) with check (public.owns_client(client_id));

drop policy if exists ai_visibility_prompts_super on public.ai_visibility_prompts;
create policy ai_visibility_prompts_super on public.ai_visibility_prompts
  for select using (public.is_super_admin());

create table if not exists public.ai_visibility_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  provider text not null,                 -- 'perplexity' | 'demo'
  model text,                             -- e.g. 'sonar'
  data jsonb not null,                    -- normalized AiVisibility payload
  prompt_count int not null default 0,
  cost_usd numeric(10,4) not null default 0,
  trigger text not null default 'cron',   -- 'cron' | 'backfill'
  captured_at timestamptz not null default now()
);
create index if not exists ai_visibility_snapshots_client_idx
  on public.ai_visibility_snapshots(client_id, captured_at desc);

alter table public.ai_visibility_snapshots enable row level security;

-- Members read their client's snapshots; INSERT is service-role-only (cron), so
-- there is intentionally NO member write policy.
drop policy if exists ai_visibility_snapshots_select on public.ai_visibility_snapshots;
create policy ai_visibility_snapshots_select on public.ai_visibility_snapshots
  for select using (public.owns_client(client_id));

drop policy if exists ai_visibility_snapshots_super on public.ai_visibility_snapshots;
create policy ai_visibility_snapshots_super on public.ai_visibility_snapshots
  for select using (public.is_super_admin());

create table public.github_cache (
  cache_key text primary key,
  content text not null,
  fetched_at timestamptz not null default now()
);
alter table public.github_cache enable row level security;
create policy "public read github_cache" on public.github_cache for select using (true);
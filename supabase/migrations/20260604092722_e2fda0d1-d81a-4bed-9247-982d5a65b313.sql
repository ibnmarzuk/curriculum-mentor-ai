
create extension if not exists vector;

create table if not exists public.subject_chunks (
  id uuid primary key default gen_random_uuid(),
  subject_path text not null,
  chunk_idx integer not null,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  unique (subject_path, chunk_idx)
);

grant select on public.subject_chunks to anon, authenticated;
grant all on public.subject_chunks to service_role;

alter table public.subject_chunks enable row level security;

create policy "public read subject_chunks"
  on public.subject_chunks for select
  using (true);

create index if not exists subject_chunks_embedding_idx
  on public.subject_chunks using hnsw (embedding vector_cosine_ops);

create index if not exists subject_chunks_subject_path_idx
  on public.subject_chunks (subject_path);

create or replace function public.match_subject_chunks(
  query_embedding vector(1536),
  match_count integer default 8,
  filter_language text default null
)
returns table (
  subject_path text,
  chunk_idx integer,
  content text,
  similarity real
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.subject_path,
    c.chunk_idx,
    c.content,
    (1 - (c.embedding <=> query_embedding))::real as similarity
  from public.subject_chunks c
  left join public.subject_meta m on m.subject_path = c.subject_path
  where filter_language is null or m.language = filter_language
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_subject_chunks(vector, integer, text) to anon, authenticated, service_role;

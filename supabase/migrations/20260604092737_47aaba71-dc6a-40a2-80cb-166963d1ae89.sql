
revoke execute on function public.match_subject_chunks(vector, integer, text) from anon, authenticated, public;

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
security invoker
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

grant execute on function public.match_subject_chunks(vector, integer, text) to service_role;

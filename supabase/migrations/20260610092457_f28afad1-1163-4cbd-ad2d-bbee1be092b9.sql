
ALTER TABLE public.mentor_messages ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.mentor_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_path text NOT NULL,
  summary text NOT NULL,
  covers_until timestamptz NOT NULL,
  message_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_summaries TO authenticated;
GRANT ALL ON public.mentor_summaries TO service_role;

ALTER TABLE public.mentor_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own summaries select" ON public.mentor_summaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own summaries insert" ON public.mentor_summaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own summaries delete" ON public.mentor_summaries FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mentor_summaries_user_subject
  ON public.mentor_summaries (user_id, subject_path, created_at DESC);

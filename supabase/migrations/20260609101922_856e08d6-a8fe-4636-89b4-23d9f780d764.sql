
CREATE TABLE public.mentor_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_path text NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mentor_messages_user_subject ON public.mentor_messages(user_id, subject_path, created_at);
GRANT SELECT, INSERT, DELETE ON public.mentor_messages TO authenticated;
GRANT ALL ON public.mentor_messages TO service_role;
ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mentor msgs select" ON public.mentor_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own mentor msgs insert" ON public.mentor_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own mentor msgs delete" ON public.mentor_messages FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS solution text,
  ADD COLUMN IF NOT EXISTS getting_started text;

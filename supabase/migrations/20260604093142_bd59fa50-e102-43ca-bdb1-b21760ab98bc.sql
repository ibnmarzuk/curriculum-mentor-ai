
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_path text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'code',
  title text NOT NULL,
  prompt text NOT NULL,
  language text NOT NULL DEFAULT 'javascript',
  starter_code text NOT NULL DEFAULT '',
  rubric jsonb NOT NULL DEFAULT '[]'::jsonb,
  teaches_skills text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assessments TO anon, authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read assessments" ON public.assessments FOR SELECT USING (true);

CREATE TABLE public.assessment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  subject_path text NOT NULL,
  score real NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  feedback text,
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  code text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.assessment_results TO authenticated;
GRANT ALL ON public.assessment_results TO service_role;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own results select" ON public.assessment_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own results insert" ON public.assessment_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own results delete" ON public.assessment_results FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX assessment_results_user_idx ON public.assessment_results(user_id, created_at DESC);
CREATE INDEX assessment_results_subject_idx ON public.assessment_results(subject_path);

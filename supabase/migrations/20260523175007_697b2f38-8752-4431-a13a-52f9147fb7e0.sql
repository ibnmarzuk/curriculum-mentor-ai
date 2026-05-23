CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.subject_meta (
  subject_path TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  language TEXT,
  framework TEXT,
  difficulty TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  estimated_minutes INT,
  ai_classified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subject_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read subject_meta" ON public.subject_meta FOR SELECT USING (true);

CREATE INDEX idx_subject_meta_lang ON public.subject_meta (language);
CREATE INDEX idx_subject_meta_difficulty ON public.subject_meta (difficulty);
CREATE INDEX idx_subject_meta_title_trgm ON public.subject_meta USING GIN (title gin_trgm_ops);
CREATE INDEX idx_subject_meta_path_trgm ON public.subject_meta USING GIN (subject_path gin_trgm_ops);

CREATE TRIGGER trg_subject_meta_updated BEFORE UPDATE ON public.subject_meta
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
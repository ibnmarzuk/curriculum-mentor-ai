
DROP POLICY IF EXISTS "public read assessments" ON public.assessments;

REVOKE ALL ON public.assessments FROM anon;
REVOKE ALL ON public.assessments FROM authenticated;
GRANT ALL ON public.assessments TO service_role;

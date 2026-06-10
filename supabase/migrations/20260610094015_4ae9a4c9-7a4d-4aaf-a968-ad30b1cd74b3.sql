-- Re-affirm assessments access model: closed to anon/authenticated, full access for service_role
REVOKE ALL ON public.assessments FROM anon;
REVOKE ALL ON public.assessments FROM authenticated;
REVOKE ALL ON public.assessments FROM PUBLIC;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
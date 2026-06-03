
-- ============================================================
-- Curriculum Intelligence: schema
-- ============================================================

CREATE TABLE public.skills (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  track TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('beginner','intermediate','advanced')),
  description TEXT,
  prerequisites TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.skills TO anon, authenticated;
GRANT ALL ON public.skills TO service_role;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read skills" ON public.skills FOR SELECT USING (true);

CREATE TABLE public.tracks (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  level TEXT NOT NULL CHECK (level IN ('beginner','intermediate','advanced','mixed')),
  skill_slugs TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tracks TO anon, authenticated;
GRANT ALL ON public.tracks TO service_role;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read tracks" ON public.tracks FOR SELECT USING (true);

CREATE TABLE public.subject_skills (
  subject_path TEXT NOT NULL,
  skill_slug TEXT NOT NULL REFERENCES public.skills(slug) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('requires','teaches')),
  weight REAL NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_path, skill_slug, role)
);
CREATE INDEX idx_subject_skills_skill ON public.subject_skills(skill_slug);
CREATE INDEX idx_subject_skills_subject ON public.subject_skills(subject_path);
GRANT SELECT ON public.subject_skills TO anon, authenticated;
GRANT ALL ON public.subject_skills TO service_role;
ALTER TABLE public.subject_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read subject_skills" ON public.subject_skills FOR SELECT USING (true);

CREATE TABLE public.user_skill_mastery (
  user_id UUID NOT NULL,
  skill_slug TEXT NOT NULL REFERENCES public.skills(slug) ON DELETE CASCADE,
  mastery REAL NOT NULL DEFAULT 0 CHECK (mastery >= 0 AND mastery <= 1),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_skill_mastery TO authenticated;
GRANT ALL ON public.user_skill_mastery TO service_role;
ALTER TABLE public.user_skill_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mastery select" ON public.user_skill_mastery FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own mastery insert" ON public.user_skill_mastery FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own mastery update" ON public.user_skill_mastery FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own mastery delete" ON public.user_skill_mastery FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.user_track_enrollment (
  user_id UUID NOT NULL,
  track_slug TEXT NOT NULL REFERENCES public.tracks(slug) ON DELETE CASCADE,
  current_skill_slug TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_track_enrollment TO authenticated;
GRANT ALL ON public.user_track_enrollment TO service_role;
ALTER TABLE public.user_track_enrollment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own enrollment all" ON public.user_track_enrollment FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.readiness_cache (
  user_id UUID NOT NULL,
  subject_path TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  missing TEXT[] NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subject_path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.readiness_cache TO authenticated;
GRANT ALL ON public.readiness_cache TO service_role;
ALTER TABLE public.readiness_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own readiness all" ON public.readiness_cache FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Seed: canonical skills taxonomy
-- ============================================================
INSERT INTO public.skills (slug, name, track, level, description, prerequisites) VALUES
-- Foundations
('cli-basics','Command Line Basics','foundations','beginner','Navigate filesystem, run commands, pipes.', '{}'),
('git-basics','Git Basics','foundations','beginner','Clone, commit, branch, merge, push.', '{"cli-basics"}'),
('git-advanced','Git Advanced','foundations','intermediate','Rebase, cherry-pick, conflict resolution.', '{"git-basics"}'),
('algorithms-basics','Algorithms Fundamentals','foundations','beginner','Big-O, sorting, searching.', '{}'),
('data-structures','Data Structures','foundations','intermediate','Arrays, lists, maps, trees, graphs.', '{"algorithms-basics"}'),

-- Frontend
('html','HTML','frontend','beginner','Semantic markup, forms, accessibility basics.', '{}'),
('css','CSS','frontend','beginner','Selectors, box model, flexbox, grid.', '{"html"}'),
('css-advanced','Advanced CSS','frontend','intermediate','Animations, responsive design, design systems.', '{"css"}'),
('javascript-basics','JavaScript Basics','frontend','beginner','Variables, control flow, functions, arrays.', '{}'),
('javascript-advanced','Advanced JavaScript','frontend','intermediate','Closures, async/await, modules, prototypes.', '{"javascript-basics"}'),
('dom','DOM Manipulation','frontend','beginner','Events, query selectors, dynamic UI.', '{"javascript-basics","html"}'),
('typescript','TypeScript','frontend','intermediate','Static typing, generics, utility types.', '{"javascript-advanced"}'),
('react-basics','React Basics','frontend','intermediate','Components, props, state, JSX.', '{"javascript-advanced"}'),
('react-hooks','React Hooks','frontend','intermediate','useState, useEffect, custom hooks.', '{"react-basics"}'),
('react-advanced','Advanced React','frontend','advanced','Context, performance, suspense, server components.', '{"react-hooks"}'),
('state-management','State Management','frontend','intermediate','Redux, Zustand, TanStack Query patterns.', '{"react-hooks"}'),
('frontend-testing','Frontend Testing','frontend','intermediate','Unit, integration, e2e with Vitest/Playwright.', '{"javascript-advanced"}'),
('accessibility','Web Accessibility','frontend','intermediate','ARIA, keyboard nav, semantic HTML, WCAG.', '{"html","css"}'),

-- Backend
('http-basics','HTTP Fundamentals','backend','beginner','Methods, status codes, headers, REST.', '{}'),
('rest-apis','REST API Design','backend','intermediate','Resources, versioning, pagination, errors.', '{"http-basics"}'),
('node-basics','Node.js Basics','backend','intermediate','Modules, npm, async I/O, fs.', '{"javascript-advanced"}'),
('express','Express / HTTP Servers','backend','intermediate','Routing, middleware, error handling.', '{"node-basics","http-basics"}'),
('go-basics','Go Basics','backend','beginner','Syntax, types, control flow, packages.', '{}'),
('go-concurrency','Go Concurrency','backend','intermediate','Goroutines, channels, sync.', '{"go-basics"}'),
('rust-basics','Rust Basics','backend','intermediate','Ownership, borrowing, traits, cargo.', '{"algorithms-basics"}'),
('python-basics','Python Basics','backend','beginner','Syntax, lists/dicts, functions, modules.', '{}'),
('database-fundamentals','Database Fundamentals','backend','beginner','Tables, relations, normalization.', '{}'),
('sql','SQL','backend','intermediate','Joins, indexes, aggregations, transactions.', '{"database-fundamentals"}'),
('postgres','PostgreSQL','backend','intermediate','Schemas, RLS, JSONB, performance.', '{"sql"}'),
('orm','ORMs & Query Builders','backend','intermediate','Prisma, Drizzle, SQLAlchemy patterns.', '{"sql"}'),
('graphql','GraphQL','backend','advanced','Schemas, resolvers, federation.', '{"rest-apis"}'),
('caching','Caching Strategies','backend','advanced','CDN, Redis, HTTP caching headers.', '{"http-basics"}'),
('backend-testing','Backend Testing','backend','intermediate','Unit, integration, contract testing.', '{"rest-apis"}'),

-- Full-stack / cross-cutting
('authentication','Authentication','fullstack','intermediate','Sessions, OAuth, password hashing.', '{"http-basics"}'),
('jwt','JWT & Tokens','fullstack','intermediate','Signing, verification, refresh flows.', '{"authentication"}'),
('authorization','Authorization & RBAC','fullstack','intermediate','Roles, claims, RLS, ABAC.', '{"authentication"}'),
('api-integration','3rd-party API Integration','fullstack','intermediate','SDKs, webhooks, retries, idempotency.', '{"rest-apis"}'),
('realtime','Realtime & WebSockets','fullstack','advanced','WS, SSE, pub/sub patterns.', '{"http-basics"}'),
('file-uploads','File Uploads & Storage','fullstack','intermediate','Multipart, signed URLs, image pipelines.', '{"http-basics"}'),
('seo','SEO Fundamentals','fullstack','intermediate','Meta tags, sitemaps, structured data, SSR.', '{"html"}'),
('web-security','Web Security','fullstack','advanced','XSS, CSRF, OWASP top-10, secure headers.', '{"http-basics"}'),

-- AI
('python-ai','Python for AI','ai','intermediate','Numpy, pandas, jupyter workflow.', '{"python-basics"}'),
('ml-fundamentals','Machine Learning Fundamentals','ai','intermediate','Supervised vs unsupervised, train/test, metrics.', '{"python-ai","algorithms-basics"}'),
('deep-learning','Deep Learning','ai','advanced','Neural nets, backprop, frameworks.', '{"ml-fundamentals"}'),
('prompt-engineering','Prompt Engineering','ai','beginner','System prompts, few-shot, structured output.', '{}'),
('llm-apis','LLM APIs & Tools','ai','intermediate','Chat completions, tool calling, streaming.', '{"prompt-engineering","rest-apis"}'),
('rag','Retrieval-Augmented Generation','ai','advanced','Chunking, embeddings, vector search.', '{"llm-apis"}'),
('ai-agents','AI Agents','ai','advanced','Tool use, planning loops, evaluation.', '{"llm-apis"}'),

-- DevOps
('linux','Linux Administration','devops','intermediate','Processes, permissions, systemd, networking.', '{"cli-basics"}'),
('bash-scripting','Bash Scripting','devops','intermediate','Variables, loops, automation scripts.', '{"cli-basics"}'),
('docker','Docker & Containers','devops','intermediate','Images, volumes, compose.', '{"linux"}'),
('kubernetes','Kubernetes','devops','advanced','Pods, services, deployments, helm.', '{"docker"}'),
('ci-cd','CI/CD Pipelines','devops','intermediate','GitHub Actions, build/test/deploy.', '{"git-basics"}'),
('cloud-fundamentals','Cloud Fundamentals','devops','intermediate','Compute, storage, networking, IAM.', '{}'),
('monitoring','Monitoring & Observability','devops','advanced','Metrics, logs, traces, alerting.', '{"linux"}'),
('iac','Infrastructure as Code','devops','advanced','Terraform, Pulumi patterns.', '{"cloud-fundamentals"}'),

-- Mobile
('mobile-fundamentals','Mobile App Fundamentals','mobile','beginner','App lifecycle, navigation, platform basics.', '{}'),
('react-native','React Native','mobile','intermediate','Components, navigation, native modules.', '{"react-basics","mobile-fundamentals"}'),
('swift-basics','Swift Basics','mobile','intermediate','Syntax, optionals, structs, protocols.', '{"mobile-fundamentals"}'),
('kotlin-basics','Kotlin Basics','mobile','intermediate','Syntax, coroutines, null safety.', '{"mobile-fundamentals"}'),
('mobile-state','Mobile State & Storage','mobile','intermediate','Local DB, secure storage, offline.', '{"mobile-fundamentals"}'),

-- Web3
('blockchain-fundamentals','Blockchain Fundamentals','web3','beginner','Blocks, consensus, wallets, gas.', '{}'),
('solidity','Solidity','web3','intermediate','Contracts, storage, events, modifiers.', '{"blockchain-fundamentals","algorithms-basics"}'),
('evm','EVM & Smart Contracts','web3','advanced','Bytecode, opcodes, security pitfalls.', '{"solidity"}'),
('web3-frontend','Web3 Frontend Integration','web3','intermediate','wagmi, ethers, wallet connect.', '{"react-basics","blockchain-fundamentals"}'),
('defi','DeFi Primitives','web3','advanced','AMMs, lending, oracles.', '{"solidity"}');

-- ============================================================
-- Seed: tracks (ordered skill lists)
-- ============================================================
INSERT INTO public.tracks (slug, name, description, level, skill_slugs, sort_order) VALUES
('frontend','Frontend Development','Build modern, accessible UIs with HTML, CSS, JS, and React.','mixed',
 ARRAY['html','css','javascript-basics','dom','css-advanced','javascript-advanced','typescript','react-basics','react-hooks','state-management','accessibility','frontend-testing','react-advanced'], 1),
('backend','Backend Development','APIs, databases, and server-side architecture.','mixed',
 ARRAY['cli-basics','git-basics','http-basics','algorithms-basics','data-structures','node-basics','express','database-fundamentals','sql','postgres','rest-apis','orm','backend-testing','caching','graphql'], 2),
('fullstack','Full Stack Development','End-to-end web apps from UI to database.','mixed',
 ARRAY['html','css','javascript-basics','javascript-advanced','react-basics','react-hooks','node-basics','express','http-basics','rest-apis','database-fundamentals','sql','postgres','authentication','jwt','authorization','api-integration','seo','web-security'], 3),
('ai','AI Engineering','From Python ML fundamentals to LLM apps and agents.','mixed',
 ARRAY['python-basics','python-ai','algorithms-basics','prompt-engineering','llm-apis','ml-fundamentals','rag','ai-agents','deep-learning'], 4),
('devops','DevOps Engineering','Ship, run, and observe systems in production.','mixed',
 ARRAY['cli-basics','git-basics','linux','bash-scripting','docker','ci-cd','cloud-fundamentals','monitoring','kubernetes','iac'], 5),
('mobile','Mobile Development','Native and cross-platform mobile apps.','mixed',
 ARRAY['javascript-basics','javascript-advanced','react-basics','mobile-fundamentals','react-native','mobile-state','swift-basics','kotlin-basics'], 6),
('web3','Web3 Development','Smart contracts and decentralised apps.','mixed',
 ARRAY['javascript-basics','blockchain-fundamentals','solidity','web3-frontend','evm','defi'], 7);

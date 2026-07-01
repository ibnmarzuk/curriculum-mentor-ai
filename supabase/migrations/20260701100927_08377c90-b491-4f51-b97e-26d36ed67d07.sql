
-- ============= assessment_attempts =============
CREATE TABLE public.assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  score NUMERIC,
  passed BOOLEAN,
  status TEXT NOT NULL DEFAULT 'submitted',
  feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attempts_user_assessment ON public.assessment_attempts(user_id, assessment_id, attempt_number DESC);
GRANT SELECT, INSERT, UPDATE ON public.assessment_attempts TO authenticated;
GRANT ALL ON public.assessment_attempts TO service_role;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts read" ON public.assessment_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own attempts insert" ON public.assessment_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own attempts update" ON public.assessment_attempts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============= submission_artifacts =============
CREATE TABLE public.submission_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL DEFAULT 'solution',
  file_content TEXT NOT NULL,
  diff_content TEXT,
  language TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_artifacts_attempt ON public.submission_artifacts(attempt_id);
GRANT SELECT, INSERT ON public.submission_artifacts TO authenticated;
GRANT ALL ON public.submission_artifacts TO service_role;
ALTER TABLE public.submission_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own artifacts read" ON public.submission_artifacts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own artifacts insert" ON public.submission_artifacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============= assessment_feedback =============
CREATE TABLE public.assessment_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criterion_id TEXT NOT NULL,
  criterion_description TEXT,
  passed BOOLEAN,
  score NUMERIC,
  feedback TEXT,
  improvement_recommendation TEXT,
  related_skills TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_attempt ON public.assessment_feedback(attempt_id);
GRANT SELECT, INSERT ON public.assessment_feedback TO authenticated;
GRANT ALL ON public.assessment_feedback TO service_role;
ALTER TABLE public.assessment_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feedback read" ON public.assessment_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own feedback insert" ON public.assessment_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============= checkpoints =============
CREATE TABLE public.checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 8),
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  language TEXT NOT NULL DEFAULT 'javascript',
  description TEXT NOT NULL,
  function_signature TEXT,
  examples TEXT,
  hints JSONB NOT NULL DEFAULT '[]'::jsonb,
  starter_code TEXT NOT NULL DEFAULT '',
  visible_tests JSONB NOT NULL DEFAULT '[]'::jsonb,
  hidden_tests JSONB NOT NULL DEFAULT '[]'::jsonb,
  solution TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkpoints_level ON public.checkpoints(level, sort_order);
GRANT SELECT ON public.checkpoints TO authenticated;
GRANT ALL ON public.checkpoints TO service_role;
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkpoints readable" ON public.checkpoints FOR SELECT TO authenticated USING (true);

-- ============= checkpoint_submissions =============
CREATE TABLE public.checkpoint_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES public.checkpoints(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  source_code TEXT NOT NULL,
  language TEXT NOT NULL,
  passed_visible INTEGER NOT NULL DEFAULT 0,
  passed_hidden INTEGER NOT NULL DEFAULT 0,
  total_visible INTEGER NOT NULL DEFAULT 0,
  total_hidden INTEGER NOT NULL DEFAULT 0,
  score NUMERIC NOT NULL DEFAULT 0,
  grade TEXT,
  passed BOOLEAN NOT NULL DEFAULT false,
  feedback TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkpoint_subs_user ON public.checkpoint_submissions(user_id, checkpoint_id, created_at DESC);
GRANT SELECT, INSERT ON public.checkpoint_submissions TO authenticated;
GRANT ALL ON public.checkpoint_submissions TO service_role;
ALTER TABLE public.checkpoint_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subs read" ON public.checkpoint_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own subs insert" ON public.checkpoint_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============= seed checkpoints =============
INSERT INTO public.checkpoints (slug, level, title, difficulty, language, description, function_signature, examples, hints, starter_code, visible_tests, hidden_tests, solution, sort_order) VALUES
('retain-first-half', 1, 'RetainFirstHalf', 'easy', 'javascript',
  'Return the first half of a string. If the length is odd, drop the middle character.',
  'function retainFirstHalf(s) { }',
  'retainFirstHalf("abcdef") -> "abc"\nretainFirstHalf("abcde") -> "ab"',
  '["Think about string.length / 2", "Use Math.floor", "slice(0, n) returns the first n chars"]'::jsonb,
  'function retainFirstHalf(s) {\n  // your code\n}\n',
  '[{"call":"retainFirstHalf(\"abcdef\")","expected":"abc"},{"call":"retainFirstHalf(\"hello\")","expected":"he"}]'::jsonb,
  '[{"call":"retainFirstHalf(\"\")","expected":""},{"call":"retainFirstHalf(\"ab\")","expected":"a"}]'::jsonb,
  'function retainFirstHalf(s){return s.slice(0,Math.floor(s.length/2));}',
  1),
('greet', 1, 'Greet', 'easy', 'javascript', 'Return "Hello, NAME!" for a given name.', 'function greet(name) { }', 'greet("Ada") -> "Hello, Ada!"',
  '["Use template literals", "Concatenate with +"]'::jsonb,
  'function greet(name){\n}\n',
  '[{"call":"greet(\"Ada\")","expected":"Hello, Ada!"}]'::jsonb,
  '[{"call":"greet(\"\")","expected":"Hello, !"}]'::jsonb,
  'function greet(n){return `Hello, ${n}!`;}', 2),
('sum-two', 1, 'SumTwo', 'easy', 'javascript', 'Return the sum of two numbers.', 'function sumTwo(a,b){}', 'sumTwo(2,3) -> 5',
  '["+ works on numbers"]'::jsonb, 'function sumTwo(a,b){}\n',
  '[{"call":"sumTwo(2,3)","expected":5}]'::jsonb,
  '[{"call":"sumTwo(-1,1)","expected":0}]'::jsonb,
  'function sumTwo(a,b){return a+b;}', 3),

('camel-to-snake', 2, 'CamelToSnakeCase', 'easy', 'javascript',
  'Convert a camelCase string to snake_case.', 'function camelToSnake(s){}',
  'camelToSnake("helloWorld") -> "hello_world"',
  '["Regex /[A-Z]/g", "String.replace with a function", "toLowerCase"]'::jsonb,
  'function camelToSnake(s){}\n',
  '[{"call":"camelToSnake(\"helloWorld\")","expected":"hello_world"}]'::jsonb,
  '[{"call":"camelToSnake(\"aBcDeF\")","expected":"a_bc_de_f"}]'::jsonb,
  'function camelToSnake(s){return s.replace(/[A-Z]/g,c=>"_"+c.toLowerCase());}', 1),
('reverse-string', 2, 'ReverseString', 'easy', 'javascript', 'Reverse a string.', 'function reverse(s){}',
  'reverse("abc") -> "cba"', '["split, reverse, join"]'::jsonb,
  'function reverse(s){}\n',
  '[{"call":"reverse(\"abc\")","expected":"cba"}]'::jsonb,
  '[{"call":"reverse(\"\")","expected":""}]'::jsonb,
  'function reverse(s){return s.split("").reverse().join("");}', 2),
('count-vowels', 2, 'CountVowels', 'easy', 'javascript', 'Count vowels in a string.', 'function countVowels(s){}',
  'countVowels("hello") -> 2', '["Consider a e i o u", "Case insensitive"]'::jsonb,
  'function countVowels(s){}\n',
  '[{"call":"countVowels(\"hello\")","expected":2}]'::jsonb,
  '[{"call":"countVowels(\"AEIOU\")","expected":5}]'::jsonb,
  'function countVowels(s){return (s.match(/[aeiou]/gi)||[]).length;}', 3),

('find-prev-prime', 3, 'FindPrevPrime', 'medium', 'javascript',
  'Return the largest prime strictly less than n. Return 0 if none.',
  'function findPrevPrime(n){}',
  'findPrevPrime(10) -> 7\nfindPrevPrime(3) -> 2',
  '["Trial division", "Loop downward from n-1"]'::jsonb,
  'function findPrevPrime(n){}\n',
  '[{"call":"findPrevPrime(10)","expected":7},{"call":"findPrevPrime(3)","expected":2}]'::jsonb,
  '[{"call":"findPrevPrime(2)","expected":0},{"call":"findPrevPrime(30)","expected":29}]'::jsonb,
  'function findPrevPrime(n){function p(x){if(x<2)return false;for(let i=2;i*i<=x;i++)if(x%i===0)return false;return true;}for(let i=n-1;i>=2;i--)if(p(i))return i;return 0;}', 1),
('zip-string', 3, 'ZipString', 'medium', 'javascript',
  'Compress repeated adjacent characters into char+count.',
  'function zipString(s){}', 'zipString("aaabbc") -> "a3b2c1"',
  '["Walk the string tracking a current char and run length"]'::jsonb,
  'function zipString(s){}\n',
  '[{"call":"zipString(\"aaabbc\")","expected":"a3b2c1"}]'::jsonb,
  '[{"call":"zipString(\"\")","expected":""},{"call":"zipString(\"a\")","expected":"a1"}]'::jsonb,
  'function zipString(s){let r="",c=0;for(let i=0;i<s.length;i++){c++;if(s[i]!==s[i+1]){r+=s[i]+c;c=0;}}return r;}', 2),
('is-capitalized', 3, 'IsCapitalized', 'easy', 'javascript',
  'Return true if the string starts with a capital letter and the rest are lowercase.',
  'function isCapitalized(s){}',
  'isCapitalized("Hello") -> true', '["Compare charCodeAt to A-Z / a-z"]'::jsonb,
  'function isCapitalized(s){}\n',
  '[{"call":"isCapitalized(\"Hello\")","expected":true},{"call":"isCapitalized(\"hello\")","expected":false}]'::jsonb,
  '[{"call":"isCapitalized(\"\")","expected":false},{"call":"isCapitalized(\"HEllo\")","expected":false}]'::jsonb,
  'function isCapitalized(s){return /^[A-Z][a-z]*$/.test(s);}', 3),

('chunk', 4, 'Chunk', 'medium', 'javascript', 'Split an array into subarrays of size n.', 'function chunk(arr,n){}',
  'chunk([1,2,3,4,5],2) -> [[1,2],[3,4],[5]]',
  '["Loop with step n", "slice"]'::jsonb,
  'function chunk(arr,n){}\n',
  '[{"call":"chunk([1,2,3,4,5],2)","expected":[[1,2],[3,4],[5]]}]'::jsonb,
  '[{"call":"chunk([],3)","expected":[]}]'::jsonb,
  'function chunk(a,n){const r=[];for(let i=0;i<a.length;i+=n)r.push(a.slice(i,i+n));return r;}', 1),
('can-jump', 4, 'CanJump', 'medium', 'javascript',
  'Given an array of max jump lengths, return true if you can reach the last index from index 0.',
  'function canJump(nums){}',
  'canJump([2,3,1,1,4]) -> true\ncanJump([3,2,1,0,4]) -> false',
  '["Greedy: track farthest reachable index"]'::jsonb,
  'function canJump(nums){}\n',
  '[{"call":"canJump([2,3,1,1,4])","expected":true},{"call":"canJump([3,2,1,0,4])","expected":false}]'::jsonb,
  '[{"call":"canJump([0])","expected":true}]'::jsonb,
  'function canJump(a){let m=0;for(let i=0;i<a.length;i++){if(i>m)return false;m=Math.max(m,i+a[i]);}return true;}', 2),
('union', 4, 'Union', 'easy', 'javascript', 'Return unique union of two arrays, preserving order of first appearance.',
  'function union(a,b){}',
  'union([1,2,3],[2,3,4]) -> [1,2,3,4]',
  '["Sets", "Spread"]'::jsonb,
  'function union(a,b){}\n',
  '[{"call":"union([1,2,3],[2,3,4])","expected":[1,2,3,4]}]'::jsonb,
  '[{"call":"union([],[1])","expected":[1]}]'::jsonb,
  'function union(a,b){return [...new Set([...a,...b])];}', 3),

('fifth-and-skip', 5, 'FifthAndSkip', 'medium', 'javascript',
  'Return every 5th element of an array starting from index 4.',
  'function fifthAndSkip(a){}', 'fifthAndSkip([1..15]) -> [5,10,15]',
  '["Loop with step 5 starting at index 4"]'::jsonb,
  'function fifthAndSkip(a){}\n',
  '[{"call":"fifthAndSkip([1,2,3,4,5,6,7,8,9,10])","expected":[5,10]}]'::jsonb,
  '[{"call":"fifthAndSkip([1,2,3])","expected":[]}]'::jsonb,
  'function fifthAndSkip(a){const r=[];for(let i=4;i<a.length;i+=5)r.push(a[i]);return r;}', 1),
('slice-fn', 5, 'Slice', 'medium', 'javascript',
  'Implement a manual slice(arr, start, end) without using Array.prototype.slice.',
  'function mySlice(a,s,e){}',
  'mySlice([1,2,3,4],1,3) -> [2,3]',
  '["Loop from s to e", "push"]'::jsonb,
  'function mySlice(a,s,e){}\n',
  '[{"call":"mySlice([1,2,3,4],1,3)","expected":[2,3]}]'::jsonb,
  '[{"call":"mySlice([1,2,3],0,3)","expected":[1,2,3]}]'::jsonb,
  'function mySlice(a,s,e){const r=[];for(let i=s;i<e&&i<a.length;i++)r.push(a[i]);return r;}', 2),
('not-decimal', 5, 'NotDecimal', 'easy', 'javascript', 'Return true if the number is an integer (no decimal part).',
  'function notDecimal(n){}', 'notDecimal(3) -> true; notDecimal(3.5) -> false',
  '["Number.isInteger"]'::jsonb,
  'function notDecimal(n){}\n',
  '[{"call":"notDecimal(3)","expected":true},{"call":"notDecimal(3.5)","expected":false}]'::jsonb,
  '[{"call":"notDecimal(0)","expected":true}]'::jsonb,
  'function notDecimal(n){return Number.isInteger(n);}', 3),

('find-pairs', 6, 'FindPairs', 'medium', 'javascript',
  'Return count of pairs (i,j), i<j such that arr[i]+arr[j]===target.',
  'function findPairs(arr,target){}',
  'findPairs([1,2,3,4],5) -> 2',
  '["Hashmap of complements", "O(n)"]'::jsonb,
  'function findPairs(arr,target){}\n',
  '[{"call":"findPairs([1,2,3,4],5)","expected":2}]'::jsonb,
  '[{"call":"findPairs([1,1,1],2)","expected":3}]'::jsonb,
  'function findPairs(a,t){let c=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i]+a[j]===t)c++;return c;}', 1),
('word-flip', 6, 'WordFlip', 'medium', 'javascript',
  'Reverse the order of words in a string.', 'function wordFlip(s){}',
  'wordFlip("hello world") -> "world hello"',
  '["split, reverse, join"]'::jsonb,
  'function wordFlip(s){}\n',
  '[{"call":"wordFlip(\"hello world\")","expected":"world hello"}]'::jsonb,
  '[{"call":"wordFlip(\"a b c\")","expected":"c b a"}]'::jsonb,
  'function wordFlip(s){return s.split(" ").reverse().join(" ");}', 2),
('ro-string', 6, 'RoString', 'medium', 'javascript',
  'Rotate a string left by n characters.',
  'function roString(s,n){}',
  'roString("abcdef",2) -> "cdefab"',
  '["Use modulo for large n", "slice"]'::jsonb,
  'function roString(s,n){}\n',
  '[{"call":"roString(\"abcdef\",2)","expected":"cdefab"}]'::jsonb,
  '[{"call":"roString(\"abc\",5)","expected":"cab"}]'::jsonb,
  'function roString(s,n){n=n%s.length;return s.slice(n)+s.slice(0,n);}', 3),

('itoa-base', 7, 'ItoaBase', 'hard', 'javascript',
  'Convert an integer to a string in a given base (2..16), no built-in toString(base).',
  'function itoaBase(n,base){}',
  'itoaBase(255,16) -> "ff"',
  '["Repeatedly divide by base", "0..9 then a..f", "Handle 0"]'::jsonb,
  'function itoaBase(n,base){}\n',
  '[{"call":"itoaBase(255,16)","expected":"ff"},{"call":"itoaBase(10,2)","expected":"1010"}]'::jsonb,
  '[{"call":"itoaBase(0,10)","expected":"0"}]'::jsonb,
  'function itoaBase(n,b){if(n===0)return "0";const d="0123456789abcdef";let r="";while(n>0){r=d[n%b]+r;n=Math.floor(n/b);}return r;}', 1),
('pig-latin', 7, 'PigLatin', 'hard', 'javascript',
  'Convert a word to pig latin: move first consonant cluster to end and add "ay". If starts with vowel, append "ay".',
  'function pigLatin(s){}',
  'pigLatin("hello") -> "ellohay"',
  '["Find index of first vowel", "slice + concat"]'::jsonb,
  'function pigLatin(s){}\n',
  '[{"call":"pigLatin(\"hello\")","expected":"ellohay"},{"call":"pigLatin(\"apple\")","expected":"appleay"}]'::jsonb,
  '[{"call":"pigLatin(\"string\")","expected":"ingstray"}]'::jsonb,
  'function pigLatin(s){const i=s.search(/[aeiou]/i);if(i<=0)return s+"ay";return s.slice(i)+s.slice(0,i)+"ay";}', 2),
('roman-numbers', 7, 'RomanNumbers', 'hard', 'javascript',
  'Convert an integer 1..3999 to a Roman numeral.', 'function toRoman(n){}',
  'toRoman(1994) -> "MCMXCIV"',
  '["Table of value/symbol pairs including 4/9 forms"]'::jsonb,
  'function toRoman(n){}\n',
  '[{"call":"toRoman(1994)","expected":"MCMXCIV"}]'::jsonb,
  '[{"call":"toRoman(1)","expected":"I"},{"call":"toRoman(58)","expected":"LVIII"}]'::jsonb,
  'function toRoman(n){const v=[1000,900,500,400,100,90,50,40,10,9,5,4,1];const s=["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];let r="";for(let i=0;i<v.length;i++){while(n>=v[i]){r+=s[i];n-=v[i];}}return r;}', 3),

('rpn-calc', 8, 'RpnCalc', 'hard', 'javascript',
  'Evaluate a Reverse Polish Notation expression given as a string of tokens separated by spaces. Supports + - * /',
  'function rpn(expr){}',
  'rpn("3 4 +") -> 7\nrpn("2 3 4 * +") -> 14',
  '["Use a stack", "Integer division truncates toward zero"]'::jsonb,
  'function rpn(expr){}\n',
  '[{"call":"rpn(\"3 4 +\")","expected":7},{"call":"rpn(\"2 3 4 * +\")","expected":14}]'::jsonb,
  '[{"call":"rpn(\"10 2 /\")","expected":5}]'::jsonb,
  'function rpn(e){const s=[],ops={"+":(a,b)=>a+b,"-":(a,b)=>a-b,"*":(a,b)=>a*b,"/":(a,b)=>a/b|0};for(const t of e.split(" ")){if(ops[t]){const b=s.pop(),a=s.pop();s.push(ops[t](a,b));}else s.push(+t);}return s[0];}', 1),
('brackets', 8, 'Brackets', 'hard', 'javascript',
  'Return true if brackets ()[]{} are balanced in the string.',
  'function brackets(s){}',
  'brackets("()[]{}") -> true\nbrackets("(]") -> false',
  '["Stack of expected closers"]'::jsonb,
  'function brackets(s){}\n',
  '[{"call":"brackets(\"()[]{}\")","expected":true},{"call":"brackets(\"(]\")","expected":false}]'::jsonb,
  '[{"call":"brackets(\"\")","expected":true},{"call":"brackets(\"([{}])\")","expected":true}]'::jsonb,
  'function brackets(s){const m={")":"(","]":"[","}":"{"};const st=[];for(const c of s){if("([{".includes(c))st.push(c);else if(m[c]){if(st.pop()!==m[c])return false;}}return st.length===0;}', 2),
('word-flip-2', 8, 'HardWordFlip', 'hard', 'javascript',
  'Reverse each word in a sentence but keep word order.',
  'function hardWordFlip(s){}',
  'hardWordFlip("hello world") -> "olleh dlrow"',
  '["split by space, reverse each, join"]'::jsonb,
  'function hardWordFlip(s){}\n',
  '[{"call":"hardWordFlip(\"hello world\")","expected":"olleh dlrow"}]'::jsonb,
  '[{"call":"hardWordFlip(\"a bc\")","expected":"a cb"}]'::jsonb,
  'function hardWordFlip(s){return s.split(" ").map(w=>w.split("").reverse().join("")).join(" ");}', 3);

#!/usr/bin/env bash
# Automated check: assessments must be unreachable by anon/authenticated via
# the Data API, RLS must be enabled with no permissive policies, and the
# service_role (used by server functions) must still be able to read it.
#
# Run: bash scripts/check-assessments-access.sh
# Exits non-zero on any failure.

set -uo pipefail

FAIL=0
pass() { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; FAIL=1; }

echo "== assessments access checks =="

# 1. RLS enabled
RLS=$(psql -tAc "SELECT relrowsecurity FROM pg_class WHERE oid='public.assessments'::regclass;")
[ "$RLS" = "t" ] && pass "RLS enabled on assessments" || fail "RLS NOT enabled on assessments"

# 2. No policies allowing anon/authenticated
POL_COUNT=$(psql -tAc "SELECT count(*) FROM pg_policy WHERE polrelid='public.assessments'::regclass;")
[ "$POL_COUNT" = "0" ] && pass "No RLS policies (closed by default)" \
  || fail "Unexpected RLS policies on assessments ($POL_COUNT)"

# 3. No grants to anon / authenticated
for ROLE in anon authenticated; do
  N=$(psql -tAc "SELECT count(*) FROM information_schema.role_table_grants
                 WHERE table_schema='public' AND table_name='assessments'
                   AND grantee='$ROLE'
                   AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE');")
  [ "$N" = "0" ] && pass "$ROLE has no table privileges on assessments" \
    || fail "$ROLE has $N privileges on assessments (should be 0)"
done

# 4. service_role can still SELECT (server functions need this)
SR=$(psql -tAc "SELECT count(*) FROM information_schema.role_table_grants
                WHERE table_schema='public' AND table_name='assessments'
                  AND grantee='service_role' AND privilege_type='SELECT';")
[ "$SR" = "1" ] && pass "service_role retains SELECT on assessments" \
  || fail "service_role missing SELECT on assessments"

# 5. Live Data API probe with anon key (must be denied)
if [ -n "${VITE_SUPABASE_URL:-}" ] && [ -n "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]; then
  CODE=$(curl -sS -o /tmp/_assess.json -w "%{http_code}" \
    -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" \
    -H "Authorization: Bearer $VITE_SUPABASE_PUBLISHABLE_KEY" \
    "$VITE_SUPABASE_URL/rest/v1/assessments?select=id&limit=1")
  if [ "$CODE" = "401" ] || [ "$CODE" = "403" ] || [ "$CODE" = "404" ]; then
    pass "Data API rejects anon read (HTTP $CODE)"
  else
    BODY=$(cat /tmp/_assess.json)
    fail "Data API anon read returned HTTP $CODE: $BODY"
  fi
else
  echo "  ⚠️  Skipping live Data API probe (VITE_SUPABASE_URL / KEY not set)"
fi

echo
[ "$FAIL" = "0" ] && { echo "ALL CHECKS PASSED"; exit 0; } || { echo "CHECKS FAILED"; exit 1; }

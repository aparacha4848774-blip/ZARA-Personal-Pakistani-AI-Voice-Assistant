# ZARA — Cloudflare Workers AI Free Plan and migration status

ZARA remains on the Cloudflare Workers Free plan. Do not configure Kimi K2.6
or any model marked `require_workers_paid=true`.

## Selected default model

`@cf/google/gemma-4-26b-a4b-it`

The Worker has this model as its built-in fallback in
`src/worker/index.ts` (`WORKERS_MODEL`). Workers AI Free includes a daily
inference allocation; check the current allowance and model eligibility before
deployment:

- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/

## Required Cloudflare configuration

1. Keep the existing `AI` binding in `wrangler.jsonc`.
2. Leave `WORKERS_AI_MODEL` unset, or set it to
   `@cf/google/gemma-4-26b-a4b-it`.
3. Do not add Kimi K2.6 to staging or production Worker variables.
4. Keep Cloudflare API tokens only in GitHub Actions Secrets or the
   Cloudflare deployment environment. Never commit them or expose them to
   browser JavaScript.
5. The existing Worker currently uses D1 through `env.DB`. Do not remove the
   D1 binding or deploy a Supabase runtime cutover until the Worker data layer
   has been migrated and staging-tested.

The existing Worker prioritizes Gemini when `GEMINI_API_KEY` is configured,
then falls back to Workers AI. For a Cloudflare-only free-plan test, use a
staging environment without a Gemini key; do not delete production secrets.

## Supabase migration progress

- Supabase project is `ACTIVE_HEALTHY`.
- The initial PostgreSQL schema migration has been applied and verified.
- All nine tables exist with RLS enabled and no direct table grants to
  `anon` or `authenticated`.
- The D1 owner settings row and three approved memories were copied and
  verified in Supabase.
- Other D1 application tables were empty at the time of migration.
- D1 remains configured and untouched as the rollback/source backup.
- **Runtime cutover is not complete:** `src/worker/index.ts` and
  `src/worker/env.ts` still use the D1 API. Do not claim the app is running
  from Supabase until all D1 operations have been replaced, tested, and
  deployed to staging.

The service-role/secret key must remain server-side. Never put it in frontend
code, commit it, or paste it into chat. Configure it only as a Cloudflare
Worker secret when the Supabase-backed runtime is ready.

## Why Kimi is disabled

Cloudflare's model catalog marks `@cf/moonshotai/kimi-k2.6` with
`require_workers_paid=true`. It is not appropriate for this Free-plan
configuration. Reconsider it only if the account is intentionally upgraded
and the owner approves the additional cost.

## Remaining verification before production

1. Complete and test the Worker data-access migration from D1 to Supabase.
2. Verify settings, memories, conversations, rate limits, WhatsApp records,
   usage logs, automation history, and backups through the Supabase-backed
   Worker.
3. Add the Supabase server secret in the staging Worker environment without
   exposing it to the browser or Git history.
4. Deploy only `cloudflare-workers-migration` to staging.
5. Test authenticated `/api/health`, `/api/chat`, voice/STT/TTS, and
   persistence; verify the model response reports the expected Gemma model
   when the Workers AI fallback is used.
6. Review Worker logs, Supabase security/performance advisors, and Workers AI
   usage.
7. Keep `main`, production, and D1 unchanged until staging verification
   passes and production cutover is explicitly approved.

A successful CI run or schema migration alone does not verify live AI,
Urdu speech, TTS, WhatsApp delivery, or production deployment.

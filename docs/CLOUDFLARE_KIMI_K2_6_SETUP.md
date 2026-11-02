# ZARA — Always Free deployment policy

## Non-negotiable cost policy

ZARA must run on free-tier services only. Do not enable paid plans, paid model
providers, prepaid credits, paid add-ons, or usage-based billing. Do not
automatically upgrade or fall back to a paid provider. If a free quota is
exhausted, return a clear temporary-unavailable response and resume when the
quota resets.

This is a free-tier architecture, not an unlimited-service guarantee. Free
providers can change quotas, availability, or terms. Monitor usage and re-check
the official limits before releases.

## Approved stack

- **Compute and hosting:** Cloudflare Workers / Pages on Workers Free.
- **AI inference:** Cloudflare Workers AI using a model currently eligible for
  Workers Free, default `@cf/google/gemma-4-26b-a4b-it`.
- **Database:** Cloudflare D1 (existing binding `env.DB` and existing
  `zara-assistant-staging` database).
- **Speech recognition:** Workers AI Whisper only while the selected model
  remains Free-eligible and within the daily AI allocation.
- **Speech output:** Browser Web Speech API / device voices; no paid TTS API.
- **Frontend:** Static assets hosted on Cloudflare Pages/Workers.

Official limits and model eligibility:
- Workers Free limits: https://developers.cloudflare.com/workers/platform/limits/
- Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Gemma model: https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/

## Quota behavior

Current published Workers Free limits include 100,000 Worker requests per day.
Workers AI includes 10,000 Neurons per day. D1 Free currently includes 5 million
rows read per day, 100,000 rows written per day, and 5 GB total account storage.
Limits reset according to Cloudflare's published schedule and can change.

- Never silently upgrade to Workers Paid.
- Never route to a paid model/provider when free inference is exhausted.
- Handle quota errors gracefully; show the user that the free daily quota has
  been reached and when service is expected to resume.
- Keep D1 queries indexed and bounded; avoid unbounded table scans.
- Track request, AI neuron, D1 row-read/write, and storage usage.
- No paid API key is required for the default chat/STT path.

## Providers explicitly excluded

- **Kimi K2.6:** Cloudflare marks it as requiring Workers Paid; do not use it.
- **Gemini API:** paid/usage-based external provider; do not configure or invoke
  it in the Always Free runtime.
- **Supabase:** do not use it as ZARA's runtime database under this policy.
  Its Free project can pause after a week of low activity and has quotas. A
  Supabase schema and copy of initial settings/memories were created during
  migration investigation, but they are not the production source of truth.
  Keep D1 as the sole active database. Do not add a Supabase secret to Worker
  environments or cut runtime over to Supabase.
- Any paid TTS, WhatsApp provider, AI gateway credit, storage, monitoring, or
  third-party API is excluded unless the owner explicitly changes this policy.

## Existing Supabase migration investigation

The Supabase Free project contains a copy of the owner settings row and three
approved memories, plus a nine-table schema. This was an evaluation/migration
test only. It must not be treated as live ZARA storage. D1 remains authoritative.
Do not delete the Supabase copy until the owner decides it is no longer needed.

## Deployment safeguards

1. Keep the Cloudflare `AI` and D1 `DB` bindings.
2. Keep `WORKERS_AI_MODEL` unset or set to
   `@cf/google/gemma-4-26b-a4b-it`.
3. Remove/ignore `GEMINI_API_KEY` in the Always Free runtime; code must not
   invoke Gemini even if an old secret is present.
4. Keep Kimi and all `require_workers_paid=true` models disabled.
5. Never commit secrets. Do not enable billing or change account plan.
6. Deploy and test only `cloudflare-workers-migration`; leave `main` and
   production untouched until separately approved.
7. Before deployment, verify current free eligibility of every Workers AI
   model and ensure quota exhaustion fails closed without paid fallback.

## Status and limitations

The repository has a Workers AI Free model fallback and the D1 database
binding. Supabase schema/data migration is not part of the target runtime.
The current application code still has a Gemini-first branch when
`GEMINI_API_KEY` is set; that branch must be removed or hard-disabled before
claiming full Always Free compliance.

CI success does not prove live AI, voice, TTS, WhatsApp, or staging deployment.
A free-tier service can still be rate-limited, paused, or unavailable at its
provider's discretion.

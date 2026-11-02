# ZARA — Cloudflare Workers AI Free Plan configuration

ZARA will remain on the Cloudflare Workers Free plan. Do not configure Kimi K2.6
or any model marked `require_workers_paid=true`.

## Selected default model

`@cf/google/gemma-4-26b-a4b-it`

The Worker already has this model as its built-in fallback in
`src/worker/index.ts` (`WORKERS_MODEL`). The model catalog currently does not
mark it with `require_workers_paid=true`. Workers AI Free includes a daily
inference allocation (currently 10,000 Neurons/day); requests above the free
allowance require an upgrade or wait for the daily reset. Check current
allowances and model availability before deployment:

- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/

## Required Cloudflare configuration

1. Keep the existing `AI` binding in `wrangler.jsonc`.
2. Leave `WORKERS_AI_MODEL` unset, or set it to
   `@cf/google/gemma-4-26b-a4b-it`.
3. Do not add Kimi K2.6 to staging or production Worker variables.
4. Keep the Cloudflare API token only in GitHub Actions Secrets or the
   Cloudflare deployment environment. Never commit it or expose it to browser
   JavaScript.

The existing Worker prioritizes Gemini when `GEMINI_API_KEY` is configured,
then falls back to Workers AI. To run a Cloudflare-only free-plan test, make
sure the staging Worker has no Gemini key configured for that test; do not
delete production secrets.

## Why Kimi is disabled

Cloudflare's model catalog marks `@cf/moonshotai/kimi-k2.6` with
`require_workers_paid=true`. It is therefore not appropriate for this
Free-plan configuration. Kimi can be reconsidered only if the account is
intentionally upgraded and the owner approves the additional cost.

## Free-plan validation

1. Confirm the Cloudflare account remains on Workers Free.
2. Confirm the staging Worker has the `AI` binding.
3. Confirm `WORKERS_AI_MODEL` is unset or set to the Gemma model above.
4. Deploy only `cloudflare-workers-migration` to staging.
5. Send an authenticated request to staging `/api/chat`.
6. Confirm a successful response reports
   `modelUsed: "@cf/google/gemma-4-26b-a4b-it"` and the appropriate provider
   status.
7. Check Worker logs and Workers AI usage so daily Neurons usage is visible.
8. Do not change `main` or production until staging verification passes and
   production cutover is explicitly approved.

A successful model request does not by itself verify the full ZARA application,
database migration, Urdu speech recognition, TTS, WhatsApp, or production
deployment.

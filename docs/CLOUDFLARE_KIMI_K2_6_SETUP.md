# Cloudflare Workers AI — Kimi K2.6 setup for ZARA

This guide configures Kimi K2.6 as ZARA's Workers AI fallback/provider on the
`cloudflare-workers-migration` branch. It does not put Cloudflare credentials
in source code and does not change the production `main` branch.

## 1. Plan and billing requirement

`@cf/moonshotai/kimi-k2.6` requires Workers Paid or prepaid AI Gateway credits.
It is not available on standard Workers Free billing. Workers Paid starts at
$5/month; inference above included daily Neurons is billed at the published
model rates. Check the current model page and billing before enabling it:

- https://developers.cloudflare.com/workers-ai/models/kimi-k2.6/
- https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/

If you stay on Workers Free, leave `WORKERS_AI_MODEL` unset and ZARA keeps its
configured fallback model (`@cf/google/gemma-4-26b-a4b-it`).

## 2. Configure the staging Worker

In Cloudflare Dashboard → Workers & Pages → your ZARA staging Worker →
Settings → Variables and Secrets, add this variable:

- Name: `WORKERS_AI_MODEL`
- Value: `@cf/moonshotai/kimi-k2.6`

The Worker already uses the `AI` binding from `wrangler.jsonc`; do not add an
API token to browser code. The binding call is server-side:
`env.AI.run(model, { messages, ... })`.

If you deploy from GitHub Actions, keep these as GitHub Actions secrets/vars
according to `.github/workflows/deploy-staging.yml`:

- Secret `CLOUDFLARE_API_TOKEN`: scoped to the required Workers deployment and
  account resources; never commit or print it.
- Secret `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account ID (the workflow
  expects it as a secret).
- Existing `ZARA_AUTH_TOKEN` secret and `ALLOWED_ORIGIN` variable remain
  required by the staging workflow.

Do not paste tokens into chat, source files, screenshots, or commit messages.
Create/rotate API tokens in the Cloudflare dashboard. `wrangler whoami` can
identify the account for an authenticated Wrangler session; it does not make
the token safe to expose.

## 3. Optional direct REST smoke test

Use the documented model-specific endpoint. The model ID is part of the URL;
it is not sent inside an `input.model` field. This request is a direct
Workers AI API call (not the AI Gateway URL), so the
`cf-aig-gateway-id: default` header from some gateway examples is not needed.

```bash
curl "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/moonshotai/kimi-k2.6" \
  --request POST \
  --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --data '{
    "messages": [
      {"role": "system", "content": "You are ZARA, a friendly Pakistani AI assistant. Address the user as Boss and reply in Roman Urdu when appropriate."},
      {"role": "user", "content": "What is Cloudflare?"}
    ],
    "max_tokens": 512,
    "chat_template_kwargs": {"thinking": true}
  }'
```

Run this only in a trusted terminal where the environment variables are set.
Do not put real credentials directly in the command history.

## 4. ZARA integration behavior

- Gemini remains the preferred provider whenever `GEMINI_API_KEY` is configured.
- Workers AI is used as the fallback if Gemini is unavailable.
- Set `WORKERS_AI_MODEL` to Kimi K2.6 only after confirming paid access.
- Kimi K2.6 uses `chat_template_kwargs.thinking`; the Worker selects this
  parameter automatically for that exact model. Other configured Workers AI
  models retain their existing `enable_thinking` parameter.
- Usage logging and the existing ZARA server-side authentication/rate limits
  remain in place.

## 5. Verification checklist

1. Confirm the staging Worker has the `AI` binding.
2. Confirm the staging Worker variable `WORKERS_AI_MODEL` has the exact model ID.
3. Confirm Workers Paid or prepaid AI Gateway credits are active.
4. Deploy only the migration/staging branch.
5. Send a chat request to the staging `/api/chat` endpoint with valid ZARA auth.
6. Verify the response reports `modelUsed: "@cf/moonshotai/kimi-k2.6"` and
   `providerStatus: "fallback"` when Gemini is intentionally unavailable.
7. Check Worker logs for provider errors and confirm usage is recorded.
8. Do not switch production or modify `main` until staging tests pass and you
   explicitly approve production cutover.

A successful REST smoke test confirms model access, not that the full ZARA
application, Urdu voice, database, or production deployment is complete.

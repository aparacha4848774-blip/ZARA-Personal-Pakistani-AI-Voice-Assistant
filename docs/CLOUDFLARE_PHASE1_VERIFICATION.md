# ZARA Cloudflare Worker Phase 1 — Verification Notes

**Branch:** `cloudflare-workers-migration`
**Status:** Worker implementation and automated checks are committed; staging deployment remains gated on repository configuration.

## Changes made

- Pinned Wrangler and added Worker-specific scripts.
- Configured Cloudflare Static Assets with SPA fallback and Worker-first API routing.
- Added strict CORS preflight validation for an exact configured origin, method allowlist, and request-header allowlist.
- Added Worker tests for health, API 404, CORS, preflight, authentication, request validation, fallback behavior, and Static Assets delegation.
- CI runs on both `main` and `cloudflare-workers-migration` and performs tests, type checking, frontend build, and Wrangler dry-run.
- The Cloudflare login gate now clears legacy browser localStorage bearer tokens when it detects the Worker runtime; Worker sessions use the Secure, HttpOnly cookie.

## Staging deployment requirements

Configure these in GitHub repository Settings → Secrets and variables → Actions:

**Required secrets**
- `CLOUDFLARE_API_TOKEN` — scoped to the required Worker and D1 deployment operations.
- `CLOUDFLARE_ACCOUNT_ID`.
- `ZARA_AUTH_TOKEN` — unique random value of at least 32 characters.

**Required variable**
- `ALLOWED_ORIGIN` — exact HTTPS staging origin, including scheme and port if applicable. Do not use a wildcard.
  
**Optional WhatsApp configuration**
- Secret `WHATSAPP_API_TOKEN`.
- Variable `WHATSAPP_PHONE_NUMBER_ID`.

The manual staging workflow validates the required configuration, runs the full verification suite, applies D1 migrations, and deploys only the staging Worker. It does not deploy production or change DNS.

## Live account verification

The connected Cloudflare account contains the `zara-assistant-staging` D1 database. The expected schema tables, one owner settings record, and three approved owner memories are present. The Workers Scripts list is currently empty, so the application has not yet been deployed as a Worker.

## Remaining verification

- Configure the required GitHub secrets and `ALLOWED_ORIGIN` variable.
- Run the manual staging deployment workflow.
- Test the deployed health endpoint, login/session cookie, CORS, chat providers, D1 CRUD, voice/TTS, and WhatsApp only after its credentials are configured.
- Complete browser and Electron smoke tests before any production cutover.

## Supabase status

The connected Supabase project is currently `INACTIVE`. The Cloudflare migration uses D1 as its application database; the Worker, package manifest, and Wrangler configuration do not require Supabase at runtime. Keep the legacy Supabase project inactive unless a separately approved rollback or data-export task requires it. Do not restore it merely to make the dashboard show an active status, because restoration may incur compute charges and would create a second, unused database.

## CI verification status

The CI workflow is configured for pushes and pull requests on both `main` and `cloudflare-workers-migration`, plus manual dispatch. At the time of this verification, GitHub reports no status checks and the available commit-workflow lookup returns no runs for the migration fix commit. Therefore the workflow definition is present, but a successful CI run is not yet proven. Run the workflow from the Actions tab and confirm all five steps pass before staging deployment.

## Safety

The original `main` branch and existing Express/Electron runtime remain the rollback baseline. This branch does not remove desktop functionality or change production DNS.

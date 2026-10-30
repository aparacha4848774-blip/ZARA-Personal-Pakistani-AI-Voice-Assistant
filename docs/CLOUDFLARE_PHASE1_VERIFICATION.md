# ZARA Cloudflare Worker Phase 1 — Verification Notes

**Branch:** `cloudflare-workers-migration`  
**Status:** Implementation and automated checks added; execution results are pending GitHub Actions.

## Changes made

- Pinned the Wrangler CLI to `4.156.0` as a development dependency.
- Added `worker:dev`, `worker:test`, and `worker:dry-run` scripts.
- Configured Cloudflare Static Assets to use SPA fallback while keeping `/api/*` Worker-first.
- Tightened CORS preflight validation: exact configured origin, explicit method allowlist, and explicit request-header allowlist.
- Added Worker tests for health, JSON API 404, allowed/disallowed CORS, preflight validation, and Static Assets delegation.
- Updated CI to run on both `main` and `cloudflare-workers-migration`, and to run the Worker tests and Wrangler dry-run after the frontend build.
- Added Wrangler local-state and local-secret exclusions to `.gitignore`.

## Verification commands

Run these from the repository root:

```bash
npm install --no-audit --no-fund
npm test
npm run lint
npm run build
npm run worker:dry-run
npm run worker:dev
```

The dry-run validates the Worker bundle/configuration without publishing a Worker. Do not use `wrangler deploy` for production until the migration acceptance checks and rollback plan are approved.

## Cloudflare account inspection

The connected Cloudflare account is reachable, but its Workers Scripts list is currently empty. No Worker is deployed from this project yet.

## Remaining blockers — not claimed as complete

- Set `ALLOWED_ORIGIN` as a Worker environment variable for the actual staging hostname before testing cross-origin access. Do not put secrets in `wrangler.jsonc`.
- Run the automated test, TypeScript, frontend build, and Wrangler dry-run checks and fix any failures.
- Test a real Wrangler local session and SPA deep-link routing.
- Migrate chat/provider handling, durable persistence, authentication/authorization, WhatsApp state, and cloud-safe automation in separate reviewed phases.
- Keep Electron OS controls and browser speech-recognition behavior in their supported local/browser runtimes.

## Safety

The existing Express/Electron application remains the working baseline. This phase does not remove existing functionality, change DNS, or deploy production.

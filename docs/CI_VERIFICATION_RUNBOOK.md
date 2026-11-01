# GitHub CI Verification Runbook

The `ZARA CI` workflow is defined in `.github/workflows/ci.yml` and runs on pushes and pull requests targeting `main` or `cloudflare-workers-migration`, or by manual dispatch.

## Checks performed

1. Install dependencies with `npm install --no-audit --no-fund`.
2. Generate Cloudflare Worker binding types with `npm run worker:types`.
3. Run application and Worker tests with `npm test`.
4. Run the TypeScript check with `npm run lint`.
5. Build the frontend with `npm run build`.
6. Validate the Worker bundle and Wrangler configuration with `npm run worker:dry-run`.

## How to verify a run

Open the repository's Actions tab, select **ZARA CI**, and inspect the run for the `cloudflare-workers-migration` branch. A run is verified only when the workflow conclusion is `success` and every step above has completed successfully. A configured workflow file or an empty commit status is not evidence of a passing run.

## Staging deployment

Staging deployment is separate from CI and must not be used as a substitute for CI verification. It requires the deployment credentials and variables documented in `docs/CLOUDFLARE_PHASE1_VERIFICATION.md`. Do not deploy to production as part of this verification.

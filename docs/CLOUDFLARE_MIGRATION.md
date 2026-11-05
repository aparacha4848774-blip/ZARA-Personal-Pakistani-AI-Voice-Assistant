# ZARA Cloudflare Workers Migration — Repository-Specific Plan

**Status:** Audit complete; Phase 1 scaffold committed, verification pending  
**Branch:** `cloudflare-workers-migration`  
**Baseline:** Existing `main` branch remains untouched

## 1. Executive decision

Migrate the **web-hosted application and cloud API** toward one Cloudflare Worker with Static Assets and Workers AI. Do not attempt to move Electron or operating-system capabilities into a Worker.

The repository is not a simple Express chat server. It is a React 19 + Vite 8 + TypeScript application with an Express API, a file-backed JSON data store, browser speech recognition, Gemini chat/TTS, WhatsApp Cloud API integration, automation jobs, and an Electron desktop companion.

A safe target is therefore a **hybrid architecture**:

- **Cloudflare Worker + Static Assets:** web frontend hosting and cloud API routes.
- **Workers AI:** candidate replacement for text generation and transcription only after model, Urdu quality, latency, streaming, and Free-plan eligibility are verified.
- **D1:** durable structured user settings, memories, message records, and usage data after schema migration and authenticated ownership design.
- **KV:** short-lived rate-limit counters and cache only; not the authoritative memory database.
- **R2 (optional):** backups or audio/artifact objects if the product needs object storage.
- **Electron desktop companion:** remains a separate local application for OS access, global shortcuts, system tray, file operations, app launch/close, clipboard, and desktop WhatsApp handoff.
- **Browser speech APIs:** preserve current browser microphone/wake-word behavior unless an independently tested replacement is deliberately introduced.

Do not remove the current Express/Electron path until the Worker version passes the migration acceptance suite and a rollback plan is tested.

## 2. Repository facts verified from source

| Area | Current implementation | Migration consequence |
|---|---|---|
| Frontend | React 19, Vite 8, TypeScript; `vite.config.ts` | Keep Vite build and serve its output as Worker Static Assets. |
| Backend | Root `server.ts`, Express 4 | Convert API routes to Worker `fetch()` handlers incrementally. |
| AI text | `@google/genai`, `GEMINI_API_KEY`, Gemini `generateContent` in `server.ts` | Replace behind a provider adapter; preserve API response contract. |
| Speech input | `src/engines/SpeechRecognitionEngine.ts` uses browser SpeechRecognition / webkitSpeechRecognition | Keep browser-side; do not force Whisper for a feature that currently uses browser recognition. Add transcription only for a separately supported uploaded/recorded-audio path. |
| Speech output | `/api/voice/tts` calls Gemini audio generation, with browser voice fallback | Cloudflare TTS is not a drop-in replacement until Urdu/Roman Urdu voice quality, codec, and client playback are tested. |
| Persistence | `src/db/storage.ts` uses Node `fs`, JSON file, backup file, synchronous writes | Not Worker-compatible. Design and migrate a durable database before moving these endpoints. |
| Automation | `src/logic/automationService.ts` uses filesystem, `process`, `os` | Separate cloud-safe scheduled tasks from machine-local tasks; use Cron Triggers/Queues only for appropriate cloud jobs. |
| WhatsApp | `src/logic/whatsappService.ts` calls Meta Cloud API and persists status in local JSON | Can remain a Worker server-side integration with secret bindings and durable records. Keep truthful delivery status. |
| Desktop control | `electron/main.cjs` uses Electron, `child_process`, `fs`, `os`, clipboard, shell and global shortcuts | Must remain in Electron/local desktop process; Workers cannot launch apps or inspect the user's PC. |
| Security | Express middleware, authorization checks, in-memory IP limits | Reimplement explicitly; in-memory maps are not reliable across Worker isolates. Do not trust a client-supplied user ID. |
| Existing tests | `npm test` runs `tsx --test src/logic/logic.test.ts`; `npm run lint` is `tsc --noEmit`; `npm run build` is `vite build` | Preserve and run all three checks throughout migration. |

Files inspected: `package.json`, `vite.config.ts`, `tsconfig.json`, `server.ts`, `src/utils/apiClient.ts`, `src/engines/SpeechRecognitionEngine.ts`, `src/db/storage.ts`, `src/logic/automationService.ts`, `src/logic/whatsappService.ts`, `electron/main.cjs`, and the existing logic tests.

## 3. Work already committed on the migration branch

- `850a371d049c5fabeebecaba1f208f7fed1bcc81` — initial repository-specific migration plan.
- `a5d5e3b71fdaafb13b2526e5f007e93dcb513c86` — initial `wrangler.jsonc`.
- `b6d83dfc7ec985d748df16b577d4d55fc7eb34ab` — typed Worker environment contract.
- `f2a4e5b45df55dc2b780f526a183da3050c9397e` — Worker entry point, health endpoint, API 404, CORS preflight, and Static Assets delegation.

This is scaffolding only. It does not migrate chat, TTS, persistence, authentication, WhatsApp, or automation, and it has not yet been validated with Wrangler or deployed.

## 4. Critical compatibility findings

### Node-only features

The following are not directly portable to the Workers runtime:

- Node filesystem operations and local JSON database.
- `child_process`, Electron APIs, local OS process/system information.
- Node process lifecycle hooks and in-memory singleton assumptions.
- Long-running in-process timers and local scheduled automation.

Do not solve these by adding compatibility shims that silently return fake success. Each capability must be migrated to a real Cloudflare service or remain in the local Electron companion.



### Migration tooling and CI gaps

- The current `package.json` does not declare Wrangler or Worker-specific scripts. Add a pinned development dependency before treating local Worker commands as available.
- The root `npm run lint` runs `tsc --noEmit` with the existing root TypeScript configuration. Verify Worker files under this configuration or introduce a dedicated Worker tsconfig without weakening checks.
- The current CI workflow's push and pull-request triggers target `main`; direct pushes to the migration branch do not run those triggers. Run checks explicitly or extend CI coverage before using CI as evidence.
- `ALLOWED_ORIGIN` is optional in the Worker environment type but is not configured in the Wrangler file. Configure exact staging/production origins and test both allowed and denied origins.
- The current health endpoint is not a dependency readiness probe. A declared AI binding does not prove model availability, account eligibility, or successful inference.

### Existing product behavior to preserve

- English, Urdu-script, and Roman Urdu chat.
- ZARA persona, response cleanup, emotion detection, contextual fallback, conversation history contract.
- Browser microphone permission, listening state, silence timeout, wake-word and echo lockout.
- TTS playback and browser speech fallback.
- Settings and durable user-approved memories.
- Quota/circuit-breaker reporting and usage telemetry.
- WhatsApp draft/confirmation flow and truthful dispatch status.
- Electron global shortcuts, tray, file/app controls and desktop handoff.

### Security corrections required

- Never put Gemini, Cloudflare, WhatsApp, or auth secrets in Vite `VITE_*` variables or browser JavaScript.
- Use Worker secrets for provider credentials.
- Authenticate users server-side before reading or writing personal memories/settings/history. Do not use a client-provided identifier as proof of identity.
- Replace process-local rate limiting with a shared service (for example, KV for coarse limits or Durable Objects for strongly coordinated counters).
- Validate request size, shape, allowed fields, message length, audio type/size, and model selection on the server.
- Restrict CORS to configured origins; do not reflect arbitrary origins.
- Keep prompts/transcripts/audio/private memories out of logs.
- Keep destructive desktop operations behind existing confirmation controls; desktop IPC must validate inputs and use allowlisted app commands rather than arbitrary shell strings.
- Treat prompt-injection instructions as defense-in-depth, not a complete security boundary.

## 5. Target architecture

```text
Browser
  ├── React + Vite static assets ───────────────┐
  ├── Browser SpeechRecognition / speechSynthesis│
  └── /api/* requests                            │
                                                 ▼
                                  Cloudflare Worker
                                    ├── API router + validation
                                    ├── Authentication / authorization
                                    ├── Workers AI provider adapter
                                    ├── D1: settings, memories, usage,
                                    │       WhatsApp records, history
                                    ├── KV: rate limits / short cache
                                    ├── R2: optional backups / objects
                                    └── Meta WhatsApp Cloud API

Electron desktop app (separate local runtime)
  ├── tray + global shortcuts
  ├── local file/app operations
  ├── clipboard + desktop WhatsApp handoff
  └── secure IPC bridge to React UI
```

Use the official Workers Static Assets configuration and the Worker AI binding. Exact Wrangler configuration must be generated against the current Cloudflare documentation and validated with the installed Wrangler version. Do not copy a Pages configuration into a Workers project.

## 6. Phased implementation plan

### Phase 0 — Baseline and inventory (complete)

- [x] Confirm actual package/framework and entry points.
- [x] Identify filesystem, process, Electron, AI, speech, persistence, and WhatsApp dependencies.
- [x] Record migration blockers and feature-preservation requirements.
- [ ] Capture baseline CI/build status again on this migration branch before code changes.

### Phase 1 — Worker scaffolding (CI verified; staging runtime pending)

- [x] Add initial `wrangler.jsonc` for Worker + Static Assets and AI binding; configuration is not yet validated with Wrangler.
- [x] Add Worker entry point and typed environment bindings.
- [x] Add a basic `/api/health` endpoint; this is a scaffold status response, not a dependency-readiness probe.
- [x] Delegate non-API requests to the Static Assets binding.
- [x] Add a pinned Wrangler development dependency and Worker scripts.
- [ ] Verify Vite output, SPA deep links, and Static Assets fallback with the installed Wrangler version.
- [ ] Configure explicit staging/production `ALLOWED_ORIGIN` values and test CORS on success and error responses.
- [x] Add Worker-specific tests for health, 404, CORS, static asset routing, auth, chat validation, TTS fallback and WhatsApp confirmation.
- [x] Run `npm test`, `npm run lint`, `npm run build`, and `wrangler deploy --dry-run` in GitHub Actions (successful run #9; local `wrangler dev` and staging Worker request tests still pending).

**Phase 1 code and CI gate passed.** Staging runtime verification, real configured-origin CORS, and live binding readiness remain outstanding.

### Phase 2 — Provider adapter and chat route (implementation committed; staging provider secrets pending)

- [x] Add the Workers AI chat route using the configured `AI` binding. The current Worker route uses Workers AI directly; it does not call Gemini. Live model availability, account quota, Urdu quality, latency and capacity behavior still require staging tests.
- [x] Preserve the current `POST /api/chat` request and response fields initially (adds `providerStatus` and stable provider-unavailable errors).
- [x] Add Workers AI implementation using the documented `env.AI.run()` chat messages shape. Account entitlement, usage cost and actual Urdu/Roman Urdu output quality have not yet been exercised.
- Evaluate Urdu script and Roman Urdu using a fixed representative test set; compare response quality with current Gemini output.
- Preserve system persona, language detection, memory context, emotion fields, fallback behavior and usage accounting.
- Keep Gemini adapter as a rollback option until acceptance criteria pass.
- Never claim that an AI response came from a live model when a fallback was used.

### Phase 3 — Data layer migration (D1 created, schema applied, selected data imported)

- [x] Create APAC staging D1 database and apply schema for settings, memories, usage, WhatsApp, automation, rate limits, memory backups and conversation history.
- [x] Import settings and three active, approved owner memories. Test/probe memory, simulated WhatsApp test messages, synthetic automation logs and usage test data were deliberately excluded. Full JSON archive/restore tooling and repeatable import verification remain outstanding.
- Implement repository interfaces so Express and Worker routes can share business logic where practical.
- Do not use KV as the sole durable database for mutable user records.
- Test CRUD, authorization boundaries, concurrent updates, backup/export and recovery.

### Phase 4 — Voice and audio (browser recognition preserved; cloud TTS route committed)

- [x] Keep browser SpeechRecognition / webkitSpeechRecognition and current wake-word logic in the browser.
- [x] Keep browser `speechSynthesis` fallback. The current Worker `/api/voice/tts` route returns a client-voice fallback only; it does not generate cloud audio or call Gemini TTS.
- Evaluate Cloudflare TTS models only with real Pakistani Urdu/Roman Urdu listening tests; confirm current availability, pricing, response format and plan requirements.
- Add Whisper transcription only if the UI actually captures/uploads audio for server transcription. Confirm MIME types, duration/size limits, timeout behavior and chunking.
- Do not relabel a text transcript as audio transcription or claim Urdu support without test evidence.

### Phase 5 — WhatsApp and automation (D1 draft/send routes committed; credentials pending)

- [x] Worker reads WhatsApp token from a secret binding (`WHATSAPP_API_TOKEN`); secret has not yet been configured.
- [x] Persist drafts and dispatch results in D1; require authenticated owner session and explicit confirmation.
- Preserve actual provider message IDs and distinguish sent, pending, rejected, and local draft statuses.
- [x] Add daily cron trigger for D1 memory snapshot and rate-limit cleanup. Existing local filesystem and OS jobs remain Electron/local-only.
- Keep local disk cleanup, OS diagnostics and desktop-only automation in Electron.

### Phase 6 — Authentication, limits and observability (owner gate and D1 rate limit implemented; secret setup pending)

- [x] Add a single-owner sign-in gate with a Secure, HttpOnly, SameSite=Strict session cookie backed by a 32+ character `ZARA_AUTH_TOKEN` Worker secret. This is an owner password gate, not multi-user identity.
- Use secure server-validated sessions or a proven identity provider; do not assume the localStorage bearer token is a secure session design.
- [x] Enforce the single-owner session on private memory/settings/WhatsApp/usage/automation routes. No multi-tenant user accounts are claimed.
- [x] Add D1-backed per-IP and AI request windows plus JSON content-type, body-size, message/history and field validation.
- Log only route, status, latency, model identifier where appropriate, and aggregate usage; exclude prompts, transcripts, secrets and memory contents.

### Phase 7 — Cutover and cleanup (not started; staging deployment required)

- Deploy a staging Worker first.
- Run the complete acceptance suite and a manual browser/Electron smoke test.
- Verify D1 migration and rollback/recovery.
- Compare Cloudflare usage against the actual account plan and current model pricing.
- Only after production acceptance, decide whether Express can be removed from the web deployment. Do not remove Electron or desktop-specific code.
- Keep a documented rollback to the last working deployment and data backup.

## 7. Acceptance tests (minimum)

### API and chat

- `GET /api/health` returns 200 and truthful readiness.
- English, Urdu-script, and Roman Urdu chat return the established response schema.
- Empty/invalid message returns 400; oversized message returns 413 or the documented validation status.
- Invalid JSON/content type is rejected safely.
- Provider quota/capacity errors map to stable, non-leaking client errors.
- Fallback responses are labeled as fallback and do not claim live model success.
- If streaming is supported, test SSE framing, disconnects, cancellation, and partial responses. Do not promise streaming until verified.

### Data and security

- Authenticated user can read/write only their own data.
- Unauthenticated requests cannot access private memories/settings/history or privileged actions.
- Cross-user access tests fail closed.
- Rate limits work across independent Worker instances.
- CORS allows only configured origins and OPTIONS preflight works.
- No secrets appear in built JS, repository files, logs, or API errors.
- D1 import/export and backup/restore preserve record counts and content.

### Voice and desktop

- Browser mic permission, Urdu and English recognition, wake-word, silence submission, continuous listening and echo lockout work.
- TTS playback and fallback work on supported browsers.
- Electron tray, hotkeys, file opening, app launch/close, clipboard and WhatsApp handoff continue working locally.
- Worker deployment does not pretend to have access to the user's local filesystem or operating system.

### Build and deployment

- `npm ci` (when a lockfile is present and current) or the repository's documented install command succeeds.
- `npm test`, `npm run lint`, and `npm run build` pass.
- `wrangler dev` and staging deploy work with the actual configuration.
- Production static assets, SPA routes, API routes, D1/KV bindings and secret bindings are verified.

## 8. Cloudflare model and plan verification gate

Do not hard-code model IDs, daily neuron estimates, request limits, CPU limits, audio size limits, or pricing copied from an earlier chatbot answer.

Before implementation, verify from current official Cloudflare documentation and the user's actual dashboard:

1. Whether each candidate Workers AI model is currently available to this account and plan.
2. Whether model invocation requires a paid Workers plan under the current policy.
3. Urdu and Roman Urdu performance for text, speech-to-text and text-to-speech.
4. Supported input/output formats, streaming, maximum tokens, audio duration and payload limits.
5. Current Neurons pricing and free allocation, if any.
6. Worker CPU/duration/request limits and D1/KV/R2 quotas.

Candidate model names mentioned in prior planning (including GLM, Whisper, MeloTTS, Aura, M2M100, and Llama Guard) are **candidates only**, not approved dependencies. Confirm exact IDs and language support before writing production code.

## 9. Files expected during implementation

Initial scaffolding may add:

- `wrangler.jsonc`
- `src/worker/index.ts` (or another clearly documented Worker entry)
- `src/worker/env.ts`
- `src/worker/routes/health.ts`
- `src/worker/lib/errors.ts`
- `src/worker/lib/validation.ts`
- `src/worker/lib/cors.ts`
- `docs/CLOUDFLARE_MIGRATION.md`
- Worker-specific tests

Do not create duplicate route implementations without a clear ownership boundary. Prefer shared, runtime-neutral business logic for chat formatting, language detection, memory formatting, and validation.

## 10. Rules for the implementation agent

1. Work only on the migration branch until the user approves cutover.
2. Inspect the current file before editing it; do not overwrite whole files from assumptions.
3. Make small, reversible commits grouped by phase.
4. Never delete working features to make a build pass.
5. Never migrate Electron/OS operations into Worker code.
6. Never replace durable data with in-memory maps or fake local storage.
7. Never expose secrets or hard-code tokens.
8. Never report a feature as complete unless its real implementation and tests exist.
9. Run tests, type-check and production build after each meaningful change.
10. If a blocker requires a product decision (for example, whether a desktop-only feature may be unavailable in the browser), document it and preserve the existing behavior rather than silently removing it.
11. Keep a migration log with changed files, test results, known limitations and rollback instructions.
12. Do not deploy production or change DNS/custom domains without explicit user authorization.

## 11. Current status (verified 2026-11-05)

- Migration branch: `cloudflare-workers-migration`; latest audited code commit: `a7aedb5754f23535196207b0c6c1fc36f334acf0`.
- Original `main` branch: **unchanged** at `ef21d858038fe03a433a83fe08652eb11b224061`.
- GitHub CI on the latest audited code commit: **green**. Run `42035554870` passed Worker/application tests, Wrangler type generation, TypeScript, Vite production build and Wrangler dry-run.
- Workers AI model: `@cf/google/gemma-4-26b-a4b-it`; the model ID is listed in current Cloudflare documentation. Worker code invokes it through `env.AI.run()`. A model registry and authenticated live inference test route are now implemented.
- D1 staging database: schema verified directly; settings = 1 row and approved memories = 3 rows. Conversation, WhatsApp, usage, automation, rate-limit and backup tables currently have 0 rows.
- Existing Cloudflare Pages production deployment has an `AI` binding, but the preview environment has no AI binding and the Pages project has `uses_functions: false`. The Pages preview is static UI and does not execute this Worker API.
- Separate Wrangler Worker deployment: **not deployed**; Cloudflare currently has no standalone Worker script for this project.
- Chat: Workers AI only. Gemini environment fields are not used by this Worker.
- Voice: browser Web Speech recognition and browser speech synthesis. Urdu voice availability and pronunciation depend on the browser/device; there is no cloud TTS or Worker transcription endpoint.
- WhatsApp: real-number draft validation, explicit confirmation, cancellation and idempotent Meta dispatch are implemented. Real delivery still requires valid Meta Cloud API credentials.
- Authentication and D1-backed rate limiting: implemented and covered by tests; production staging runtime verification is pending.
- Production DNS, production Worker deployment and changes to `main`: **not performed**.

**Remaining external deployment gate:** configure the GitHub Actions secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `ZARA_AUTH_TOKEN`. The staging origin is preconfigured in the workflow as `https://zara-personal-pakistani-ai-voice-assistant-staging.aparacha4848774.workers.dev`; override the `ALLOWED_ORIGIN` Actions variable only if the Worker URL changes. Then manually run the staging workflow. Do not claim production readiness before live staging acceptance tests pass.

## 12. Staging resource and secret setup

A Cloudflare D1 database named `zara-assistant-staging` was created in APAC (database ID is in `wrangler.jsonc`). The schema was applied directly and the initial settings plus three active, approved owner memories were imported. No simulated WhatsApp/test records were imported.

Before staging Worker deployment, configure these secrets/variables in the Cloudflare Worker settings:

- Secret `ZARA_AUTH_TOKEN`: unique random owner key, minimum 32 characters. The sign-in screen uses this to issue an HttpOnly session cookie.
- No Gemini API key is required by the current Worker chat route; it uses the Workers AI binding directly.
- Secret `WHATSAPP_API_TOKEN`: only if WhatsApp Cloud API dispatch is enabled.
- Variable `WHATSAPP_PHONE_NUMBER_ID`: official Meta phone-number ID; not a secret.
- Variable `ALLOWED_ORIGIN`: exact staging origin(s), comma-separated. Never use wildcard origins with owner credentials.
- Optional variable `WORKERS_AI_MODEL=@cf/google/gemma-4-26b-a4b-it` to override the default model. Do not configure unused Gemini model IDs.

The Gemini model IDs above are listed as current stable model endpoints in the official Gemini API model catalogue. Urdu/Roman Urdu output and TTS must still pass listening/quality tests before production. Workers AI invocation may incur usage charges, including during local development.

The Cloudflare account currently has a D1 staging database but no deployed Worker, no KV namespace, and no production DNS changes. Do not claim production readiness until a staging Worker is deployed and end-to-end tests pass.


## 13. Staging deployment workflow

A manual-only workflow is available at `.github/workflows/deploy-staging.yml`. It deploys only the isolated Worker named `zara-personal-pakistani-ai-voice-assistant-staging` and does not configure production DNS or the main branch.

Before manually running it, add these GitHub Actions repository secrets:

- `CLOUDFLARE_API_TOKEN` — token with Workers Scripts edit, D1 read/write, and Worker secrets edit permissions for this account.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `ZARA_AUTH_TOKEN` — unique owner password, at least 32 characters.
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account ID.
- `ZARA_AUTH_TOKEN` — a unique random owner password (at least 32 characters).
- No Gemini key is required by the current Worker implementation; its chat route uses the Workers AI binding directly. Do not add an unused Gemini secret.
- `WHATSAPP_API_TOKEN` — optional; only needed for real WhatsApp Cloud API dispatch.

Optional GitHub Actions variable:
- `WHATSAPP_PHONE_NUMBER_ID` — official Meta Cloud API phone-number ID.
- `ALLOWED_ORIGIN` — optional override for the preconfigured staging Worker origin.

The workflow runs tests, TypeScript, Vite build and Wrangler dry-run before uploading secrets and deploying the staging Worker. Do not paste secret values into chat, commits, or issue comments. The deployment workflow has not been run because these external credentials are not present in the connected account session.

## 14. Current D1 staging row counts

Verified directly against the APAC staging database after the initial import:

| Table | Rows |
|---|---:|
| settings | 1 |
| memories | 3 |
| whatsapp_messages | 0 |
| automation_history | 0 |
| usage_logs | 0 |
| rate_limits | 0 |
| memory_backups | 0 |
| conversations | 0 |
| conversation_messages | 0 |

Only the settings record and three active, user-approved owner memories were imported. Synthetic WhatsApp test records and diagnostic/test usage/automation records were intentionally excluded. The original JSON source remains unchanged in the migration branch for rollback/reference.



## 15. Latest implementation details (re-audited 2026-11-05)

- The Worker protects chat, model registry/tests, TTS, memories, settings, WhatsApp, usage, automation and conversation-history routes behind owner authentication.
- The sign-in route issues a Secure, HttpOnly, SameSite=Strict cookie. The browser auth gate clears the legacy localStorage bearer token after detecting the Cloudflare Worker runtime.
- Login attempts are limited to five per five minutes per client IP. General API and AI requests use D1-backed rate windows.
- The chat handler invokes the configured Workers AI model through `env.AI.run()`; it does not call Gemini.
- `GET /api/models` returns the active Workers AI model and explicitly reports browser-based voice providers. `POST /api/models/test` performs a real provider inference and records the result in D1.
- The TTS route currently returns `audioBase64: null`; the client uses browser speech synthesis. There is no cloud TTS or server-side transcription endpoint in this Worker.
- Browser SpeechRecognition / webkitSpeechRecognition remains the speech-input implementation. Recognition requires a supported browser, HTTPS and microphone permission; Urdu/Roman Urdu accuracy must be tested on the target device.
- WhatsApp Center no longer uses hard-coded sample phone numbers. Voice-command drafts ask for a real E.164 number; the UI requires explicit confirmation, reports provider errors honestly, and supports cancellation without dispatch. Real sending requires Meta credentials.
- D1 stores settings, approved memories, conversation history, WhatsApp drafts, usage logs and automation history. Initial D1 import counts were checked directly.
- Usage Monitor now displays real D1 request records and approximate text token counts; it does not invent a dollar cost estimate. Check Cloudflare billing for actual Workers AI charges.
- The only Worker automation job is D1 memory backup. Local filesystem cleanup, host diagnostics, Electron, clipboard, process control and desktop actions remain local-only.
- The daily Cron Trigger is configured but cannot run until the Worker is deployed.

**Still not verified live:** standalone Worker deployment, live Workers AI inference from the deployed Worker, quota/plan behavior, Pakistani Urdu/Roman Urdu voice quality, microphone behavior on the staging hostname, real WhatsApp delivery, D1 backup restore and the complete staging acceptance suite.


## 16. CI verification checkpoint (2026-11-05)

The latest migration-branch CI run for commit `a7aedb5754f23535196207b0c6c1fc36f334acf0` is **completed successfully**:

- Run: https://github.com/aparacha4848774-blip/ZARA-Personal-Pakistani-AI-Voice-Assistant/actions/runs/42036330797
- **113 tests passed, 0 failed**, including WhatsApp cancellation, authenticated model registry and inference-route behavior with a mocked AI binding.
- Wrangler binding type generation passed.
- TypeScript check passed.
- Vite production build passed.
- Wrangler Worker dry-run passed.

This CI success verifies source/build/test behavior. It does **not** prove the production AI provider, browser microphone, voice pronunciation, WhatsApp delivery or deployed staging Worker works live.

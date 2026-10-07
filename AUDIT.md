# Current architecture and security audit

**Review date:** 2026-10-05  
**Scope:** static review of the current `client/`, `server/`, `database/`, manifests, lockfiles, tests, and documentation. `.env` files were excluded and not inspected. This is not a penetration test or a production-readiness certification.

## Architecture map and trust boundaries

| Area | Components | Boundary / responsibility |
|---|---|---|
| Browser client | React 19, TypeScript, Vite, React Router, `client/src/auth`, `components`, `lib`, `pages` | Untrusted browser input; sends same-origin `/api` requests with an HttpOnly cookie. React escapes rendered text. The active pages are in `PortalPage.tsx` and other page modules; `index.css` imports `legacy.css` as the current style layer. |
| API process | Express 5, `server/src/app.ts`, `http.ts`, `middleware/*` | CORS, request policy, body limits, security/cache headers, authentication, errors. The API does not serve the SPA in this workspace. |
| Authentication | `routes/auth.ts`, `middleware/auth.ts`, `middleware/cookies.ts` | Public password/Google/phone sign-in, registration and recovery; DB-backed opaque sessions. Doctor accounts are provisioned with an operator command. |
| Protected API | `routes/portal.ts`, `routes/booking.ts`, `routes/integrations.ts` | Portal routes require a session. Patient and doctor role checks and resource ownership filters are applied server-side. Public booking discovery is read-only; creating requests requires a patient session. |
| Persistence | PostgreSQL `pg` pool and ordered SQL in `database/migrations/` | Stores identities, sessions, appointments, consultations, reports, prescriptions, payment history, notifications, audit rows, and encrypted Calendar credentials. No ORM/repository layer is used; route modules currently contain both SQL and request/business-flow logic. |
| External providers | Google OAuth/Calendar, Twilio Verify, Resend | Provider credentials are server-side. OAuth state/nonce/PKCE protects Google flows; Calendar tokens are AES-GCM encrypted in the application before persistence. Provider calls now use a bounded timeout. |
| Operator/system operations | `scripts/migrate.ts`, `scripts/provision-doctor.ts` | Requires server/database access. Public registration only creates patient accounts; it cannot set a privileged role. |
| Build/deployment | Per-package `package.json` and lockfiles; no deployment manifest | The Vite development proxy is configurable. Production hosting/reverse-proxy security headers, TLS, secrets management, backups, and monitoring are deployment responsibilities and are not represented by this repository. |

### Endpoint classes

- **Public:** `/api/health`, `/api/ready`, active booking services/slots, auth registration/login/logout/recovery, phone verification, Google sign-in and OAuth callbacks.
- **Authenticated:** `/api/portal/*` starts with session authentication; each route checks patient/doctor role as applicable.
- **Patient-only:** booking creation, report upload/deletion, pending-request cancellation, and patient profile actions.
- **Doctor-only:** availability/services, consultation notes/completion, prescriptions, patient records, appointment decisions, and Calendar integration.
- **Shared patient/doctor reads:** appointment detail, prescriptions, payments history, and report reads; SQL constrains access to the current patient or a patient with a relationship to that doctor.
- **Admin/system:** an `ADMIN` enum role exists, but there is no admin portal/API. Migration and doctor-provisioning commands are privileged system operations.
- **Not implemented:** payment initiation/verification/refunds/webhooks and WhatsApp Business webhooks/delivery. Stale webhook-origin exceptions were removed from the request middleware; no payment or WhatsApp webhook route is mounted.

## Sensitive data and security controls

Sensitive data includes account/contact identifiers, date of birth, patient history, intake, notes/assessment, prescriptions, report bytes, OAuth/calendar tokens, and payment provider references. Data moves from the untrusted browser through the API to PostgreSQL or the relevant provider. Google Calendar receives the appointment invitation and Google Meet event; event text is deliberately generic and excludes symptoms and notes.

Controls present in the reviewed code:

- Passwords use bcrypt with cost 12 and a length/complexity policy. Session tokens are random opaque values; only SHA-256 hashes are stored. Cookies are HttpOnly, SameSite=Lax, and Secure in production. Password reset tokens are hashed, short-lived, single-use, and successful password reset invalidates stored sessions.
- Exact-origin CORS and explicit Origin/content-type checks cover `POST`, `PUT`, `PATCH`, and `DELETE`. CORS permits only configured origins/methods/headers. Response headers include no-store, nosniff, frame denial, referrer/permissions policies, and production HSTS. `X-Request-Id` is emitted for log correlation.
- SQL values are passed as parameters. Query shape interpolation is limited to fixed server-side branches/constants (for example, patient-vs-doctor query selection), not raw user values. Request bodies use explicit field allowlists rather than spreading arbitrary objects into updates.
- Patient and doctor access checks use authenticated database identity and scoped predicates. Report reads/deletes and patient detail have ownership/association checks. Resource identifiers are UUID-validated before relevant DB lookups.
- Medical reports require PDF/JPEG/PNG signatures, an 8 MB maximum, sanitized client filename metadata, a server-generated storage key, authenticated access, and audit records. Stored report downloads use no-store/nosniff and a safe content-disposition.
- React renders user-supplied text as text; a source scan found no `dangerouslySetInnerHTML`, `innerHTML`, `localStorage`, or `sessionStorage` usage. Google Meet links rendered by the client are restricted to HTTPS `meet.google.com`.
- Error responses are generic. Server diagnostics now log request ID, method, error type and a safe SQLSTATE where available rather than raw error messages. Provider failure logs avoid error-message/payload output.
- Authentication has route-specific brute-force limits; appointment requests, report uploads, and prescription issuance now also have tighter per-user/per-IP limits. These are still held in process memory.

## Threat model and findings

### Severity summary

- **Critical:** none confirmed by this static review.
- **High:** the product is not ready for real patient data while report malware scanning, verified encrypted backups/restores, retention/deletion controls, and operational privacy ownership remain unconfigured. Any credential fully exposed in the earlier environment screenshot must be revoked/rotated by the owner.
- **Medium:** process-local rate limits are insufficient for multi-instance deployment; the frontend host has no configured CSP/security headers in this repository; database-backed IDOR/workflow tests have not been run; live dependency advisories could not be retrieved.
- **Low:** two confirmed-unused artifacts were removed; no SQL injection, unsafe HTML sink, or currently mounted unsigned webhook route was identified.

| Threat | Current protection / observation | Risk and next action | Evidence/check |
|---|---|---|---|
| Patient changes a patient, appointment, report, or prescription ID (BOLA/IDOR) | Server checks authenticated role and scopes queries to patient ID, doctor ID, or an appointment relationship. UUIDs reduce casual enumeration but are not treated as authorization. | No access-control bypass was confirmed statically. Add DB-backed cross-account negative tests for every resource type before launch. | Manual SQL/route review; no real DB authorization tests in this environment. |
| SQL injection | SQL values are parameterized; no string-built user-value query was found in the reviewed routes. | Keep dynamic SQL identifiers/branches constant and server-controlled. Add injection-shaped input tests to protected route suites. | Static review of all `pool.query`/`client.query` call sites. |
| XSS / unsafe external URL | React escaping, no unsafe HTML sink found, external Meet URLs are HTTPS Google Meet only. | Configure a production CSP on the frontend host; Express does not serve the SPA. Keep future rich-text sanitized. | Static client source scan; client typecheck/build. |
| CSRF / cross-origin browser mutation | Lax cookie supports the top-level Google callback; all unsafe methods require an allowlisted Origin and content type. Webhook exemptions were removed because no signed webhook handler exists. | Reassess if cross-site frontend hosting or webhooks are introduced; signed webhooks need provider signature validation, not Origin trust. | Regression tests for missing Origin, PUT preflight, content type, and stale webhook path. |
| Login/OTP/reset brute force | Generic login/reset results, bcrypt dummy compare, per-route memory limits, Twilio Verify checks. | Limits do not coordinate across instances or survive restarts; replace with a shared store before horizontal scaling and monitor provider spend. Consider MFA/email verification before launch. | Existing HTTP limiter test; provider flows not tested against live accounts. |
| Malicious report upload / storage exhaustion | Signature and size checks, safe storage key, role/ownership checks; route limit is 8 uploads/hour per user+IP. | No malware scan/quarantine, aggregate storage quota, retention policy, or restore drill. Signature validation is not malware detection. Build a private storage/scanning plan and verify managed DB/backups are encrypted. | Upload logic review; live upload/download round-trip not run. |
| Leaked session or reset token | Tokens are random; database stores hashes; cookies are HttpOnly; reset invalidates all active sessions. | No MFA or user-visible session management; expired sessions are not proactively pruned. Add cleanup/monitoring and recovery controls as separate batch. | Source review; DB session lifecycle not exercised. |
| Provider outage / stalled request | Outbound Google, Twilio, and Resend fetch calls use a 15-second abort timeout. | Retries/idempotency and provider-specific timeouts need real integration tests. Calendar event creation may leave an external event if the app fails after provider success; stable IDs make retry recovery possible. | Unit regression verifies outbound abort behavior; no live provider calls. |
| Payment/webhook tampering | Payment list is read-only history; no order creation, payment verification, or webhook endpoint is implemented. | Do not accept real payments or mark an appointment paid. Implement official server-side signature checks, ownership validation, idempotency, and replay tests before enabling payments. | Route inventory confirmed no payment/webhook mutation route. |
| Secret leakage | `.gitignore` excludes `.env`/`.env.*`; a high-confidence source scan outside those files found no provider-key/private-key patterns. | `.env` contents were intentionally not examined; no Git metadata is present, so commit history is unavailable. A prior chat screenshot showed part of an environment file: revoke any real credential that was fully exposed. | Source scan; `.git status` reports this folder is not a Git repository. |
| Dependency vulnerabilities | Lockfiles exist; offline `npm audit` reported zero advisories in cached advisory data. | Live registry audit failed with network access denied. Rerun both audits in network-enabled CI before deployment. | Offline audit succeeded; online audit unavailable. |
| Denial of service through provider/upload/booking load | 64 KB JSON limit, 8 MB report limit, global API limit, route-specific booking/upload/prescription limits, provider timeouts. | In-memory limits can be bypassed by restarts/multiple instances; add shared storage, upload quotas, and operational resource monitoring. | TypeScript/build + 7 server tests; no load test. |

## Implemented in this review

1. Unsafe-method policy now includes `PUT` in CORS and Origin/content-type enforcement; the request-id header is included for safe correlation.
2. Removed unauthenticated Origin exemptions for payment/WhatsApp webhook paths that do not exist. A future webhook must have a signed, replay-safe provider handler.
3. Added a 15-second timeout wrapper and applied it to Google, Twilio, and Resend requests.
4. Added tighter process-local limits: 10 booking requests/hour, 8 report uploads/hour, and 20 prescriptions/hour per authenticated identity and source IP.
5. Added reusable UUID validation to booking service, appointment, patient, report, notification, and service identifiers before DB lookup.
6. Constrained client meeting links to HTTPS `meet.google.com` and reduced UI exception logs to error type only.
7. Removed `client/rewrite-portal.cjs` after confirming it was not referenced and that it rewrote the active portal page from an obsolete template. Removed unused `client/src/domain.ts` after confirming none of its exported types were referenced.
8. Added `SECURITY.md` with the current model, safe reporting guidance, secrets/dependency notes, and deployment checklist.

## Verification performed

- `npm.cmd --prefix server test`: server TypeScript build and 8 HTTP/unit tests passed, including Origin/PUT preflight policy, UUID validation, and outbound timeout.
- `npm.cmd --prefix client run typecheck`: passed.
- `npm.cmd --prefix client run build`: passed. Vite reports a 521.92 kB minified JavaScript chunk above its 500 kB advisory threshold; consider route-based code splitting in a separate frontend performance change.
- `npm.cmd --prefix server audit --offline` and `npm.cmd --prefix client audit --offline`: each reported 0 advisories from the available local advisory cache.
- Online `npm audit` could not reach the npm audit endpoint due network access denial.
- No configured PostgreSQL DB, provider accounts, or production deployment were used. Migrations, authorization boundaries, real uploads, bookings, OAuth, and Calendar operations remain unverified end-to-end.

## Remaining risks / intentionally not changed

- The application is **not production-ready for real patient care**. Payments and WhatsApp workflows do not exist; appointment email/SMS notifications are not delivered; no malware scanning, external private file store, or managed backup/restore plan is configured.
- Rate limits remain per-process. A shared Redis/database-backed limiter is a deployment architecture decision; do not deploy multiple API instances with the current limits as the sole abuse control.
- The API's headers do not set CSP on the SPA. No production static host/reverse-proxy config exists. Add and test frontend headers at the actual host.
- Reports are stored as PostgreSQL `bytea`. Whether database disks/backups are encrypted at rest and retained/deleted correctly depends on deployment configuration and has not been verified.
- No database-backed IDOR tests, booking-race tests, migration tests, file round-trip tests, live OAuth/Calendar tests, or provider/webhook security tests exist yet.
- Route modules contain SQL/business flow and `PortalPage.tsx` is large. No mass refactor was made because it would risk existing workflows without broader DB-backed coverage. Split modules incrementally with behavior tests rather than in a single rewrite.
- The screenshot credential exposure should be assessed by the owner. Rotate exposed credentials; calendar encryption-key rotation requires token re-encryption or reconnecting the Calendar account.
- The workspace is not a Git repository, so staged diffs, committed secret history, and remote configuration could not be inspected.

## Next safe batches

1. Add disposable-PostgreSQL tests for patient-vs-patient and doctor-vs-unrelated-patient access, then expand resource-specific route tests.
2. Select and configure shared rate limiting for the intended deployment; add storage quotas and operational monitoring.
3. Design private file scanning/storage, encryption, retention, backup, and restore before any clinical data migration.
4. Add focused Google/Twilio/Resend integration tests with mocked responses/timeouts and OAuth state cases; test Calendar event recovery against a test account.
5. Implement payments only with provider secrets and a verified/idempotent webhook design; do not infer payment from client state.
6. Add the actual frontend host's CSP/security headers and run current online dependency audits in CI.

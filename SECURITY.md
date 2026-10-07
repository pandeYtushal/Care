# Security guide

Atelier Care is a development-stage, single-practice telemedicine application. It is **not approved for real patient care** until the deployment and operational items in this document are complete.

## Security architecture

- The React client calls the Express API through same-origin `/api` routes and uses an HttpOnly session cookie. The client does not keep session tokens in local or session storage.
- The API authenticates sessions from SHA-256 hashes stored in PostgreSQL. A request's role and patient/doctor identifiers are loaded from the database, never accepted as authority from a client request.
- `/api/portal/*` requires authentication. Each route applies role and ownership filters for patient, doctor, or account resources. Doctor provisioning and schema migrations are operator-run server commands.
- Public endpoints are limited to liveness/readiness, active booking-service and time-slot discovery, account sign-in/registration/recovery, OTP verification, and OAuth callbacks. Creating a booking requires a patient session.
- Google Calendar credentials are encrypted before database storage. Google sign-in uses state, nonce, and PKCE. Provider HTTP calls now have a 15-second timeout.
- Patient reports are limited to PDF/JPEG/PNG, checked against file signatures, capped at 8 MB per file, stored in PostgreSQL, and retrieved only through authenticated access checks. Uploads and reads are audit logged.

## Sensitive data

Patient names and contact details, date of birth, medical history, symptoms, consultation notes, prescriptions, and reports are sensitive health data. Session/reset tokens, provider secrets, and Google refresh tokens are credentials. Payment records currently contain history/provider identifiers only; the app does not process payments.

Avoid putting any of these values in logs, support tickets, browser screenshots, public bug reports, or analytics. The API uses no-store cache headers. The code cannot establish whether the configured database provider encrypts disks/backups at rest; operators must verify that separately.

## Environment and secrets

- Keep real values in ignored server-side environment configuration or a deployment secrets manager. Never put server secrets in `VITE_*` variables.
- `.gitignore` excludes `.env` and `.env.*` while allowing `.env.example`. The current workspace is not a Git repository, so its commit history and already-published secrets could not be audited.
- A prior screenshot in the development conversation showed part of an environment file. If any real credential was fully visible, revoke/rotate it. Rotating `GOOGLE_TOKEN_ENCRYPTION_KEY` makes existing Calendar token ciphertext unreadable; reconnect calendars or plan a controlled token re-encryption before rotating it.
- Use unique high-entropy secrets per environment. Do not copy development database/provider credentials to production.

## Dependency hygiene

Lockfiles are present for `server/` and `client/`. An offline `npm audit` lookup reported zero advisories from the available local advisory data. An online registry audit could not connect in this environment, so that result is not a current registry verification. Run `npm audit` for both packages in CI or another network-enabled environment before deployment; update dependencies only with reviewed lockfile changes and passing builds/tests.

## Reporting a vulnerability

Report security issues privately to the project owner through the team's trusted private channel. Do not open a public issue containing exploit details, credentials, patient data, or screenshots of secrets. No dedicated security contact address is configured in this repository. Include a minimal reproduction using synthetic accounts/data and the affected route or file.

## Deployment checklist

- Serve the frontend and API over HTTPS, use a same-origin `/api` reverse proxy, configure exact production `APP_ORIGINS`, and set `TRUST_PROXY_HOPS` to the actual trusted proxy chain.
- Apply migrations through the deployment process. Use a least-privilege PostgreSQL role, TLS with certificate verification, encrypted backups, a tested restore plan, retention/deletion rules, and monitored storage capacity.
- Configure the frontend host/reverse proxy with an appropriate Content Security Policy and security headers; the Express API headers do not protect static frontend responses.
- Replace per-process in-memory rate limits with a shared store before running multiple API instances. Monitor OTP, login, booking, and upload abuse.
- Add malware scanning/quarantine and resource quotas for uploaded reports. Define access review and retention controls. Do not expose database/object storage URLs publicly.
- Confirm provider credentials and callback URLs in a production secret manager. Keep OAuth Calendar scopes minimal. Add a verified webhook implementation before enabling any payment or messaging provider.
- Configure structured log collection, alerting, request-ID correlation, secret/PHI redaction, incident response ownership, and audit-log retention.
- Run database-backed authorization/IDOR, migration, upload, and appointment concurrency tests with a disposable database. Perform a privacy/security review before any real patient use.

## Current limitations

There is no Razorpay payment-order/signature/webhook implementation, no WhatsApp Business integration, no appointment email/SMS delivery, no malware scanner, no managed private file-storage layer, no distributed rate limiter, and no frontend deployment configuration. Payment pages are history-only. Do not represent these capabilities as enabled, and do not use real patient data until the remaining controls are in place.

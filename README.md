# Atelier Care

Atelier Care is an early private-practice telemedicine platform. The repository includes patient and doctor sign-in, role-gated portals, PostgreSQL-backed overview/list/profile pages, and doctor weekly availability management.

**This is not production-ready and must not be used for real patient care yet.** Patients can submit appointment requests, upload/download PDF/JPG/PNG reports, and view patient-facing consultation summaries and prescriptions. Doctors can manage services and availability, respond to requests, review patient history, document consultations, issue prescriptions, and connect Google Calendar for Meet events. In-app notifications are recorded. Online payments, prescription PDF generation, email/SMS/WhatsApp delivery, malware scanning, and managed encrypted file storage/backups are not configured. Reports are stored as binary data in PostgreSQL; secure database backups, privacy, access, retention, and deployment controls must be reviewed before real patient use. Real doctor qualifications, fees, specialties, awards, reviews, and outcomes have not been supplied and are not invented in the public content.

## Architecture

- `client/`: React 19, TypeScript, Vite, React Router, Lucide. Uses relative `/api` requests with HttpOnly cookies; configure the development proxy with `VITE_API_PROXY_TARGET`.
- `server/`: Express 5, TypeScript, PostgreSQL (`pg`), bcrypt. Routes and middleware are split by concern. Patient self-registration always assigns `PATIENT`; it cannot create doctor/admin accounts.
- Optional Google OpenID Connect sign-in and Twilio Verify phone sign-in are available when configured on the server. Password recovery uses Resend when configured. Phone numbers must be verified before use.
- `database/migrations/`: ordered SQL migrations for the domain schema, hashed server-side sessions, and cross-table consistency/webhook idempotency groundwork.
- `AUDIT.md`: current architecture map, threat model, findings, fixes, verification, and remaining risks.
- `SECURITY.md`: security architecture, secrets/dependency guidance, reporting, and deployment checklist.

## Prerequisites

- Node.js 22 LTS recommended (the client uses Vite 8).
- npm.
- PostgreSQL 15+ with permission to create `pgcrypto` and `btree_gist` extensions for migration 001.

## Local setup

From the project root, install both applications:

```sh
npm --prefix server install
npm --prefix client install
```

Copy `server/.env.example` to `server/.env` and set a real local PostgreSQL URL and port. Copy `client/.env.example` to `client/.env`; set its proxy target if your API runs on a different local address. `.env` files are ignored by Git.

Create the development database, then apply migrations:

```sh
npm --prefix server run db:migrate
```

Start the API and frontend in separate terminals:

```sh
npm --prefix server run dev
npm --prefix client run dev
```

### Google and phone sign-in

After upgrading, apply the latest database migration with `npm --prefix server run db:migrate`.

Password recovery uses the Resend email API. Configure `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL` in `server/.env` (do not commit that file), then run `npm --prefix server run db:migrate` to add reset-token storage and restart the API. Reset links expire after 30 minutes and can only be used once. Without the mail settings, the app cannot deliver password reset links.

For Google, configure an OAuth web client and set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `server/.env`. Register the exact callback URL with Google. Locally it should use the frontend's origin and Vite's `/api` proxy (for example, `http://localhost:5173/api/auth/google/callback`); in production it should use the public app origin and reverse proxy.

For Google Calendar/Meet, enabling the Calendar API is only one step. Add a **second authorized redirect URI** to that OAuth client: `http://localhost:5173/api/integrations/google/callback` (use your production app origin in production), set `GOOGLE_CALENDAR_REDIRECT_URI` to that exact URL, and set `GOOGLE_TOKEN_ENCRYPTION_KEY` to a randomly generated 32-byte secret. In PowerShell, generate one with `[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`. Keep it stable and private: changing it makes saved refresh tokens unreadable. If the OAuth consent screen is in Testing, add the doctor's Google account as a test user. Apply all migrations using `npm --prefix server run db:migrate`, restart the API, then sign in as the doctor and use **Integrations → Connect Google Calendar**. The app asks for Calendar event access only for the doctor connection, stores OAuth tokens encrypted server-side, refreshes access tokens, and creates Google Meet events when a doctor accepts a Meet request. Google event titles and descriptions intentionally omit patient symptoms and notes.

For phone sign-in, configure a Twilio Verify service and set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` in `server/.env`. Enter numbers in E.164 format (`+` followed by country code and number). A new phone user can create a patient account after SMS verification by supplying a name and email. Existing signed-in patients and doctors can verify/link a number under **Account** in their portal. A doctor phone can also be supplied as `DOCTOR_PHONE` during controlled provisioning. Never expose provider credentials in the client or commit them.

The server validates required environment variables at startup and fails clearly when they are missing. `GET /api/health` is liveness; `GET /api/ready` checks PostgreSQL. The API does not automatically run migrations on production startup.

## Environment variables

See `server/.env.example` for `NODE_ENV`, `PORT`, `TRUST_PROXY_HOPS`, `DATABASE_URL`, `SESSION_TTL_HOURS`, and `APP_ORIGINS`, plus integration placeholders. Set `APP_ORIGINS` to a comma-separated exact origin allowlist. Production requires this value. Set `TRUST_PROXY_HOPS` to match the exact number of trusted reverse proxies in front of the server; the default is zero. The client expects same-origin `/api` routing in production; configure the frontend host/reverse proxy to route `/api/*` to the API service. The development proxy target is separate and not compiled into the production frontend.

Never commit real keys or put provider secrets in `VITE_*` variables. Do not enable an integration until its provider credentials, callback/webhook URLs, consent, and failure handling have been configured.

## Current authentication behavior

- Patient registration hashes passwords with bcrypt and creates a patient profile in a transaction.
- Session tokens are random opaque values; only SHA-256 hashes are stored in PostgreSQL. The browser cookie is HttpOnly, SameSite=Lax (required for the top-level Google OAuth callback), path-scoped, and Secure in production. State-changing API requests require an allowlisted Origin and supported content type.
- Login errors are generic, session lookups reject disabled/expired accounts, logout revokes the current session, and role checks run on the server.
- A one-time doctor provisioning command is available for an operator with server/database access. Set `DOCTOR_EMAIL`, `DOCTOR_NAME`, and `DOCTOR_PASSWORD` in the ignored server environment, then run `npm --prefix server run db:provision-doctor`. It refuses to promote an existing account and records an audit event. Do not put real credentials in a committed file.
- Password recovery is available by email when Resend is configured. Email verification, MFA, and user-visible session management are not implemented. Never expose a public role selector.
- The small in-memory rate limiter is per process. Before running multiple API instances, replace it with a shared store (for example Redis) and tune limits based on deployment traffic.

## Database and migrations

Migrations are applied in filename order and tracked in `schema_migrations`. Each migration is transactionally applied under a PostgreSQL advisory lock. Back up the database before production migrations. The initial schema includes domain entities and an overlap exclusion constraint; later migrations add user sessions, consistency constraints, and webhook idempotency records. No development or production seed data is included.

The schema still needs transaction-backed application services for slot generation/reservation, payment reconciliation, report access, and clinical records. Exclusion constraints are a final defense; application code must validate availability and translate conflicts into a safe response.

## API routes currently implemented

```text
GET  /api/health
GET  /api/ready
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
GET  /api/portal/overview
GET  /api/portal/appointments
GET  /api/portal/records
GET  /api/portal/prescriptions
GET  /api/portal/patients
GET  /api/portal/profile
PATCH /api/portal/profile
GET  /api/portal/availability
PUT  /api/portal/availability
GET  /api/portal/services
POST /api/portal/services
PATCH /api/portal/services/:id
GET  /api/booking/services
GET  /api/booking/slots?serviceId=…&date=YYYY-MM-DD
POST /api/booking/appointments
PATCH /api/portal/appointments/:id/status
POST /api/portal/appointments/:id/cancel-request
GET  /api/portal/appointments/:id
PUT  /api/portal/appointments/:id/consultation
POST /api/portal/appointments/:id/prescriptions
GET  /api/portal/patients/:id
POST /api/portal/records
GET  /api/portal/records/:id/download
DELETE /api/portal/records/:id
GET  /api/portal/notifications
PATCH /api/portal/notifications/:id/read
GET  /api/portal/payments
GET  /api/integrations/google/status
GET  /api/integrations/google/connect
GET  /api/integrations/google/callback
DELETE /api/integrations/google
```

Mutating browser requests require an allowlisted `Origin` and supported content type. The API applies exact-origin CORS, request-size limits, security headers, safe error responses, and basic per-process rate limits. Portal endpoints enforce patient/doctor role and ownership filters. Medical downloads are authenticated, attachment-only, and audited. Small file data is stored in PostgreSQL; managed encrypted backups, malware scanning, retention, and restore drills remain required before real clinical use.

## Checks

```sh
npm --prefix client run typecheck
npm --prefix client run build
npm --prefix server run build
```

`npm --prefix server test` exercises HTTP security middleware without a database. Authentication persistence, authorization, appointment concurrency, payment webhook, file upload/download, and migration integration tests still need to be written and run against a disposable PostgreSQL database.

## Provider and deployment setup still required

- **Razorpay:** server-side order creation, checkout signature verification, webhook signature validation, replay/idempotency, refund reconciliation, and appointment confirmation are not implemented. Never trust client payment status.
- **Google Calendar/Meet:** doctor OAuth connection, encrypted server-side tokens, refresh handling, and Meet event creation for accepted appointments are implemented. Rescheduling and event deletion are still missing. Calendar setup must be tested with the doctor's Google Cloud client, callback URI, Calendar API enablement, OAuth consent/test-user settings, and token encryption key.
- **WhatsApp Business, email, SMS:** no provider adapter, templates, consent/preferences, delivery tracking, or reminders are implemented.
- **Medical files:** authenticated PDF/JPG/PNG uploads and downloads are implemented with 8 MB limit and file-signature checks; binary data is stored in PostgreSQL. Malware scanning, managed file storage, encryption/backup policy, retention, and restore drills are not implemented.
- **Production:** provide managed PostgreSQL, HTTPS, exact frontend origins, same-origin `/api` proxy, secrets management, backups/restore drills, monitoring, migrations, OAuth callback domains, payment webhooks, and private object storage. No Vercel/Railway/Render/AWS/Supabase deployment config currently exists.

The server currently uses local validation helpers and a per-process in-memory request limiter. `helmet`, `zod`, and `express-rate-limit` were not available in the offline package cache, and the registry was unreachable; they were not added as unverified dependencies. The current API headers/origin checks and input checks are explicit, but production should use maintained shared rate limiting and schema validation packages once package installation is available.

Before any real patient use, complete a security and privacy review against applicable Indian privacy/health-data requirements and the clinician's obligations. Confirm backups, access auditing, retention/deletion, incident response, monitoring, and operational ownership.

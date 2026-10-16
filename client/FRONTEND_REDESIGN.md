# Frontend redesign inventory and acceptance

This inventory covers the React routes found in `src/App.tsx`. Route aliases that render the same page are listed separately so they are not mistaken for separate screen implementations. No route is considered redesigned just because a shared style changed.

## Route inventory (source-verified)

The paths below are read from `src/App.tsx`; `PortalSection` dispatch and each page's API calls are read from the current client source. Route count: 39 literal route patterns and one wildcard. Parameters are shown in braces. Routes that intentionally share a component are identified as aliases; they are not counted as unique designs.

| Route | Rendered screen / purpose | Data and meaningful states | Responsive / UX acceptance |
| --- | --- | --- | --- |
| `/` | Public landing page | Public content; scroll-linked hero presentation | Header/drawer and section anchors work at phone/tablet; honor reduced motion |
| `/about` | Static about page | Static supplied copy | Editorial text measure, navigation, footer; no invented credentials |
| `/philosophy` | Static philosophy page | Static supplied copy | Same static-page system, distinct content |
| `/services` | Landing-page services anchor alias | Same LandingPage, scrolls to `#services` | Alias is intentional; target must not hide under sticky header |
| `/consultations` | Landing-page consultation anchor alias | Same LandingPage, scrolls to `#consultations` | Alias is intentional; target must not hide under sticky header |
| `/contact` | Landing-page contact anchor alias | Same LandingPage, scrolls to `#contact` | Alias is intentional; target must not hide under sticky header |
| `/faq` | Landing-page FAQ anchor alias | Same LandingPage, scrolls to `#faq` | Alias is intentional; target must not hide under sticky header |
| `/privacy` | Static privacy page | Supplied legal text | Readable long-form page; wording needs owner/legal approval |
| `/terms` | Static terms page | Supplied legal text | Readable long-form page; wording needs owner/legal approval |
| `/login` | Shared AuthPage, login mode | `/auth/me`, email/password, phone OTP, Google OAuth; validation, provider configuration, loading/error | Auth card stacks to one column on mobile; labels, focus, OTP and errors remain usable |
| `/register` | Shared AuthPage, registration mode | Registration API, phone OTP, Google OAuth; validation/loading/error | Same auth layout; doctor workspace query is not a public role picker |
| `/forgot-password` | PasswordRecoveryPage request mode | Reset-request API; generic result/error/loading | One-column accessible form; never reveal whether an email exists |
| `/reset-password` | PasswordRecoveryPage token mode | Token/password reset API; invalid/expired/success/error states | Long token and password form work on narrow screens |
| `/patient` | Patient overview | `/portal/overview`; next visit, appointments, reports, prescriptions; loading/error/empty | Patient-first hierarchy and booking action; no horizontal overflow |
| `/patient/account` | AccountPage | Phone-link send/verify APIs; idle/sent/busy/error/success | Phone and code fields fit mobile; verification state is clear |
| `/patient/profile` | ProfilePage in patient mode | `/portal/profile`, PATCH `/portal/profile`; form/loading/error/saved | Profile fields stack; save/validation feedback visible |
| `/patient/appointments` | AppointmentRows patient list | `/portal/appointments`; filters, cancel request, confirm dialog, empty/error | Dense list adapts to cards; all actions keyboard/touch accessible |
| `/patient/appointments/{id}` | AppointmentDetail patient mode | `/portal/appointments/:id`; files, visit summary, prescription, safe active Meet link; loading/error/not found | Clinical details prioritized; completed/cancelled visit hides join link |
| `/patient/book` | BookingPage | Services, slots, appointment create, optional report upload; each wizard step, no slots, upload retry, confirmation/error | Wizard stepper and controls adapt to phone; no forced small-screen calendar/table |
| `/patient/history` | CareHistoryPage | Appointments and records from portal data; empty/error/loading | Timeline becomes single-column; chronology remains clear |
| `/patient/reports` | PatientReportsPage | `/portal/records`, upload/download/delete; empty/error/upload validation/success | File chooser, metadata, and list become mobile-friendly; sensitive file access remains authenticated |
| `/patient/prescriptions` | PrescriptionList patient view | `/portal/prescriptions`; empty/error/loading | Medicine instructions readable without horizontal page scroll |
| `/patient/payments` | PaymentsPage patient mode | `/portal/payments`; history-only, empty/error/loading | No unsupported checkout/processing implication |
| `/patient/notifications` | NotificationsPage patient mode | `/portal/notifications`, mark-read; empty/error/action-error/unread | Notification actions remain reachable at phone widths |
| `/doctor` | Clinician overview | `/portal/overview`; requests, next visit, agenda, summary; loading/error/empty | High-signal triage and schedule; compact without losing actions |
| `/doctor/account` | AccountPage | Same phone-link workflow as patient account | Same form acceptance, clinician identity retained |
| `/doctor/profile` | ProfilePage in doctor mode | `/portal/profile`, PATCH; practice profile form/loading/error/saved | Practice fields stack; save state visible |
| `/doctor/calendar` | CalendarPage | `/portal/appointments`; day/week, navigation, appointment details | Day/week controls and time grid adapt; scroll is contained on small screens |
| `/doctor/appointments` | AppointmentRows doctor list | `/portal/appointments`; status filtering, accept/decline/cancel dialogs, errors | Triage actions stay attached to the relevant request |
| `/doctor/appointments/{id}` | AppointmentDetail doctor mode | Appointment context, patient intake/records, consultation save/complete, prescriptions; loading/error/success | Patient context and clinical form sections remain scannable on narrow screens |
| `/doctor/patients` | PatientList directory | `/portal/patients`; search, empty/error/loading | Table transforms or scrolls within its container; columns stay aligned |
| `/doctor/patients/{id}` | PatientDetail | `/portal/patients/:id`; demographics, visits, patient-uploaded reports, prescriptions; loading/error | Record sections have clear labels and responsive details |
| `/doctor/availability` | AvailabilityPage | GET/PUT `/portal/availability`; edit/add/remove/save/loading/error/success | Weekly rules and time inputs become stacked rows on phone |
| `/doctor/services` | ServicesPage | GET/POST/PATCH `/portal/services`; create/activate/deactivate/error/empty | Service editor and method toggles work with touch/keyboard |
| `/doctor/integrations` | IntegrationsPage | Google status/connect/callback/disconnect; unconfigured/disconnected/connected/error | State and next steps are explicit; no false connected status |
| `/doctor/reports` | Redirect alias | `<Navigate replace>` to `/doctor/patients` | Verify redirected destination, not a separate report page |
| `/doctor/prescriptions` | PrescriptionList doctor view | `/portal/prescriptions`; history-only, empty/error/loading | No unsupported editing capability implied |
| `/doctor/payments` | PaymentsPage doctor mode | `/portal/payments`; history-only, empty/error/loading | No payment processing implied |
| `/doctor/notifications` | NotificationsPage doctor mode | `/portal/notifications`, mark-read; empty/error/action-error | Actions work at phone widths |
| `*` | NotFound | No API; return-to-practice action | Handles long/unknown paths and remains readable on phone |

`AppErrorBoundary` is a global recovery screen rather than a route; `RouteLoading` is the lazy-route pending state. `AuthGate` and `RoleGate` are access/redirect states around the patient and doctor trees, not standalone routes. Role-gated runtime acceptance requires test accounts for both roles.

### Shared architecture and implementation order

- Keep React Router path declarations and server/API contracts as the behavior source of truth. Make page composition distinct by public/patient/doctor context rather than changing data semantics.
- Continue using the existing Tailwind v4 token layer for spacing/color/type utilities; use scoped semantic CSS for complex widgets (calendar, booking wizard, clinical record) so narrow-screen behavior is explicit.
- Extract the 3,800+ line `PortalPage.tsx` in low-risk domain batches only after identifying component dependencies: first navigation/shell and shared states; then patient booking/records; then clinician appointments/records; finally settings and schedule widgets. Each move should be behavior-preserving and typechecked before the next.
- Batch A: exact route/state inventory and design plan (this document and `REDESIGN_AUDIT.md`).
- Batch B: shared light visual primitives, responsive navigation and focus behavior.
- Batch C: public/auth/legal surfaces and direct-entry/anchor behavior.
- Batch D: patient overview, booking, appointments, reports and prescriptions.
- Batch E: clinician triage, calendar, patient chart, consultation and prescription workflows.
- Batch F: profile/account, availability, services, integrations, notifications, payment history and error/recovery states.
- Batch G: acceptance matrix across 1440, 1280, 1024, 768, 480, 390 and 360px, both roles, keyboard and reduced motion; record verified routes one by one.

There are 39 explicit URL patterns plus the wildcard. The codebase has no admin UI routes, separate onboarding or verification pages, reschedule page, standalone meeting room, refund page, support center, report-detail route, or payment-detail route. Those are not represented as working features in this redesign without corresponding frontend/API behavior.

## Design and responsive acceptance

- Public, authentication, patient, and doctor surfaces share design tokens but have distinct navigation, density, and task focus.
- Tailwind v4 remains active through the Vite plugin and `@theme` tokens. Existing utility markup is retained; semantic CSS is used for the bespoke editorial landing page and complex portal widgets such as calendars, clinical records, and booking steps.
- Layouts are usable at 1440, 1280, 1024, 768, 480, 390, and 360 CSS pixels.
- No horizontal page overflow; tables and dense details become readable lists/cards or horizontally contained data views on narrow screens.
- Touch targets remain at least 44 CSS pixels; fixed navigation respects safe areas and never covers the primary action or form submit.
- Forms, async actions, data pages, integrations, and appointment workflows have loading, error/retry, empty, success, and validation feedback where applicable.
- Keyboard focus, labels, semantic headings, status announcements, and reduced-motion behavior remain intact.
- Existing API endpoints, field names, authentication, and authorization are preserved.

## Implementation batches

- [x] Baseline route, shared-component, auth, theme, and responsive audit in `REDESIGN_AUDIT.md`.
- [x] Batch 1: warm light theme tokens, one sans/serif pairing, landing stylesheet, public footer, and legal-page presentation.
- [x] Batch 2: align sign-in/registration markup to shared auth styles; restore consistent mobile account styling.
- [x] Batch 3: replace the black patient/clinician shell with one role-aware light shell and responsive accessible drawer.
- [x] Batch 4: repair dashboard metric grid and style appointment filters, appointments, patient directory, and calendar surfaces.
- [ ] Batch 5: inspect remaining booking, clinical record, service, availability, notification, billing, and profile states at all target widths; patient-role runtime pass still requires a patient session.

### Expanded redesign progress (2026-10-16)

- [x] Reconciled the requested full-redesign brief against `App.tsx`, guards, auth context, page dispatch, and API call sites; corrected this inventory to 39 literal patterns plus the wildcard.
- [x] Added a route-by-route purpose, API/state, alias/redirect, and responsive acceptance matrix above, plus a low-risk extraction order for the large portal module.
- [x] Kept clinician mobile navigation light and added sticky-header offset for direct public-section links.
- [x] Re-ran client typecheck and production build after the current CSS/document batch; both pass.
- [ ] Remaining work is substantial: complete each patient and clinician route-family redesign and direct-entry states, extract `PortalPage.tsx` in domain batches, and perform the listed viewport/role/workflow matrix. Do not interpret prior shared styling or this route map as complete acceptance.

### Implementation Batch 1: design foundation and shared shell (2026-10-16)

- [x] Consolidated the practice palette, typography, status colors, control/card radii, spacing, responsive breakpoints, and elevation tokens in the existing Tailwind v4 `@theme`; removed duplicate landing-page palette aliases and migrated repeated palette values in the shared styles to semantic tokens.
- [x] Kept the current public header/footer and the role-specific patient/clinician drawer architecture; the public section scroll offset remains in place.
- [x] Hid the closed portal drawer from layout/focus/accessibility at mobile breakpoints using `visibility`, retained the existing open-state focus trap and Escape behavior, and removed the unused 78px mobile bottom-navigation reservation. No bottom bar was added because the portal currently renders a drawer.
- [x] Standardized existing shared CSS primitives for buttons, inputs, labels, cards, dialogs, tables, status badges, and error/success/empty states without changing route, API, or feature behavior.
- [x] Checked palette contrast ratios against the actual light surfaces: muted text `#5E6A62` is at least 4.87:1 on the surface/sub-surface; the revised clay accent `#97533D` is at least 5.00:1 on those surfaces; primary action `#486C56` is at least 5.09:1 on them. Semantic status foregrounds also exceed 4.5:1 against their paired backgrounds.
- [x] Client typecheck and production build pass; `git diff --check` reports no whitespace errors.
- [ ] A complete visual viewport pass at the seven documented widths was not completed in this batch. The existing browser was on a sign-in page with an in-progress field, and the UI automation detected user input and blocked navigation. No further browser interaction was attempted. Authenticated patient/clinician visual and workflow acceptance remains outstanding.

## Acceptance evidence (2026-10-06)

- Final `npm run typecheck` and `npm run build` both passed.
- Live visual review in the available clinician session covered the public landing page, clinician overview, calendar, patient directory, integrations, availability, consultation services, and account across desktop and narrow browser viewports. The dashboard metrics, appointment filters, and small-tablet sidebar breakpoint were corrected after review.
- Patient runtime routes, booking uploads, patient record details, and the unauthenticated sign-in screen were not fully exercised: the available browser session is a clinician account and role guards do not permit viewing patient content. Patient route source and workflow hooks were preserved; this is not equivalent to an end-to-end patient acceptance pass.
- The responsive portal drawer is styled for narrow screens and includes Escape, focus trapping, and focus restoration behavior. A complete keyboard pass and 320/360/390/768/1024px route matrix remain outstanding.
- Privacy/terms wording was not substantively edited; it still needs review and approval from the practice owner. No server, API contract, database, authentication, or appointment workflow behavior was changed.

### Implementation Batch 2: public website and authentication (2026-10-16)

- [x] Replaced the dashboard-like hero illustration with a quiet, original appointment-request sequence; removed fabricated portal metrics and nonfunctional mock controls.
- [x] Replaced unsupported public copy about rushed visits, guaranteed continuity, and being “unhurried” with statements tied to current booking behavior. Public consultation options now load from `GET /api/booking/services`, including loading, empty, error/retry, duration, fee (when provided), and method states.
- [x] Pointed consultation CTAs at the real `/patient/book` route so the existing patient role guard preserves the requested destination through sign-in/registration. Existing paths and anchor aliases remain unchanged; active navigation, reduced-motion-aware anchor scrolling, and FAQ native disclosure behavior remain intact.
- [x] Refined the shared public header, responsive menu, editorial/informational page layouts, and footer using the Batch 1 theme tokens. The original privacy/terms paragraphs were not edited; those routes no longer show a misleading account-creation CTA.
- [x] Reworked authentication/recovery styling with responsive form sizing, visible keyboard focus, full-width controls, and compact mobile composition. Preserved email/password, patient registration, phone OTP, Google OAuth, reset endpoints, cookies, API payloads, and role-based destination behavior. Added Enter-key handling so phone sign-in sends its first code instead of submitting an empty verification.
- [x] Corrected the auth-context failure distinction: only API 401/403 now means confirmed signed-out; network/server failures render a retry state. Session retry is also available on login so a transient `/auth/me` outage is not presented as logout.
- [x] Client typecheck and production build pass; `git diff --check` has no whitespace errors. The client package has no configured lint or test script.
- [ ] Browser visual acceptance at 1440, 1280, 1024, 768, 480, 390, and 360px was not performed in this batch. Browser interaction was unavailable because the active window contained user-entered content and the automation safeguard refused navigation. Direct route, OAuth provider, phone provider, and session behavior were checked from source/API contracts only; they were not exercised end-to-end.
- [ ] Dr. Kiran must review the current About and Philosophy copy (it contains unverified practice/privacy claims) and review the existing Privacy and Terms copy for legal and practice accuracy. Qualifications, specialty, real contact details, and approved biography were not supplied and were not invented.
- [ ] Patient/clinician portal redesign and role-specific acceptance remain the next product batch; no portal workflows were intentionally changed here.

### Implementation Batch 3: patient portal (2026-10-16)

Source-verified patient routes and capabilities:

- `/patient`: next requested/confirmed visit, real appointment/report/prescription counts, upcoming visit list, and booking action; API loading/error handling is present.
- `/patient/book`: service/method selection, server-provided availability, concern intake, optional PDF/JPG/PNG upload (8 MB limit), review, request creation, slot-conflict recovery, and appointment detail link.
- `/patient/appointments` and `/patient/appointments/:id`: status-filtered visits, details, pending request cancellation with confirmation, authenticated report viewing, visit summary/prescription, and active Google Meet link when supplied by the API.
- `/patient/history`: appointments, patient-uploaded reports, and prescriptions from three existing endpoints.
- `/patient/reports`: report metadata, search/category filters, upload and authenticated view; server also exposes delete, but the current client has no delete control.
- `/patient/prescriptions`, `/patient/payments`, `/patient/notifications`: real prescriptions and medicine fields, payment history only (no online checkout), and in-app notification read state.
- `/patient/profile`, `/patient/account`: supported profile fields and verified phone linking through send/verify code APIs. Account does not offer password changes or session management.

Implementation completed in this batch:

- [x] Grouped patient navigation into care, records, activity, and account; preserved the existing accessible drawer, sign-out, role guard, and route URLs.
- [x] Refined portal surfaces and patient dashboard hierarchy with the existing Figtree/Newsreader design system; compacted the appointment feature area and added a real account-name greeting.
- [x] Applied consistent responsive styles to booking, appointment, history, report, prescription, notification, payment, profile, and account screens.
- [x] Booking copy now reflects the API-provided provider and practice timezone, and describes WhatsApp/Meet methods as requests pending practice confirmation. No API payloads or appointment rules changed.
- [x] Care history keeps successful data sources visible if another request fails, distinguishes partial from total failure, and offers retry.
- [x] Appointment history sorts past visits newest-first; notification read actions disable while saving; phone linking offers a resend action.
- [x] Payment history explicitly states that online payment is not available; no payment flow or fake records were added.
- [x] Client typecheck, production build, and `git diff --check` pass.
- [ ] Authenticated patient runtime review and visual verification at 1440, 1280, 1024, 768, 480, 390, and 360px remain outstanding. No browser tabs or logged-in patient session were available in this turn; source and build checks do not replace that acceptance pass.
- [ ] `PortalPage.tsx` remains a large shared patient/clinician module. Any extraction should be a later, behavior-preserving component batch after the UI changes are reviewed; this batch did not alter its API boundaries or role guards.


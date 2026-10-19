# Frontend redesign inventory and acceptance

This inventory covers the React routes found in `src/App.tsx`. Route aliases that render the same page are listed separately so they are not mistaken for separate screen implementations. The route ownership below reflects the current feature-split source. Dated implementation batches are a history of work at that point in time; later batches may supersede unchecked items in earlier entries.

## Route inventory (source-verified)

The paths, route components, and page-level API call sites below are read from the current client source. Route count: 39 literal route patterns and one wildcard. Parameters are shown in braces. Routes that intentionally share a component are identified as aliases; they are not counted as unique designs.

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
| `/patient/appointments` | `PatientAppointmentsPage` | `/portal/appointments`; filters, cancel request, confirm dialog, empty/error | Dense list adapts to cards; all actions keyboard/touch accessible |
| `/patient/appointments/{id}` | AppointmentDetail patient mode | `/portal/appointments/:id`; files, visit summary, prescription, safe active Meet link; loading/error/not found | Clinical details prioritized; completed/cancelled visit hides join link |
| `/patient/book` | BookingPage | Services, slots, appointment create, optional report upload; each wizard step, no slots, upload retry, confirmation/error | Wizard stepper and controls adapt to phone; no forced small-screen calendar/table |
| `/patient/history` | CareHistoryPage | Appointments and records from portal data; empty/error/loading | Timeline becomes single-column; chronology remains clear |
| `/patient/reports` | PatientReportsPage | `/portal/records`, upload/download/delete; empty/error/upload validation/success | File chooser, metadata, and list become mobile-friendly; sensitive file access remains authenticated |
| `/patient/prescriptions` | `PatientPrescriptionsPage` | `/portal/prescriptions`; empty/error/loading | Medicine instructions readable without horizontal page scroll |
| `/patient/payments` | PaymentsPage patient mode | `/portal/payments`; history-only, empty/error/loading | No unsupported checkout/processing implication |
| `/patient/notifications` | NotificationsPage patient mode | `/portal/notifications`, mark-read; empty/error/action-error/unread | Notification actions remain reachable at phone widths |
| `/doctor` | Clinician overview | `/portal/overview`; requests, next visit, agenda, summary; loading/error/empty | High-signal triage and schedule; compact without losing actions |
| `/doctor/account` | AccountPage | Same phone-link workflow as patient account | Same form acceptance, clinician identity retained |
| `/doctor/profile` | ProfilePage in doctor mode | `/portal/profile`, PATCH; practice profile form/loading/error/saved | Practice fields stack; save state visible |
| `/doctor/calendar` | `DoctorCalendarPage` | `/portal/appointments`; day/week/month, navigation, appointment details | Calendar controls and grid adapt; scroll is contained on small screens |
| `/doctor/appointments` | `DoctorAppointmentsPage` | `/portal/appointments`; status filtering, accept/decline/cancel dialogs, errors | Triage actions stay attached to the relevant request |
| `/doctor/appointments/{id}` | AppointmentDetail doctor mode | Appointment context, patient intake/records, consultation save/complete, prescriptions; loading/error/success | Patient context and clinical form sections remain scannable on narrow screens |
| `/doctor/patients` | `DoctorPatientsPage` | `/portal/patients`; search, empty/error/loading | Table transforms or scrolls within its container; columns stay aligned |
| `/doctor/patients/{id}` | `DoctorPatientDetailPage` | `/portal/patients/:id`; demographics, visits, patient-uploaded reports, prescriptions; loading/error | Record sections have clear labels and responsive details |
| `/doctor/availability` | `DoctorAvailabilityPage` | GET/PUT `/portal/availability`; edit/add/remove/save/loading/error/success | Weekly rules use responsive schedule cards; controls stack cleanly on phones |
| `/doctor/services` | `DoctorServicesPage` | GET/POST/PATCH `/portal/services`; create/activate/deactivate/error/empty | Service editor and method toggles work with touch/keyboard |
| `/doctor/integrations` | IntegrationsPage | Google status/connect/callback/disconnect; unconfigured/disconnected/connected/error | State and next steps are explicit; no false connected status |
| `/doctor/reports` | Redirect alias | `<Navigate replace>` to `/doctor/patients` | Verify redirected destination, not a separate report page |
| `/doctor/prescriptions` | `DoctorPrescriptionsPage` | `/portal/prescriptions`; history-only, empty/error/loading | No unsupported editing capability implied |
| `/doctor/payments` | PaymentsPage doctor mode | `/portal/payments`; history-only, empty/error/loading | No payment processing implied |
| `/doctor/notifications` | NotificationsPage doctor mode | `/portal/notifications`, mark-read; empty/error/action-error | Actions work at phone widths |
| `*` | NotFound | No API; return-to-practice action | Handles long/unknown paths and remains readable on phone |

`AppErrorBoundary` is a global recovery screen rather than a route; `RouteLoading` is the lazy-route pending state. `AuthGate` and `RoleGate` are access/redirect states around the patient and doctor trees, not standalone routes. Role-gated runtime acceptance requires test accounts for both roles.

### Shared architecture and implementation order

- Keep React Router path declarations and server/API contracts as the behavior source of truth. Make page composition distinct by public/patient/doctor context rather than changing data semantics.
- Continue using the existing Tailwind v4 token layer for spacing/color/type utilities; use scoped semantic CSS for complex widgets (calendar, booking wizard, clinical record) so narrow-screen behavior is explicit.
- Keep routes feature-owned: patient pages live in `src/patient/`, clinician pages in `src/doctor/`, and shared appointment/activity/profile details in `src/portal/`. Extract additional shared pieces only when they remove real duplication without blurring role-specific behavior.
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
- [ ] Remaining acceptance includes direct-entry states, the listed viewport/role/workflow matrix, and authenticated patient/clinician runtime review. The old `PortalPage.tsx` extraction task was completed in later implementation batches.

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

### Implementation Batch 4: clinician identity and practice workflows (2026-10-17)

- [x] Fixed profile-name selection by account role in the shared auth response and `/api/auth/me`. A user with both patient and doctor profile rows now receives the doctor display name in the doctor workspace and the patient full name in the patient workspace.
- [x] Added a regression test for the dual-profile doctor identity case, including the authenticated `/api/auth/me` response.
- [x] Removed the hard-coded clinician greeting from the doctor overview and use the authenticated profile name instead.
- [x] Changed the doctor overview API to include `patient_id`, include all pending requests even when their requested date has passed, and return a pending-request count. The dashboard now surfaces this as “Needs response” and provides direct links to appointments, patients, availability, and consultation services.
- [x] Exposed the existing `PATCH /portal/services/:id` capability in the doctor UI with edit, save, and cancel controls; editing preserves the service's enabled/paused state. Small-screen action buttons wrap and expand to usable widths.
- [x] Client typecheck/build, server build, and server test suite pass (9 tests); `git diff --check` passes.
- [ ] Doctor pages still need route-by-route visual and workflow acceptance at the documented viewport widths, including calendar, appointments, patient chart, records, prescriptions, services, availability, integrations, billing, notifications, profile, and account.
- [ ] The shared `PortalPage.tsx` is still oversized. Extracting doctor feature modules remains future work and must preserve the existing role guards, API contracts, and page states.
- [ ] No authenticated browser visual pass was performed here; build and source-level checks do not establish screen acceptance.

### Implementation Batch 5: clinician calendar, directory, and clinical safety (2026-10-17)

- [x] Added named patient and clinician layout entry points with distinct route-level layout files. They share accessible navigation mechanics while keeping separate navigation groups, role labels, and the patient/doctor visual scopes.
- [x] Extracted `/doctor/calendar` into `doctor/DoctorCalendarPage.tsx`. It now has day, week, and month views, previous/next and Today controls, search, status filtering, duration/status details, and direct visit links. The month grid is responsive and has keyboard focus states.
- [x] Added bounded, parameterized date-range support to the existing doctor appointments API; the calendar requests only its visible range (up to 63 days). The patient endpoint behavior is unchanged.
- [x] Extracted `/doctor/patients` into `doctor/DoctorPatientsPage.tsx`, with debounced server-side search, 25-row pagination, desktop table and mobile cards. New `GET /portal/patient-directory` is doctor-role protected and always scopes queries to the authenticated doctor. Existing `/portal/patients` remains available for compatibility.
- [x] Added a distinct “Requests” appointment filter so overdue pending requests remain actionable, and linked doctor appointment rows to their patient charts using the authorized patient ID returned by the API.
- [x] Consultation drafts now show saved/unsaved/read-only states, protect against browser and in-app link navigation that would discard unsaved edits, and use local time correctly in the follow-up input. Completed consultations are read-only in the UI and rejected by the server with 409 to prevent silent overwrite.
- [x] Regression coverage now includes role-scoped paginated directory queries, bounded parameterized calendar ranges, and rejection of edits to completed consultations.
- [x] Client typecheck/build and server build/tests passed after this batch; all 12 server tests pass, including the completed-record guard.
- [ ] No authenticated visual/browser acceptance was run for the new calendar, directory, or clinical form states. Continue the viewport and accessibility matrix before considering these routes finished.
- [ ] The calendar cannot show saved one-off blocked periods because the current database/API has no blocked-time model. Recurring availability remains managed on `/doctor/availability`; no unsaved or synthetic blocks are drawn.
- [ ] Appointment rescheduling is not implemented by the current API. Keep that action absent until a conflict-safe server workflow exists.
- [ ] Remaining clinician and patient route families still need their own redesign/acceptance batches; this is not completion of the full-product brief.

### Implementation Batch 6: doctor feature boundaries and record workflows (2026-10-17)

- [x] Extracted doctor appointment list, consultation services, recurring availability, Google Calendar integration, patient directory, patient chart, calendar, and appointment detail into route-focused components under `client/src/doctor/` and `client/src/portal/`. Direct routes in `App.tsx` now lazy-load these components; patient and doctor route guards remain in place.
- [x] Extracted the shared profile form as a feature module, passed its role explicitly from `/patient/profile` and `/doctor/profile`, and removed profile dispatch from the remaining generic portal section.
- [x] Moved shared appointment rows, formatting helpers, status/empty/record/prescription primitives and types into `client/src/portal/`. Prescription headings now choose the correct patient/doctor counterpart name.
- [x] Reduced `PortalPage.tsx` from a shared catch-all to the overview and remaining generic appointment/prescription sections; it no longer contains the record/history/activity page implementations.
- [x] Moved care history, patient report upload/search, notifications, and payment history into `client/src/portal/PortalActivityPages.tsx`; notification appointment links now use the router's current path rather than the global location object.
- [x] The doctor shell now displays the authenticated doctor's name instead of hardcoding “Dr. Kiran” in the clinician workspace header.
- [x] Client typecheck and production build pass after the extraction.
- [x] Server TypeScript build and HTTP regression suite were rerun with local loopback access. All 12 tests pass, including the role-scoped directory and completed-record protections.
- [ ] No authenticated desktop/tablet/mobile visual acceptance has been performed for this batch. The full 1440/1280/1024/768/480/390/360px route matrix and keyboard/screen-reader checks remain open.
- [ ] The patient and doctor overview screens still share a role-conditional `PortalHome` implementation. Their major content differs, but the home components should be split after verifying identical data-loading and error behavior.
- [ ] Remaining generic appointment and prescription listing dispatch still lives in `PortalPage.tsx`; patient and doctor routes need final source-to-API and responsive state review. Patient runtime acceptance remains outstanding.
- [ ] Doctor billing, notifications, account, and profile, along with public/auth and patient routes, still require complete route-by-route functional and visual acceptance. Component extraction is not itself proof that those screens are finished.
- [ ] Existing product limits remain: no online checkout, no one-off calendar blocking, no rescheduling API, and no patient report deletion control in the client.

### Implementation Batch 7: explicit activity and prescription routes (2026-10-17)

- [x] Replaced the remaining generic route dispatcher with direct lazy route components for patient appointments, patient prescriptions, doctor prescriptions, patient care history, reports, notifications, and payments.
- [x] Each direct list/activity route now owns its own loading, error, retry, and API request state. Report upload still refreshes the real record list; notification read actions refresh the real notification list; payment history remains read-only because the backend has no checkout flow.
- [x] Removed the generic `PortalSection` and its path-dependent API dispatch. `PortalPage.tsx` now only supplies the still role-conditional patient/doctor overview and is 439 lines rather than the former 2,800+ line catch-all.
- [x] Production code splitting now emits separate chunks for patient appointments, patient prescriptions, doctor prescriptions, activity pages, booking, calendar, services, directory, patient chart, integrations, availability, account, profile, and appointment detail.
- [x] Client typecheck and production build pass; `git diff --check` passes.
- [ ] This batch has not introduced a form or table library because current forms are API-specific and the current directory is already server-paginated. Add React Hook Form/Zod or TanStack Table only when a concrete repeated validation/table need warrants the dependency and migration work.
- [ ] Full authenticated viewport, keyboard, and screen-reader acceptance is still outstanding. The current browser audit could only review public and unauthenticated screens without entering account credentials.

### Implementation Batch 8: shared route hierarchy (2026-10-17)

- [x] Added one shared `PageHeader` primitive for portal route landmarks, eyebrow labels, titles, descriptions, and optional actions. Patient and clinician appointment and prescription routes now use the same semantic, responsive heading structure.
- [x] Standardised the doctor appointment loading and error state through the existing shared `Status` primitive, including a labelled retry action.
- [x] Split the former role-conditional overview into `patient/PatientOverviewPage.tsx` and `doctor/DoctorOverviewPage.tsx`. Both consume one shared overview data hook, while each owns its own layout, wording, shortcuts, and record hierarchy.
- [x] Replaced patient-dashboard inline styles with scoped patient presentation classes for the empty state and appointment panel. API contracts, role guards, appointment actions, and prescription data remain unchanged.
- [x] Moved the booking route onto the same page-heading component while retaining its real multi-step service, availability, document upload, request, and slot-conflict workflow. The native date control and required patient-profile gender select retain their dedicated accessible control styling.
- [x] Applied the shared heading hierarchy to profile, account security, care history, reports, notifications, payment history, availability, services, and calendar integrations. These routes retain their existing API loading, error, and retry paths.
- [x] Applied the same header/action pattern to the clinician calendar while preserving day/week/month controls, bounded API range loading, filters, and appointment links.
- [x] Added a clinician appointment date filter alongside the existing real status views and patient/service search. It filters the loaded, authorised appointment collection and does not imply unsupported rescheduling or status transitions.
- [x] Client typecheck and production build pass after this batch. The server build and all 12 HTTP/security regression tests also pass, including the doctor-identity, role-scoped patient-directory, bounded calendar-range, and completed-consultation guards.
- [x] Updated the original route audit to clearly mark its `PortalPage.tsx` findings as historical baseline data and point to the current feature-owned route structure.

### Implementation Batch 9: form foundation and bundle review (2026-10-17)

- [x] Added React Hook Form and Zod Mini for the profile form, the first repeated validation surface that benefits from client-side field state. The form keeps persistent labels, inline validation, preserved values after failed saves, accessible invalid-field semantics, and the existing `PATCH /portal/profile` contract.
- [x] Patient gender remains required in the profile UI, as requested. The server remains the authoritative validator and data owner.
- [x] Tested Radix Dialog for appointment confirmations, then removed it because it added approximately 38 kB to an otherwise 8.86 kB lazy route. The existing dialog already traps focus, restores focus, supports Escape, blocks interaction while saving, and has responsive sheet behaviour, so retaining it is the smaller and lower-risk choice.
- [x] Reviewed production bundle output after each tool decision. The ProfilePage lazy chunk reduced from 117.79 kB to 50.16 kB (17.54 kB gzip); AppointmentRows remains 8.86 kB (2.99 kB gzip).
- [x] Client typecheck, production build, and `git diff --check` pass after the form integration.
- [ ] Continue route-by-route authenticated visual, keyboard, and responsive acceptance before treating the full redesign as complete. The documented appointment rescheduling, online payment, blocked calendar time, and report deletion limitations still require server capability work.

### Implementation Batch 10: selected open-source UI and table tools (2026-10-19)

- [x] Added the shadcn/ui component configuration for the existing Tailwind v4 + Vite project, with an Atelier Care themed shared Button and Input under `client/src/components/ui/`. Kept the components source-owned and avoided replacing the established global design tokens.
- [x] Added TanStack Table v9 to the doctor patient directory. It owns the table column and sorting interaction while existing server-side search and page navigation remain in place; sorting is performed by the API across the full filtered directory.
- [x] Added a strict allowlist for server sort keys and direction. SQL sort expressions come only from a fixed map; a regression test verifies that arbitrary sort keys are rejected.
- [x] Kept the responsive patient cards for narrow screens and added a sort select that works at mobile widths. Desktop column headings also toggle server sorting.
- [x] Reviewed the current calendar against the existing workflow. It already supports day, week, and month navigation with search, status filters, and appointment links, so no calendar dependency was added in this batch.
- [x] Removed `tailwind-merge` and `class-variance-authority` after bundle review; a small static variant map and `clsx` keep the shared Button chunk to 1.47 kB (0.74 kB gzip). TanStack's route chunk is 39.77 kB (12.58 kB gzip).
- [x] Client typecheck and production build pass. Server build and the full 13-test HTTP regression suite pass, including the invalid sort allowlist test. `git diff --check` passes.
- [ ] Authenticated patient-directory visual and keyboard checks at desktop, tablet, and mobile widths remain to be completed as part of the full route acceptance pass.

### Implementation Batch 11: reports, notifications, and responsive layout corrections (2026-10-19)

- [x] Redesigned the patient Reports screen around the existing authenticated upload and record APIs: clearer upload heading, category control, accessible file picker with selected-file feedback, upload/privacy action row, document search and category filter, report rows with a direct “View record” action, and a responsive empty state.
- [x] Preserved the PDF/JPG/PNG allowlist, 8 MB client-side limit, category header, upload endpoint, record filtering, and refresh-on-success behavior. Report links still use the authenticated record endpoint.
- [x] Reworked patient and doctor notification rows to show unread state with a compact dot rather than a thick left border, removed the generic gray background applied to timestamps, aligned list edges, and made actions wrap at phone widths. Reset the inherited card-list link margin and standardized link/button heights so notification actions align vertically. Existing appointment links and mark-read API behavior are unchanged.
- [x] Corrected the responsive shared page-header flex basis that reserved excess vertical space on narrow screens. Adjusted the single-column auth grid so login, registration, and password recovery sections do not stretch to fill the desktop two-column minimum height.
- [x] Removed the duplicate patient form-field halo while retaining a visible keyboard focus outline.
- [x] Client typecheck, production build, and `git diff --check` pass for these changes.
- [ ] Live-browser visual acceptance was not completed: the local preview connection timed out. Reload the app locally and verify Reports and Notifications at desktop and phone widths, then review login, registration, and password recovery at mobile and desktop widths.
- [ ] This is a targeted repair batch, not completion of the full redesign. All remaining routes still require authenticated route-by-route visual, responsive, keyboard, and workflow acceptance as tracked above.

### Implementation Batch 12: patient care-history timeline (2026-10-19)

- [x] Reworked `/patient/history` into a visual timeline with a connected marker rail, event-type labels, semantic dates, appointment status badges, readable event titles, and consistent detail/report links.
- [x] Removed the page's inline presentation styles and kept its existing appointment, uploaded-report, and prescription data sources and links.
- [x] Added phone-specific spacing and wrapping for long filenames, event titles, timestamps, and status badges.
- [x] Client typecheck, production build, and `git diff --check` pass.
- [ ] Authenticated visual acceptance of the timeline at desktop and phone widths remains outstanding.

### Implementation Batch 13: patient overview mobile hierarchy (2026-10-19)

- [x] Removed the redundant all-caps next-step kicker from the patient dashboard.
- [x] Set the featured empty-state title to a high-contrast light colour on the evergreen panel.
- [x] Reflowed the patient summary links into readable two-column tiles on phones, with the final record count arranged as a full-width row.
- [x] Tightened the upcoming-appointments empty state so its message and action fit more naturally within a phone viewport.
- [ ] Run client typecheck/build and visually verify the dashboard at phone and desktop widths.

### Implementation Batch 14: patient dashboard composition redesign (2026-10-19)

- [x] Rebuilt the patient home screen around a light appointment feature, care shortcuts, and a compact list of additional upcoming visits. The featured appointment is not repeated in the list.
- [x] Kept the existing overview API, appointment links, Google Meet URL validation, and booking route; no sample data or new workflow was introduced.
- [x] Replaced cramped numeric cards with readable icon-led links and adapted the appointment card, quick links, and upcoming list for small screens.
- [ ] Run client typecheck/build and visually verify the dashboard at phone and desktop widths.

### Implementation Batch 15: patient navigation refinement (2026-10-19)

- [x] Refined the patient sidebar for desktop and the mobile drawer: calmer brand header, sentence-case navigation group labels, tighter group rhythm, clearer selected/focus states, and a more integrated account/sign-out footer.
- [x] Kept the existing patient navigation destinations, role label, profile link, and sign-out behavior unchanged.
- [ ] Visually verify the sidebar and drawer at desktop, tablet, and phone widths.

### Implementation Batch 16: shared shadcn-style form controls (2026-10-19)

- [x] Added source-owned Select and Checkbox primitives under `src/components/ui/`, following the existing shadcn-style Button and Input pattern without adding a runtime dependency.
- [x] Migrated native select controls in booking, profile, reports, doctor availability, calendar filters, and patient-directory sorting; migrated the service-method checkbox.
- [x] Kept the primitives as native HTML controls, preserving current values, validation, keyboard behavior, and API contracts.
- [x] Client typecheck and production build pass.
- [ ] Review the primitives in live browser at desktop and mobile widths before migrating additional controls.

### Implementation Batch 17: availability editor, patient account screens, and brand identity (2026-10-19)

- [x] Reworked `/doctor/availability` from repeated full-width form rows into a responsive weekly schedule editor. Day selection and removal are grouped together; opening hours, appointment length, and buffer settings have clearer relationships and touch-sized controls.
- [x] Moved “Add hours” beside the schedule heading and kept “Save availability” and “Configure services” together in a distinct action footer. Existing GET/PUT API requests, editable weekday/time/slot/buffer values, empty/loading/error/success states, and service configuration route remain in place.
- [x] Refined patient `/patient/appointments/:id` details with a focused visit summary, readable status/service hierarchy, and separate shared-document, visit-summary, and prescription sections. Empty prescription values such as `NA` are no longer shown as clinical details.
- [x] Redesigned patient `/patient/profile` into a compact account form with a two-column desktop field layout, a single-column phone layout, clearer contact information, and a non-button “Profile is up to date” state. Profile validation and `PATCH /portal/profile` remain unchanged; gender remains required for patients.
- [x] Redesigned the patient `/patient/account` security screen into an explanatory panel and a separate phone verification form; it stacks at tablet and phone widths. Existing send-code, resend, and verify API workflow is unchanged.
- [x] Added the supplied transparent heart-and-leaf mark as a shared brand image for public navigation/footer, legal-page header, authentication brand links, and patient/doctor workspace sidebars; added a square favicon derived from the mark.
- [x] Client TypeScript check and production build pass after this batch.
- [ ] Authenticated visual acceptance of availability, appointment details, profile, and security screens at desktop, tablet, and phone widths remains outstanding. Build success does not verify rendered appearance or API-backed behavior in a live session.

### Implementation Batch 18: clinician overview mobile hierarchy (2026-10-19)

- [x] Reframed the clinician overview heading as a contained “Today at a glance” panel with the date and calendar action together, so it reads as one purposeful section on mobile and desktop.
- [x] Removed repeated “today / in one place” wording while keeping the greeting and descriptions of appointments, patient care, and requests.
- [x] Preserved all overview counts, pending-request queue, next appointment, day agenda, and navigation/API data sources.
- [ ] Review the clinician overview in an authenticated browser at phone and desktop widths; this pass has only source/build verification.

### Implementation Batch 19: application-wide typography system (2026-10-19)

- [x] Defined shared font roles and a type scale: Newsreader for page-level editorial titles; Figtree for portal cards, forms, tables, navigation, and actions.
- [x] Standardized patient and clinician card heading weights, sizes, line heights, and phone sizing; normalized the Integrations title and explanatory copy shown in the supplied screenshot.
- [x] Changed the Google Fonts request to variable weight ranges so CSS weights used by existing screens are actually available, without adding a dependency.
- [x] Kept page title styles, route content, and all API-backed actions intact; this batch changes typography rather than replacing page workflows or layout.
- [ ] Run client typecheck/build and review representative public, patient, and clinician screens at desktop and phone widths. Source-level font consistency does not confirm every rendered route.

### Implementation Batch 20: clinician profile and account alignment (2026-10-19)

- [x] Applied the patient profile screen's restrained card, readable input, contact summary, save feedback, and responsive form layout to `/doctor/profile`, keeping the clinician name and contact data sourced from the existing profile API.
- [x] Applied the patient security screen's two-column introduction/form composition to `/doctor/account`, collapsing to a stacked layout on tablet and phone.
- [x] Kept phone verification, validation, profile loading/saving, and API contracts unchanged.
- [ ] Run client typecheck/build and inspect both clinician account routes at desktop and phone widths.

### Implementation Batch 21: consultation services workspace (2026-10-19)

- [x] Reworked `/doctor/services` service summaries to show booking availability, consultation details, methods, and actions in a deliberate responsive layout.
- [x] Expanded the service editor into a balanced desktop form with paired name/description and duration/fee fields; it stacks on phones with full-width actions.
- [x] Preserved existing create, edit, pause/enable, load, and error workflows and API payloads.
- [ ] Run client typecheck/build and inspect the screen at desktop, tablet, and phone widths.

### Implementation Batch 22: typography cascade consistency (2026-10-19)

- [x] Applied a final patient and clinician portal rule so route-level `h1` titles remain Newsreader while workflow and card `h2`/`h3`/`h4` headings consistently use Figtree.
- [x] Normalized prominent patient and clinician dashboard section heading sizes to fit the sans-serif hierarchy; body copy and controls remain Figtree.
- [ ] Check authenticated patient and clinician pages in a browser at desktop and phone widths to confirm the final cascade visually.

### Implementation Batch 23: clinician appointments mobile header (2026-10-19)

- [x] Kept the original appointments description and tuned the phone typography: Newsreader for the title and Figtree for supporting text, with a readable weight, line height, and measure.
- [x] Left appointment data, filters, and actions unchanged.
- [ ] Visually review `/doctor/appointments` at phone width after the build.

### Implementation Batch 24: focused calendar integration card (2026-10-19)

- [x] Constrained the single Google Calendar integration card to a readable desktop measure with responsive padding instead of stretching it across the full workspace.
- [x] Made the connection action full-width on phones while preserving setup details, connected state, and OAuth behavior.
- [ ] Inspect `/doctor/integrations` at desktop and phone widths in the browser.

### Implementation Batch 25: Google Calendar integration hierarchy (2026-10-19)

- [x] Grouped connection identity, status, and connect/disconnect action into one responsive header row.
- [x] Reframed the existing calendar/Meet behavior as scannable points and an explicit privacy note; no new capabilities or claims were added.
- [x] Kept server setup guidance conditional on missing configuration and preserved OAuth, disconnect, error, and callback behavior.
- [ ] Inspect the connected, disconnected, setup-required, and phone layouts in a browser.

### Implementation Batch 26: responsive review and mobile sign-in density (2026-10-19)

- [x] Rendered the public landing page, practice information, privacy and terms pages, sign-in, registration, and password recovery routes at 360, 390, 480, 768, 1024, and 1440px. All 54 rendered route/viewport combinations had no document-level horizontal overflow.
- [x] Tightened the mobile authentication story and form spacing so the sign-in fields begin within the first 390×844 phone viewport; retained the desktop two-column presentation and all auth copy and behavior.
- [x] Ran the client TypeScript check, production build, and `git diff --check` successfully.
- [ ] Review the authenticated patient and clinician page layouts in a browser at the target widths. The current browser session is signed out, and this pass did not create or use test accounts or clinical data.

### Implementation Batch 27: botanical portal welcome artwork (2026-10-19)

- [x] Added the supplied transparent botanical image to the patient and clinician overview welcome headings, with text-forward gradients and responsive crops so the greeting stays legible.
- [x] Kept the image decorative; no clinical or interaction content changed.
- [x] Client typecheck and production build pass, and the asset is included in the production output.
- [ ] Visually inspect both authenticated overview pages at desktop and phone widths when a patient and clinician test session is available.

### Implementation Batch 28: clinician patient-chart redesign (2026-10-19)

- [x] Reorganized `/doctor/patients/:id` around patient identity, real visit/document/prescription totals, and a concise “At a glance” summary of contact, date of birth, conditions, allergies, and current medications.
- [x] Replaced the bulky appointment cards with a compact visit list that keeps date, method, status, available assessment, and the existing “Open visit” route together.
- [x] Paired reports and prescriptions in a two-column resource layout on wider screens and stacked them on phones. Empty states are shorter, and populated reports retain their authenticated view links.
- [x] Added responsive sizing for the patient header, counts, clinical facts, visit actions, report rows, and prescription rows; wrapped the facts in a semantic definition list.
- [x] Preserved the existing `/portal/patients/:id` request, loading/error/retry behavior, patient data, visit links, and `RecordList`/`PrescriptionList` rendering.
- [x] Client TypeScript check, Vite production build, and `git diff --check` pass after this batch.
- [ ] Review the authenticated patient chart visually at desktop, tablet, and phone widths and verify the real visit/document links in a clinician session. Build output does not confirm the rendered layout or role-authorized workflow.

### Current completion note (2026-10-19)

The implementation log above now includes the previous redesign batches through Batch 28, including the shared typography system, patient/doctor profile and account alignment, service and availability screens, calendar integration, mobile review, botanical welcome art, and the clinician patient chart. The original acceptance matrix remains open: role-authenticated workflow review and responsive visual acceptance are still needed for routes not explicitly recorded as browser-verified. Do not treat the completed source/build checks as full route acceptance.

### Implementation Batch 29: clinician appointment and consultation workspace (2026-10-19)

- [x] Redesigned the doctor view of `/doctor/appointments/:id` with a clearer patient heading, separated service/date/status/method metadata, and a more structured pre-consultation intake panel.
- [x] Improved the files section and consultation-notes state hierarchy. Empty completed fields now explain that no value was recorded, and completed consultation notes remain read-only.
- [x] Changed the consultation form to a balanced desktop grid that stacks on smaller screens, and reorganized medicine fields and prescription actions into responsive groups.
- [x] Kept patient appointment styling, Google Meet availability rules, all consultation/prescription data, API calls, save/complete behavior, and existing validation intact.
- [x] Client TypeScript check, Vite production build, and `git diff --check` pass after this batch.
- [ ] Visually inspect the doctor appointment workflow in an authenticated clinician session at desktop, tablet, and phone widths; verify completed/read-only and editable consultation states plus prescription submission.

### Implementation Batch 30: patient and clinician unread notification indicators (2026-10-19)

- [x] Added an unread-count badge to the top-bar bell and both roles’ sidebar Notifications links. Counts above 99 display as `99+`, and accessible labels announce the unread total.
- [x] Extended `GET /portal/notifications` with an additive `unreadCount` field computed across all unread records, even though the page itself only lists the 100 most recent notifications.
- [x] Refresh the count on workspace load, when the tab becomes visible, every 60 seconds, and immediately after a notification is marked read.
- [x] Kept notification ownership scoped to the authenticated user and preserved the existing notification list and mark-read API behavior.
- [ ] Verify the badge with patient and clinician accounts containing unread notifications, then mark items read and confirm the count updates in the authenticated browser.

### Implementation Batch 31: notification-center card redesign (2026-10-19)

- [x] Reworked patient and clinician notification rows with a consistent icon tile, more readable title/date hierarchy, an explicit “New” label for unread items, and better-separated actions.
- [x] Added responsive card spacing and action placement so actions remain attached to their notification on phones; constrained the notification page to a more readable content width.
- [x] Kept notification messages, unread/read state, appointment destinations, and mark-read API behavior intact.
- [ ] Visually inspect the patient and doctor notification centers at desktop and phone widths and verify the new/unread states with real notifications.

### Implementation Batch 32: top-bar sign-out access (2026-10-19)

- [x] Added a sign-out button beside the notifications bell in the patient and clinician top bars; on phone widths it becomes an icon button with an accessible label.
- [x] Reused the existing sign-out/session-clearing flow and kept the sidebar sign-out action available.
- [x] Added a disabled in-progress state and a visible top-bar error if sign-out fails.
- [ ] Verify sign-out from both role shells and confirm successful navigation to the login screen in an authenticated session.

### Implementation Batch 33: mobile notification layout refinement (2026-10-19)

- [x] Refined patient and clinician notification pages for phone widths with a compact title scale, better description measure, and more deliberate card spacing.
- [x] Put notification actions on a dedicated full-card row below the icon and message, with touch-friendly controls that share space when they fit and stack on the narrowest phones.
- [x] Preserved notification read states, appointment destinations, top-bar controls, and API behavior.
- [ ] Review both role notification pages at phone and tablet widths in an authenticated browser.

### Implementation Batch 34: simplify sidebar account footer (2026-10-19)

- [x] Removed the duplicate sign-out action from the patient and clinician sidebars; the account profile link remains in the footer.
- [x] Kept sign-out in the shared top bar for both roles, including its existing accessible label, progress state, and error feedback.

### Implementation Batch 35: mobile login and registration focus (2026-10-19)

- [x] Hid the introductory story panel on phone widths for login and registration, removing the redundant hero copy shown above the form.
- [x] Let the authentication form use the available mobile viewport while preserving the two-column story and form layout at larger widths.
- [x] Scoped the change to login and registration; password recovery retains its existing story panel.

### Implementation Batch 36: public landing and care-area redesign (2026-10-19)

- [x] Reworked the public home page around the practice’s stated consultation topics, with a responsive Areas of care section for ovarian cysts, uterine fibroids, irregular menstruation, infertility, kidney stones, and chronic conditions.
- [x] Added a dedicated `/care` anchor route and navigation entry. The About page now describes the same areas as consultation topics and avoids unsupported claims about treatment outcomes or geographic reach.
- [x] Refreshed the landing page hero, request journey, service introduction, care principle, FAQ controls, cards, buttons, and phone layouts while retaining live consultation options and booking links.
- [x] Replaced generic About copy with accurate practice and portal descriptions; the clinician-provided list is presented as concerns to discuss, with a note that individual assessment determines next steps.
- [x] Verified TypeScript and production build; opened the home and About routes in the local browser and confirmed the topic content and booking links are present.
- [ ] Inspect visual layout and responsive behavior at desktop, tablet, and phone widths; the local browser inspection did not include viewport-specific visual review.

### Implementation Batch 37: prevent mobile hero illustration overlap (2026-10-19)

- [x] Reflowed the decorative appointment journey illustration on phones so its practice label sits below the content card instead of covering the appointment-review note.
- [x] Removed the card rotation at phone widths and tightened row spacing while preserving the desktop composition.
- [ ] Confirm the illustration at 360px, 390px, and 480px in a viewport-specific browser review.

### Implementation Batch 38: featured single consultation option (2026-10-19)

- [x] Expanded a lone active consultation service into a wide featured panel instead of leaving it isolated in the first third of a three-column grid.
- [x] Separated service facts from the booking next step, removed the large unused card area, and kept the real service data and booking route.
- [x] Added a stacked mobile layout for the featured service panel.
- [ ] Visually review the featured service at desktop and phone widths in a browser.

### Implementation Batch 39: explicit consultation method labels (2026-10-19)

- [x] Replaced the ambiguous “Online” label with “Google Meet” and normalized WhatsApp casing on public service cards.
- [x] Kept method display driven by the active service configuration; the landing page does not suggest unconfigured consultation options.


### Implementation Batch 40: booking and practice policies (2026-10-19)

- [x] Added a public `/booking-policy` page covering booking confirmation, consultation methods and scope, quote-only fees, cancellations/rescheduling, refunds, complaints, and urgent-care boundaries.
- [x] Documented that the site currently does not accept online payments or issue refunds, and that requested appointment changes require practice confirmation.
- [x] Added clearly labeled demo email and phone details plus a reminder to replace them before launch. Professional registration details remain an explicit practice-supplied placeholder rather than an invented credential.
- [x] Added the policy page to the public footer.
- [ ] Replace demo contact details and confirm final practice cancellation/refund terms before launch.

### Implementation Batch 41: FAQ expanded-state cross icon (2026-10-20)

- [x] Kept the plus icon for collapsed FAQ items and changed the expanded icon to a clear diagonal cross (×), per the mobile feedback.
- [x] Preserved the outlined circular touch target and existing native disclosure interaction.
- [ ] Visually confirm in a local browser once browser inspection is available.

### Implementation Batch 42: mobile FAQ controls and local screenshot hygiene (2026-10-20)

- [x] Kept the FAQ list full-width on phones, with question text wrapping beside a fixed circular control rather than squeezing into a narrow column.
- [x] Made the expanded FAQ control display a diagonal cross (×), while collapsed rows retain a plus; retained native disclosure behavior and touch sizing.
- [x] Added the Home link to desktop and mobile public navigation and fixed the mobile menu close control touch target in recent frontend work.
- [x] Ignored `codex-clipboard-*` files so pasted temporary screenshots do not get committed. Source images and other project assets remain trackable.
- [ ] Recheck the FAQ and menu in the user’s local browser after these files are loaded by the running development server.

### Implementation Batch 43: landing artwork integration (2026-10-20)

- [x] Added the supplied botanical landscape as a restrained landing hero background with a light overlay to preserve text contrast.
- [x] Added the teleconsultation illustration alongside the “How it works” introduction, with descriptive alternative text and responsive sizing.
- [x] Added the botanical line-art image as a low-contrast FAQ section background.
- [x] Copied the supplied images into named public assets, keeping their `codex-clipboard-*` temporary source names out of the repository.
- [ ] Visually review image crops, contrast, and mobile layout in the local browser.

### Implementation Batch 44: mobile consultation card refinement (2026-10-20)

- [x] Removed the shaded nested booking panel from the single-service card on mobile; the booking prompt now sits in a simple divided footer.
- [x] Tuned the service title size and card spacing for narrow screens and made the booking action full-width on the narrowest phones.
- [ ] Visually review the revised service card on a phone-sized viewport in the local browser.

### Implementation Batch 45: responsive consultation options redesign (2026-10-20)

- [x] Added a dedicated consultation section layout with card widths and heading measure tuned for desktop, tablet, and phone.
- [x] Configured multi-service cards to flow as three columns on wide screens, two on tablet, and one on phones.
- [x] Tuned the single-service layout to use a balanced side-by-side booking panel on larger screens and a simple stacked/footer treatment on mobile.
- [x] Scaled service title, metadata, and action spacing for each viewport range.
- [ ] Visually review the section at desktop, tablet, and phone widths in the local browser.

### Implementation Batch 46: mobile navigation close icon visibility (2026-10-20)

- [x] Increased the public mobile menu close control to a 48px touch target and explicitly sized its X icon to 27px with a heavier stroke.
- [ ] Visually confirm the close icon at phone viewport sizes in the local browser.

### Implementation Batch 47: botanical public footer background (2026-10-20)

- [x] Added the supplied botanical landscape as a background on the shared public footer used by the landing and static information pages.
- [x] Applied a pale overlay and centered cover crop to keep footer links and copy legible across viewport sizes.
- [ ] Visually review desktop and mobile crops in the local browser.

### Implementation Batch 48: responsive visit journey redesign (2026-10-20)

- [x] Replaced the four-box “How it works” presentation with a connected editorial sequence on desktop, a two-column sequence on tablet, and a vertical timeline on phones.
- [x] Kept step icons, numbering, headings, and descriptions legible and aligned at each responsive layout.
- [ ] Visually review the sequence on desktop, tablet, and phone widths in the local browser.

### Implementation Batch 49: mobile footer artwork crop (2026-10-20)

- [x] Changed the mobile footer image from a full-height cover crop to a bottom-aligned, width-scaled accent so the waves do not run behind the footer links and cookie notice.
- [x] Kept a soft vertical wash over the artwork to preserve copy contrast while leaving the botanical edge visible near the footer bottom.
- [ ] Visually check the footer crop on phone and desktop widths in the local browser.

### Implementation Batch 50: keep mobile footer copy clear of artwork (2026-10-20)

- [x] Reserved a bottom decorative band for the mobile footer background so botanical shapes sit below legal and emergency copy.
- [x] Reduced the mobile overlay near the bottom edge to let the artwork read as a deliberate footer accent while keeping the copy area plain.
- [ ] Confirm footer spacing and artwork placement in the local browser at narrow phone widths.

### Implementation Batch 51: reliable public navigation and section scrolling (2026-10-20)

- [x] Changed landing navigation section links to root hash targets so they work from the landing page and public information pages.
- [x] Scrolls to a section on hash changes and preserves compatibility with older `/care`, `/services`, `/consultations`, `/faq`, and `/contact` URLs.
- [x] Handles repeat clicks on the current section and Home/logo clicks while already on the landing page.
- [ ] Verify public navigation with direct loads and repeat clicks in the local browser.

### Implementation Batch 52: simplify landing hero (2026-10-20)

- [x] Removed the “Private practice · Patient portal” pill above the landing hero heading to reduce visual clutter.

### Implementation Batch 53: landing hero action buttons (2026-10-20)

- [x] Replaced the oversized pill shape on the hero CTAs with softer, consistent rounded corners.
- [x] Kept the primary action prominent and softened the outlined secondary action on desktop and mobile.
- [ ] Visually review the hero actions at desktop and phone sizes in the local browser.

### Implementation Batch 54: repository cleanup for GitHub preparation (2026-10-20)

- [x] Removed the unreferenced `src/replace-layout.cjs` script, which contained a developer-specific absolute Windows path and targeted the deleted `PortalPage.tsx`.
- [x] Removed the redundant `LandingRoutes` wrapper; public aliases now render the same lazy `LandingPage` directly.
- [x] Checked added frontend UI components, dependencies, and public artwork for active imports/references; kept the ones currently used.
- [x] Corrected stale audit/security/deployment notes and verified real `.env`, `node_modules`, `dist`, coverage, and clipboard files stay ignored.

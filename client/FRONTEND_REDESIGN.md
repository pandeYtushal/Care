# Frontend redesign inventory and acceptance

This inventory covers the React routes found in `src/App.tsx`. Route aliases that render the same page are listed separately so they are not mistaken for separate screen implementations. No route is considered redesigned just because a shared style changed.

## Route inventory

| Area | Routes | Current screen / behavior |
| --- | --- | --- |
| Public | `/`, `/about`, `/services`, `/consultations`, `/contact`, `/faq` | One public landing page with section navigation and anchor targets. |
| Authentication | `/login`, `/register` | Shared email, phone-code, and Google sign-in screen. Doctor access uses `?workspace=doctor`. |
| Recovery | `/forgot-password`, `/reset-password` | Request and token-based reset states. |
| Patient | `/patient` | Patient overview. |
| Patient | `/patient/account`, `/patient/profile` | Phone linking and patient profile. |
| Patient | `/patient/appointments`, `/patient/appointments/:id` | Appointment list and detail. |
| Patient | `/patient/book` | Multi-step service, time, intake, report-upload, and confirmation flow. |
| Patient | `/patient/history`, `/patient/reports`, `/patient/prescriptions` | Care timeline, report list/view, and prescription list. |
| Patient | `/patient/payments`, `/patient/notifications` | Payment history and notification center. |
| Doctor | `/doctor` | Clinical overview and today's schedule. |
| Doctor | `/doctor/account`, `/doctor/profile` | Account security and practice profile. |
| Doctor | `/doctor/calendar`, `/doctor/appointments`, `/doctor/appointments/:id` | Calendar, appointment list, and appointment detail/workflow. |
| Doctor | `/doctor/patients`, `/doctor/patients/:id` | Patient directory and longitudinal patient record. |
| Doctor | `/doctor/availability`, `/doctor/services` | Scheduling rules and consultation offerings. |
| Doctor | `/doctor/integrations` | Google Calendar/Meet connection states. |
| Doctor | `/doctor/prescriptions`, `/doctor/payments`, `/doctor/notifications` | Clinical orders, payment history, and notification center. |
| Legacy alias | `/doctor/reports` | Redirects to `/doctor/patients`; reports belong to patient records. |
| Fallback | `*` | Not-found state. |

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

## Acceptance evidence (2026-10-06)

- Final `npm run typecheck` and `npm run build` both passed.
- Live visual review in the available clinician session covered the public landing page, clinician overview, calendar, patient directory, integrations, availability, consultation services, and account across desktop and narrow browser viewports. The dashboard metrics, appointment filters, and small-tablet sidebar breakpoint were corrected after review.
- Patient runtime routes, booking uploads, patient record details, and the unauthenticated sign-in screen were not fully exercised: the available browser session is a clinician account and role guards do not permit viewing patient content. Patient route source and workflow hooks were preserved; this is not equivalent to an end-to-end patient acceptance pass.
- The responsive portal drawer is styled for narrow screens and includes Escape, focus trapping, and focus restoration behavior. A complete keyboard pass and 320/360/390/768/1024px route matrix remain outstanding.
- Privacy/terms wording was not substantively edited; it still needs review and approval from the practice owner. No server, API contract, database, authentication, or appointment workflow behavior was changed.


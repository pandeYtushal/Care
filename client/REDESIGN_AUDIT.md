# Frontend redesign audit and proposal

> Baseline findings and implementation proposal. Progress and remaining acceptance checks are tracked in `FRONTEND_REDESIGN.md`.

## Scope reviewed

Reviewed the route tree in `src/App.tsx`, the shared patient/clinician implementation in `src/pages/PortalPage.tsx`, public and legal pages, authentication and recovery forms, the footer, global styles, Tailwind/Vite setup, and the current frontend route inventory. This is a frontend and experience audit; no API, database, authentication, or clinical workflow changes are proposed in this redesign.

The current route tree includes public landing/section routes, privacy and terms, login and registration, password recovery, patient portal routes, clinician portal routes, appointment and patient record details, and a wildcard error state. Several public section URLs resolve to one long landing page, and most authenticated data screens share conditional routing in the large `PortalPage.tsx` module.

## Findings

1. **The visual system is inconsistent.** `index.html` loads Figtree and Newsreader, while `index.css` separately imports Inter and Plus Jakarta Sans and assigns Plus Jakarta Sans to the display face. Typography therefore does not follow one deliberate system. The current blue-gray canvas and saturated turquoise palette also feel more like generic software than a personal care practice.
2. **Public surfaces use several unrelated visual languages.** The landing page uses a dark zinc footer and near-black actions, legal pages introduce indigo gradients, and the portal uses a separate green scheme. Components and interaction patterns do not carry one recognizable practice identity from discovery through care.
3. **Styling has accumulated in competing layers.** Tailwind v4 tokens/utilities, a long `index.css` stylesheet, a separate `landing.css`, media-query overrides, and inline styles all contribute presentation. No `legacy.css` file/import exists in the current repository. Repeated role/screen selectors and hard-coded token values make cascade changes difficult to reason about.
4. **The authenticated surface is difficult to maintain.** `PortalPage.tsx` is a large component module containing routing decisions, data views, appointment workflows, clinical documentation, and role-specific states. A visual refresh must preserve those behaviors and route contracts; a mass component/architecture rewrite would make regressions harder to isolate.
5. **The two portal roles need distinct emphasis.** Patients need reassurance, booking, visit readiness, and understandable records. Clinicians need scannable schedules, request triage, patient context, and efficient documentation. They should share brand tokens and accessible controls without feeling like the same workspace with a different sidebar color.
6. **Content limits the kind of redesign that is safe.** Qualification, pricing, contact, privacy, and clinical claims must remain grounded in supplied facts. Visual polish must not invent credentials, clinical assurances, testimonials, or legal promises.
7. **The mobile navigation issue has been repaired, but the screenshot exposed the larger visual problem.** The old public menu exposed the page beneath it and allowed its actions to collide with page content. The drawer now uses an independent full-screen layer; the full redesign will retain and recheck that behavior.

## Reference notes

- Motion's current public site presents distinct, strongly paced sections and makes interaction/motion part of the craft. Its own documentation emphasizes native-feeling gestures, layout transitions, spring motion, and reduced-motion handling. I will use restrained transition and feedback patterns, not constant animation or movement that distracts from care tasks. [Motion](https://motion.dev/)
- `offbrand.com` currently redirects to a parked domain, so its current design could not be inspected. I will not claim to reproduce it. The requested direction—less templated, more art-directed and emotionally grounded—will guide an original visual system instead.
- The expanded redesign brief adds xAI, editorial `.design` references, and SpaceX. These will be treated as cues for clarity, page rhythm, confident hierarchy, and purposeful movement only. Their dark/technical or cinematic branding is not appropriate to copy into a warm, light patient-care experience. Motion's official site specifically highlights native-feeling gestures and layout animation; those ideas remain limited to lightweight feedback and transitions, with reduced motion respected. [xAI](https://x.ai/), [Motion](https://motion.dev/), [SpaceX](https://www.spacex.com/)

## Proposed direction: “A practice that feels present”

- **Palette:** warm paper and chalk backgrounds, deep botanical ink, a measured evergreen action color, soft mineral borders, and a small clay/amber accent for human warmth. Avoid neon turquoise, purple/blue gradients, glass effects, and decorative color clouds.
- **Type:** one readable sans family for controls and data, paired with a quiet editorial serif for major moments and section titles. Use local/system fallbacks and one source of truth; avoid four competing remote font imports.
- **Composition:** editorial spacing and purposeful asymmetry on public pages; clear, calm hierarchy in portals; fewer, more useful containers instead of every block looking like a floating card.
- **Voice:** direct, gentle, and specific. Reassure users through clear status, next steps, and privacy boundaries rather than sentimental slogans.
- **Motion:** short, low-amplitude transitions for navigation, confirmation, and progressive booking states; keep forms stable; honor `prefers-reduced-motion`.
- **Role distinction:** patient navigation foregrounds next visit, booking, and care history; clinician navigation foregrounds today's work, requests, calendar, and patient records. Both use the same color, type, focus, and status semantics.
- **Responsive behavior:** retain compact bottom navigation where it supports frequent tasks; keep drawer and page layers independent; convert dense data into readable cards or contained tables; reserve safe-area space for fixed controls.

## Small implementation batches

1. Replace conflicting tokens/font definitions with one warm light theme; make a visual QA pass before touching page flows.
2. Redesign public landing, section, legal, and footer surfaces with consistent header, section rhythm, and restrained Motion behavior.
3. Redesign sign-in, registration, and recovery screens in the same system, preserving authentication behavior and role messaging.
4. Redesign the patient portal pages and booking flow, preserving API payloads, uploads, routing, and status meanings.
5. Redesign clinician dashboard, appointments, patient record, calendar, availability, services, integrations, and account surfaces with clinician-first information hierarchy.
6. Sweep all explicit routes at phone, tablet, and desktop widths; check focus, validation/loading/empty/error states, navigation, reduced motion, and build/type checks. Do not claim a patient runtime walkthrough unless tested with a patient-role session.

## Guardrails

- No backend/API/database changes, invented product capabilities, fabricated care claims, or changes to authorization semantics.
- Preserve existing routes, data contracts, audit behavior, and appointment state transitions.
- Implement and verify one batch at a time; keep the existing application usable between batches.
- Treat privacy and terms content as owner-approved legal copy, not design filler.

## Implementation update (2026-10-06)

The first staged frontend pass has been applied: warm light theme tokens and one font pair, a responsive public landing stylesheet, consistent footer/legal presentation, shared sign-in field layout, and a role-aware light portal shell. Browser review then caught and corrected clinician-dashboard metric layout and appointment-filter styling. Remaining route-by-route responsive review and the patient-role runtime pass are tracked in `FRONTEND_REDESIGN.md`.

## Phase 1 source verification (2026-10-16)

The Phase 1 pass inventoried repository paths and read the requested README/audit/security guides. It reviewed the full React route tree, guards/auth context, frontend page/component modules, style entry points, API call sites, and mounted backend route modules. This is a product/frontend audit, not an exhaustive source-level review of every backend utility, database migration, or security control. No `.env` files were inspected. The authoritative frontend route matrix is `FRONTEND_REDESIGN.md`: 39 literal patterns plus wildcard. Static-source review was supplemented with the current client typecheck/build; no patient or clinician authenticated workflow was exercised in this audit.

### Verified frontend findings

1. `PortalPage.tsx` is 4,068 lines and owns shell/navigation, overview, appointment list/actions, day/week calendar, patient history, reports, patient chart, appointment consultation/prescription workflow, payments, notifications, integrations, profile, availability, services, and booking. Routing dispatches multiple screens through `PortalSection` path-suffix checks. This is the main maintainability and regression-risk concentration.
2. `index.css` is a 3,268-line global style sheet; `landing.css` adds a second set of public-site tokens. Tailwind v4 is installed/configured and used for some utility markup, but most portal/landing appearance comes from semantic CSS classes and hard-coded color values. Treat one token source as authoritative and extract domain components gradually.
3. The mobile portal renders a slide-in sidebar drawer with Escape handling, focus trapping/restoration, and backdrop. It does **not** render `.patient-bottom-nav` or `.doctor-bottom-nav`, although `index.css` contains extensive styles for those selectors. At widths under 768px, `.portal-main` still reserves 78px bottom padding for the absent fixed nav. This is a source-verified mismatch; its visual impact should be checked during responsive acceptance.
4. `AuthPage` always renders the Google sign-in anchor. It displays a server-returned configuration error only after OAuth returns; there is no client configuration/status read to disable or explain the button before click. Email and phone-code states do have busy/error/success messaging.
5. `/doctor/profile` is presented as “Practice profile,” but `ProfilePage` only allows the doctor display name to be changed; qualifications, specialization, bio, contact details, and timezone returned by the profile API are not editable there. Do not redesign the form as if those fields were supported without a separately approved workflow.
6. `/patient/account` and `/doctor/account` share `AccountPage`, which only links/verifies a phone number. The page copy says “Manage how you sign in,” so the scope currently covers only one sign-in method.
7. `/doctor/calendar` is a day/week appointment agenda grouped by date, not a month grid or drag-to-reschedule calendar. `ServicesPage` creates and pauses/enables services; it does not offer service editing, though the API supports PATCH. Payment screens show history only. No frontend payment flow, email/SMS notifications, refund flow, or admin workspace exists.
8. `/services`, `/consultations`, `/contact`, and `/faq` intentionally reuse the same long landing component and scroll to a section; `/doctor/reports` redirects to `/doctor/patients`. These are aliases/redirects rather than unique screens. Anchor destinations and sticky header need direct-entry checks.
9. Legal text is hard-coded in `StaticPage.tsx` and should receive practice-owner/legal review. Landing copy includes service-quality assertions such as “unhurried” and “not a rushed 5-minute call”; confirm those claims before publication. The landing hero also contains an illustrative portal mockup; label/keep it clearly illustrative so it cannot be mistaken for live patient data.
10. `AuthProvider` catches all `/auth/me` errors and sets `user` to null, conflating network/server failure with a signed-out session. `AppErrorBoundary`, lazy-route loading, and role guards exist, but authenticated behavior and error recovery have not been verified end-to-end in this pass.
11. CSS contains bottom-nav selectors that have no matching rendered component; audit/delete them only in an implementation batch after deciding the final navigation pattern. `replace-layout.cjs` is present but has no source/package reference found; leave it untouched until its intended status is confirmed.

### Proposed information architecture

- **Public practice site:** home; about; philosophy; consultations/how-it-works; services; FAQ; contact/next step; privacy; terms. Section aliases stay intentional and point to real anchored sections.
- **Access and recovery:** patient sign-in/registration; provisioned clinician sign-in; phone OTP and Google OAuth states; forgot/reset password; global loading, authorization redirect, error recovery, and not-found states.
- **Patient portal:** overview/next step; book a visit; appointments/list and detail; care history; reports/documents; prescriptions; payment history; notifications; profile; account/phone linking.
- **Clinician workspace:** today overview/request triage; calendar agenda; appointment list/detail with intake, shared reports, consultation documentation and prescription; patient directory and longitudinal chart; availability; services; Calendar/Meet integration; payment history; notifications; practice profile; account/phone linking.
- **No admin IA:** `ADMIN` exists in the auth type, but no admin route/API screen is implemented.

### Visual system proposal

The source already contains a viable light base. Consolidate it instead of layering another theme: warm paper `#F7F5EF`, near-white surface `#FFFEFB`, mineral border `#E2DED2`, deep botanical ink `#26342E`, muted text `#66736B`, evergreen action `#486C56` with darker hover/active colors, and restrained clay accent `#A96249`. Use Figtree for UI/data and Newsreader for editorial headings, with system fallbacks. Keep patient, clinician, and public compositions distinct while sharing the tokens. Favor editorial rhythm, clear next steps, high legibility, and restrained state motion; no purple gradients, glass effects, simulated metrics, or unsupported clinical/security claims. Check text/interactive contrast against WCAG AA rather than assuming the current muted colors pass.

### Reusable component/feature structure proposal

1. `app/`: router, lazy boundaries, page-level error and not-found states.
2. `design-system/`: tokens, buttons, fields, status/empty/error, page header, accessible dialog, responsive table/list primitives.
3. `public/`: public shell, header/mobile drawer, landing sections, legal/info content, footer.
4. `auth/`: sign-in/register method panels, Google state, phone OTP, recovery/reset.
5. `portal/shared/`: portal shell, role navigation, notification link, session/error state.
6. `portal/patient/`: overview, booking wizard, appointments/detail, care timeline, documents, prescriptions, payment history, notifications, profile/account.
7. `portal/doctor/`: overview, agenda, appointment/consultation workflow, patient directory/chart, services/availability, integrations, history, notifications, profile/account.
8. `lib/api.ts` and auth context remain the API/session boundary. Preserve request paths, payloads, status transitions, upload constraints, and role guards while extracting.

### Redesign order and acceptance

1. Lock route matrix, page ownership, content truth, tokens and component contracts.
2. Refactor shared shell and foundations; resolve mobile nav decision and remove unused spacing only with viewport proof.
3. Public sections, legal/info pages, authentication and recovery.
4. Patient booking and appointment detail first, then overview/history/reports/prescriptions/profile/account/payment history/notifications.
5. Clinician appointment triage and consultation documentation, then patient chart, directory, schedule, services/availability, integrations, profile/account/payment history/notifications.
6. Verify every route at 1440, 1280, 1024, 768, 480, 390, 360px; check keyboard-only navigation, dialog focus/escape, reduced motion, direct route entry, loading/error/empty/success, both roles, booking/upload, accept/decline/cancel, complete consultation, prescription issue, and Calendar connect/disconnect with test accounts/provider setup.

### Verified versus unverified

- **Verified from source:** route declarations, components, API call sites, currently implemented controls and client state branches described above; 39 literal routes plus wildcard; no frontend testing framework in `client/package.json`; no admin UI; no implemented payment execution.
- **Build evidence:** client TypeScript typecheck and Vite production build passed during this audit.
- **Not verified:** patient/doctor authenticated runtime because no role-specific test walkthrough was performed; actual phone OAuth/Google/payment provider behavior; all seven target viewport widths; complete keyboard/screen-reader behavior; whether unverified marketing/legal statements are factually approved. These remain acceptance tasks, not assumptions of success.

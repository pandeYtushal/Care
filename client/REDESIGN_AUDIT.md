# Frontend redesign audit and proposal

> Baseline findings and implementation proposal. Progress and remaining acceptance checks are tracked in `FRONTEND_REDESIGN.md`.

## Scope reviewed

Reviewed the route tree in `src/App.tsx`, the shared patient/clinician implementation in `src/pages/PortalPage.tsx`, public and legal pages, authentication and recovery forms, the footer, global styles, Tailwind/Vite setup, and the current frontend route inventory. This is a frontend and experience audit; no API, database, authentication, or clinical workflow changes are proposed in this redesign.

The current route tree includes public landing/section routes, privacy and terms, login and registration, password recovery, patient portal routes, clinician portal routes, appointment and patient record details, and a wildcard error state. Several public section URLs resolve to one long landing page, and most authenticated data screens share conditional routing in the large `PortalPage.tsx` module.

## Findings

1. **The visual system is inconsistent.** `index.html` loads Figtree and Newsreader, while `index.css` separately imports Inter and Plus Jakarta Sans and assigns Plus Jakarta Sans to the display face. Typography therefore does not follow one deliberate system. The current blue-gray canvas and saturated turquoise palette also feel more like generic software than a personal care practice.
2. **Public surfaces use several unrelated visual languages.** The landing page uses a dark zinc footer and near-black actions, legal pages introduce indigo gradients, and the portal uses a separate green scheme. Components and interaction patterns do not carry one recognizable practice identity from discovery through care.
3. **Styling has accumulated in competing layers.** `legacy.css`, the Tailwind theme/utilities, a long component stylesheet, mobile overrides, and inline styles all contribute presentation. The extra cascade makes small adjustments unpredictable and helped create previous overlap and spacing defects.
4. **The authenticated surface is difficult to maintain.** `PortalPage.tsx` is a large component module containing routing decisions, data views, appointment workflows, clinical documentation, and role-specific states. A visual refresh must preserve those behaviors and route contracts; a mass component/architecture rewrite would make regressions harder to isolate.
5. **The two portal roles need distinct emphasis.** Patients need reassurance, booking, visit readiness, and understandable records. Clinicians need scannable schedules, request triage, patient context, and efficient documentation. They should share brand tokens and accessible controls without feeling like the same workspace with a different sidebar color.
6. **Content limits the kind of redesign that is safe.** Qualification, pricing, contact, privacy, and clinical claims must remain grounded in supplied facts. Visual polish must not invent credentials, clinical assurances, testimonials, or legal promises.
7. **The mobile navigation issue has been repaired, but the screenshot exposed the larger visual problem.** The old public menu exposed the page beneath it and allowed its actions to collide with page content. The drawer now uses an independent full-screen layer; the full redesign will retain and recheck that behavior.

## Reference notes

- Motion's current public site presents distinct, strongly paced sections and makes interaction/motion part of the craft. Its own documentation emphasizes native-feeling gestures, layout transitions, spring motion, and reduced-motion handling. I will use restrained transition and feedback patterns, not constant animation or movement that distracts from care tasks. [Motion](https://motion.dev/)
- `offbrand.com` currently redirects to a parked domain, so its current design could not be inspected. I will not claim to reproduce it. The requested direction—less templated, more art-directed and emotionally grounded—will guide an original visual system instead.

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

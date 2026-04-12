# Privacy Policy Page & Cookie Banner — Design Spec

## Goal

Add GDPR-compliant privacy disclosures to Redline: a `/privacy` page with all Article 13 required information, an informational cookie banner for first-time visitors, and a persistent footer with a privacy link.

## Context

- Redline is EU-first. GDPR applies.
- No cookies, no analytics, no tracking. Only `localStorage` usage is `redline-theme` (dark/light preference).
- Contract text is sent to OpenAI (GPT-4.1-nano) for analysis — this is the main privacy-relevant data flow.
- No user accounts, no server-side storage of contract content.
- Currently a single-page app with no footer.

## Architecture

Three new pieces, all frontend-only:

1. **`/privacy` page** — new Next.js route, static server component
2. **`CookieBanner` component** — client component, rendered in `layout.tsx`
3. **`Footer` component** — server component, rendered in `layout.tsx`

No backend changes. No new dependencies.

---

## 1. Privacy Policy Page

### Route

`/privacy` — `frontend/src/app/privacy/page.tsx`. Static server component (no client-side state).

### Content (GDPR Article 13 disclosures)

Each section maps to a required GDPR disclosure:

1. **Identity & contact** — Operator name (Sebastian Giupana, individual developer). Contact email for privacy inquiries (user to provide during implementation).

2. **What data we process**
   - Contract text: uploaded by the user, sent to third-party AI for analysis.
   - Theme preference: stored in browser `localStorage` (`redline-theme`).
   - No cookies. No accounts. No PII collected. No server-side logs of contract content.

3. **Purpose & legal basis**
   - Contract text: performance of the service the user requests (Art. 6(1)(b)).
   - Theme preference: legitimate interest in functional UX (Art. 6(1)(f)).

4. **Third-party processors**
   - **OpenAI** (GPT-4.1-nano): contract text sent for clause extraction and risk analysis. Link to OpenAI's [privacy policy](https://openai.com/privacy) and [DPA](https://openai.com/policies/data-processing-addendum).
   - **Vercel**: frontend hosting. Link to Vercel's [privacy policy](https://vercel.com/legal/privacy-policy).
   - **Railway**: backend hosting. Link to Railway's [privacy policy](https://railway.com/legal/privacy).

5. **Data retention**
   - Contract text is processed in-memory and discarded after the response is returned. Not stored on any server.
   - Theme preference persists in browser `localStorage` until the user clears it.

6. **International data transfers**
   - OpenAI processes data in the United States, covered under their DPA with Standard Contractual Clauses (SCCs).
   - Vercel and Railway may process data outside the EU under their respective DPAs.

7. **Your rights**
   - Right to access, rectification, erasure, restriction of processing, data portability, objection.
   - Right to lodge a complaint with a supervisory authority.
   - Since no personal data is stored server-side, most rights are satisfied by default — there is nothing to access, correct, or delete.
   - Contact email provided for any requests.

8. **Changes to this policy**
   - "Last updated" date displayed at top of page.
   - Material changes communicated via updated date.

### Styling

- Same `max-w-4xl` container as main page, consistent `px-5 sm:px-7` padding.
- Prose-style typography: existing heading font (`--font-heading`) for `h1`/`h2`, body font (`--font-body`) for paragraphs.
- Existing color tokens: `--text-primary`, `--text-secondary`, `--text-tertiary` for hierarchy.
- No new CSS variables. No new components beyond the page itself.
- A simple back-link to `/` at the top (text link, not a button).

---

## 2. Cookie Banner

### Component

`CookieBanner` — client component (`"use client"`). File: `frontend/src/components/CookieBanner.tsx`.

### Behavior

- **Shows on first visit:** no `redline-cookie-dismissed` key in `localStorage`.
- **Dismissing:** sets `localStorage.setItem("redline-cookie-dismissed", "true")`. Banner hides.
- **Subsequent visits:** checks on mount, stays hidden if key exists.
- **Non-blocking:** does not prevent interaction. Content scrolls behind it.

### Layout

Full-width bar pinned to bottom of viewport. Contains:
- **Text:** "Redline uses localStorage for theme preference only. No cookies or tracking."
- **Link:** "Privacy Policy" pointing to `/privacy`.
- **Button:** "Got it" — dismisses the banner.

Single line on desktop, wraps naturally on mobile.

### Styling

Matches existing sticky bottom bar pattern (ReportView/StreamingReportView export bar):
- `fixed inset-x-0 bottom-0`
- `border-t border-[var(--border-primary)]`
- `bg-[var(--bg-primary)]/95 backdrop-blur-sm`
- Same padding (`px-5 py-3.5 sm:px-7`), font sizes (`text-[15px]`), and color tokens.
- Banner uses `z-30`; report export bar uses `z-40` (stacks above if both are visible, though unlikely — user has likely dismissed the banner before reaching the report).

### Placement

Rendered in `layout.tsx`, outside of `{children}`, so it appears on every page.

### Hydration

Uses `useState` + `useEffect` to read `localStorage` on mount (avoids SSR mismatch). Returns `null` during SSR and when dismissed.

---

## 3. Footer

### Component

`Footer` — server component. File: `frontend/src/components/Footer.tsx`.

### Content

Single line: `Redline · Privacy Policy`

- "Privacy Policy" is a link to `/privacy`.
- Muted text (`--text-muted`), small font (`text-sm`).

### Styling

- Same `max-w-4xl` container, centered.
- Sits at the natural bottom of page content (not sticky, not fixed).
- Top border (`border-t border-[var(--border-primary)]`) with vertical padding.
- Sufficient bottom margin to clear the cookie banner / export bar when present.

### Placement

Rendered in `layout.tsx`, below `{children}`, above `CookieBanner`.

---

## File Inventory

| Action | File |
|--------|------|
| Create | `frontend/src/app/privacy/page.tsx` |
| Create | `frontend/src/components/CookieBanner.tsx` |
| Create | `frontend/src/components/Footer.tsx` |
| Modify | `frontend/src/app/layout.tsx` |

---

## What This Spec Does NOT Cover

- Terms of service (separate concern, not requested).
- Cookie consent gate with accept/reject (not needed — no non-essential storage).
- Backend changes (no server-side privacy infrastructure needed).
- Analytics integration (none planned).

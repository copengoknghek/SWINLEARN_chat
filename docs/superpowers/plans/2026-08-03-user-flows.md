# Role User Flow Diagrams

I'm using the writing-plans skill to create this implementation plan.

## Goal

Produce two documentation artifacts (no app code changes) that explain **as-is** navigation and key journeys for admin / teacher / student, with a short **Gaps / future** section.

## Deliverables

| File | Role |
|------|------|
| [docs/user-flows.md](../../user-flows.md) | Source of truth: prose + Mermaid |
| [docs/user-flows.html](../../user-flows.html) | Standalone shareable view (Mermaid CDN) |
| [docs/superpowers/specs/2026-08-03-user-flows-design.md](../specs/2026-08-03-user-flows-design.md) | Short design record from brainstorming |
| [docs/superpowers/plans/2026-08-03-user-flows.md](./2026-08-03-user-flows.md) | This plan |

## Grounding (read-only sources)

- Routes: `src/App.tsx`
- Nav labels: `src/features/swinlearn/lib/workspace/navigation.ts`
- Course sections: `src/features/swinlearn/pages/shared/courseDetailSections.ts` (`home`, `modules`, `assignments`, `grades`, `community`)
- Registration approve/reject on admin Course Offer API
- Help/consultation: Admin Requests + Teacher Requests (forwarded consultations)
- AI/CV: student `/student/swinlearn`

## Document outline (`docs/user-flows.md`)

1. Purpose (as-is + gaps callouts)
2. Shared entry flowchart: public → login → change-password (optional) → role home
3. Three role sitemaps (`flowchart TB`)
4. Five journey diagrams:
   - Registration & approval (Student Register → Admin Course Offer)
   - Course learning loop (modules / assignments / grades / community)
   - Help / Inbox / Requests / consultation
   - SWINLEARN AI + Perfect CV
   - Admin setup (users → courses → course offer)
5. Gaps / future (bullets only)

## Conventions

- Mermaid only; no custom fill colors
- Captions above each diagram
- HTML mirrors markdown sections with TOC; load Mermaid from CDN
- Do not invent UI that does not exist; mark uncertainty in Gaps

## Implementation steps

1. Write design spec under `docs/superpowers/specs/`
2. Author `docs/user-flows.md`
3. Author `docs/user-flows.html`
4. Spot-check paths against `App.tsx` / `navigation.ts`
5. Save this plan copy
6. Skip `graphify update .` (no code changes)

## Out of scope

- App routes, UI, or backend changes
- Auto-generating diagrams from code
- Redesign of future flows beyond short gap notes

## Status

Completed 2026-08-03.

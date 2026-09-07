# User flows diagrams — design

**Date:** 2026-08-03  
**Status:** Approved (brainstorming)

## Problem

Swinlearn has three workspace roles (admin, teacher, student) plus shared public entry. There was no single diagram documenting as-is navigation and cross-role journeys.

## Decisions (approved)

| Choice | Decision |
|--------|----------|
| Scope | Sitemap per role **and** key cross-role journeys |
| Truthfulness | **As-is** first, with short **Gaps / future** callouts |
| Deliverable | Single markdown Mermaid source **plus** standalone HTML (Mermaid CDN) |
| Journey coverage | Full product surface: academic, help/inbox/requests, AI + Perfect CV, admin setup, community/gamification where present |

## Approach

One source of truth (`docs/user-flows.md`) mirrored by `docs/user-flows.html`. No app routes or UI changes. Diagrams grounded in `App.tsx`, `navigation.ts`, and `courseDetailSections.ts`.

## Out of scope

- Redesigning future UX beyond gap notes
- Auto-generating diagrams from code
- In-app React “flows” page

## Deliverables

- `docs/user-flows.md`
- `docs/user-flows.html`
- `docs/superpowers/plans/2026-08-03-user-flows.md`

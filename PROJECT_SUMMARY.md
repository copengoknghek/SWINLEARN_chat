# Swinlearn — Project Summary

> A full-stack learning management system (LMS) built for **Swinburne University's Vietnam campuses** (Hanoi, Da Nang, Ho Chi Minh City). It combines a traditional LMS (courses, curriculum, assignments, grades) with a Swinburne-branded public site, an AI study assistant, and a student community / gamification layer.

---

## 1. Overview

The codebase is a single monorepo containing:

- A **public marketing site** (`src/features/swinburne/**`) — Home, News, Events, Calendar, Courses pages.
- A **workspace / LMS app** (`src/features/swinlearn/**`) — role-based UIs for `student`, `teacher`, and `admin`.
- An **Express API + Prisma/MySQL backend** (`server/`, `prisma/`).
- An **AI / RAG subsystem** using Qdrant + Ollama + LLM routers (Groq / Gemini).

Corpus scale (per the in-repo graphify knowledge graph): **267 source files, ~404K words, 2554 graph nodes, 4244 edges, 201 communities**.

---

## 2. Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, React Router 7, react-markdown + remark-gfm, FontAwesome |
| Backend | Node.js, Express 5, Multer (uploads), node-cron (scheduler) |
| Database | MySQL 8 via Prisma 6 ORM |
| Vector search / AI | Qdrant (`@qdrant/js-client-rest`), Ollama embeddings (`nomic-embed-text`), Groq / Gemini for chat + intent routing |
| Document I/O | pdfkit, exceljs, officeparser, word-extractor |
| Dev infra | Docker Compose (mysql, qdrant, ollama, api, web), nodemon, ESLint |

Dev entry point is `npm run dev` → Docker Compose brings up Vite (`:5173`), API (`:3001`), MySQL (`:3307`), Qdrant (`:6333`), and Ollama (`:11434`).

---

## 3. Architecture

```
┌───────────────────────────────┐        ┌──────────────────────────────┐
│  React SPA (Vite, TS)         │  HTTP  │  Express API (server/)       │
│  - swinburne (public site)    ├───────►│  - routes/auth.js            │
│  - swinlearn (workspace)      │        │  - routes/workspace.js       │
│    student / teacher / admin  │        │  - routes/admin.js           │
└───────────────────────────────┘        │  - services/* (RAG, grades…) │
                                         └────┬──────────────┬──────────┘
                                              │ Prisma       │ HTTP
                                         ┌────▼─────┐  ┌─────▼────────┐
                                         │ MySQL 8  │  │ Qdrant +     │
                                         │ (Prisma) │  │ Ollama (RAG) │
                                         └──────────┘  └──────────────┘
```

The backend is organized into three route groups (`server/routes/auth.js`, `workspace.js`, `admin.js`) plus a services layer (`server/services/`) for grade analysis, intent routing, RAG indexing, gamification scheduling, and consultation logic. `server/docker-start.js` orchestrates dependency waits, Prisma migrations, and optional demo seeding on startup.

---

## 4. Core Domains

Derived from the Prisma schema and the graphify community structure.

- **Identity & access** — `UserRole` (admin / teacher / student), `ProfileStatus`, `Campus` (hanoi / danang / hcm), session-based auth (`useAuthContext`, `attachUser`).
- **Academic model** — courses, main / child majors, curriculum rules (core / elective / major, scoped global / main / child), prerequisites (credit-point thresholds and course-alternative groups), course offerings, staff assignments (teacher / TA), sessions (class / lab / event / consultation).
- **Registration & enrolment** — registration requests (pending / approved / rejected) evaluated against curriculum rules and prerequisites.
- **Assignments & content** — assignments with submissions, plus a course-content module system (`packages` → `modules` → `items` → `assets`) with a **Canvas course import** pipeline.
- **Grades & analytics** — GPA calculation, grade bands, warnings, goal tracking, "required remaining average" projection, and full **PDF + XLSX grade report exports**.
- **AI assistant ("Swinlearn" chat)** — threaded chat with attachments and knowledge indexes; an intent router classifies queries (grade analysis, course knowledge QA, CV export, capabilities, …) and dispatches to specialized handlers; RAG over course knowledge and assignments via Qdrant.
- **Perfect CV** — LLM-assisted CV builder that pulls from submitted student projects and exports to Word / PDF.
- **Community** — posts, comments, likes, image and GIF attachments, share events, community groups and connections.
- **Inbox / messaging** — direct threads, forwarding of help requests to teachers.
- **Consultations & help** — bookable consultation rooms, help requests routed through teacher / admin approval flows.
- **Gamification** — gold economy, badges (champion tiers), share rewards, scheduled via `node-cron`.
- **Admin tooling** — user CRUD with campus filters, Excel import / export templates, course / curriculum administration, course-offer configuration.

---

## 5. Notable Cross-Cutting Utilities

Highest-degree "god nodes" in the graph indicate the shared infrastructure that most other modules depend on:

- `apiRequest()` — **83 edges** — the frontend HTTP client, used by every workspace page.
- `httpError()` / `sendError()` — unified backend error responses.
- `useAuthContext()` — auth state consumed by workspace, community, and admin surfaces.
- `handleSwinlearnMessage()` — the central AI-chat dispatcher.
- `routeIntent()` — LLM-driven intent classifier bridging grade analysis, knowledge QA, and CV flows.

---

## 6. Development & Tooling

- **Prisma workflow**: `prisma:migrate`, `prisma:seed` (opt-in demo data via `SWINLEARN_SEED_DEMO_DATA=true`), `prisma:seed:rooms`, `prisma:clear-demo`.
- **Agent tooling in-repo**: this project is instrumented with a rich agent skill stack — a graphify knowledge graph (`graphify-out/`), agentmemory for cross-session memory, and design / process skills (`ui-ux-pro-max`, `design-taste-frontend`, `ponytail`, superpowers TDD). Orchestration is defined in `.cursor/rules/skills-orchestration.mdc` and `AGENTS.md`.
- **Optional agentmemory service** runs in a separate Compose file (`docker-compose.agentmemory.yml`) so it does not clutter the main stack.

---

## 7. One-Paragraph Abstract

> Swinlearn is a React 19 + Express 5 + MySQL learning management system tailored to Swinburne University's Vietnam campuses. It provides role-based experiences for students, teachers, and administrators covering the full academic lifecycle — curriculum and prerequisite modelling, course offerings and enrolment, assignments and content delivery (including Canvas import), and grade analytics with PDF / XLSX exports. On top of the traditional LMS, it layers an AI study assistant that uses Qdrant + Ollama embeddings and an LLM intent router to answer course questions, analyse grades, and generate CVs from submitted student work, alongside a community / inbox / gamification layer with posts, direct messaging, badges, and a gold economy. The stack is orchestrated with Docker Compose for reproducible local development and is instrumented with an agent-tooling layer (graphify, agentmemory, superpowers skills) to support AI-assisted engineering.

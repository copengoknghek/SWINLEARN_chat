# SwinLearn Chatbot — Manual End-to-End Test Checklist

This checklist walks through the **entire chatbot feature** in the running app to
verify it behaves correctly for real students — including the key requirement that
the bot understands the *meaning* of natural-language input (paraphrases, "yessss",
typos, English/Vietnamese, polite forms), not exact string matches.

## Prerequisites

- App running via Docker: `npm run dev` (uses `docker-compose.yml`).
- API keys configured in `.env` (see `.env.example`):
  - `GEMINI_API_KEY` — optional. Intent routing + smalltalk.
  - `GROQ_API_KEY` — required. Tutor answers, grade-intent classification,
    CV/Perfect CV, **and intent routing when Gemini is not configured**.
  - Groq-only setup: when `GEMINI_API_KEY` is absent, the chatbot routes intent
    through Groq, so free-typed requests like "i want to see my grade table"
    still reach the grade flow (no need to click the Export button).
- Logged in as a **student** enrolled in at least one course that has indexed
  knowledge content.
- A browser open at the SwinLearn workspace → **Swinlearn** page
  (`src/features/swinlearn/pages/student/SwinlearnPage/SwinlearnPage.tsx`).
- The backend endpoint under test is `POST /api/workspace/swinlearn/threads/:id/messages`
  (see `server/routes/workspace.js`).

## How to use

For each item: send the **Input** phrasing(s) in the chat composer, then verify the
**Expected** behavior. Mark Pass/Fail. If an item fails, capture the exact input and
the bot's reply and file it with the failing automated case from
`server/services/nluEval.live.test.mjs`.

> Tip: to specifically stress "meaning vs if/else", prefer the *paraphrased* and
> *sloppy* phrasings over the literal ones — they are what the automated live NLU
> eval also covers.

---

## 1. Grade table — show, refine & export

- **Input:** "cho mình xem bảng điểm", "whats my gpa", "export my grade table please",
  "i want to see my grade table"
- **Expected:** Bot returns a grade table (course codes, scores, grades) and offers
  to analyse it. `metadata.contentType` = `grade_export`. This works for **free-typed**
  requests even without a Gemini key (routing falls back to Groq).
- **Refine (iterative):** after the table, try "just show only the P ones",
  "show me the pass and distinction", "the fails only". The bot re-filters the table
  to those grades and keeps offering analysis.
- **Export:** click the export button → a downloadable file (markdown/excel) is produced.
- **Language:** if you type in English, the bot replies in English; if you type in
  Vietnamese, it replies in Vietnamese (the clarification/offer text follows your input).
- Pass / Fail: ___

## 2. Grade analysis — agree (messy replies)

- After the offer above, reply with each:
  - "yessss"
  - "ok nha"
  - "uh được"
  - "y"
- **Expected:** Each is understood as **agree**; bot advances to ask the graduation
  goal. `metadata.analysisState` = `awaiting_goal`.
- Also try a rejection: "nope" / "thôi khỏi" → understood as **decline**.
- Pass / Fail: ___

## 3. Grade analysis — pick a goal (words & numbers)

- Reply with each:
  - "giỏi" / "3" / "distinction" / "mức ba"
  - "xuất sắc" / "HD" / "4"
  - "C" / "2"
- **Expected:** Each maps to the correct target grade (1–4) and the bot returns a
  tailored analysis (`metadata.analysisState` = `complete`,
  `metadata.contentType` = `grade_analysis`).
- Pass / Fail: ___

## 4. Course knowledge QA — paraphrased questions

- **Input:** "can you summary this course for me please", "tóm tắt giúp mình môn này với",
  "cho mình hỏi cái đề tài chương 2 là gì", "where do i submit assignment 3"
- **Expected:** Bot answers from the **enrolled** course's indexed knowledge, with
  citations, in a Socratic/tutor tone. It should NOT invent content outside enrolled
  courses.
- Pass / Fail: ___

## 5. Tutor explanation — understandable, not doing the work

- **Input:** "explain what a variable is in week 1", "help me understand recursion
  without giving the full answer"
- **Expected:** Bot explains clearly and simply, guides rather than completing
  assignments, and cites sources where relevant.
- Pass / Fail: ___

## 6. CV export — from submitted projects

- **Input:** "make me a CV from my submitted projects", "export a resume for COS30034"
- **Expected:** Bot scopes to your submitted assignments and produces a CV export
  (`metadata.contentType` = `cv_export` with `assignmentIds`).
- Pass / Fail: ___

## 7. Perfect CV

- From the CV panel/intent, trigger Perfect CV with selected projects.
- **Expected:** Bot assembles a structured Perfect CV (`metadata.contentType` =
  `perfect_cv_export`) including profile, education, skills, and experience.
- Pass / Fail: ___

## 8. Smalltalk & typo'd / Vietnamese chatter

- **Input:** "hey there", "cảm ơn nhaa", "ban la ai vay", "hôm nay trời đẹp quá"
- **Expected:** Handled as smalltalk (friendly reply), not misrouted to grade/course.
- Pass / Fail: ___

## 9. Course-scope guard

- **Input:** ask about a course you are **not** enrolled in, e.g. "explain COS99999
  assignment 1"
- **Expected:** Bot returns the scoped/excluded-course message and does not retrieve
  or answer from that course's content.
- Pass / Fail: ___

## 10. Mixed-language robustness

- **Input:** "mình muốn xem điểm nhưng explain câu 2 giúp mình với" (blend of goals)
- **Expected:** Intent is resolved sensibly (the explicit/primary feature wins); no
  crash and no fallback loop.
- Pass / Fail: ___

---

## Automated counterparts

| Manual item | Automated test |
|---|---|
| 1–3 | `server/services/swinlearnMessageHandler.test.mjs` (grade flows) + `nluEval.live.test.mjs` (live agree/target) |
| 4–5 | `swinlearnMessageHandler.test.mjs` (document_qa RAG) + `nluEval.live.test.mjs` (intent routing) |
| 6–7 | `swinlearnMessageHandler.test.mjs` (cv_export, perfect_cv) |
| 8 | `swinlearnMessageHandler.test.mjs` (smalltalk) + `nluEval.live.test.mjs` |
| 9 | `swinlearnMessageHandler.test.mjs` (excluded scope) |
| All NLU | `server/services/swinlearnNluParsing.test.mjs` (offline) + `nluEval.live.test.mjs` (live) |

Run the offline suite with `npm test`. Run the live NLU eval with
`RUN_LIVE_NLU=1 node --test server/services/nluEval.live.test.mjs` (requires keys).

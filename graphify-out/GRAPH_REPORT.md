# Graph Report - swinlearn  (2026-06-17)

## Corpus Check
- 88 files · ~262,533 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 783 nodes · 1413 edges · 58 communities (50 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c0b17f63`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 58|Community 58]]

## God Nodes (most connected - your core abstractions)
1. `apiRequest()` - 41 edges
2. `httpError()` - 25 edges
3. `useAuthContext()` - 19 edges
4. `scripts` - 17 edges
5. `compilerOptions` - 17 edges
6. `compilerOptions` - 16 edges
7. `tasteskill: Anti-Slop Frontend Skill` - 16 edges
8. `Appendix B - Canonical Sources (read these before reinventing)` - 15 edges
9. ``users`` - 13 edges
10. `evaluateCourseEligibility()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `AdminUsersPage()` --calls--> `useAuthContext()`  [EXTRACTED]
  src/features/swinlearn/pages/admin/AdminUsersPage.tsx → src/context/AuthContext.tsx
- `InboxPage()` --calls--> `useAuthContext()`  [EXTRACTED]
  src/features/swinlearn/pages/shared/InboxPage.tsx → src/context/AuthContext.tsx
- `RegisterCoursesPage()` --calls--> `useAuthContext()`  [EXTRACTED]
  src/features/swinlearn/pages/student/RegisterCoursesPage.tsx → src/context/AuthContext.tsx
- `createApp()` --calls--> `asyncHandler()`  [EXTRACTED]
  server/app.js → server/http.js
- `attachUser()` --calls--> `getSessionUser()`  [EXTRACTED]
  server/auth-middleware.js → server/services/session.js

## Import Cycles
- 3-file cycle: `src/features/swinlearn/lib/workspace/api.ts -> src/features/swinlearn/lib/workspace/types.ts -> src/hooks/useAuth.ts -> src/features/swinlearn/lib/workspace/api.ts`

## Communities (58 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (24): blockedHtmlTags, buildAssetLookup(), collectAssignmentSources(), copyAssetEntries(), encodePublicPath(), findEndOfCentralDirectory(), importCanvasCourseContent(), normalizeCanvasCourseData() (+16 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (45): dependencies, dotenv, express, multer, @prisma/client, react, react-dom, react-router-dom (+37 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (18): ChangePasswordPage(), AuthContext, AuthContextValue, AuthProvider(), AuthProviderProps, useAuthContext(), useAuth(), LoginPage() (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (10): CalendarView, CoursesPage(), normalizeSearch(), pluralize(), fanpageEvents, fanpageNews, features, footerLinks (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (41): apiRequest(), ApiRequestOptions, addCourseMember(), addStudentCourseCompletion(), ApiAuthPayload, approveCourseRegistrationRequest(), byTitle(), changePassword() (+33 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (19): offeringsInclude, upload, visibleOfferingIds(), visibleOfferingWhere(), mapAssignment(), mapCourse(), mapCourseContentAsset(), mapCourseContentItem() (+11 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (22): AdminUserCreateResult, AdminUserData, AssignmentStatus, CatalogData, CourseContentAssetRow, CourseContentItemType, CourseContentModuleRow, CourseContentPackageRow (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (23): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (21): AdminUsersPage(), campusLabels, CreateUserForm, CredentialResult, csvRowsToUsers(), EditUserForm, emptyCreateForm, emptyEditForm (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (21): APPENDICES - Real Source-Backed Reference Material, Appendix A - Install Commands per Design System, Appendix B - Canonical Sources (read these before reinventing), Appendix C - Apple Liquid Glass: Honest Web Approximation, Apple Liquid Glass (Apple platforms only), Atlassian, Bootstrap, Carbon (+13 more)

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (5): CalendarItem, fetchWorkspaceCourses(), AssignmentRow, CourseSessionRow, CourseWithMembers

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (35): CourseDialogMode, courseMatchesSearch(), CourseSaveCurriculumRuleInput, CourseSearchRow, courseToForm(), ExistingRule, filterCourseRows(), getCourseSaveCurriculumRuleError() (+27 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.29
Nodes (16): `assignment_submissions`, `assignments`, `child_majors`, `course_offerings`, `course_sessions`, `course_staff`, `courses`, `curriculum_rules` (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (3): Answer, Q: How should future Codex sessions use Graphify and agentmemory in this repo?, Source Nodes

### Community 16 - "Community 16"
Cohesion: 0.17
Nodes (12): 4.10 Quotes & Testimonials, 4.11 Page Theme Lock (Light / Dark Mode Consistency), 4.1 Typography, 4.2 Color Calibration, 4.3 Layout Diversification, 4.4 Materiality, Shadows, Cards, 4.5 Interactive UI States, 4.6 Data & Form Patterns (+4 more)

### Community 17 - "Community 17"
Cohesion: 0.20
Nodes (10): 10. REFERENCE VOCABULARY (Pattern Names the Agent Should Know), Animation Library Choice, Cards & Containers, Galleries & Media, Hero Paradigms, Layout & Grids, Micro-Interactions & Effects, Navigation & Menus (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.20
Nodes (10): 13. OUT OF SCOPE, 14. FINAL PRE-FLIGHT CHECK, 2.A When to reach for a real design system (use official packages), 2.B When the brief is an aesthetic, not a system, 2. BRIEF → DESIGN SYSTEM MAP, 7. DIAL DEFINITIONS (Technical Reference), DESIGN_VARIANCE (Level 1-10), MOTION_INTENSITY (Level 1-10) (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (8): 9.A Visual & CSS, 9. AI TELLS (Forbidden Patterns), 9.B Typography, 9.C Layout & Spacing, 9.D Content & Data ("Jane Doe" Effect), 9.E External Resources & Components, 9.F Production-Test Tells (banned outright), 9.G EM-DASH BAN (the single most-violated Tell)

### Community 20 - "Community 20"
Cohesion: 0.25
Nodes (7): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 21 - "Community 21"
Cohesion: 0.34
Nodes (13): baselineExistingDatabaseIfNeeded(), countFromQueryRow(), createPrismaClient(), executable(), getDatabaseMigrationState(), getMigrationNames(), main(), run() (+5 more)

### Community 22 - "Community 22"
Cohesion: 0.29
Nodes (7): 11.A Detect the Mode (first action), 11.B Audit Before Touching, 11.C Preservation Rules, 11.D Modernisation Levers (priority order), 11.E Decision Tree: Targeted Evolution vs Full Redesign, 11.F What Never Changes Silently, 11. REDESIGN PROTOCOL

### Community 23 - "Community 23"
Cohesion: 0.29
Nodes (7): 3.A Stack, 3.B State, 3.C Icons, 3.D Emoji Policy, 3. DEFAULT ARCHITECTURE & CONVENTIONS, 3.E Responsiveness & Layout Mechanics, 3.F Dependency Verification (mandatory)

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (7): 6.A Hardware Acceleration, 6.B Reduced Motion (mandatory), 6.C Dark Mode (mandatory for any consumer-facing page), 6.D Core Web Vitals Targets, 6.E DOM Cost, 6.F Z-Index Restraint, 6. PERFORMANCE & ACCESSIBILITY GUARDRAILS

### Community 25 - "Community 25"
Cohesion: 0.29
Nodes (7): ChildMajor, CourseUnit, getChildMajorById(), getMainMajorById(), MainMajor, MajorAccent, majorDatabase

### Community 26 - "Community 26"
Cohesion: 0.40
Nodes (5): 12.A File Location, 12.B Required Frontmatter, 12.C Required Body Sections, 12.D Block-Library Discipline, 12. THE BLOCK LIBRARY (Contract - Implementations Land Here Iteratively)

### Community 27 - "Community 27"
Cohesion: 0.40
Nodes (5): 5.A Sticky-Stack - Canonical Skeleton, 5.B Horizontal-Pan - Canonical Skeleton, 5.C Scroll-Reveal Stagger - Canonical Skeleton (lighter alternative), 5. CONTEXT-AWARE PROACTIVITY, 5.D Forbidden Animation Patterns

### Community 28 - "Community 28"
Cohesion: 0.40
Nodes (5): 8.A Token Strategy (pick one, stick to it), 8.B Do Not Prescribe Specific Colors Here, 8.C Default Mode, 8.D Test in Both Modes Before Finishing, 8. DARK MODE PROTOCOL

### Community 29 - "Community 29"
Cohesion: 0.23
Nodes (10): activeRegistrationOfferings(), evaluateRegistrationSelection(), requireStudentRegistrationContext(), evaluateRegistrationBasket(), loadPrerequisiteContext(), prerequisiteFailureMessage(), approveRegistrationRequest(), rejectRegistrationRequest() (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (5): Docker MySQL, MySQL Development, MySQL Workbench, Native MySQL, Stop Containers

### Community 31 - "Community 31"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 32 - "Community 32"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 33 - "Community 33"
Cohesion: 0.50
Nodes (3): For /graphify explain, For /graphify path, graphify reference: query, path, explain

### Community 34 - "Community 34"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 42 - "Community 42"
Cohesion: 0.14
Nodes (11): AuthProfile, AuthUser, Role, UseAuthReturn, InboxPage(), createInboxThread(), logout(), roleAllowedRecipient() (+3 more)

### Community 43 - "Community 43"
Cohesion: 0.20
Nodes (16): courseContentUpload, createUserRecord(), offeringsInclude, readCreditPoints(), validatePrerequisiteGroups(), httpError(), requireBodyString(), readAdminUserCreateInput() (+8 more)

### Community 44 - "Community 44"
Cohesion: 0.11
Nodes (19): mapChildMajor(), mapCoursePrerequisiteGroup(), mapCoursePrerequisiteOption(), mapCourseRegistrationRequest(), mapCurriculumRule(), byCourseCode(), courseKey(), findChildMajor() (+11 more)

### Community 45 - "Community 45"
Cohesion: 0.22
Nodes (12): demoCourseCodes, demoUserIds, authPayload(), prisma, mapUserProfile(), clearSessionCookie(), createSession(), deleteSessionForRequest() (+4 more)

### Community 46 - "Community 46"
Cohesion: 0.26
Nodes (14): assertStaffCanTeachCourse(), assertTeacherCanTeachCourse(), loadTeachingEligibilityContext(), childMajorIdFromRule(), courseIdFromRule(), field(), getCourseTeachingMainMajorIds(), getIneligibleStaffForCourse() (+6 more)

### Community 47 - "Community 47"
Cohesion: 0.14
Nodes (14): memberProfileName(), CourseDetailPage(), defaultAssignmentForm(), itemTypeLabel, toDateTimeLocalValue(), termLabels, createAssignment(), profileName() (+6 more)

### Community 48 - "Community 48"
Cohesion: 0.10
Nodes (28): AdminCourseOfferPage(), currentYear, emptyOfferingForm(), memberRoleLabel, termLabels, toReadableDate(), CourseOfferFilters, CourseOfferFilterValue (+20 more)

### Community 49 - "Community 49"
Cohesion: 0.80
Nodes (4): `course_prerequisite_groups`, `course_prerequisite_options`, `courses`, `student_course_completions`

### Community 50 - "Community 50"
Cohesion: 0.40
Nodes (5): 0.A Read these signals first, 0.B Output a one-line "Design Read" before generating, 0. BRIEF INFERENCE (Read the Room Before Anything Else), 0.C If the brief is ambiguous, ask one question, do not guess, 0.D Anti-Default Discipline

### Community 51 - "Community 51"
Cohesion: 0.28
Nodes (12): adminRouter, authRouter, workspaceRouter, app, createApp(), attachUser(), requireAuth(), requireRole() (+4 more)

### Community 52 - "Community 52"
Cohesion: 0.20
Nodes (10): MyCoursesPage(), getRegistrationBlockedMessage(), RegisterCoursesPage(), termLabels, courseLabel(), getErrorMessage(), CourseTerm, RegistrationBasketResult (+2 more)

### Community 53 - "Community 53"
Cohesion: 0.32
Nodes (7): aiCurriculumCourses, aiPrerequisitesByCourseCode, curriculumRuleForCourse(), main(), passwordHash, seedAiPrerequisites(), seededCourseId()

### Community 54 - "Community 54"
Cohesion: 0.73
Nodes (5): `assignments`, `course_content_assets`, `course_content_items`, `course_content_modules`, `course_content_packages`

### Community 56 - "Community 56"
Cohesion: 0.50
Nodes (4): 1.A Dial Inference (design read → dial values), 1.B Use-Case Presets, 1.C How the Dials Drive Output, 1. THE THREE DIALS (Core Configuration)

## Knowledge Gaps
- **297 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+292 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `tasteskill: Anti-Slop Frontend Skill` connect `Community 18` to `Community 9`, `Community 16`, `Community 17`, `Community 50`, `Community 19`, `Community 22`, `Community 23`, `Community 56`, `Community 24`, `Community 26`, `Community 27`, `Community 28`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `main()` connect `Community 21` to `Community 51`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _297 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1310344827586207 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11397849462365592 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.06090808416389812 - nodes in this community are weakly interconnected._
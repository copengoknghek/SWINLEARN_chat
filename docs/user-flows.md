# Swinlearn user flows

As-is navigation and journeys for **admin**, **teacher**, and **student**. Grounded in current routes (`src/App.tsx`), workspace nav (`navigation.ts`), and course detail sections. Short **Gaps / future** notes call out missing or awkward pieces — not a redesign.

Companion view: [user-flows.html](./user-flows.html) (open in a browser; needs network for Mermaid CDN).

---

## 1. Shared entry

Public marketing site → login → optional forced password change → role workspace home.

```mermaid
flowchart TB
  Home["/ Home"]
  Courses["/courses"]
  News["/news"]
  Events["/events"]
  Login["/login"]
  ChangePw["/change-password"]
  AdminHome["/admin/courses"]
  TeacherHome["/teacher/my-courses"]
  StudentHome["/student/my-courses"]

  Home --> Login
  Courses --> Login
  News --> Login
  Events --> Login
  Login --> ChangePw
  Login --> AdminHome
  Login --> TeacherHome
  Login --> StudentHome
  ChangePw --> AdminHome
  ChangePw --> TeacherHome
  ChangePw --> StudentHome
```

---

## 2. Role sitemaps

### Admin (`/admin`)

Nav: Courses, Course Offer, Users, Requests, Inbox, Account. Default home: `/admin/courses`.

```mermaid
flowchart TB
  Admin["/admin"]
  Courses["courses"]
  Offer["course-offer"]
  Users["users"]
  Requests["requests"]
  Inbox["inbox"]
  Account["account"]

  Admin --> Courses
  Admin --> Offer
  Admin --> Users
  Admin --> Requests
  Admin --> Inbox
  Admin --> Account
```

### Teacher (`/teacher`)

Nav: Teaching courses, Calendar, Inbox, Requests, Help, Account. Course detail sections nest under a course.

```mermaid
flowchart TB
  Teacher["/teacher"]
  MyCourses["my-courses"]
  Detail["my-courses/:courseId"]
  Home["home"]
  Modules["modules"]
  Assignments["assignments"]
  Grades["grades"]
  Community["community"]
  Calendar["calendar"]
  Inbox["inbox"]
  Requests["requests"]
  Help["help"]
  Account["account"]

  Teacher --> MyCourses
  MyCourses --> Detail
  Detail --> Home
  Detail --> Modules
  Detail --> Assignments
  Detail --> Grades
  Detail --> Community
  Teacher --> Calendar
  Teacher --> Inbox
  Teacher --> Requests
  Teacher --> Help
  Teacher --> Account
```

### Student (`/student`)

Nav: My courses, Register, Calendar, Inbox, Help, Account, SWINLEARN. Same course detail sections as teacher.

```mermaid
flowchart TB
  Student["/student"]
  MyCourses["my-courses"]
  Detail["my-courses/:courseId"]
  Home["home"]
  Modules["modules"]
  Assignments["assignments"]
  Grades["grades"]
  Community["community"]
  Register["register"]
  Calendar["calendar"]
  Inbox["inbox"]
  Help["help"]
  Account["account"]
  AI["swinlearn"]

  Student --> MyCourses
  MyCourses --> Detail
  Detail --> Home
  Detail --> Modules
  Detail --> Assignments
  Detail --> Grades
  Detail --> Community
  Student --> Register
  Student --> Calendar
  Student --> Inbox
  Student --> Help
  Student --> Account
  Student --> AI
```

---

## 3. Cross-role journeys

### 3.1 Registration and approval

Student submits registration requests; admin approves or rejects on Course Offer (not the Admin Requests page).

```mermaid
sequenceDiagram
  actor Student
  actor Admin
  participant Register as /student/register
  participant Offer as /admin/course-offer
  participant System

  Student->>Register: Browse offerings, check eligibility
  Student->>Register: Submit registration request
  Register->>System: Create pending request
  Admin->>Offer: Review pending requests for offering
  alt Approve
    Admin->>Offer: Approve
    Offer->>System: Enrol student
    System-->>Student: Course appears in My courses
  else Reject
    Admin->>Offer: Reject
    System-->>Student: Status rejected on Register
  end
```

### 3.2 Course learning loop

Shared course surface for enrolled students and assigned teachers. Community and share/gamification live inside the course.

```mermaid
flowchart TB
  List["My courses / Teaching courses"]
  Open["Open course detail"]
  Home["home"]
  Modules["modules — content packages"]
  Assignments["assignments — submit / manage"]
  Grades["grades — view / analyse"]
  Community["community — posts, comments, likes"]
  Share["Share post — badges / gold"]

  List --> Open
  Open --> Home
  Open --> Modules
  Open --> Assignments
  Open --> Grades
  Open --> Community
  Community --> Share
```

### 3.3 Help, Inbox, and consultation requests

General help and consultations go through Admin Requests. Consultations can be forwarded to a teacher; teachers respond on Teacher Requests. Inbox handles messaging.

```mermaid
sequenceDiagram
  actor Requester as Student or Teacher
  actor Admin
  actor Teacher
  participant Help as /help
  participant AdminReq as /admin/requests
  participant TeacherReq as /teacher/requests
  participant Inbox as /inbox

  Requester->>Help: Submit general or consultation request
  Help-->>AdminReq: Request appears as submitted
  alt General help
    Admin->>AdminReq: Approve or reject
  else Consultation
    Admin->>AdminReq: Forward to teacher optional room
    AdminReq-->>TeacherReq: Forwarded consultation
    Teacher->>TeacherReq: Respond approve or decline
  end
  Requester->>Inbox: Message threads / follow-ups
  Admin->>Inbox: Message threads
  Teacher->>Inbox: Message threads
```

### 3.4 SWINLEARN AI and Perfect CV

Student-only workspace page: threaded chat with intent routing (grades, course knowledge, CV, capabilities) and Perfect CV edit/export.

```mermaid
sequenceDiagram
  actor Student
  participant AI as /student/swinlearn
  participant System

  Student->>AI: Open SWINLEARN, create or select thread
  Student->>AI: Send message optional attachments
  AI->>System: Route intent grades / QA / CV / other
  System-->>AI: Reply citations or CV draft
  alt Perfect CV
    Student->>AI: Pick projects, edit CV
    Student->>AI: Export Word or PDF
  else Grade report
    Student->>AI: Request grade analysis / export
  end
```

### 3.5 Admin setup

Typical admin path to open offerings for registration: users → courses/curriculum → course offer (staff, offerings, registration approvals).

```mermaid
flowchart TB
  Users["/admin/users — CRUD, campus, import/export"]
  Courses["/admin/courses — courses, curriculum, prerequisites"]
  Offer["/admin/course-offer — offerings, staff, registration approve/reject"]
  Requests["/admin/requests — help and consultations"]
  Inbox["/admin/inbox"]

  Users --> Courses
  Courses --> Offer
  Offer --> Requests
  Requests --> Inbox
```

---

## 4. Gaps / future

- No dedicated student hub for pending registrations beyond the Register page itself.
- Community is course-scoped only (no global community nav item).
- SWINLEARN AI and Perfect CV are student-only; teachers/admins have no equivalent workspace page.
- Teacher Requests covers forwarded consultations, not course registration.
- Admin has no My courses / calendar / help nav items (help/requests are admin-facing via Requests).
- Course detail path uses optional `:section`; default section behaviour is app-defined — document consumers should treat `home` as the primary entry.
- Diagrams are maintained manually; update this file when routes or nav change.

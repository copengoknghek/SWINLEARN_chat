create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'student',
  full_name text,
  display_name text,
  campus text,
  student_id text,
  must_change_password boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('admin', 'teacher', 'student')),
  constraint profiles_campus_check check (campus is null or campus in ('hanoi', 'danang', 'hcm')),
  constraint profiles_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.managed_user_credentials (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  temp_password text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists campus text;
alter table public.profiles add column if not exists student_id text;
alter table public.profiles add column if not exists must_change_password boolean not null default false;
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create unique index if not exists profiles_student_id_unique
  on public.profiles(student_id)
  where student_id is not null and student_id <> '';

do $$
begin
  alter table public.profiles
    add constraint profiles_campus_check check (campus is null or campus in ('hanoi', 'danang', 'hcm'));
exception
  when duplicate_object then null;
end $$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, display_name, role, campus, student_id, must_change_password, status)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    case
      when new.raw_user_meta_data->>'role' in ('admin', 'teacher', 'student')
        then new.raw_user_meta_data->>'role'
      else 'student'
    end,
    case
      when new.raw_user_meta_data->>'campus' in ('hanoi', 'danang', 'hcm')
        then new.raw_user_meta_data->>'campus'
      else null
    end,
    new.raw_user_meta_data->>'student_id',
    case
      when new.raw_user_meta_data->>'must_change_password' = 'true' then true
      else false
    end,
    'active'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        display_name = coalesce(public.profiles.display_name, excluded.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (
  id,
  email,
  full_name,
  display_name,
  role,
  campus,
  student_id,
  must_change_password,
  status
)
select
  users.id,
  users.email,
  coalesce(
    users.raw_user_meta_data->>'full_name',
    users.raw_user_meta_data->>'display_name',
    split_part(users.email, '@', 1)
  ),
  coalesce(
    users.raw_user_meta_data->>'display_name',
    users.raw_user_meta_data->>'full_name',
    split_part(users.email, '@', 1)
  ),
  case
    when users.raw_user_meta_data->>'role' in ('admin', 'teacher', 'student')
      then users.raw_user_meta_data->>'role'
    else 'student'
  end,
  case
    when users.raw_user_meta_data->>'campus' in ('hanoi', 'danang', 'hcm')
      then users.raw_user_meta_data->>'campus'
    else null
  end,
  users.raw_user_meta_data->>'student_id',
  case
    when users.raw_user_meta_data->>'must_change_password' = 'true' then true
    else false
  end,
  'active'
from auth.users
on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      display_name = coalesce(public.profiles.display_name, excluded.display_name),
      campus = coalesce(public.profiles.campus, excluded.campus),
      student_id = coalesce(public.profiles.student_id, excluded.student_id);

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.complete_password_change()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set must_change_password = false
  where id = auth.uid();

  delete from public.managed_user_credentials
  where user_id = auth.uid();
end;
$$;

create table if not exists public.main_majors (
  id text primary key,
  title text not null,
  summary text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.child_majors (
  id text primary key,
  main_major_id text not null references public.main_majors(id) on delete cascade,
  title text not null,
  summary text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  child_major_id text not null references public.child_majors(id) on delete restrict,
  code text not null,
  title text not null,
  description text not null default '',
  semester text not null default 'current',
  academic_year integer not null default extract(year from now())::integer,
  status text not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_semester_check check (semester in ('previous', 'current', 'next')),
  constraint courses_status_check check (status in ('active', 'archived')),
  unique (code, semester, academic_year)
);

create table if not exists public.course_memberships (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint course_memberships_role_check check (role in ('teacher', 'teaching_assistant', 'student')),
  unique (course_id, user_id)
);

create unique index if not exists one_teaching_assistant_per_course
  on public.course_memberships(course_id)
  where role = 'teaching_assistant';

create or replace function public.has_course_role(course_id_value uuid, role_values text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.course_memberships
    where course_id = course_id_value
      and user_id = auth.uid()
      and role = any(role_values)
  );
$$;

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  due_at timestamptz not null,
  status text not null default 'published',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_status_check check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  file_paths text[] not null default '{}',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table if not exists public.course_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  session_type text not null default 'class',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint course_sessions_type_check check (session_type in ('class', 'lab', 'event', 'consultation'))
);

create table if not exists public.inbox_threads (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  course_id uuid references public.courses(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inbox_thread_participants (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.inbox_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (thread_id, user_id)
);

create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.inbox_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create or replace function public.can_access_assignment(assignment_id_value uuid, role_values text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    join public.course_memberships cm on cm.course_id = a.course_id
    where a.id = assignment_id_value
      and cm.user_id = auth.uid()
      and cm.role = any(role_values)
  );
$$;

create or replace function public.can_submit_assignment(assignment_id_value uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_assignment(assignment_id_value, array['student']);
$$;

create or replace function public.is_thread_participant(thread_id_value uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.inbox_thread_participants
    where thread_id = thread_id_value
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_thread_creator(thread_id_value uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.inbox_threads
    where id = thread_id_value
      and created_by = auth.uid()
  );
$$;

create or replace function public.prevent_course_without_teacher()
returns trigger
language plpgsql
as $$
declare
  course_id_to_check uuid;
begin
  if tg_table_name = 'courses' then
    course_id_to_check = coalesce(old.id, new.id);
  else
    course_id_to_check = coalesce(old.course_id, new.course_id);
  end if;

  if exists (
    select 1
    from public.courses
    where id = course_id_to_check
      and status = 'active'
  ) and not exists (
    select 1
    from public.course_memberships
    where course_id = course_id_to_check
      and role = 'teacher'
  ) then
    raise exception 'A course must have at least one teacher';
  end if;

  return null;
end;
$$;

drop trigger if exists course_requires_teacher_after_membership_change on public.course_memberships;
create constraint trigger course_requires_teacher_after_membership_change
  after insert or update or delete on public.course_memberships
  deferrable initially deferred
  for each row execute function public.prevent_course_without_teacher();

drop trigger if exists course_requires_teacher_after_course_change on public.courses;
create constraint trigger course_requires_teacher_after_course_change
  after insert or update on public.courses
  deferrable initially deferred
  for each row execute function public.prevent_course_without_teacher();

create or replace function public.create_course_with_teacher(
  p_child_major_id text,
  p_code text,
  p_title text,
  p_description text,
  p_semester text,
  p_academic_year integer,
  p_status text,
  p_teacher_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  next_course_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access is required';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_teacher_id
      and role = 'teacher'
      and status = 'active'
  ) then
    raise exception 'A valid active teacher is required';
  end if;

  insert into public.courses (
    child_major_id,
    code,
    title,
    description,
    semester,
    academic_year,
    status,
    created_by
  )
  values (
    p_child_major_id,
    p_code,
    p_title,
    p_description,
    p_semester,
    p_academic_year,
    p_status,
    auth.uid()
  )
  returning id into next_course_id;

  insert into public.course_memberships (course_id, user_id, role)
  values (next_course_id, p_teacher_id, 'teacher');

  return next_course_id;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_courses_updated_at on public.courses;
create trigger touch_courses_updated_at before update on public.courses
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_assignments_updated_at on public.assignments;
create trigger touch_assignments_updated_at before update on public.assignments
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_assignment_submissions_updated_at on public.assignment_submissions;
create trigger touch_assignment_submissions_updated_at before update on public.assignment_submissions
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_inbox_threads_updated_at on public.inbox_threads;
create trigger touch_inbox_threads_updated_at before update on public.inbox_threads
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.managed_user_credentials enable row level security;
alter table public.main_majors enable row level security;
alter table public.child_majors enable row level security;
alter table public.courses enable row level security;
alter table public.course_memberships enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.course_sessions enable row level security;
alter table public.inbox_threads enable row level security;
alter table public.inbox_thread_participants enable row level security;
alter table public.inbox_messages enable row level security;

drop policy if exists "Authenticated users can read active profiles" on public.profiles;
create policy "Authenticated users can read active profiles"
  on public.profiles for select
  to authenticated
  using (status = 'active' or id = auth.uid() or public.is_admin());

drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Users can update own profile basics" on public.profiles;

drop policy if exists "Admins can manage temporary credentials" on public.managed_user_credentials;
create policy "Admins can manage temporary credentials"
  on public.managed_user_credentials for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Authenticated users can read main majors" on public.main_majors;
create policy "Authenticated users can read main majors"
  on public.main_majors for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage main majors" on public.main_majors;
create policy "Admins can manage main majors"
  on public.main_majors for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Authenticated users can read child majors" on public.child_majors;
create policy "Authenticated users can read child majors"
  on public.child_majors for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage child majors" on public.child_majors;
create policy "Admins can manage child majors"
  on public.child_majors for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Course members can read courses" on public.courses;
create policy "Course members can read courses"
  on public.courses for select
  to authenticated
  using (
    public.is_admin()
    or public.has_course_role(id, array['teacher', 'teaching_assistant', 'student'])
  );

drop policy if exists "Admins can manage courses" on public.courses;
create policy "Admins can manage courses"
  on public.courses for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Course users can read memberships" on public.course_memberships;
create policy "Course users can read memberships"
  on public.course_memberships for select
  to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or public.has_course_role(course_id, array['teacher', 'teaching_assistant'])
  );

drop policy if exists "Admins can manage memberships" on public.course_memberships;
create policy "Admins can manage memberships"
  on public.course_memberships for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Course users can read assignments" on public.assignments;
create policy "Course users can read assignments"
  on public.assignments for select
  to authenticated
  using (
    public.is_admin()
    or public.has_course_role(course_id, array['teacher', 'teaching_assistant', 'student'])
  );

drop policy if exists "Teachers can manage assignments" on public.assignments;
create policy "Teachers can manage assignments"
  on public.assignments for all
  to authenticated
  using (
    public.is_admin()
    or public.has_course_role(course_id, array['teacher', 'teaching_assistant'])
  )
  with check (
    public.is_admin()
    or public.has_course_role(course_id, array['teacher', 'teaching_assistant'])
  );

drop policy if exists "Course users can read submissions" on public.assignment_submissions;
create policy "Course users can read submissions"
  on public.assignment_submissions for select
  to authenticated
  using (
    public.is_admin()
    or student_id = auth.uid()
    or public.can_access_assignment(assignment_id, array['teacher', 'teaching_assistant'])
  );

drop policy if exists "Students can submit assignments" on public.assignment_submissions;
create policy "Students can submit assignments"
  on public.assignment_submissions for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and public.can_submit_assignment(assignment_id)
  );

drop policy if exists "Students can update own submissions" on public.assignment_submissions;
create policy "Students can update own submissions"
  on public.assignment_submissions for update
  to authenticated
  using (student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and public.can_submit_assignment(assignment_id)
  );

drop policy if exists "Course users can read sessions" on public.course_sessions;
create policy "Course users can read sessions"
  on public.course_sessions for select
  to authenticated
  using (
    public.is_admin()
    or public.has_course_role(course_id, array['teacher', 'teaching_assistant', 'student'])
  );

drop policy if exists "Teachers can manage sessions" on public.course_sessions;
create policy "Teachers can manage sessions"
  on public.course_sessions for all
  to authenticated
  using (
    public.is_admin()
    or public.has_course_role(course_id, array['teacher', 'teaching_assistant'])
  )
  with check (
    public.is_admin()
    or public.has_course_role(course_id, array['teacher', 'teaching_assistant'])
  );

drop policy if exists "Participants can read threads" on public.inbox_threads;
create policy "Participants can read threads"
  on public.inbox_threads for select
  to authenticated
  using (public.is_admin() or created_by = auth.uid() or public.is_thread_participant(id));

drop policy if exists "Authenticated users can create threads" on public.inbox_threads;
create policy "Authenticated users can create threads"
  on public.inbox_threads for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Thread creators can update threads" on public.inbox_threads;
create policy "Thread creators can update threads"
  on public.inbox_threads for update
  to authenticated
  using (public.is_admin() or public.is_thread_participant(id))
  with check (public.is_admin() or public.is_thread_participant(id));

drop policy if exists "Participants can read participant rows" on public.inbox_thread_participants;
create policy "Participants can read participant rows"
  on public.inbox_thread_participants for select
  to authenticated
  using (public.is_admin() or user_id = auth.uid() or public.is_thread_participant(thread_id));

drop policy if exists "Thread creators can add participants" on public.inbox_thread_participants;
create policy "Thread creators can add participants"
  on public.inbox_thread_participants for insert
  to authenticated
  with check (
    public.is_admin()
    or user_id = auth.uid()
    or public.is_thread_creator(thread_id)
  );

drop policy if exists "Participants can update own read state" on public.inbox_thread_participants;
create policy "Participants can update own read state"
  on public.inbox_thread_participants for update
  to authenticated
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

drop policy if exists "Participants can read messages" on public.inbox_messages;
create policy "Participants can read messages"
  on public.inbox_messages for select
  to authenticated
  using (public.is_admin() or public.is_thread_participant(thread_id));

drop policy if exists "Participants can send messages" on public.inbox_messages;
create policy "Participants can send messages"
  on public.inbox_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_thread_participant(thread_id)
  );

insert into public.main_majors (id, title, summary, sort_order) values
  ('business', 'Business', 'Business, management, analytics, marketing, and entrepreneurship programs.', 1),
  ('media', 'Media', 'Digital media, animation, film, design, and creative communication programs.', 2),
  ('computer-science', 'Computer Science', 'Software, AI, data, networks, cyber security, and games programs.', 3)
on conflict (id) do update
  set title = excluded.title,
      summary = excluded.summary,
      sort_order = excluded.sort_order;

insert into public.child_majors (id, main_major_id, title, summary, sort_order) values
  ('business-analytics', 'business', 'Business Analytics', 'Data-driven decision-making, forecasting, and dashboards.', 1),
  ('marketing', 'business', 'Marketing', 'Campaign planning, customer insight, brand, and digital channels.', 2),
  ('international-business', 'business', 'International Business', 'Global markets, trade, and cross-cultural business practice.', 3),
  ('entrepreneurship', 'business', 'Entrepreneurship', 'New venture planning, validation, and launch strategy.', 4),
  ('project-management', 'business', 'Project Management', 'Scope, people, risk, budgets, and delivery outcomes.', 5),
  ('digital-media', 'media', 'Digital Media', 'Interactive content, production, platforms, and audience engagement.', 1),
  ('animation', 'media', 'Animation', '2D and 3D animation, motion design, and storyboarding.', 2),
  ('film-television', 'media', 'Film & Television', 'Screenwriting, production planning, cinematography, and editing.', 3),
  ('graphic-design', 'media', 'Graphic Design', 'Brand identity, typography, layout, and digital design.', 4),
  ('creative-writing', 'media', 'Creative Writing', 'Narrative craft, scripts, editing, and contemporary writing.', 5),
  ('artificial-intelligence', 'computer-science', 'Artificial Intelligence', 'Machine learning, computer vision, NLP, and automation.', 1),
  ('software-development', 'computer-science', 'Software Development', 'Web, mobile, backend, cloud, and agile software delivery.', 2),
  ('data-analysis', 'computer-science', 'Data Analysis', 'Analytics, statistics, visualization, and predictive modelling.', 3),
  ('cyber-security', 'computer-science', 'Cyber Security', 'Network security, ethical hacking, forensics, and risk management.', 4),
  ('networking', 'computer-science', 'Networking', 'Switching, routing, cloud infrastructure, and network operations.', 5),
  ('games-development', 'computer-science', 'Games Development', 'Gameplay programming, engines, graphics, and interactive design.', 6)
on conflict (id) do update
  set main_major_id = excluded.main_major_id,
      title = excluded.title,
      summary = excluded.summary,
      sort_order = excluded.sort_order;

insert into public.courses (id, child_major_id, code, title, description, semester, academic_year, status) values
  ('00000000-0000-4000-8000-000000000101', 'software-development', 'COS10009', 'Introduction to Programming', 'Programming fundamentals, testing, and problem solving with practical labs.', 'current', 2026, 'archived'),
  ('00000000-0000-4000-8000-000000000102', 'data-analysis', 'DAT10001', 'Data Analytics Foundations', 'Spreadsheets, SQL, visualization, and introductory analytics methods.', 'current', 2026, 'archived'),
  ('00000000-0000-4000-8000-000000000103', 'cyber-security', 'CYB10001', 'Cyber Security Principles', 'Security fundamentals, threat models, controls, and incident response.', 'next', 2026, 'archived'),
  ('00000000-0000-4000-8000-000000000104', 'business-analytics', 'BUS10012', 'Business Information Systems', 'Business process, systems thinking, and information management.', 'current', 2026, 'archived'),
  ('00000000-0000-4000-8000-000000000105', 'digital-media', 'MDA10001', 'Digital Media Studio', 'Digital storytelling, platform production, and interactive media practice.', 'previous', 2026, 'archived')
on conflict (code, semester, academic_year) do update
  set child_major_id = excluded.child_major_id,
      title = excluded.title,
      description = excluded.description,
      status = excluded.status;

insert into storage.buckets (id, name, public)
values ('assignment-files', 'assignment-files', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Students can upload own assignment files" on storage.objects;
create policy "Students can upload own assignment files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'assignment-files'
    and owner = auth.uid()
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.can_submit_assignment(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Course users can read assignment files" on storage.objects;
create policy "Course users can read assignment files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'assignment-files'
    and (
      owner = auth.uid()
      or public.is_admin()
      or public.can_access_assignment(((storage.foldername(name))[1])::uuid, array['teacher', 'teaching_assistant'])
    )
  );

alter table public.inbox_messages replica identity full;
alter table public.inbox_thread_participants replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.inbox_messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.inbox_thread_participants;
exception
  when duplicate_object then null;
end $$;

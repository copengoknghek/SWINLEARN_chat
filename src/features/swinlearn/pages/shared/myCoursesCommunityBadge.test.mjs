import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const myCoursesPage = readFileSync(new URL('./MyCoursesPage.tsx', import.meta.url), 'utf8')
const courseDetailPage = readFileSync(new URL('./CourseDetailPage.tsx', import.meta.url), 'utf8')

test('student course card renders people-roof community icon with badge support', () => {
  assert.match(myCoursesPage, /faPeopleRoof/)
  assert.match(myCoursesPage, /FontAwesomeIcon/)
  assert.match(myCoursesPage, /communityUnreadCount/)
  assert.match(myCoursesPage, /workspace-course-card-badge/)
  assert.match(myCoursesPage, /buildCourseDetailPath\('student', course\.id, 'community'\)/)
})

test('student course card uses split layout with community link outside main course link', () => {
  assert.match(myCoursesPage, /workspace-course-card-link/)
  assert.match(myCoursesPage, /workspace-course-card-actions--footer/)
  assert.match(myCoursesPage, /workspace-course-card-action--link/)
})

test('teacher course card keeps single-link layout without community icon link', () => {
  assert.match(myCoursesPage, /isStudent &&/)
  assert.doesNotMatch(myCoursesPage, /buildCourseDetailPath\('teacher'/)
})

test('CourseDetailPage marks community read for students after load', () => {
  assert.match(courseDetailPage, /markCommunityRead/)
  assert.match(courseDetailPage, /communityReadMarkedRef/)
  assert.match(courseDetailPage, /workspaceRole === 'student'/)
})

test('student course card shows notify badge class when community has unread', () => {
  assert.match(myCoursesPage, /workspace-course-card-badge--notify/)
  assert.match(myCoursesPage, /communityUnreadCount > 0 \?/)
})

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import HomePage from './features/swinburne/pages/HomePage/HomePage'
import CoursesPage from './features/swinburne/pages/CoursesPage/CoursesPage'
import NewsPage from './features/swinburne/pages/NewsPage/NewsPage'
import EventsPage from './features/swinburne/pages/EventsPage/EventsPage'
import LoginPage from './features/swinlearn/pages/LoginPage/LoginPage'
import ChangePasswordPage from './features/swinlearn/pages/ChangePasswordPage/ChangePasswordPage'
import WorkspaceLayout from './features/swinlearn/layouts/WorkspaceLayout/WorkspaceLayout'
import AdminCourseOfferPage from './features/swinlearn/pages/admin/AdminCourseOfferPage'
import AdminCoursesPage from './features/swinlearn/pages/admin/AdminCoursesPage'
import AdminUsersPage from './features/swinlearn/pages/admin/AdminUsersPage'
import AccountPage from './features/swinlearn/pages/shared/AccountPage'
import CourseDetailPage from './features/swinlearn/pages/shared/CourseDetailPage'
import HelpPage from './features/swinlearn/pages/shared/HelpPage'
import InboxPage from './features/swinlearn/pages/shared/InboxPage'
import MyCoursesPage from './features/swinlearn/pages/shared/MyCoursesPage'
import WorkspaceCalendarPage from './features/swinlearn/pages/shared/WorkspaceCalendarPage'
import RegisterCoursesPage from './features/swinlearn/pages/student/RegisterCoursesPage'
import SwinlearnPage from './features/swinlearn/pages/student/SwinlearnPage/SwinlearnPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/events" element={<EventsPage />} />

        <Route path="/admin" element={<WorkspaceLayout workspaceRole="admin" />}>
          <Route index element={<Navigate to="courses" replace />} />
          <Route path="dashboard" element={<Navigate to="/admin/courses" replace />} />
          <Route path="my-courses" element={<Navigate to="/admin/courses" replace />} />
          <Route path="courses" element={<AdminCoursesPage />} />
          <Route path="course-offer" element={<AdminCourseOfferPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/admin/courses" replace />} />
        </Route>

        <Route path="/teacher" element={<WorkspaceLayout workspaceRole="teacher" />}>
          <Route index element={<Navigate to="my-courses" replace />} />
          <Route path="dashboard" element={<Navigate to="/teacher/my-courses" replace />} />
          <Route path="my-courses" element={<MyCoursesPage />} />
          <Route path="my-courses/:courseId/:section?" element={<CourseDetailPage />} />
          <Route path="calendar" element={<WorkspaceCalendarPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/teacher/my-courses" replace />} />
        </Route>

        <Route path="/student" element={<WorkspaceLayout workspaceRole="student" />}>
          <Route index element={<Navigate to="my-courses" replace />} />
          <Route path="dashboard" element={<Navigate to="/student/my-courses" replace />} />
          <Route path="my-courses" element={<MyCoursesPage />} />
          <Route path="my-courses/:courseId/:section?" element={<CourseDetailPage />} />
          <Route path="register" element={<RegisterCoursesPage />} />
          <Route path="calendar" element={<WorkspaceCalendarPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="swinlearn" element={<SwinlearnPage />} />
          <Route path="*" element={<Navigate to="/student/my-courses" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

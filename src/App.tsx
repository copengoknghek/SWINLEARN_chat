import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import HomePage from './pages/HomePage/HomePage'
import LoginPage from './pages/LoginPage/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage/ChangePasswordPage'
import CoursesPage from './pages/CoursesPage/CoursesPage'
import NewsPage from './pages/NewsPage/NewsPage'
import EventsPage from './pages/EventsPage/EventsPage'
import WorkspaceLayout from './layouts/WorkspaceLayout/WorkspaceLayout'
import MyCoursesPage from './pages/workspace/MyCoursesPage'
import WorkspaceCalendarPage from './pages/workspace/WorkspaceCalendarPage'
import InboxPage from './pages/workspace/InboxPage'
import HelpPage from './pages/workspace/HelpPage'
import AccountPage from './pages/workspace/AccountPage'
import SwinlearnPage from './pages/SwinlearnPage/SwinlearnPage'
import AdminCoursesPage from './pages/workspace/AdminCoursesPage'
import AdminUsersPage from './pages/workspace/AdminUsersPage'

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
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/admin/courses" replace />} />
        </Route>

        <Route path="/teacher" element={<WorkspaceLayout workspaceRole="teacher" />}>
          <Route index element={<Navigate to="my-courses" replace />} />
          <Route path="dashboard" element={<Navigate to="/teacher/my-courses" replace />} />
          <Route path="my-courses" element={<MyCoursesPage />} />
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

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TasksPage } from './pages/TasksPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { RequestTemplatesPage } from './pages/RequestTemplatesPage';
import { RecurringTasksPage } from './pages/RecurringTasksPage';
import { UsersPage } from './pages/UsersPage';
import { GroupsPage } from './pages/GroupsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { GroupChatPage } from './pages/GroupChatPage';
import { DirectChatPage } from './pages/DirectChatPage';
import { LogsPage } from './pages/LogsPage';
import { SystemSettingsPage } from './pages/SystemSettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { InfoPanelPage } from './pages/InfoPanelPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/infopanel" element={<ProtectedRoute><InfoPanelPage /></ProtectedRoute>} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tasks/my" element={<TasksPage />} />
            <Route path="/tasks/group" element={<TasksPage />} />
            <Route path="/tasks/new" element={<TasksPage />} />
            <Route path="/tasks/archive" element={<TasksPage />} />
            <Route path="/tasks/templates" element={<RequestTemplatesPage />} />
            <Route path="/tasks/:id" element={<TaskDetailPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/recurring" element={<RecurringTasksPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/chats/group" element={<GroupChatPage />} />
            <Route path="/chats/direct" element={<DirectChatPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/settings" element={<SystemSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

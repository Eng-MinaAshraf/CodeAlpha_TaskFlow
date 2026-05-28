import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import BoardPage from './pages/BoardPage';
import UserManager from './pages/UserManager';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/project/:projectId" element={<BoardPage />} />
      <Route path="/users" element={<UserManager />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

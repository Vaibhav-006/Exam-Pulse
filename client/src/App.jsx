import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

// Landing
import Home from './pages/Home';

// Teacher pages
import TeacherLogin from './pages/teacher/Login';
import TeacherRegister from './pages/teacher/Register';
import TeacherDashboard from './pages/teacher/Dashboard';
import CreateTest from './pages/teacher/CreateTest';
import MonitorRoom from './pages/teacher/MonitorRoom';
import TestResults from './pages/teacher/TestResults';

// Student pages
import StudentJoin from './pages/student/Join';
import ExamSetup from './pages/student/ExamSetup';
import ExamRoom from './pages/student/ExamRoom';
import ExamComplete from './pages/student/ExamComplete';

import PrivateRoute from './components/PrivateRoute';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Landing */}
          <Route path="/" element={<Home />} />
          <Route path="/teacher/login" element={<TeacherLogin />} />
          <Route path="/teacher/register" element={<TeacherRegister />} />

          {/* Teacher (protected) */}
          <Route path="/teacher/dashboard" element={<PrivateRoute><TeacherDashboard /></PrivateRoute>} />
          <Route path="/teacher/tests/new" element={<PrivateRoute><CreateTest /></PrivateRoute>} />
          <Route path="/teacher/tests/:testId/monitor" element={<PrivateRoute><MonitorRoom /></PrivateRoute>} />
          <Route path="/teacher/tests/:testId/results" element={<PrivateRoute><TestResults /></PrivateRoute>} />

          {/* Student (no auth) */}
          <Route path="/join" element={<StudentJoin />} />
          <Route path="/exam/setup" element={<ExamSetup />} />
          <Route path="/exam/room" element={<ExamRoom />} />
          <Route path="/exam/complete" element={<ExamComplete />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

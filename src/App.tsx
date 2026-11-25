import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { TeacherPage } from './pages/TeacherPage';
import { StudentJoinPage } from './pages/StudentJoinPage';
import { StudentPlayPage } from './pages/StudentPlayPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/teacher" element={<TeacherPage />} />
        <Route path="/join" element={<StudentJoinPage />} />
        <Route path="/play/:sessionId" element={<StudentPlayPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

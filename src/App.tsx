import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Toast from './components/common/Toast';
import HomePage from './pages/HomePage';

// The editor pulls in React Flow; keep the home page light.
const EditorPage = lazy(() => import('./pages/EditorPage'));

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/editor/:projectId"
          element={
            <Suspense fallback={<div className="grid-bg h-full" />}>
              <EditorPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </HashRouter>
  );
}

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Rotas lazy — zero peso para quem não acessa
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const AdminPanelPage = lazy(() => import('./pages/AdminPanelPage'));
const RifaPage       = lazy(() => import('./pages/RifaPage'));

export default function App() {
  return (
    <Routes>
      {/* Rifa do Chá de Casa Nova */}
      <Route
        path="/rifa"
        element={
          <Suspense fallback={null}>
            <RifaPage />
          </Suspense>
        }
      />

      {/* Painel admin */}
      <Route
        path="/login"
        element={
          <Suspense fallback={null}>
            <AdminLoginPage />
          </Suspense>
        }
      />
      <Route
        path="/admin"
        element={
          <Suspense fallback={null}>
            <AdminPanelPage />
          </Suspense>
        }
      />

      {/* Qualquer outra rota → /rifa */}
      <Route path="*" element={<Navigate to="/rifa" replace />} />
    </Routes>
  );
}

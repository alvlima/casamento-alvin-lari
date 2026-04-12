import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainSite from './pages/MainSite';

// Rotas lazy — zero peso para quem não acessa
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const AdminPanelPage = lazy(() => import('./pages/AdminPanelPage'));
const RifaPage       = lazy(() => import('./pages/RifaPage'));

export default function App() {
  return (
    <Routes>
      {/* Site principal do casamento */}
      <Route path="/" element={<MainSite />} />

      {/* Rifa do Chá de Casa Nova — rota isolada, sem navegação para outros lugares */}
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
    </Routes>
  );
}

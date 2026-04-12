import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminPanel } from '../components/AdminPanel';

export default function AdminPanelPage() {
  const navigate = useNavigate();

  // Guard: redireciona para /login se não autenticado
  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') !== 'true') {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth');
    navigate('/login', { replace: true });
  };

  const handleClose = () => navigate('/');

  if (sessionStorage.getItem('admin_auth') !== 'true') return null;

  return <AdminPanel onClose={handleClose} onLogout={handleLogout} />;
}

import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import GuestPage from './GuestPage.jsx';
import StaffDashboard from './StaffDashboard.jsx';
import StaffLogin from './StaffLogin.jsx';

function StaffGuard() {
  const [token, setToken] = useState(() => sessionStorage.getItem('staffToken') || '');

  function handleSuccess(newToken) {
    setToken(newToken);
  }

  function handleLogout() {
    sessionStorage.removeItem('staffToken');
    setToken('');
  }

  if (!token) return <StaffLogin onSuccess={handleSuccess} />;
  return <StaffDashboard token={token} onLogout={handleLogout} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/"      element={<GuestPage />} />
      <Route path="/staff" element={<StaffGuard />} />
    </Routes>
  );
}

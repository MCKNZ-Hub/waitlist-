import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import GuestPage from './GuestPage.jsx';
import StaffDashboard from './StaffDashboard.jsx';
import StaffLogin from './StaffLogin.jsx';

function StaffGuard() {
  const [token, setToken] = useState(() => sessionStorage.getItem('staffToken') || '');
  const [role,  setRole]  = useState(() => sessionStorage.getItem('staffRole')  || 'host');

  function handleSuccess(newToken, newRole) {
    sessionStorage.setItem('staffToken', newToken);
    sessionStorage.setItem('staffRole',  newRole);
    setToken(newToken);
    setRole(newRole);
  }

  function handleLogout() {
    sessionStorage.removeItem('staffToken');
    sessionStorage.removeItem('staffRole');
    setToken('');
    setRole('host');
  }

  if (!token) return <StaffLogin onSuccess={handleSuccess} />;
  return <StaffDashboard token={token} role={role} onLogout={handleLogout} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/"      element={<GuestPage />} />
      <Route path="/staff" element={<StaffGuard />} />
    </Routes>
  );
}

import { useState, useEffect } from 'react';
import AuthPage from './pages/AuthPage';
import Navbar from './components/Navbar';
import CitizenDashboard from './pages/CitizenDashboard';
import AdminDashboard from './pages/AdminDashboard';
import StaffDashboard from './pages/StaffDashboard';
import type { User } from './types';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('civic_inbox_token'));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('civic_inbox_user');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    } else {
      localStorage.removeItem('civic_inbox_token');
      localStorage.removeItem('civic_inbox_user');
      setToken(null);
      setUser(null);
    }
  }, [token]);

  const handleAuthSuccess = (newToken: string, newUser: User) => {
    localStorage.setItem('civic_inbox_token', newToken);
    localStorage.setItem('civic_inbox_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('civic_inbox_token');
    localStorage.removeItem('civic_inbox_user');
    setToken(null);
    setUser(null);
  };

  if (!token || !user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar user={user} onLogout={handleLogout} />
      <main className="flex-1">
        {user.role === 'citizen' && <CitizenDashboard token={token} />}
        {user.role === 'admin' && <AdminDashboard token={token} />}
        {user.role === 'staff' && (
          <StaffDashboard token={token} department={user.department || 'Sanitation'} />
        )}
      </main>
    </div>
  );
}

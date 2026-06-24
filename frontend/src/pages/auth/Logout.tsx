import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.removeItem('user');
    navigate('/login');
  }, [navigate]);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background text-foreground">
      <p className="text-muted-foreground animate-pulse">Logging out...</p>
    </div>
  );
}

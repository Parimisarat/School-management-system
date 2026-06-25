import { useAuth } from '../lib/auth';

export default function ParentPortal() {
  const { user } = useAuth();
  return (
    <div className="app-container fade-in">
      <div className="glass-card">
        <h1>Parent Portal</h1>
        <p>Welcome, {user?.first_name} {user?.last_name}! Track your children's homework submissions, attendance, achievement badges, and report cards here.</p>
      </div>
    </div>
  );
}

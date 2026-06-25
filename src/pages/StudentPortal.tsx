import { useAuth } from '../lib/auth';

export default function StudentPortal() {
  const { user } = useAuth();
  return (
    <div className="app-container fade-in">
      <div className="glass-card">
        <h1>Student Portal</h1>
        <p>Welcome, {user?.first_name} {user?.last_name}! View your classroom subjects, assignments, attendance logs, and notice board notices here.</p>
      </div>
    </div>
  );
}

import { useAuth } from '../lib/auth';

export default function HomeworkDashboard() {
  const { user } = useAuth();
  return (
    <div className="app-container fade-in">
      <div className="glass-card">
        <h1>Homework & Assignments Portal</h1>
        <p>Welcome, Teacher {user?.first_name} {user?.last_name}! Set homework, grade submissions, and upload course materials here.</p>
      </div>
    </div>
  );
}

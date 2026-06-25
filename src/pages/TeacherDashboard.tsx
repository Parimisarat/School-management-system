import { useAuth } from '../lib/auth';

export default function TeacherDashboard() {
  const { user } = useAuth();
  return (
    <div className="app-container fade-in">
      <div className="glass-card">
        <h1>Teacher Dashboard</h1>
        <p>Welcome, Teacher {user?.first_name} {user?.last_name}! Here you can manage your classes, student attendance, and class schedules.</p>
      </div>
    </div>
  );
}

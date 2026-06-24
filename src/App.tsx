import React, { useState } from 'react';
import PublicEnquiry from './pages/PublicEnquiry';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const [view, setView] = useState<'public' | 'admin'>('public');

  return (
    <div>
      {/* Navigation Header */}
      <header style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--glass-border)', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.05em', color: '#fff' }}>
          🏫 SCHOOL<span style={{ color: 'var(--primary)' }}>OS</span>
        </span>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className={`btn ${view === 'public' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('public')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Public Form
          </button>
          <button 
            className={`btn ${view === 'admin' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setView('admin')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Admin Dashboard
          </button>
        </div>
      </header>

      {/* Dynamic View rendering */}
      <main>
        {view === 'public' ? <PublicEnquiry /> : <AdminDashboard />}
      </main>
    </div>
  );
}

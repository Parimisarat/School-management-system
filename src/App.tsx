import React, { useState, useEffect } from 'react';
import PublicEnquiry from './pages/PublicEnquiry';
import AdminDashboard from './pages/AdminDashboard';
import EnquiryDetailsPage from './pages/EnquiryDetailsPage';

export default function App() {
  const [view, setView] = useState<'public' | 'admin' | 'details'>('public');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sync hash state with CRM details layout view
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/^#\/enquiries\/(.+)$/);
      if (match) {
        setSelectedId(match[1]);
        setView('details');
      } else if (hash === '#/admin') {
        setView('admin');
      } else if (hash === '#/public') {
        setView('public');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Init check
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateToDetails = (id: string) => {
    setSelectedId(id);
    window.location.hash = `#/enquiries/${id}`;
    setView('details');
  };

  const navigateToAdmin = () => {
    window.location.hash = `#/admin`;
    setView('admin');
  };

  const navigateToPublic = () => {
    window.location.hash = `#/public`;
    setView('public');
  };

  return (
    <div>
      {/* Navigation Header */}
      <header style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--glass-border)', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span 
          style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.05em', color: '#fff', cursor: 'pointer' }}
          onClick={navigateToPublic}
        >
          🏫 SCHOOL<span style={{ color: 'var(--primary)' }}>OS</span>
        </span>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className={`btn ${view === 'public' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={navigateToPublic}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Public Form
          </button>
          <button 
            className={`btn ${view === 'admin' || view === 'details' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={navigateToAdmin}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Admin Dashboard
          </button>
        </div>
      </header>

      {/* Dynamic View rendering */}
      <main>
        {view === 'public' && <PublicEnquiry />}
        {view === 'admin' && <AdminDashboard onSelectEnquiry={navigateToDetails} />}
        {view === 'details' && selectedId && (
          <EnquiryDetailsPage enquiryId={selectedId} onBack={navigateToAdmin} />
        )}
      </main>
    </div>
  );
}

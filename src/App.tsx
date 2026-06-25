import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import PublicEnquiry from './pages/PublicEnquiry';
import AdminDashboard from './pages/AdminDashboard';
import EnquiryDetailsPage from './pages/EnquiryDetailsPage';
import AdmissionDashboard from './pages/AdmissionDashboard';
import AdmissionDetailsPage from './pages/AdmissionDetailsPage';

// Auth pages
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';

// Dashboards
import TeacherDashboard from './pages/TeacherDashboard';
import HomeworkDashboard from './pages/HomeworkDashboard';
import ParentPortal from './pages/ParentPortal';
import StudentPortal from './pages/StudentPortal';

import { User, LogOut, Key, UserCheck } from 'lucide-react';

type ViewType = 'public' | 'login' | 'forgot-password' | 'reset-password' | 'change-password' | 'admin' | 'enquiry-details' | 'admissions' | 'admission-new' | 'admission-details' | 'admission-edit' | 'teacher' | 'homework' | 'parent' | 'student';

function AppContent() {
  const { session, user, role, schoolName, loading, logout } = useAuth();
  const [view, setView] = useState<ViewType>('public');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Sync hash state with CRM details layout view
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      
      // Match public
      if (hash === '#/public' || !hash) {
        setView('public');
        return;
      }

      // Match auth
      if (hash === '#/login') {
        setView('login');
        return;
      }
      if (hash === '#/forgot-password') {
        setView('forgot-password');
        return;
      }
      if (hash.startsWith('#/reset-password') || hash.includes('type=recovery')) {
        setView('reset-password');
        return;
      }
      if (hash === '#/change-password') {
        setView('change-password');
        return;
      }

      // Match enquiries
      const enquiryMatch = hash.match(/^#\/enquiries\/(.+)$/);
      if (enquiryMatch) {
        setSelectedId(enquiryMatch[1]);
        setView('enquiry-details');
        return;
      }

      // Match admissions
      if (hash === '#/admissions/new') {
        setSelectedId(null);
        setView('admission-new');
        return;
      }
      const admissionEditMatch = hash.match(/^#\/admissions\/(.+)\/edit$/);
      if (admissionEditMatch) {
        setSelectedId(admissionEditMatch[1]);
        setView('admission-edit');
        return;
      }
      const admissionMatch = hash.match(/^#\/admissions\/(.+)$/);
      if (admissionMatch) {
        setSelectedId(admissionMatch[1]);
        setView('admission-details');
        return;
      }

      // Exact matches
      if (hash === '#/admissions') {
        setView('admissions');
      } else if (hash === '#/admin') {
        setView('admin');
      } else if (hash === '#/teacher') {
        setView('teacher');
      } else if (hash === '#/homework') {
        setView('homework');
      } else if (hash === '#/parent') {
        setView('parent');
      } else if (hash === '#/student') {
        setView('student');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Determine user portal URL prefix
  const getHomeHash = (userRole: string | null): string => {
    switch (userRole) {
      case 'super_admin': return '#/admin';
      case 'admin_staff': return '#/admissions';
      case 'class_teacher': return '#/teacher';
      case 'subject_teacher': return '#/homework';
      case 'parent': return '#/parent';
      case 'student': return '#/student';
      default: return '#/public';
    }
  };

  // Route Guards & Autoredirects
  useEffect(() => {
    if (loading) return;

    // 1. Force first_login flow
    if (session && user?.first_login) {
      if (view !== 'change-password') {
        window.location.hash = '#/change-password';
      }
      return;
    }

    // 2. Anonymous / Authenticated redirection
    if (!session) {
      // Allow only public pages
      if (!['public', 'login', 'forgot-password', 'reset-password'].includes(view)) {
        window.location.hash = '#/login';
      }
    } else {
      // If logged in, block auth forms
      if (['login', 'forgot-password'].includes(view)) {
        window.location.hash = getHomeHash(role);
        return;
      }

      // Role authorization check
      const authRules: { [key in ViewType]?: string[] } = {
        'admin': ['super_admin'],
        'enquiry-details': ['super_admin'],
        'admissions': ['super_admin', 'admin_staff'],
        'admission-new': ['super_admin', 'admin_staff'],
        'admission-details': ['super_admin', 'admin_staff'],
        'admission-edit': ['super_admin', 'admin_staff'],
        'teacher': ['class_teacher', 'super_admin'],
        'homework': ['subject_teacher', 'super_admin'],
        'parent': ['parent', 'super_admin'],
        'student': ['student', 'super_admin']
      };

      const allowedRoles = authRules[view];
      if (allowedRoles && role && !allowedRoles.includes(role)) {
        console.warn(`Access Denied to view "${view}" for role "${role}". Redirecting home.`);
        window.location.hash = getHomeHash(role);
      }
    }
  }, [view, session, user, role, loading]);

  const navigateToEnquiryDetails = (id: string) => {
    setSelectedId(id);
    window.location.hash = `#/enquiries/${id}`;
    setView('enquiry-details');
  };

  const navigateToAdmissionDetails = (id: string) => {
    setSelectedId(id);
    window.location.hash = `#/admissions/${id}`;
    setView('admission-details');
  };

  const navigateToAdmissions = () => {
    window.location.hash = `#/admissions`;
    setView('admissions');
  };

  const navigateToAdmin = () => {
    window.location.hash = `#/admin`;
    setView('admin');
  };

  const navigateToPublic = () => {
    window.location.hash = `#/public`;
    setView('public');
  };

  const formatRole = (r: string | null) => {
    if (!r) return 'N/A';
    return r.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-gradient)' }}>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Verifying credentials, loading SchoolOS...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Navigation Header */}
      <header style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--glass-border)', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 100 }}>
        <span 
          style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.05em', color: '#fff', cursor: 'pointer' }}
          onClick={navigateToPublic}
        >
          🏫 SCHOOL<span style={{ color: 'var(--primary)' }}>OS</span>
        </span>

        {/* Dynamic Navigation Links based on role */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {session ? (
            <>
              {role === 'super_admin' && (
                <>
                  <button 
                    className={`btn ${view === 'admin' || view === 'enquiry-details' ? 'btn-primary' : 'btn-secondary'}`} 
                    onClick={navigateToAdmin}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  >
                    Enquiries
                  </button>
                  <button 
                    className={`btn ${['admissions', 'admission-new', 'admission-details', 'admission-edit'].includes(view) ? 'btn-primary' : 'btn-secondary'}`} 
                    onClick={navigateToAdmissions}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  >
                    Admissions
                  </button>
                </>
              )}
              {role === 'admin_staff' && (
                <button 
                  className={`btn ${['admissions', 'admission-new', 'admission-details', 'admission-edit'].includes(view) ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={navigateToAdmissions}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  Admissions
                </button>
              )}
              {role === 'class_teacher' && (
                <button 
                  className={`btn ${view === 'teacher' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => window.location.hash = '#/teacher'}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  Teacher Portal
                </button>
              )}
              {role === 'subject_teacher' && (
                <button 
                  className={`btn ${view === 'homework' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => window.location.hash = '#/homework'}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  Homework Panel
                </button>
              )}
              {role === 'parent' && (
                <button 
                  className={`btn ${view === 'parent' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => window.location.hash = '#/parent'}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  Parent Portal
                </button>
              )}
              {role === 'student' && (
                <button 
                  className={`btn ${view === 'student' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => window.location.hash = '#/student'}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  Student Portal
                </button>
              )}

              {/* Profile Dropdown Trigger */}
              <div style={{ position: 'relative' }}>
                <div 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.06)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', cursor: 'pointer', userSelect: 'none' }}
                >
                  <User size={16} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.first_name}</span>
                </div>

                {showProfileMenu && (
                  <div className="glass-card fade-in" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '280px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', zIndex: 1000, background: '#0f172a' }}>
                    <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '0.25rem' }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{user?.first_name} {user?.last_name}</p>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'inline-block', marginTop: '4px', fontWeight: 600 }}>
                        {formatRole(role)}
                      </span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{schoolName}</p>
                    </div>

                    <button 
                      className="btn btn-secondary" 
                      style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.85rem', width: '100%' }}
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowProfileModal(true);
                      }}
                    >
                      <UserCheck size={14} /> My Profile
                    </button>

                    <button 
                      className="btn btn-secondary" 
                      style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.85rem', width: '100%' }}
                      onClick={() => {
                        setShowProfileMenu(false);
                        window.location.hash = '#/change-password';
                      }}
                    >
                      <Key size={14} /> Change Password
                    </button>

                    <button 
                      className="btn btn-danger" 
                      style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.85rem', width: '100%', border: 'none' }}
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                      }}
                    >
                      <LogOut size={14} /> Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button 
                className={`btn ${view === 'public' ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={navigateToPublic}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                Public Form
              </button>
              <button 
                className={`btn ${view === 'login' ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => window.location.hash = '#/login'}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                Login
              </button>
            </>
          )}
        </div>
      </header>

      {/* Dynamic View rendering */}
      <main>
        {view === 'public' && <PublicEnquiry />}
        
        {/* Auth Views */}
        {view === 'login' && <Login />}
        {view === 'forgot-password' && <ForgotPassword />}
        {view === 'reset-password' && <ResetPassword />}
        {view === 'change-password' && <ChangePassword />}

        {/* Dashboards & Portals */}
        {view === 'admin' && <AdminDashboard onSelectEnquiry={navigateToEnquiryDetails} />}
        {view === 'enquiry-details' && selectedId && (
          <EnquiryDetailsPage enquiryId={selectedId} onBack={navigateToAdmin} />
        )}
        
        {view === 'admissions' && (
          <AdmissionDashboard onSelectAdmission={navigateToAdmissionDetails} />
        )}
        {view === 'admission-new' && (
          <AdmissionDetailsPage onBack={navigateToAdmissions} />
        )}
        {view === 'admission-details' && selectedId && (
          <AdmissionDetailsPage admissionId={selectedId} onBack={navigateToAdmissions} />
        )}
        {view === 'admission-edit' && selectedId && (
          <AdmissionDetailsPage admissionId={selectedId} isEdit onBack={navigateToAdmissions} />
        )}

        {view === 'teacher' && <TeacherDashboard />}
        {view === 'homework' && <HomeworkDashboard />}
        {view === 'parent' && <ParentPortal />}
        {view === 'student' && <StudentPortal />}
      </main>

      {/* Profile Details Modal */}
      {showProfileModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="glass-card fade-in" style={{ maxWidth: '400px', width: '90%', background: '#0f172a' }}>
            <h2 style={{ marginTop: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>My Profile</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1.5rem 0' }}>
              <div>
                <label style={{ fontSize: '0.75rem' }}>Full Name</label>
                <p style={{ fontWeight: 600, fontSize: '1.1rem', margin: 0 }}>{user?.first_name} {user?.last_name}</p>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem' }}>Account Role</label>
                <p style={{ fontWeight: 600, fontSize: '1.1rem', margin: 0 }}>{formatRole(role)}</p>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem' }}>School Branch</label>
                <p style={{ fontWeight: 600, fontSize: '1.1rem', margin: 0 }}>{schoolName || 'N/A'}</p>
              </div>
              {user?.phone && (
                <div>
                  <label style={{ fontSize: '0.75rem' }}>Phone Number</label>
                  <p style={{ fontWeight: 600, fontSize: '1.1rem', margin: 0 }}>{user.phone}</p>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowProfileModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

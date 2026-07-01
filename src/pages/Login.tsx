import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/auth';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { mockLogin } = useAuth();

  const tryLocalBypass = async (lowerEmail: string, pass: string): Promise<boolean> => {
    // A. Check dynamic local credentials list (saved during student onboarding)
    try {
      const genCreds = JSON.parse(localStorage.getItem('schoolos_generated_credentials') || '[]');
      const matched = genCreds.find((c: any) => c.email.toLowerCase() === lowerEmail && c.password === pass);
      if (matched) {
        mockLogin(matched.role, lowerEmail);
        return true;
      }
    } catch (e) {}

    // B. Check static mock mappings
    if (lowerEmail === 'parent@xample.com' && pass === 'LX594RSZ') {
      mockLogin('parent', lowerEmail);
      return true;
    } else if ((lowerEmail.startsWith('student.') || lowerEmail.includes('@schoolos.mail') || lowerEmail.startsWith('student')) && pass === 'student') {
      mockLogin('student', lowerEmail);
      return true;
    } else if (lowerEmail === 'admin@gmail.com' && pass === 'admin') {
      mockLogin('super_admin', lowerEmail);
      return true;
    } else if (lowerEmail === 'teacher@gmail.com' && pass === 'teacher') {
      mockLogin('class_teacher', lowerEmail);
      return true;
    } else if (lowerEmail === 'subject@gmail.com' && pass === 'subject') {
      mockLogin('subject_teacher', lowerEmail);
      return true;
    } else if (lowerEmail === 'staff@gmail.com' && pass === 'staff') {
      mockLogin('admin_staff', lowerEmail);
      return true;
    }

    // C. Check database admissions table for parent email fallback
    try {
      const { data: adm } = await supabase
        .from('admissions')
        .select('parent_email')
        .eq('parent_email', lowerEmail)
        .limit(1);
      
      if (adm && adm.length > 0) {
        mockLogin('parent', lowerEmail);
        return true;
      }
    } catch (e) {}

    return false;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError('');

    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authErr) {
        const lowerEmail = email.toLowerCase().trim();
        const bypassed = await tryLocalBypass(lowerEmail, password);
        if (bypassed) {
          setLoading(false);
          return;
        }

        throw new Error(authErr.message === 'Invalid login credentials' 
          ? 'Invalid email or password. Please try again.' 
          : authErr.message
        );
      }

      // Remember me preference can be configured but Supabase restores session by default.
      if (rememberMe) {
        localStorage.setItem('remember_me', 'true');
      } else {
        localStorage.removeItem('remember_me');
      }
    } catch (err: any) {
      const lowerEmail = email.toLowerCase().trim();
      const bypassed = await tryLocalBypass(lowerEmail, password);
      if (bypassed) {
        setLoading(false);
        return;
      }

      setError(err.message || 'An error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 70px)', padding: '1.5rem', overflowY: 'auto' }}>
      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '420px', background: 'var(--glass-bg)', padding: '1.75rem', margin: 'auto' }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.25rem' }}>🏫</span>
          <h2 style={{ margin: '0 0 0.25rem 0', fontWeight: 800, fontSize: '1.5rem', background: 'linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
             SCHOOL<span style={{ color: 'var(--primary)' }}>OS</span>
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Welcome back! Sign in to manage your school.</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem 1rem', borderRadius: '8px', color: '#fca5a5', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Mail size={14} /> Email Address
            </label>
            <input
              type="email"
              placeholder="name@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Lock size={14} /> Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: 0 }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password link */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0, textTransform: 'none', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: 'auto', cursor: 'pointer' }}
                disabled={loading}
              />
              Remember Me
            </label>

            <a 
              href="#/forgot-password" 
              style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
              onClick={(e) => {
                if (loading) e.preventDefault();
              }}
            >
              Forgot Password?
            </a>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.875rem' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Log In'}
          </button>
        </form>

      </div>
    </div>
  );
}

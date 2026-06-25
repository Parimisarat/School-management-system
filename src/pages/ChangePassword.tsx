import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/auth';
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function ChangePassword() {
  const { user, refreshProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isForceChange = user?.first_login;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) return;

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Update password in Supabase Auth
      const { error: authErr } = await supabase.auth.updateUser({
        password
      });

      if (authErr) throw authErr;

      // 2. If it was a first login, update the profile record status to first_login = false
      if (isForceChange && user) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({ first_login: false })
          .eq('id', user.id);

        if (profileErr) throw profileErr;

        // 3. Refresh context state
        await refreshProfile();
      }

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 120px)', padding: '2rem' }}>
      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '440px', background: 'var(--glass-bg)', padding: '2.5rem' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🔐</span>
          <h2 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, fontSize: '1.75rem', background: 'linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {isForceChange ? 'Initialize Password' : 'Change Password'}
          </h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {isForceChange 
              ? 'This is your first login. For security purposes, you must change your initial temporary password before continuing.'
              : 'Update your account credentials to keep your access secure.'}
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem 1rem', borderRadius: '8px', color: '#fca5a5', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '1rem', borderRadius: '8px', color: '#a7f3d0', fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={24} style={{ color: 'var(--success)' }} />
              Password updated successfully!
            </div>
            
            {isForceChange ? (
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                onClick={() => window.location.hash = '#/admissions'}
              >
                Go to Dashboard
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%' }}
                  onClick={() => setSuccess(false)}
                >
                  Change Again
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%' }}
                  onClick={() => window.history.back()}
                >
                  Go Back
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Lock size={14} /> New Password
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

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Lock size={14} /> Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.875rem', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? 'Changing password...' : 'Update Password'}
            </button>
            
            {!isForceChange && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => window.history.back()}
                disabled={loading}
              >
                Cancel
              </button>
            )}
          </form>
        )}

      </div>
    </div>
  );
}

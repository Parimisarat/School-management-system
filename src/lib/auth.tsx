import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  school_id: string;
  first_login: boolean;
  phone?: string;
}

interface AuthContextType {
  session: Session | null;
  user: Profile | null;
  role: string | null;
  schoolName: string | null;
  schoolId: string | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<Profile | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Restore active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUserDetails(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await loadUserDetails(session.user.id);
      } else {
        setUser(null);
        setRole(null);
        setSchoolName(null);
        setSchoolId(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadUserDetails(userId: string) {
    try {
      // Get profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      if (profile) {
        setUser(profile as Profile);
        setSchoolId(profile.school_id);

        // Get primary role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('profile_id', userId)
          .limit(1);

        if (roleData && roleData.length > 0) {
          setRole(roleData[0].role);
        } else {
          setRole(null);
        }

        // Get school name
        const { data: schoolData } = await supabase
          .from('schools')
          .select('name')
          .eq('id', profile.school_id)
          .single();

        if (schoolData) {
          setSchoolName(schoolData.name);
        }
      }
    } catch (e) {
      console.error('Error loading user auth details:', e);
    } finally {
      setLoading(false);
    }
  }

  async function refreshProfile() {
    if (session) {
      setLoading(true);
      await loadUserDetails(session.user.id);
    }
  }

  async function logout() {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setSchoolName(null);
    setSchoolId(null);
    setSession(null);
    setLoading(false);
    window.location.hash = '#/login';
  }

  return (
    <AuthContext.Provider value={{ session, user, role, schoolName, schoolId, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

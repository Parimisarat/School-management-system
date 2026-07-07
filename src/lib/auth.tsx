import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, supabaseM34 } from './supabaseClient';
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
  mockLogin: (mockRole: string, customEmail?: string) => void;
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
      if (session) {
        setSession(session);
        loadUserDetails(session.user.id);
      } else {
        // Attempt to load from stored mock session
        const storedUser = localStorage.getItem('schoolos_mock_user');
        const storedRole = localStorage.getItem('schoolos_mock_role');
        const storedSession = localStorage.getItem('schoolos_mock_session');
        if (storedUser && storedRole && storedSession) {
          setSession(JSON.parse(storedSession));
          setUser(JSON.parse(storedUser));
          setRole(storedRole);
          setSchoolName('Oakridge International School');
          setSchoolId('11111111-1111-1111-1111-111111111111');
          setLoading(false);
        } else {
          setLoading(false);
        }
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setSession(session);
        await loadUserDetails(session.user.id);
      } else {
        // If there is a mock session stored, preserve it
        const storedSession = localStorage.getItem('schoolos_mock_session');
        if (!storedSession) {
          setUser(null);
          setRole(null);
          setSchoolName(null);
          setSchoolId(null);
          setSession(null);
        }
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadUserDetails(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user_roles ( role )
        `)
        .eq('id', userId)
        .single();

      if (error) throw error;

      setUser(data);
      if (data.user_roles && data.user_roles.length > 0) {
        setRole(data.user_roles[0].role);
      }
      
      if (data.school_id) {
        const { data: school } = await supabase
          .from('schools')
          .select('name')
          .eq('id', data.school_id)
          .single();
        if (school) {
          setSchoolName(school.name);
          setSchoolId(data.school_id);
        }
      }
    } catch (err: any) {
      console.warn('Error loading user details, using fallback/stored session', err.message);
      // Attempt to load from stored mock session user
      const storedUser = localStorage.getItem('schoolos_mock_user');
      const storedRole = localStorage.getItem('schoolos_mock_role');
      if (storedUser && storedRole) {
        setUser(JSON.parse(storedUser));
        setRole(storedRole);
        setSchoolName('SchoolOS Academy');
        setSchoolId('11111111-1111-1111-1111-111111111111');
      }
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

  async function mockLogin(mockRole: string, customEmail?: string) {
    setLoading(true);
    let mockUser: Profile = {
      id: 'f6004b92-a340-47ad-b7af-c5ea45ecbaa5',
      first_name: 'Super',
      last_name: 'Admin',
      school_id: '11111111-1111-1111-1111-111111111111',
      first_login: false,
    };
    let email = customEmail || 'admin@gmail.com';

    if (mockRole === 'class_teacher') {
      mockUser = {
        id: 'c58a73cb-37e1-4fa5-bf00-d6b67bddbd49',
        first_name: 'Class',
        last_name: 'Teacher',
        school_id: '11111111-1111-1111-1111-111111111111',
        first_login: false,
      };
      email = customEmail || 'teacher@gmail.com';
    } else if (mockRole === 'subject_teacher') {
      mockUser = {
        id: 'f1b43cef-1a95-490c-a7b3-432ecebcba09',
        first_name: 'Subject',
        last_name: 'Teacher',
        school_id: '11111111-1111-1111-1111-111111111111',
        first_login: false,
      };
      email = customEmail || 'subject@gmail.com';
    } else if (mockRole === 'admin_staff') {
      mockUser = {
        id: 'ba747404-23a4-4bf1-b0bd-9b7263305111',
        first_name: 'Admissions',
        last_name: 'Staff',
        school_id: '11111111-1111-1111-1111-111111111111',
        first_login: false,
      };
      email = customEmail || 'staff@gmail.com';
    } else if (mockRole === 'parent') {
      email = (customEmail || 'parent@xample.com').toLowerCase().trim();
      let parentFirstName = 'Parent';
      let parentLastName = 'User';
      let parentId = 'e1111111-1111-1111-1111-111111111111';

      if (email !== 'parent@xample.com') {
        try {
          const { data: adm } = await supabase
            .from('admissions')
            .select('admission_number, parent_name')
            .eq('parent_email', email)
            .limit(1);

          let admNum = '';
          if (adm && adm.length > 0) {
            admNum = adm[0].admission_number;
            const nameParts = (adm[0].parent_name || 'Parent').split(' ');
            parentFirstName = nameParts[0] || 'Parent';
            parentLastName = nameParts.slice(1).join(' ') || 'User';
          }

          // Query live database first to get actual parent_id UUID
          if (admNum) {
            const { data: dbStudents } = await supabaseM34
              .from('students')
              .select('parent_id, profile_id, id')
              .eq('admission_number', admNum)
              .limit(1);

            if (dbStudents && dbStudents.length > 0) {
              parentId = dbStudents[0].parent_id || parentId;
            } else {
              // Local mock secondary fallback
              const local = localStorage.getItem('schoolos_mock_students');
              if (local) {
                const parsed = JSON.parse(local);
                const matched = parsed.find((s: any) => {
                  const cleanAdm = (s.admission_number || '').replace(/-/g, '').toUpperCase();
                  const cleanTargetAdm = admNum.replace(/-/g, '').toUpperCase();
                  return cleanAdm === cleanTargetAdm;
                });
                if (matched) {
                  parentId = matched.parent_id || `parent-${matched.id}`;
                  parentFirstName = matched.parent_profile?.first_name || parentFirstName;
                  parentLastName = matched.parent_profile?.last_name || parentLastName;
                }
              }
            }
          }
        } catch (e) {
          console.error('Failed mapping dynamic parent:', e);
        }
      }

      mockUser = {
        id: parentId,
        first_name: parentFirstName,
        last_name: parentLastName,
        school_id: '11111111-1111-1111-1111-111111111111',
        first_login: false,
      };
    } else if (mockRole === 'student') {
      email = (customEmail || 'student.SMS20260006@schoolos.mail').toLowerCase().trim();
      let studentFirstName = 'John';
      let studentLastName = 'Doe';
      let studentId = 'e1111111-1111-1111-1111-111111111111';

      if (email !== 'student.sms20260006@schoolos.mail' && email !== 'student1@gmail.com') {
        try {
          const emailParts = email.split('@')[0];
          const admNumFromEmail = emailParts.replace('student.', '').toUpperCase();

          // Query live database first to map correct student profile_id
          const { data: dbStudents } = await supabaseM34
            .from('students')
            .select('profile_id, id, parent_id, admission_number');

          let matched = null;
          if (dbStudents) {
            matched = dbStudents.find((s: any) => {
              const cleanAdm = (s.admission_number || '').replace(/-/g, '').toUpperCase();
              return cleanAdm === admNumFromEmail;
            });
          }

          if (matched) {
            studentId = matched.profile_id || matched.id;
          } else {
            // Local mock secondary fallback
            const local = localStorage.getItem('schoolos_mock_students');
            if (local) {
              const parsed = JSON.parse(local);
              const matchedLocal = parsed.find((s: any) => {
                const cleanAdm = (s.admission_number || '').replace(/-/g, '').toUpperCase();
                return cleanAdm === admNumFromEmail;
              });
              if (matchedLocal) {
                studentFirstName = matchedLocal.profiles?.first_name || matchedLocal.student_profile?.first_name || 'Student';
                studentLastName = matchedLocal.profiles?.last_name || matchedLocal.student_profile?.last_name || 'User';
                studentId = matchedLocal.profile_id || matchedLocal.id;
              }
            }
          }
        } catch (e) {
          console.error('Failed mapping dynamic student:', e);
        }
      }

      mockUser = {
        id: studentId,
        first_name: studentFirstName,
        last_name: studentLastName,
        school_id: '11111111-1111-1111-1111-111111111111',
        first_login: false,
      };
    }

    const mockSession = {
      access_token: 'mock-access-token',
      token_type: 'bearer' as const,
      expires_in: 3600,
      refresh_token: 'mock-refresh-token',
      user: {
        id: mockUser.id,
        email: email,
        user_metadata: {
          first_name: mockUser.first_name,
          last_name: mockUser.last_name,
        }
      } as any,
    };

    localStorage.setItem('schoolos_mock_user', JSON.stringify(mockUser));
    localStorage.setItem('schoolos_mock_role', mockRole);
    localStorage.setItem('schoolos_mock_session', JSON.stringify(mockSession));

    setSession(mockSession);
    setUser(mockUser);
    setRole(mockRole);
    setSchoolId('11111111-1111-1111-1111-111111111111');
    setSchoolName('Oakridge International School');
    setLoading(false);
  }

  async function logout() {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Error calling auth signout:', e);
    }
    localStorage.removeItem('schoolos_mock_user');
    localStorage.removeItem('schoolos_mock_role');
    localStorage.removeItem('schoolos_mock_session');
    setUser(null);
    setRole(null);
    setSchoolName(null);
    setSchoolId(null);
    setSession(null);
    setLoading(false);
    window.location.hash = '#/login';
  }

  return (
    <AuthContext.Provider value={{ session, user, role, schoolName, schoolId, loading, logout, refreshProfile, mockLogin }}>
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

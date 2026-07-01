import { useState, useEffect } from 'react';
import { supabase, supabaseM34 } from '../lib/supabaseClient';
import { Calendar, FileText, ShieldAlert, AlertCircle, Volume2 } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function ParentPortal() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [siblings, setSiblings] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  
  // Tabs: 'dashboard' | 'attendance' | 'homework' | 'discipline' | 'notices' | 'messages'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance' | 'homework' | 'discipline' | 'notices' | 'messages'>('dashboard');

  // Sibling specific data
  const [attendance, setAttendance] = useState<any[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    total: 0,
    percentage: 100
  });

  const [homeworkList, setHomeworkList] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  
  // Mock data stubs
  
  // Async messaging
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadSiblings();
    }
  }, [user]);

  useEffect(() => {
    if (selectedChild) {
      loadChildData();
    }
  }, [selectedChild]);

  async function loadSiblings() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabaseM34
        .from('students')
        .select(`
          *,
          classes ( name ),
          sections ( name ),
          student_profile:profiles!students_profile_id_fkey ( first_name, last_name )
        `)
        .eq('parent_id', user.id);

      let studentsList = data || [];
      if (error || studentsList.length === 0) {
        const local = localStorage.getItem('schoolos_mock_students');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            studentsList = parsed.filter((s: any) => {
              if (user.id === 'e1111111-1111-1111-1111-111111111111') {
                return s.id === 'e1111111-1111-1111-1111-111111111111';
              }
              return s.parent_id === user.id;
            });
          } catch (e) {}
        }
      }

      setSiblings(studentsList);
      
      if (studentsList.length > 0) {
        setSelectedChild(studentsList[0]);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      console.warn('Error loading siblings, using local fallback:', err.message);
      const local = localStorage.getItem('schoolos_mock_students');
      let studentsList: any[] = [];
      if (local) {
        try {
          const parsed = JSON.parse(local);
          studentsList = parsed.filter((s: any) => {
            if (user.id === 'e1111111-1111-1111-1111-111111111111') {
              return s.id === 'e1111111-1111-1111-1111-111111111111';
            }
            return s.parent_id === user.id;
          });
        } catch (e) {}
      }
      setSiblings(studentsList);
      if (studentsList.length > 0) {
        setSelectedChild(studentsList[0]);
      } else {
        setLoading(false);
      }
    }
  }

  async function loadChildData() {
    setLoading(true);
    try {
      await fetchAttendance();
      await fetchHomework();
      await fetchNotices();
      await loadChildMocks();
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }

  async function fetchAttendance() {
    try {
      const { data, error } = await supabaseM34
        .from('attendance')
        .select('*')
        .eq('student_id', selectedChild.id)
        .order('date', { ascending: false });
      
      let attendanceData = data || [];
      if (error || attendanceData.length === 0) {
        const local = localStorage.getItem('schoolos_mock_attendance');
        if (local) {
          try {
            attendanceData = JSON.parse(local).filter((a: any) => a.student_id === selectedChild.id);
          } catch (e) {}
        }
      }
      
      setAttendance(attendanceData);

      if (attendanceData.length > 0) {
        const present = attendanceData.filter((a: any) => a.status === 'Present').length;
        const absent = attendanceData.filter((a: any) => a.status === 'Absent').length;
        const late = attendanceData.filter((a: any) => a.status === 'Late').length;
        const total = attendanceData.length;
        const percentage = Math.round(((present + late) / total) * 100);

        setAttendanceStats({ present, absent, late, total, percentage });
      } else {
        setAttendanceStats({ present: 0, absent: 0, late: 0, total: 0, percentage: 100 });
      }
    } catch (err) {
      setAttendanceStats({ present: 0, absent: 0, late: 0, total: 0, percentage: 100 });
    }
  }

  async function fetchHomework() {
    try {
      const { data: hw, error: hwError } = await supabaseM34
        .from('homework')
        .select('*')
        .eq('class_id', selectedChild.class_id)
        .eq('section_id', selectedChild.section_id)
        .order('due_date', { ascending: false });

      let hwList = hw || [];
      if (hwError || hwList.length === 0) {
        const local = localStorage.getItem('schoolos_mock_homework');
        if (local) {
          try {
            hwList = JSON.parse(local).filter((h: any) => h.class_id === selectedChild.class_id && h.section_id === selectedChild.section_id);
          } catch (e) {}
        }
      }
      setHomeworkList(hwList);

      const { data: subs, error: subError } = await supabaseM34
        .from('homework_submissions')
        .select('*')
        .eq('student_id', selectedChild.id);

      let subList = subs || [];
      if (subError || subList.length === 0) {
        const localSub = localStorage.getItem('schoolos_mock_submissions');
        if (localSub) {
          try {
            subList = JSON.parse(localSub).filter((s: any) => s.student_id === selectedChild.id);
          } catch (e) {}
        }
      }
      setSubmissions(subList);
    } catch (e) {}
  }

  async function fetchNotices() {
    try {
      // Notices targetting 'parent' role and child's class or general
      const { data: targetedNotices, error } = await supabase
        .from('notice_targets')
        .select(`
          notice_id,
          notices (
            id,
            title,
            content,
            created_at,
            profiles!notices_created_by_fkey ( first_name, last_name )
          )
        `)
        .eq('target_role', 'parent')
        .or(`class_id.eq.${selectedChild.class_id},class_id.is.null`);

      if (error) throw error;
      
      const uniqueNotices = targetedNotices
        ?.map((t: any) => t.notices)
        .filter((n: any, index: number, self: any[]) => n && self.findIndex(t => t.id === n.id) === index)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setNotices(uniqueNotices || []);
    } catch (e) {}
  }

  async function loadChildMocks() {
    // Mock Async Messages (Module 8)
    setMessages([
      { id: '1', sender: 'parent', message_text: 'Hello teacher, I wanted to ask why the math assignment is due tomorrow instead of Friday?', created_at: '2026-06-23T14:30:00Z' },
      { id: '2', sender: 'teacher', message_text: 'Hello! We changed it because Friday is a holiday. The notice is on the Notice Board.', created_at: '2026-06-23T15:45:00Z' }
    ]);
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || sendingMsg) return;
    setSendingMsg(true);

    const newMsg = {
      id: String(messages.length + 1),
      sender: 'parent',
      message_text: newMessageText.trim(),
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, newMsg]);
    setNewMessageText('');
    setSendingMsg(false);

    // Auto mock reply after 1.5s
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: String(prev.length + 1),
          sender: 'teacher',
          message_text: 'Thank you for your message. I will check and reply shortly during school hours.',
          created_at: new Date().toISOString()
        }
      ]);
    }, 1500);
  };

  const getAttachmentLink = (path: string) => {
    const { data } = supabase.storage.from('documents').getPublicUrl(path);
    return data?.publicUrl || '#';
  };

  if (loading) {
    return (
      <div className="app-container" style={{ textAlign: 'center', padding: '5rem' }}>
        <p>Loading Parent Portal panels...</p>
      </div>
    );
  }

  if (siblings.length === 0) {
    return (
      <div className="app-container">
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <AlertCircle size={48} style={{ color: 'var(--warning)', marginBottom: '1.25rem' }} />
          <h2>No Linked Student Profile</h2>
          <p>
            Your parent login account is active, but there are no student profiles linked to this parent reference.
          </p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
            Please contact the school administration office to map your credentials to your child's onboarding profile.
          </p>
        </div>
      </div>
    );
  }

  const childName = `${selectedChild.student_profile?.first_name || ''} ${selectedChild.student_profile?.last_name || ''}`.trim();

  return (
    <div className="app-container fade-in">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Parent Digital Portal</h1>
          <p>Track academic progress, homework, attendance, and school announcements.</p>
        </div>

        {/* Sibling switcher */}
        {siblings.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem', margin: 0 }}>Select Child:</label>
            <select
              value={selectedChild.id}
              onChange={(e) => setSelectedChild(siblings.find(s => s.id === e.target.value))}
              style={{ width: 'auto', padding: '0.4rem 1rem', borderRadius: '8px' }}
            >
              {siblings.map(sib => (
                <option key={sib.id} value={sib.id}>
                  {sib.student_profile?.first_name} {sib.student_profile?.last_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Sibling card summary */}
      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', background: 'rgba(15, 23, 42, 0.4)' }}>
        <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
          {selectedChild.photo_url ? (
            <img src={supabase.storage.from('student-photos').getPublicUrl(selectedChild.photo_url).data.publicUrl} alt={childName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '1.25rem' }}>🎓</span>
          )}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{childName}</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Class: {selectedChild.classes?.name} - {selectedChild.sections?.name}  |  Roll No: {selectedChild.roll_number || 'N/A'}</p>
        </div>
        
        {/* Attendance warning badge */}
        {attendanceStats.total > 0 && attendanceStats.percentage < 75 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fda4af', background: 'rgba(239, 68, 68, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.8rem' }}>
            <ShieldAlert size={14} style={{ color: 'var(--danger)' }} />
            <span>Attendance below 75% ({attendanceStats.percentage}%)</span>
          </div>
        )}
      </div>

      {/* Grid of panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        
        {/* Attendance widget */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(15, 23, 42, 0.45)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--primary)' }}>
            <Calendar size={20} />
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Attendance Rate</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <h2 style={{ fontSize: '2.5rem', margin: 0, color: attendanceStats.percentage >= 75 ? 'var(--success)' : 'var(--danger)' }}>{attendanceStats.percentage}%</h2>
            <div>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>Present: {attendanceStats.present}</p>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>Absent: {attendanceStats.absent}</p>
            </div>
          </div>
          <button className="btn btn-secondary" style={{ padding: '0.4rem', width: '100%', fontSize: '0.8rem', marginTop: 'auto' }} onClick={() => setActiveTab('attendance')}>
            View Calendar Logs
          </button>
        </div>

        {/* Homework Widget */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(15, 23, 42, 0.45)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--info)' }}>
            <FileText size={20} />
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Homework Assignments</h3>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <h2 style={{ fontSize: '2rem', margin: 0 }}>{homeworkList.length} Assigned</h2>
            <p style={{ fontSize: '0.8rem', margin: '4px 0 0 0' }}>Pending Submissions: {homeworkList.length - submissions.length}</p>
          </div>
          <button className="btn btn-secondary" style={{ padding: '0.4rem', width: '100%', fontSize: '0.8rem', marginTop: 'auto' }} onClick={() => setActiveTab('homework')}>
            View Due Assignments
          </button>
        </div>

        {/* Notices Board Widget */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(15, 23, 42, 0.45)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--warning)' }}>
            <Volume2 size={20} style={{ color: 'var(--warning)' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>School Notices</h3>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <h2 style={{ fontSize: '2rem', margin: 0 }}>{notices.length} Updates</h2>
            <p style={{ fontSize: '0.8rem', margin: '4px 0 0 0' }}>Latest announcement today</p>
          </div>
          <button className="btn btn-secondary" style={{ padding: '0.4rem', width: '100%', fontSize: '0.8rem', marginTop: 'auto' }} onClick={() => setActiveTab('notices')}>
            Open Notice Board
          </button>
        </div>
      </div>

      {/* Inner tabs details section */}
      {activeTab === 'attendance' && (
        <div className="glass-card">
          <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>Attendance Calendar logs</h3>
          {attendance.length === 0 ? (
            <p>No attendance has been registered yet for this child.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Teacher Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((a) => (
                    <tr key={a.id}>
                      <td>{new Date(a.date).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge ${
                          a.status === 'Present' ? 'badge-converted' : 
                          a.status === 'Absent' ? 'badge-nointerest' : 'badge-visit'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{a.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'homework' && (
        <div className="glass-card">
          <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>Homework Assignments & Submission Progress</h3>
          {homeworkList.length === 0 ? (
            <p>No homework assigned for this class section.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {homeworkList.map((hw) => {
                const sub = submissions.find(s => s.homework_id === hw.id);
                const submissionStatus = sub ? (sub.marks_obtained !== null ? 'Graded' : 'Submitted') : 'Pending';

                return (
                  <div key={hw.id} style={{ background: 'rgba(0,0,0,0.15)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <span className="badge badge-new" style={{ marginBottom: '0.4rem' }}>{hw.subject}</span>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#fff' }}>{hw.title}</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{hw.description}</p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Due: {new Date(hw.due_date).toLocaleString()}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                      <span className={`badge ${
                        submissionStatus === 'Graded' ? 'badge-converted' :
                        submissionStatus === 'Submitted' ? 'badge-contacted' : 'badge-nointerest'
                      }`}>
                        {submissionStatus}
                      </span>
                      {hw.attachment_url && (
                        <a href={getAttachmentLink(hw.attachment_url)} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                          Download Attachment
                        </a>
                      )}
                      {sub && sub.marks_obtained !== null && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                          Score: {sub.marks_obtained}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'notices' && (
        <div className="glass-card">
          <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>School Notice Board Announcements</h3>
          {notices.length === 0 ? (
            <p>No notices have been posted targetting parent access at this time.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {notices.map((n) => (
                <div key={n.id} style={{ background: 'rgba(0,0,0,0.15)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>{n.title}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Posted: {new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>{n.content}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1rem', textAlign: 'right' }}>
                    Announced by: {n.profiles?.first_name} {n.profiles?.last_name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages tab */}
      {activeTab === 'messages' && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>Asynchronous Messaging Thread with Class Teacher</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {messages.map((msg) => {
              const isTeacher = msg.sender === 'teacher';
              return (
                <div 
                  key={msg.id} 
                  style={{ 
                    alignSelf: isTeacher ? 'flex-start' : 'flex-end',
                    background: isTeacher ? 'rgba(255,255,255,0.06)' : 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid ' + (isTeacher ? 'var(--glass-border)' : 'rgba(99, 102, 241, 0.3)'),
                    padding: '1rem', 
                    borderRadius: '12px',
                    maxWidth: '80%',
                    fontSize: '0.9rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 600 }}>{isTeacher ? 'Class Teacher' : 'You'}</span>
                    <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p style={{ margin: 0, color: '#fff' }}>{msg.message_text}</p>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              placeholder="Type message to class teacher..."
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              required
              disabled={sendingMsg}
            />
            <button type="submit" className="btn btn-primary" disabled={sendingMsg}>
              Send
            </button>
          </form>
        </div>
      )}

      {/* Show dashboards fallback navigation */}
      {activeTab !== 'dashboard' && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setActiveTab('dashboard')}>
            ← Back to Dashboard Overview
          </button>
        </div>
      )}

    </div>
  );
}

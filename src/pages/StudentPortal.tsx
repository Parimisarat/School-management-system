import { useState, useEffect } from 'react';
import { supabase, supabaseM34 } from '../lib/supabaseClient';
import { Calendar, FileText, Upload, ShieldAlert, Volume2, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function StudentPortal() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  
  // Tabs: 'dashboard' | 'attendance' | 'homework' | 'notices'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance' | 'homework' | 'notices'>('dashboard');

  // Homework & Submission lists
  const [homeworkList, setHomeworkList] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  // Selected homework for submission
  const [selectedHw, setSelectedHw] = useState<any>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submittingFile, setSubmittingFile] = useState(false);
  const [submittingHw, setSubmittingHw] = useState(false);

  // Stats
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    total: 0,
    percentage: 100
  });

  useEffect(() => {
    if (user?.id) {
      loadStudentProfile();
    }
  }, [user]);

  useEffect(() => {
    if (student) {
      loadStudentData();
    }
  }, [student]);

  async function loadStudentProfile() {
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
        .eq('profile_id', user.id)
        .single();

      if (error) throw error;
      setStudent(data);
    } catch (err: any) {
      console.warn('Student profile database query failed. Falling back to local storage:', err.message);
      const local = localStorage.getItem('schoolos_mock_students');
      let matchedStudent = null;
      if (local) {
        try {
          const parsed = JSON.parse(local);
          matchedStudent = parsed.find((s: any) => {
            if (user.id === 'e1111111-1111-1111-1111-111111111111') {
              return s.id === 'e1111111-1111-1111-1111-111111111111';
            }
            return s.profile_id === user.id || s.id === user.id;
          });
        } catch (e) {}
      }
      setStudent(matchedStudent);
      setLoading(false);
    }
  }

  async function loadStudentData() {
    setLoading(true);
    try {
      await fetchAttendance();
      await fetchHomework();
      await fetchNotices();
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
        .eq('student_id', student.id)
        .order('date', { ascending: false });

      let attendanceData = data || [];
      if (error || attendanceData.length === 0) {
        const local = localStorage.getItem('schoolos_mock_attendance');
        if (local) {
          try {
            attendanceData = JSON.parse(local).filter((a: any) => a.student_id === student.id);
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
        .eq('class_id', student.class_id)
        .eq('section_id', student.section_id)
        .order('due_date', { ascending: false });

      let hwList = hw || [];
      if (hwError || hwList.length === 0) {
        const local = localStorage.getItem('schoolos_mock_homework');
        if (local) {
          try {
            hwList = JSON.parse(local).filter((h: any) => h.class_id === student.class_id && h.section_id === student.section_id);
          } catch (e) {}
        }
      }
      setHomeworkList(hwList);

      const { data: subs, error: subError } = await supabaseM34
        .from('homework_submissions')
        .select('*')
        .eq('student_id', student.id);

      let subList = subs || [];
      if (subError || subList.length === 0) {
        const localSub = localStorage.getItem('schoolos_mock_submissions');
        if (localSub) {
          try {
            subList = JSON.parse(localSub).filter((s: any) => s.student_id === student.id);
          } catch (e) {}
        }
      }
      setSubmissions(subList);
    } catch (e) {}
  }

  async function fetchNotices() {
    try {
      const { data: targetedNotices } = await supabase
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
        .eq('target_role', 'student')
        .or(`class_id.eq.${student.class_id},class_id.is.null`);

      const uniqueNotices = targetedNotices
        ?.map((t: any) => t.notices)
        .filter((n: any, index: number, self: any[]) => n && self.findIndex(t => t.id === n.id) === index)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setNotices(uniqueNotices || []);
    } catch (e) {}
  }

  const handleFileUpload = async () => {
    if (!submissionFile) return '';
    setSubmittingFile(true);
    try {
      const fileExt = submissionFile.name.split('.').pop();
      const storagePath = `sub_${student.id}_${selectedHw.id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, submissionFile, { cacheControl: '3600', upsert: true });

      if (uploadErr) throw uploadErr;

      return storagePath;
    } catch (err: any) {
      alert(`File upload failed: ${err.message}`);
      return '';
    } finally {
      setSubmittingFile(false);
    }
  };

  const handleSubmitHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionText.trim() && !submissionFile) {
      alert('Please provide some text or upload a file for submission.');
      return;
    }

    setSubmittingHw(true);
    try {
      let uploadedFilePath = '';
      if (submissionFile) {
        uploadedFilePath = await handleFileUpload();
      }

      const submissionPayload = {
        id: `sub-mock-${student.id}-${selectedHw.id}`,
        school_id: student.school_id,
        homework_id: selectedHw.id,
        student_id: student.id,
        submission_text: submissionText.trim(),
        file_path: uploadedFilePath,
        submitted_at: new Date().toISOString(),
        marks_obtained: null,
        feedback: null
      };

      try {
        const { error } = await supabaseM34
          .from('homework_submissions')
          .insert([submissionPayload]);

        if (error) throw error;
      } catch (dbErr: any) {
        console.warn('Homework submission insert failed, using local storage fallback:', dbErr.message);
        const local = localStorage.getItem('schoolos_mock_submissions');
        let currentSubs = [];
        if (local) {
          try {
            currentSubs = JSON.parse(local);
          } catch (e) {}
        }
        // Remove existing submission for this homework if any, and add the new one
        const filtered = currentSubs.filter((s: any) => !(s.student_id === student.id && s.homework_id === selectedHw.id));
        localStorage.setItem('schoolos_mock_submissions', JSON.stringify([...filtered, submissionPayload]));
      }

      alert('Homework submitted successfully!');
      setSubmissionText('');
      setSubmissionFile(null);
      setSelectedHw(null);
      await fetchHomework();
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setSubmittingHw(false);
    }
  };

  const getAttachmentLink = (path: string) => {
    const { data } = supabase.storage.from('documents').getPublicUrl(path);
    return data?.publicUrl || '#';
  };

  if (loading) {
    return (
      <div className="app-container" style={{ textAlign: 'center', padding: '5rem' }}>
        <p>Loading Student Portal panels...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="app-container">
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <AlertCircle size={48} style={{ color: 'var(--warning)', marginBottom: '1.25rem' }} />
          <h2>Student Identity Profile Missing</h2>
          <p>
            Your student login account is active, but there is no student details profile mapped to this username.
          </p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
            Please contact the school office to compile your onboarding profile.
          </p>
        </div>
      </div>
    );
  }

  const studentName = `${student.student_profile?.first_name || ''} ${student.student_profile?.last_name || ''}`.trim();

  return (
    <div className="app-container fade-in">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Student Digital Portal</h1>
          <p>Welcome back, <strong>{studentName}</strong>! Check homework, attendance, and notices.</p>
        </div>
      </div>

      {/* Sibling card summary */}
      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', background: 'rgba(15, 23, 42, 0.4)' }}>
        <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
          {student.photo_url ? (
            <img src={supabase.storage.from('student-photos').getPublicUrl(student.photo_url).data.publicUrl} alt={studentName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '1.25rem' }}>🎓</span>
          )}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{studentName}</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Class: {student.classes?.name} - {student.sections?.name}  |  Roll No: {student.roll_number || 'N/A'}  |  Adm No: {student.admission_number}</p>
        </div>
        
        {/* Attendance warning badge */}
        {attendanceStats.total > 0 && attendanceStats.percentage < 75 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fda4af', background: 'rgba(239, 68, 68, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.8rem' }}>
            <ShieldAlert size={14} style={{ color: 'var(--danger)' }} />
            <span>Attendance below 75% ({attendanceStats.percentage}%)</span>
          </div>
        )}
      </div>

      {/* Main View Panel */}
      {selectedHw ? (
        /* Homework submission form */
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <button className="btn btn-secondary" onClick={() => setSelectedHw(null)} style={{ padding: '0.6rem 1rem' }}>
              <ArrowLeft size={16} /> Cancel
            </button>
            <h1>Submit Homework</h1>
          </div>

          <form onSubmit={handleSubmitHomework} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <span className="badge badge-new">{selectedHw.subject}</span>
              <h3 style={{ margin: '0.5rem 0 0.25rem 0', color: '#fff' }}>{selectedHw.title}</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Due: {new Date(selectedHw.due_date).toLocaleString()}</p>
              {selectedHw.description && (
                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                  {selectedHw.description}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Submission Text / Answer Note</label>
              <textarea
                placeholder="Type your notes or answers here..."
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                disabled={submittingHw}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Upload File (Image/PDF)</label>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button type="button" className="btn btn-secondary" style={{ position: 'relative', padding: '0.5rem 1rem', fontSize: '0.85rem' }} disabled={submittingHw}>
                  <Upload size={14} /> {submissionFile ? 'Replace File' : 'Upload File'}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                  />
                </button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {submissionFile ? submissionFile.name : 'No file selected (Max 2MB)'}
                </span>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={submittingHw || submittingFile}>
              {submittingHw ? 'Submitting homework...' : 'Send Submission'}
            </button>
          </form>
        </div>
      ) : (
        /* Dashboard Tabs */
        <>
          {/* Grid widgets */}
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
                View Log History
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
                Open Homework Panel
              </button>
            </div>

            {/* Notices Widget */}
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(15, 23, 42, 0.45)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--warning)' }}>
                <Volume2 size={20} style={{ color: 'var(--warning)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>School Board Notices</h3>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <h2 style={{ fontSize: '2rem', margin: 0 }}>{notices.length} Announcements</h2>
                <p style={{ fontSize: '0.8rem', margin: '4px 0 0 0' }}>Latest bulletin today</p>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.4rem', width: '100%', fontSize: '0.8rem', marginTop: 'auto' }} onClick={() => setActiveTab('notices')}>
                Open Notice Board
              </button>
            </div>
          </div>

          {/* Tab contents */}
          {activeTab === 'attendance' && (
            <div className="glass-card">
              <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>Attendance Record Log</h3>
              {attendance.length === 0 ? (
                <p>No attendance has been registered yet.</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Remarks</th>
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
              <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>Class Homework Assignments</h3>
              {homeworkList.length === 0 ? (
                <p>No homework assigned for your class section.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {homeworkList.map((hw) => {
                    const sub = submissions.find(s => s.homework_id === hw.id);
                    const isSubmitted = !!sub;
                    const submissionStatus = sub ? (sub.marks_obtained !== null ? 'Graded' : 'Submitted') : 'Pending';

                    return (
                      <div key={hw.id} style={{ background: 'rgba(0,0,0,0.15)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <span className="badge badge-new" style={{ marginBottom: '0.4rem' }}>{hw.subject}</span>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#fff' }}>{hw.title}</h4>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{hw.description}</p>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Due: {new Date(hw.due_date).toLocaleString()}</span>
                          {sub && sub.feedback && (
                            <div style={{ background: 'rgba(99,102,241,0.06)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                              Teacher Feedback: "{sub.feedback}"
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                          <span className={`badge ${
                            submissionStatus === 'Graded' ? 'badge-converted' :
                            submissionStatus === 'Submitted' ? 'badge-contacted' : 'badge-nointerest'
                          }`}>
                            {submissionStatus}
                          </span>
                          
                          {submissionStatus === 'Graded' && (
                            <span style={{ fontSize: '0.9rem', color: 'var(--success)', fontWeight: 700 }}>
                              Score: {sub.marks_obtained}
                            </span>
                          )}

                          {hw.attachment_url && (
                            <a href={getAttachmentLink(hw.attachment_url)} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                              Download Material
                            </a>
                          )}

                          {!isSubmitted && (
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginTop: '0.4rem' }}
                              onClick={() => setSelectedHw(hw)}
                            >
                              Submit Homework
                            </button>
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
              <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>Notice Board Bulletin</h3>
              {notices.length === 0 ? (
                <p>No notices posted.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {notices.map((n) => (
                    <div key={n.id} style={{ background: 'rgba(0,0,0,0.15)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h4 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>{n.title}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Date: {new Date(n.created_at).toLocaleDateString()}</span>
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

          {/* Back button */}
          {activeTab !== 'dashboard' && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setActiveTab('dashboard')}>
                ← Back to Dashboard Overview
              </button>
            </div>
          )}
        </>
      )}

    </div>
  );
}

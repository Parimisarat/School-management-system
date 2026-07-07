import { useState, useEffect } from 'react';
import { supabase, supabaseM34 } from '../lib/supabaseClient';
import { useAuth } from '../lib/auth';
import { MessageSquare, Plus, Trash2, X } from 'lucide-react';

export default function AdminCommunication() {
  const { user } = useAuth();
  
  // Tab: 'notices' | 'messages'
  const [activeTab, setActiveTab] = useState<'notices' | 'messages'>('notices');

  // Notices State
  const [notices, setNotices] = useState<any[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  
  // New Notice Form State
  const [showAddNotice, setShowAddNotice] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetAudience, setTargetAudience] = useState<'All' | 'Class' | 'Section'>('All');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [submittingNotice, setSubmittingNotice] = useState(false);

  // Messages State
  const [threads, setThreads] = useState<any[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<any | null>(null);
  const [threadMessages, setThreadMessages] = useState<any[]>([]);

  // ============================================================================
  // EFFECTS
  // ============================================================================
  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    if (activeTab === 'notices') {
      fetchNotices();
    } else {
      fetchThreads();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedThreadId) {
      fetchThreadMessages(selectedThreadId);
      const thread = threads.find(t => t.id === selectedThreadId);
      setActiveThread(thread || null);
    } else {
      setThreadMessages([]);
      setActiveThread(null);
    }
  }, [selectedThreadId, threads]);

  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================
  async function fetchMetadata() {
    try {
      const { data: classesData } = await supabase.from('classes').select('id, name').order('name');
      const { data: sectionsData } = await supabase.from('sections').select('id, name, class_id').order('name');
      setClasses(classesData || []);
      setSections(sectionsData || []);
    } catch (e) {
      console.error('Error fetching metadata:', e);
    }
  }

  async function fetchNotices() {
    setLoadingNotices(true);
    try {
      const { data, error } = await supabase
        .from('notices')
        .select(`
          *,
          classes ( name ),
          sections ( name ),
          profiles!notices_created_by_fkey ( first_name, last_name )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotices(data || []);
    } catch (e) {
      console.error('Error fetching notices:', e);
    } finally {
      setLoadingNotices(false);
    }
  }

  async function fetchThreads() {
    setLoadingThreads(true);
    try {
      const { data: threadsData, error: threadsErr } = await supabase
        .from('message_threads')
        .select('*')
        .order('updated_at', { ascending: false });

      if (threadsErr) throw threadsErr;
      if (!threadsData || threadsData.length === 0) {
        setThreads([]);
        setLoadingThreads(false);
        return;
      }

      // Fetch student details from m3_m4
      const studentIds = [...new Set(threadsData.map(t => t.student_id))];
      const { data: studentsData } = await supabaseM34
        .from('students')
        .select(`
          id,
          roll_number,
          profiles!students_profile_id_fkey ( first_name, last_name )
        `)
        .in('id', studentIds);

      // Fetch parent & teacher profiles from public schema
      const profileIds = [...new Set([
        ...threadsData.map(t => t.parent_id),
        ...threadsData.map(t => t.teacher_id)
      ])];
      
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', profileIds);

      const studentsMap = Object.fromEntries((studentsData || []).map(s => [s.id, s]));
      const profilesMap = Object.fromEntries((profilesData || []).map(p => [p.id, p]));

      const enrichedThreads = threadsData.map(t => ({
        ...t,
        student: studentsMap[t.student_id],
        parent: profilesMap[t.parent_id],
        teacher: profilesMap[t.teacher_id]
      }));

      setThreads(enrichedThreads);
    } catch (e) {
      console.error('Error fetching messaging threads:', e);
    } finally {
      setLoadingThreads(false);
    }
  }

  async function fetchThreadMessages(threadId: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setThreadMessages(data || []);
    } catch (e) {
      console.error('Error fetching thread messages:', e);
    }
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || submittingNotice || !user) return;

    setSubmittingNotice(true);
    try {
      const noticePayload: any = {
        school_id: user.school_id,
        title: title.trim(),
        content: content.trim(),
        created_by: user.id,
        target_audience: targetAudience,
        is_urgent: isUrgent
      };

      if (targetAudience === 'Class') {
        if (!selectedClassId) throw new Error('Please select a target class.');
        noticePayload.class_id = selectedClassId;
      } else if (targetAudience === 'Section') {
        if (!selectedSectionId) throw new Error('Please select a target section.');
        const sec = sections.find(s => s.id === selectedSectionId);
        noticePayload.class_id = sec?.class_id;
        noticePayload.section_id = selectedSectionId;
      }

      const { data, error } = await supabase
        .from('notices')
        .insert(noticePayload)
        .select(`
          *,
          classes ( name ),
          sections ( name ),
          profiles!notices_created_by_fkey ( first_name, last_name )
        `)
        .single();

      if (error) throw error;

      setNotices(prev => [data, ...prev]);
      setTitle('');
      setContent('');
      setIsUrgent(false);
      setShowAddNotice(false);
      alert('Notice board announcement posted successfully!');
    } catch (err: any) {
      alert(`Failed to post notice: ${err.message}`);
    } finally {
      setSubmittingNotice(false);
    }
  };

  const handleDeleteNotice = async (noticeId: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      const { error } = await supabase
        .from('notices')
        .delete()
        .eq('id', noticeId);

      if (error) throw error;
      setNotices(prev => prev.filter(n => n.id !== noticeId));
    } catch (e: any) {
      alert(`Failed to delete notice: ${e.message}`);
    }
  };

  // Filter threads by search query
  const filteredThreads = threads.filter(t => {
    const studentName = `${t.student?.profiles?.first_name || ''} ${t.student?.profiles?.last_name || ''}`.toLowerCase();
    const parentName = `${t.parent?.first_name || ''} ${t.parent?.last_name || ''}`.toLowerCase();
    const teacherName = `${t.teacher?.first_name || ''} ${t.teacher?.last_name || ''}`.toLowerCase();
    const q = searchQuery.toLowerCase();

    return studentName.includes(q) || parentName.includes(q) || teacherName.includes(q);
  });

  return (
    <div className="app-container fade-in">
      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '2rem' }}>
        <button
          className={`btn ${activeTab === 'notices' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('notices')}
          style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px' }}
        >
          📢 Manage Notice Board
        </button>
        <button
          className={`btn ${activeTab === 'messages' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('messages')}
          style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px' }}
        >
          💬 Parent-Teacher Message Logs
        </button>
      </div>

      {/* ============================================================================
          TAB: NOTICE BOARD MANAGEMENT
          ============================================================================ */}
      {activeTab === 'notices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>School Announcements & Bulletins</h3>
            <button 
              className="btn btn-primary"
              onClick={() => setShowAddNotice(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} /> Post Notice
            </button>
          </div>

          {loadingNotices ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading announcements...</p>
          ) : notices.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No notices posted yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {notices.map((n) => (
                <div 
                  key={n.id} 
                  style={{ 
                    background: 'rgba(0,0,0,0.15)', 
                    padding: '1.5rem', 
                    borderRadius: '12px', 
                    border: n.is_urgent ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--glass-border)',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {n.is_urgent && (
                        <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                          Urgent
                        </span>
                      )}
                      <h4 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>{n.title}</h4>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Audience: <strong>{n.target_audience}</strong> 
                        {n.target_audience === 'Class' && n.classes ? ` (${n.classes.name})` : ''}
                        {n.target_audience === 'Section' && n.sections ? ` (${n.sections.name})` : ''}
                      </span>
                      <button 
                        onClick={() => handleDeleteNotice(n.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', margin: '0.75rem 0' }}>{n.content}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
                    <span>By: {n.profiles?.first_name} {n.profiles?.last_name}</span>
                    <span>Posted: {new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Notice Modal */}
          {showAddNotice && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
              <div className="glass-card fade-in" style={{ maxWidth: '500px', width: '95%', background: '#0f172a' }}>
                <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Create Announcement Notice</span>
                  <button 
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    onClick={() => setShowAddNotice(false)}
                  >
                    <X size={18} />
                  </button>
                </h3>

                <form onSubmit={handleCreateNotice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group">
                    <label>Notice Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Annual Sports Meet Schedule"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      disabled={submittingNotice}
                    />
                  </div>

                  <div className="form-group">
                    <label>Target Audience</label>
                    <select 
                      value={targetAudience} 
                      onChange={(e: any) => setTargetAudience(e.target.value)}
                      disabled={submittingNotice}
                    >
                      <option value="All">All Parents & Students (School-wide)</option>
                      <option value="Class">Specific Class</option>
                      <option value="Section">Specific Section</option>
                    </select>
                  </div>

                  {targetAudience === 'Class' && (
                    <div className="form-group">
                      <label>Target Class</label>
                      <select 
                        value={selectedClassId} 
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        required
                        disabled={submittingNotice}
                      >
                        <option value="">-- Select Class --</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}

                  {targetAudience === 'Section' && (
                    <div className="form-group">
                      <label>Target Section</label>
                      <select 
                        value={selectedSectionId} 
                        onChange={(e) => setSelectedSectionId(e.target.value)}
                        required
                        disabled={submittingNotice}
                      >
                        <option value="">-- Select Section --</option>
                        {sections.map(s => <option key={s.id} value={s.id}>{s.name} ({s.class_id})</option>)}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Notice Body</label>
                    <textarea 
                      placeholder="Write announcement body here..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      required
                      disabled={submittingNotice}
                      rows={5}
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.2)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        color: '#fff',
                        padding: '0.75rem',
                        fontSize: '0.9rem',
                        resize: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                    <input 
                      type="checkbox" 
                      id="urgent_notice" 
                      checked={isUrgent} 
                      onChange={(e) => setIsUrgent(e.target.checked)}
                      disabled={submittingNotice}
                      style={{ width: 'auto', cursor: 'pointer' }}
                    />
                    <label htmlFor="urgent_notice" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, color: '#f87171' }}>
                      Mark as Urgent Notice (Red highlighted tag)
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddNotice(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={submittingNotice}>
                      {submittingNotice ? 'Posting...' : 'Post Notice'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================================
          TAB: PARENT-TEACHER MESSAGE HISTORY LOGS (READ-ONLY)
          ============================================================================ */}
      {activeTab === 'messages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem' }}>
            <h3 style={{ margin: 0 }}>Parent-Teacher Asynchronous Conversation Logs</h3>
            <input 
              type="text" 
              placeholder="Search by student, parent, or teacher name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ maxWidth: '400px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem 1rem', color: '#fff' }}
            />
          </div>

          {loadingThreads ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading message logs...</p>
          ) : filteredThreads.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No communication logs match search criteria.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', minHeight: '500px' }}>
              {/* Thread list */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
                <h4 style={{ margin: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>Active Threads</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {filteredThreads.map(t => {
                    const studentName = t.student?.profiles
                      ? `${t.student.profiles.first_name} ${t.student.profiles.last_name}`
                      : 'Unknown Student';
                    const parentName = t.parent
                      ? `${t.parent.first_name} ${t.parent.last_name}`
                      : 'Unknown Parent';
                    const teacherName = t.teacher
                      ? `${t.teacher.first_name} ${t.teacher.last_name}`
                      : 'Unknown Teacher';
                    const isSelected = selectedThreadId === t.id;

                    return (
                      <div 
                        key={t.id} 
                        onClick={() => setSelectedThreadId(t.id)}
                        style={{ 
                          padding: '1rem', 
                          borderRadius: '8px', 
                          background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)', 
                          border: '1px solid ' + (isSelected ? 'rgba(99, 102, 241, 0.4)' : 'var(--glass-border)'),
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>Student: {studentName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          Parent: {parentName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                          Teacher: {teacherName}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            color: t.status === 'Resolved' ? '#10b981' : '#38bdf8',
                            fontWeight: 'bold'
                          }}>
                            {t.status}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                            Updated: {new Date(t.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Message log content */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
                {activeThread ? (
                  <>
                    <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0 }}>
                          Student: {activeThread.student?.profiles
                            ? `${activeThread.student.profiles.first_name} ${activeThread.student.profiles.last_name}`
                            : 'Log'}
                        </h4>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          padding: '0.2rem 0.6rem', 
                          borderRadius: '4px', 
                          background: activeThread.status === 'Resolved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(56, 189, 248, 0.1)', 
                          color: activeThread.status === 'Resolved' ? '#10b981' : '#38bdf8',
                          border: '1px solid ' + (activeThread.status === 'Resolved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)'),
                          fontWeight: 'bold'
                        }}>
                          Thread Status: {activeThread.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '2rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                        <span>Parent: <strong>{activeThread.parent ? `${activeThread.parent.first_name} ${activeThread.parent.last_name}` : 'N/A'}</strong></span>
                        <span>Class Teacher: <strong>{activeThread.teacher ? `${activeThread.teacher.first_name} ${activeThread.teacher.last_name}` : 'N/A'}</strong></span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '420px', paddingRight: '0.5rem' }}>
                      {threadMessages.map(msg => {
                        const isTeacher = msg.sender_id === activeThread.teacher_id;
                        const senderName = isTeacher 
                          ? `Teacher (${activeThread.teacher?.first_name || 'N/A'})` 
                          : `Parent (${activeThread.parent?.first_name || 'N/A'})`;
                        
                        return (
                          <div 
                            key={msg.id}
                            style={{
                              alignSelf: isTeacher ? 'flex-end' : 'flex-start',
                              background: isTeacher ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.06)',
                              border: '1px solid ' + (isTeacher ? 'rgba(99, 102, 241, 0.2)' : 'var(--glass-border)'),
                              padding: '1rem',
                              borderRadius: '12px',
                              maxWidth: '80%',
                              fontSize: '0.85rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                              <span style={{ fontWeight: 600, color: isTeacher ? '#a5b4fc' : '#94a3b8' }}>{senderName}</span>
                              <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p style={{ margin: 0, color: '#fff' }}>{msg.message_text}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      🚫 Administrator Read-Only Mode. You cannot reply or pose as a participant.
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)', opacity: 0.7, padding: '4rem 0' }}>
                    <MessageSquare size={36} style={{ marginBottom: '1rem' }} />
                    <p>Select a parent-teacher message thread on the left to inspect the conversation logs.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

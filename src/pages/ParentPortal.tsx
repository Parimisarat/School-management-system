import { useState, useEffect } from 'react';
import { supabase, supabaseM34 } from '../lib/supabaseClient';
import { useAuth } from '../lib/auth';
import { 
  Calendar, 
  FileText, 
  ShieldAlert, 
  AlertCircle, 
  Volume2, 
  Clock, 
  AlertTriangle
} from 'lucide-react';

interface PtmEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  status: 'active' | 'cancelled';
}

interface PtmSlot {
  id: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  is_booked_by_me: boolean;
  booking_id?: string;
  booking_notes?: string;
}

const formatTimeStr = (t: string) => {
  if (!t) return '';
  return t.substring(0, 5);
};

export default function ParentPortal() {
  const { user, schoolId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [siblings, setSiblings] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  
  // Tabs: 'dashboard' | 'attendance' | 'homework' | 'discipline' | 'notices' | 'messages' | 'ptm'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance' | 'homework' | 'discipline' | 'notices' | 'messages' | 'ptm'>('dashboard');

  // Sibling specific data (Attendance, Homework, Notices, Messages)
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
  
  // Async messaging
  const [activeThread, setActiveThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // ============================================================================
  // PTM PORTAL SPECIFIC STATES
  // ============================================================================
  const [ptmSubTab, setPtmSubTab] = useState<'book' | 'history'>('book');
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  const [events, setEvents] = useState<PtmEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [slots, setSlots] = useState<PtmSlot[]>([]);
  
  // Active/Cancelled bookings notifications
  const [cancelledBookings, setCancelledBookings] = useState<any[]>([]);
  const [activeBooking, setActiveBooking] = useState<any | null>(null);
  const [pastBookings, setPastBookings] = useState<any[]>([]);

  // ============================================================================
  // EFFECTS
  // ============================================================================
  useEffect(() => {
    if (user?.id) {
      loadSiblings();
    }
  }, [user]);

  useEffect(() => {
    if (selectedChild) {
      loadChildData();
      fetchEvents();
      fetchParentBookings();
    }
  }, [selectedChild]);

  useEffect(() => {
    if (selectedEventId && selectedChild) {
      const classTeacherId = selectedChild.sections?.class_teacher_id;
      if (classTeacherId) {
        fetchSlots(selectedEventId, classTeacherId);
      } else {
        setSlots([]);
      }
    }
  }, [selectedEventId, selectedChild]);

  // ============================================================================
  // LOAD SIBLINGS & MAIN DATA
  // ============================================================================
  async function loadSiblings() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabaseM34
        .from('students')
        .select(`
          *,
          classes ( name ),
          sections (
            name,
            class_teacher_id,
            profiles:class_teacher_id ( first_name, last_name )
          ),
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
      await fetchMessageThread();
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
    if (!selectedChild) return;
    try {
      const { data, error } = await supabase
        .from('notices')
        .select(`
          id,
          title,
          content,
          is_urgent,
          created_at,
          class_id,
          section_id,
          target_audience,
          profiles!notices_created_by_fkey ( first_name, last_name )
        `)
        .or(`target_audience.eq.All,and(target_audience.eq.Class,class_id.eq.${selectedChild.class_id}),and(target_audience.eq.Section,section_id.eq.${selectedChild.section_id})`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotices(data || []);
    } catch (e) {
      console.error('Error fetching notices:', e);
    }
  }

  async function fetchMessageThread() {
    if (!selectedChild || !user) return;
    try {
      const { data: threadData, error: threadError } = await supabase
        .from('message_threads')
        .select('*')
        .eq('student_id', selectedChild.id)
        .eq('parent_id', user.id)
        .single();

      if (threadError && threadError.code !== 'PGRST116') {
        throw threadError;
      }

      if (threadData) {
        setActiveThread(threadData);
        const { data: msgData, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .eq('thread_id', threadData.id)
          .order('created_at', { ascending: true });

        if (msgError) throw msgError;
        setMessages(msgData || []);
      } else {
        setActiveThread(null);
        setMessages([]);
      }
    } catch (e) {
      console.error('Error fetching message thread:', e);
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || sendingMsg || !selectedChild || !user) return;
    if (newMessageText.length > 1000) {
      alert('Message must be 1000 characters or less.');
      return;
    }

    const classTeacherId = selectedChild.sections?.class_teacher_id;
    if (!classTeacherId) {
      alert('Cannot send message: no class teacher assigned to this section.');
      return;
    }

    setSendingMsg(true);
    try {
      let threadId = activeThread?.id;

      if (!activeThread) {
        const { data: newThread, error: threadErr } = await supabase
          .from('message_threads')
          .insert({
            school_id: user.school_id,
            student_id: selectedChild.id,
            parent_id: user.id,
            teacher_id: classTeacherId,
            status: 'Active'
          })
          .select()
          .single();

        if (threadErr) throw threadErr;
        setActiveThread(newThread);
        threadId = newThread.id;
      } else if (activeThread.status === 'Resolved') {
        const { data: updatedThread, error: updateErr } = await supabase
          .from('message_threads')
          .update({ status: 'Active' })
          .eq('id', activeThread.id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        setActiveThread(updatedThread);
        threadId = updatedThread.id;
      }

      const { data: newMsg, error: msgErr } = await supabase
        .from('messages')
        .insert({
          school_id: user.school_id,
          thread_id: threadId,
          sender_id: user.id,
          message_text: newMessageText.trim()
        })
        .select()
        .single();

      if (msgErr) throw msgErr;

      setMessages(prev => [...prev, newMsg]);
      setNewMessageText('');
    } catch (e: any) {
      alert(`Failed to send message: ${e.message}`);
    } finally {
      setSendingMsg(false);
    }
  };

  const getAttachmentLink = (path: string) => {
    const { data } = supabase.storage.from('documents').getPublicUrl(path);
    return data?.publicUrl || '#';
  };

  // ============================================================================
  // PTM BOOKING PORTAL LOGIC
  // ============================================================================
  async function fetchEvents() {
    setLoadingEvents(true);
    try {
      const { data, error } = await supabase
        .from('ptm_events')
        .select('*')
        .eq('school_id', schoolId)
        .order('date', { ascending: false });

      if (error) throw error;

      const mappedEvents: PtmEvent[] = (data || []).map((e: any) => {
        let isCancelled = e.status === 'cancelled' || e.title.startsWith('[CANCELLED]');
        try {
          const descObj = JSON.parse(e.description);
          if (descObj.status === 'cancelled') isCancelled = true;
        } catch (err) {}

        return {
          id: e.id,
          title: e.title,
          date: e.date,
          description: e.description,
          status: isCancelled ? 'cancelled' : 'active'
        };
      });

      setEvents(mappedEvents);
      if (mappedEvents.length > 0) {
        setSelectedEventId(mappedEvents[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching events:', err.message);
    } finally {
      setLoadingEvents(false);
    }
  }

  async function fetchParentBookings() {
    try {
      const { data, error } = await supabase
        .from('ptm_bookings')
        .select(`
          id,
          slot_id,
          notes,
          student_id,
          ptm_slots (
            id,
            start_time,
            end_time,
            teacher_id,
            profiles:teacher_id (first_name, last_name),
            ptm_events (
              id,
              title,
              date,
              description
            )
          )
        `)
        .eq('parent_id', user?.id)
        .eq('student_id', selectedChild.id);

      if (error) throw error;

      const active: any[] = [];
      const cancelled: any[] = [];
      const past: any[] = [];

      data?.forEach((b: any) => {
        const slot = b.ptm_slots;
        const event = slot?.ptm_events;
        const teacher = slot?.profiles;

        let eventCancelled = false;
        if (event) {
          if (event.title.startsWith('[CANCELLED]')) {
            eventCancelled = true;
          }
          try {
            const descObj = JSON.parse(event.description);
            if (descObj.status === 'cancelled') eventCancelled = true;
          } catch (err) {}
        }

        const bookingInfo = {
          booking_id: b.id,
          slot_id: slot?.id,
          notes: b.notes,
          event_title: event?.title || 'PTM Meeting',
          event_date: event?.date || '',
          start_time: slot?.start_time || '',
          end_time: slot?.end_time || '',
          teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : 'Class Teacher'
        };

        if (eventCancelled || b.notes?.startsWith('[CANCELLED]')) {
          cancelled.push(bookingInfo);
        } else {
          const meetingDate = new Date(`${event.date}T${slot.start_time}`);
          if (meetingDate < new Date()) {
            past.push(bookingInfo);
          } else {
            active.push(bookingInfo);
          }
        }
      });

      setCancelledBookings(cancelled);
      setPastBookings(past);
      setActiveBooking(active.length > 0 ? active[0] : null);
    } catch (err: any) {
      console.error('Error fetching parent bookings:', err.message);
    }
  }

  async function fetchSlots(eventId: string, teacherId: string) {
    setLoadingSlots(true);
    try {
      const { data, error } = await supabase
        .from('ptm_slots')
        .select('*')
        .eq('event_id', eventId)
        .eq('teacher_id', teacherId)
        .order('start_time', { ascending: true });

      if (error) throw error;

      const { data: myBookings } = await supabase
        .from('ptm_bookings')
        .select('*')
        .eq('parent_id', user?.id)
        .eq('student_id', selectedChild.id);

      const mappedSlots: PtmSlot[] = (data || []).map((slot: any) => {
        const bookedByMe = myBookings?.find(b => b.slot_id === slot.id);
        return {
          id: slot.id,
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_available: slot.is_available,
          is_booked_by_me: !!bookedByMe,
          booking_id: bookedByMe?.id,
          booking_notes: bookedByMe?.notes || ''
        };
      });

      setSlots(mappedSlots);
    } catch (err: any) {
      console.error('Error fetching slots:', err.message);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleBookSlot(slot: PtmSlot) {
    if (!selectedChild) return;
    const teacherProfile = selectedChild.sections?.profiles;
    const teacherName = teacherProfile ? `${teacherProfile.first_name} ${teacherProfile.last_name}` : 'Class Teacher';

    if (activeBooking && activeBooking.event_date === events.find(e => e.id === selectedEventId)?.date) {
      alert(`You have already booked a slot for this PTM event (${activeBooking.start_time} with ${activeBooking.teacher_name}). To change times, please cancel your existing booking first.`);
      return;
    }

    const selectedEvent = events.find(e => e.id === selectedEventId);
    if (selectedEvent) {
      const slotDateTime = new Date(`${selectedEvent.date}T${slot.start_time}`);
      if (slotDateTime < new Date()) {
        alert('You cannot book a past time slot.');
        return;
      }
    }

    if (!confirm(`Confirm booking for slot ${formatTimeStr(slot.start_time)} - ${formatTimeStr(slot.end_time)} with Teacher ${teacherName}?`)) {
      return;
    }

    setBookingInProgress(true);
    try {
      const { error } = await supabase
        .from('ptm_bookings')
        .insert([{
          school_id: schoolId,
          slot_id: slot.id,
          student_id: selectedChild.id,
          parent_id: user?.id,
          notes: ''
        }]);

      if (error) {
        if (error.code === '23505') {
          throw new Error('This slot was just booked by another parent. Please refresh and select a different slot.');
        }
        throw error;
      }

      alert('Meeting booked successfully!');
      fetchParentBookings();
      const classTeacherId = selectedChild.sections?.class_teacher_id;
      if (selectedEventId && classTeacherId) {
        fetchSlots(selectedEventId, classTeacherId);
      }
    } catch (err: any) {
      alert(`Booking failed: ${err.message}`);
    } finally {
      setBookingInProgress(false);
    }
  }

  async function handleCancelBooking(bookingId: string, eventDate: string, startTimeStr: string) {
    const current = new Date();
    const slotDateTime = new Date(`${eventDate}T${startTimeStr}`);
    const diffMs = slotDateTime.getTime() - current.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);

    if (diffHrs < 2) {
      alert('Cannot cancel or change booking. Bookings are locked within 2 hours of the meeting time.');
      return;
    }

    if (!confirm('Are you sure you want to cancel this booking? This will make the slot available for other parents.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ptm_bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;

      alert('Booking cancelled successfully.');
      fetchParentBookings();
      const classTeacherId = selectedChild.sections?.class_teacher_id;
      if (selectedEventId && classTeacherId) {
        fetchSlots(selectedEventId, classTeacherId);
      }
    } catch (err: any) {
      alert(`Cancellation failed: ${err.message}`);
    }
  }

  const handleDismissNotification = (id: string) => {
    setCancelledBookings(prev => prev.filter(c => c.booking_id !== id));
  };

  const checkCancelAllowed = (eventDate: string, startTimeStr: string) => {
    const current = new Date();
    const slotDateTime = new Date(`${eventDate}T${startTimeStr}`);
    const diffMs = slotDateTime.getTime() - current.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    return diffHrs >= 2;
  };

  // ============================================================================
  // RENDER
  // ============================================================================
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
  const classTeacherProfile = selectedChild.sections?.profiles;
  const classTeacherName = classTeacherProfile ? `${classTeacherProfile.first_name} ${classTeacherProfile.last_name}` : 'Unassigned';

  return (
    <div className="app-container fade-in">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Parent Digital Portal</h1>
          <p>Track academic progress, homework, attendance, announcements, and book PTM meetings.</p>
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
        
        {attendanceStats.total > 0 && attendanceStats.percentage < 75 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fda4af', background: 'rgba(239, 68, 68, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.8rem' }}>
            <ShieldAlert size={14} style={{ color: 'var(--danger)' }} />
            <span>Attendance below 75% ({attendanceStats.percentage}%)</span>
          </div>
        )}
      </div>

      {/* Cancellation Banner Alerts for PTM */}
      {cancelledBookings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
          {cancelledBookings.map((c) => (
            <div 
              key={c.booking_id}
              className="glass-card fade-in" 
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '1.25rem',
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertTriangle size={24} style={{ color: 'var(--danger)' }} />
                <div>
                  <h4 style={{ margin: 0, color: '#fca5a5', fontWeight: 700 }}>PTM Meeting Cancelled</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Your meeting with <strong>{c.teacher_name}</strong> scheduled on <strong>{new Date(c.event_date).toLocaleDateString()}</strong> at <strong>{formatTimeStr(c.start_time)}</strong> has been cancelled by the teacher/admin.
                  </p>
                </div>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                onClick={() => handleDismissNotification(c.booking_id)}
              >
                Dismiss Notice
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Grid of panels (Dashboard Overview) */}
      {activeTab === 'dashboard' && (
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

          {/* PTM Booking Widget */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(15, 23, 42, 0.45)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--primary)' }}>
              <Clock size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Parent-Teacher Meetings</h3>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              {activeBooking ? (
                <>
                  <h4 style={{ margin: 0, color: '#fff', fontSize: '0.95rem' }}>Booked: {activeBooking.event_title}</h4>
                  <p style={{ fontSize: '0.8rem', margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
                    With {activeBooking.teacher_name} at {formatTimeStr(activeBooking.start_time)} ({new Date(activeBooking.event_date).toLocaleDateString()})
                  </p>
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: '2rem', margin: 0 }}>No Booking</h2>
                  <p style={{ fontSize: '0.8rem', margin: '4px 0 0 0' }}>Select a time slot to meet teacher</p>
                </>
              )}
            </div>
            <button className="btn btn-secondary" style={{ padding: '0.4rem', width: '100%', fontSize: '0.8rem', marginTop: 'auto' }} onClick={() => setActiveTab('ptm')}>
              {activeBooking ? 'Manage / Book Slot' : 'Book a Slot'}
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
              <p style={{ fontSize: '0.8rem', margin: '4px 0 0 0' }}>Latest announcements scoping child</p>
            </div>
            <button className="btn btn-secondary" style={{ padding: '0.4rem', width: '100%', fontSize: '0.8rem', marginTop: 'auto' }} onClick={() => setActiveTab('notices')}>
              Open Notice Board
            </button>
          </div>
        </div>
      )}

      {/* ============================================================================
          TAB: ATTENDANCE LOGS
          ============================================================================ */}
      {activeTab === 'attendance' && (
        <div className="glass-card">
          <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>Attendance Calendar Logs</h3>
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

      {/* ============================================================================
          TAB: HOMEWORK ASSIGNMENTS
          ============================================================================ */}
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

      {/* ============================================================================
          TAB: SCHOOL NOTICES
          ============================================================================ */}
      {activeTab === 'notices' && (() => {
        const now = new Date();
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const activeNotices = notices.filter(n => new Date(n.created_at) >= ninetyDaysAgo);
        const archivedNotices = notices.filter(n => new Date(n.created_at) < ninetyDaysAgo);

        return (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div>
              <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>School Notice Board Announcements</h3>
              {activeNotices.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>No active notices at this time.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {activeNotices.map((n) => (
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
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Posted: {new Date(n.created_at).toLocaleDateString()}</span>
                      </div>
                      <p style={{ fontSize: '0.9rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', margin: '0.5rem 0' }}>{n.content}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1rem', textAlign: 'right', margin: 0 }}>
                        Announced by: {n.profiles?.first_name} {n.profiles?.last_name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {archivedNotices.length > 0 && (
              <div>
                <h4 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Archived Notices (Older than 90 days)</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {archivedNotices.map((n) => (
                    <div key={n.id} style={{ background: 'rgba(0,0,0,0.08)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <h5 style={{ margin: 0, color: '#94a3b8' }}>{n.title}</h5>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{new Date(n.created_at).toLocaleDateString()}</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: '#94a3b8', whiteSpace: 'pre-wrap' }}>{n.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ============================================================================
          TAB: MESSAGES THREAD
          ============================================================================ */}
      {activeTab === 'messages' && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>Asynchronous Parent-Teacher Messages</h3>
            {selectedChild?.sections?.profiles && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Class Teacher: <strong>{selectedChild.sections.profiles.first_name} {selectedChild.sections.profiles.last_name}</strong>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {messages.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                No messages yet. Send a message below to start a conversation with the class teacher.
              </p>
            ) : (
              messages.map((msg) => {
                const isTeacher = msg.sender_id !== user?.id;
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
              })
            )}
          </div>

          {activeThread?.status === 'Resolved' && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', fontSize: '0.85rem', color: '#10b981' }}>
              This conversation thread was marked as <strong>Resolved</strong> by the teacher. Sending a new message will re-open it.
            </div>
          )}

          <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <textarea
              placeholder="Type message to class teacher..."
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value.slice(0, 1000))}
              required
              disabled={sendingMsg}
              rows={3}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: newMessageText.length >= 1000 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                {newMessageText.length}/1000 characters
              </span>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={sendingMsg || !newMessageText.trim()}
              >
                {sendingMsg ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================================
          TAB: PTM SCHEDULING PORTAL
          ============================================================================ */}
      {activeTab === 'ptm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Selector Subtabs */}
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
            <button 
              className={`btn ${ptmSubTab === 'book' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.4rem 1.25rem', fontSize: '0.8rem' }}
              onClick={() => setPtmSubTab('book')}
            >
              Book Time Slot
            </button>
            <button 
              className={`btn ${ptmSubTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.4rem 1.25rem', fontSize: '0.8rem' }}
              onClick={() => setPtmSubTab('history')}
            >
              Meeting History & Feedback
            </button>
          </div>

          {ptmSubTab === 'book' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start' }}>
              
              {/* Left side: Event dropdown & active booking card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="glass-card">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Select PTM Event</label>
                    {loadingEvents ? (
                      <p>Loading events...</p>
                    ) : events.length === 0 ? (
                      <p style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>No PTM Meets scheduled by school administration.</p>
                    ) : (
                      <select 
                        value={selectedEventId} 
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        style={{ padding: '0.5rem' }}
                      >
                        {events.map(e => (
                          <option key={e.id} value={e.id} disabled={e.status === 'cancelled'}>
                            {e.title} {e.status === 'cancelled' ? '(Cancelled)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Active Booking Status */}
                <div className="glass-card" style={{ border: activeBooking ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--glass-border)' }}>
                  <h4 style={{ margin: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '0.75rem', color: '#fff' }}>
                    Active Booking Status
                  </h4>
                  {activeBooking ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>
                        Event: <strong>{activeBooking.event_title}</strong>
                      </p>
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>
                        Date: <strong>{new Date(activeBooking.event_date).toLocaleDateString()}</strong>
                      </p>
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>
                        Time: <strong style={{ color: 'var(--primary)' }}>{formatTimeStr(activeBooking.start_time)} - {formatTimeStr(activeBooking.end_time)}</strong>
                      </p>
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>
                        Teacher: <strong>{activeBooking.teacher_name}</strong>
                      </p>
                      
                      <div style={{ marginTop: '0.5rem' }}>
                        {checkCancelAllowed(activeBooking.event_date, activeBooking.start_time) ? (
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.4rem', fontSize: '0.75rem', width: '100%' }}
                            onClick={() => handleCancelBooking(activeBooking.booking_id, activeBooking.event_date, activeBooking.start_time)}
                          >
                            Cancel Booking
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.4rem', borderRadius: '4px' }}>
                            🔒 Booking Locked (Within 2 Hours)
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontStyle: 'italic', fontSize: '0.85rem', margin: 0 }}>You have no active bookings for this child.</p>
                  )}
                </div>
              </div>

              {/* Right side: Slot Grid */}
              <div className="glass-card">
                <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: 0 }}>Available Meeting Slots</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Book a 1-on-1 private slot with class teacher: <strong>{classTeacherName}</strong>
                  </p>
                </div>

                {loadingSlots ? (
                  <p style={{ textAlign: 'center', padding: '2rem' }}>Loading time slots...</p>
                ) : !selectedChild.sections?.class_teacher_id ? (
                  <p style={{ color: 'var(--warning)', fontStyle: 'italic' }}>
                    No class teacher assigned to this student section. Slots cannot be booked.
                  </p>
                ) : slots.length === 0 ? (
                  <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                    No slots generated by the class teacher for this event.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
                    {slots.map((slot) => {
                      const selectedEvent = events.find(e => e.id === selectedEventId);
                      const isPast = selectedEvent ? new Date(`${selectedEvent.date}T${slot.start_time}`) < new Date() : false;
                      const isBookedOther = !slot.is_available && !slot.is_booked_by_me;
                      
                      let btnText = formatTimeStr(slot.start_time);
                      let btnClass = 'btn-secondary';
                      let disabled = false;

                      if (slot.is_booked_by_me) {
                        btnText = `${formatTimeStr(slot.start_time)} (Booked)`;
                        btnClass = 'btn-primary';
                      } else if (isBookedOther || isPast || !slot.is_available) {
                        disabled = true;
                        btnText = `${formatTimeStr(slot.start_time)} (N/A)`;
                      }

                      return (
                        <button
                          key={slot.id}
                          className={`btn ${btnClass}`}
                          style={{ padding: '0.6rem 0.4rem', fontSize: '0.8rem', justifyContent: 'center' }}
                          disabled={disabled || bookingInProgress}
                          onClick={() => {
                            if (!slot.is_booked_by_me) handleBookSlot(slot);
                          }}
                        >
                          {btnText}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {ptmSubTab === 'history' && (
            <div className="glass-card">
              <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                Meeting History & Teacher Feedback
              </h3>
              {pastBookings.length === 0 ? (
                <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)', margin: 0 }}>
                  No past meeting history or feedback logs available.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {pastBookings.map((b) => (
                    <div 
                      key={b.booking_id}
                      style={{
                        padding: '1.25rem',
                        borderRadius: '12px',
                        background: 'rgba(0,0,0,0.15)',
                        border: '1px solid var(--glass-border)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <h4 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>{b.event_title}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {new Date(b.event_date).toLocaleDateString()} | {formatTimeStr(b.start_time)} - {formatTimeStr(b.end_time)}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Teacher: <strong>{b.teacher_name}</strong>
                      </p>
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem', color: 'var(--primary)' }}>
                          Teacher Feedback / Action Items:
                        </strong>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                          {b.notes || 'No feedback notes recorded by teacher.'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Back button overview helper */}
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

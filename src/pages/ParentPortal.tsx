import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/auth';
import { Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Student {
  id: string;
  roll_number: string;
  class_name: string;
  section_name: string;
  first_name: string;
  last_name: string;
  class_teacher_id: string | null;
  class_teacher_name: string;
}

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

export default function ParentPortal() {
  const { user, schoolId } = useAuth();
  
  // Tab states
  const [activeTab, setActiveTab] = useState<'book' | 'history'>('book');

  // Loading states
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // Data states
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [events, setEvents] = useState<PtmEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [slots, setSlots] = useState<PtmSlot[]>([]);
  
  // Active/Cancelled bookings notifications
  const [cancelledBookings, setCancelledBookings] = useState<any[]>([]);
  const [activeBooking, setActiveBooking] = useState<any | null>(null);
  const [pastBookings, setPastBookings] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchStudents();
    }
  }, [user?.id]);

  useEffect(() => {
    if (selectedStudentId) {
      fetchEvents();
      fetchParentBookings();
    }
  }, [selectedStudentId]);

  useEffect(() => {
    if (selectedEventId && selectedStudentId) {
      const activeStudent = students.find(s => s.id === selectedStudentId);
      if (activeStudent?.class_teacher_id) {
        fetchSlots(selectedEventId, activeStudent.class_teacher_id);
      } else {
        setSlots([]);
      }
    }
  }, [selectedEventId, selectedStudentId]);

  // Fetch children for logged-in parent
  async function fetchStudents() {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          roll_number,
          profiles:profile_id (first_name, last_name),
          sections:section_id (
            name,
            class_teacher_id,
            profiles:class_teacher_id (first_name, last_name)
          ),
          classes:class_id (name)
        `)
        .eq('parent_id', user?.id);

      if (error) throw error;

      const formattedStudents: Student[] = (data || []).map((s: any) => {
        const studentProfile = s.profiles;
        const sectionData = s.sections;
        const teacherProfile = sectionData?.profiles;
        const classData = s.classes;

        return {
          id: s.id,
          roll_number: s.roll_number || 'N/A',
          first_name: studentProfile?.first_name || '',
          last_name: studentProfile?.last_name || '',
          class_name: classData?.name || 'N/A',
          section_name: sectionData?.name || 'N/A',
          class_teacher_id: sectionData?.class_teacher_id || null,
          class_teacher_name: teacherProfile 
            ? `${teacherProfile.first_name} ${teacherProfile.last_name}` 
            : 'Unassigned'
        };
      });

      setStudents(formattedStudents);
      if (formattedStudents.length > 0) {
        setSelectedStudentId(formattedStudents[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching students:', err.message);
    } finally {
      setLoadingStudents(false);
    }
  }

  // Fetch active school-wide events
  async function fetchEvents() {
    setLoadingEvents(true);
    try {
      const { data, error } = await supabase
        .from('ptm_events')
        .select('*')
        .eq('school_id', schoolId)
        .order('date', { ascending: false });

      if (error) throw error;

      // Filter events to check if they are active/cancelled
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

  // Fetch bookings made by the parent to detect cancelled notifications and active schedules
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
        .eq('student_id', selectedStudentId);

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
          // Check if date is in the past
          const meetingDate = new Date(`${event.date}T${slot.start_time}`);
          if (meetingDate < new Date()) {
            past.push(bookingInfo);
          } else {
            active.push(bookingInfo);
          }
        }
      });

      // Set states
      setCancelledBookings(cancelled);
      setPastBookings(past);
      setActiveBooking(active.length > 0 ? active[0] : null);
    } catch (err: any) {
      console.error('Error fetching parent bookings:', err.message);
    }
  }

  // Fetch slots for the child's class teacher
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

      // Find my bookings for these slots
      const { data: myBookings } = await supabase
        .from('ptm_bookings')
        .select('*')
        .eq('parent_id', user?.id)
        .eq('student_id', selectedStudentId);

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

  // Handle Slot Booking
  async function handleBookSlot(slot: PtmSlot) {
    const activeStudent = students.find(s => s.id === selectedStudentId);
    if (!activeStudent) return;

    // 1. One parent can book only one slot per PTM event
    // Check if the parent already has an active booking for this event
    if (activeBooking && activeBooking.event_date === events.find(e => e.id === selectedEventId)?.date) {
      alert(`You have already booked a slot for this PTM event (${activeBooking.start_time} with ${activeBooking.teacher_name}). To change times, please cancel your existing booking first.`);
      return;
    }

    // 2. Parents cannot book past time slots
    const selectedEvent = events.find(e => e.id === selectedEventId);
    if (selectedEvent) {
      const slotDateTime = new Date(`${selectedEvent.date}T${slot.start_time}`);
      if (slotDateTime < new Date()) {
        alert('You cannot book a past time slot.');
        return;
      }
    }

    if (!confirm(`Confirm booking for slot ${formatTimeStr(slot.start_time)} - ${formatTimeStr(slot.end_time)} with Teacher ${activeStudent.class_teacher_name}?`)) {
      return;
    }

    setBookingInProgress(true);
    try {
      // Create booking row (concurrency-safe via unique constraint on slot_id)
      const { error } = await supabase
        .from('ptm_bookings')
        .insert([{
          school_id: schoolId,
          slot_id: slot.id,
          student_id: selectedStudentId,
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
      if (selectedEventId) {
        fetchSlots(selectedEventId, activeStudent.class_teacher_id!);
      }
    } catch (err: any) {
      alert(`Booking failed: ${err.message}`);
    } finally {
      setBookingInProgress(false);
    }
  }

  // Handle Booking Cancellation
  async function handleCancelBooking(bookingId: string, eventDate: string, startTimeStr: string) {
    // 2-Hour Cancellation Rule check
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
      const activeStudent = students.find(s => s.id === selectedStudentId);
      if (selectedEventId && activeStudent?.class_teacher_id) {
        fetchSlots(selectedEventId, activeStudent.class_teacher_id);
      }
    } catch (err: any) {
      alert(`Cancellation failed: ${err.message}`);
    }
  }

  // Dismiss a cancellation notification
  const handleDismissNotification = (id: string) => {
    setCancelledBookings(prev => prev.filter(c => c.booking_id !== id));
  };

  const formatTimeStr = (t: string) => {
    return t.substring(0, 5);
  };

  const checkCancelAllowed = (eventDate: string, startTimeStr: string) => {
    const current = new Date();
    const slotDateTime = new Date(`${eventDate}T${startTimeStr}`);
    const diffMs = slotDateTime.getTime() - current.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    return diffHrs >= 2;
  };

  const activeStudent = students.find(s => s.id === selectedStudentId);

  return (
    <div className="app-container fade-in">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Parent PTM Dashboard</h1>
          <p>Book online slots to meet your child's class teacher and review meeting history/feedback.</p>
        </div>
      </div>

      {/* Cancellation Banner Alerts */}
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

      {loadingStudents ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Loading student profiles...</div>
      ) : students.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <AlertTriangle size={36} style={{ color: 'var(--warning)', marginBottom: '1rem' }} />
          <p>No student profiles linked to this parent account. Please contact school administration.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start' }}>
          
          {/* Left Column: Student Selector and Active Booking Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Student selection card */}
            <div className="glass-card">
              <h3 style={{ margin: 0, paddingBottom: '0.75rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '1.25rem' }}>
                Select Student Profile
              </h3>
              
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label>Child Profile</label>
                <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} (Roll No: {s.roll_number})
                    </option>
                  ))}
                </select>
              </div>

              {activeStudent && (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Class & Section</p>
                  <p style={{ margin: '2px 0 8px 0', fontWeight: 600, color: '#fff' }}>
                    {activeStudent.class_name} - {activeStudent.section_name}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Assigned Class Teacher</p>
                  <p style={{ margin: '2px 0 0 0', fontWeight: 600, color: 'var(--primary)' }}>
                    👨‍🏫 {activeStudent.class_teacher_name}
                  </p>
                </div>
              )}
            </div>

            {/* Current Booked Appointment Card */}
            <div className="glass-card">
              <h3 style={{ margin: 0, paddingBottom: '0.75rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '1.25rem' }}>
                Current Scheduled Meeting
              </h3>
              
              {activeBooking ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                    <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                    <span style={{ fontSize: '0.9rem', color: '#a7f3d0', fontWeight: 600 }}>Booking Confirmed</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>EVENT</p>
                    <p style={{ margin: 0, fontWeight: 700, color: '#fff' }}>{activeBooking.event_title}</p>
                    
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>TEACHER</p>
                    <p style={{ margin: 0, fontWeight: 600, color: '#fff' }}>{activeBooking.teacher_name}</p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginTop: '8px' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>DATE</p>
                        <p style={{ margin: 0, fontWeight: 600, color: '#fff' }}>{new Date(activeBooking.event_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>TIME</p>
                        <p style={{ margin: 0, fontWeight: 600, color: '#fff' }}>{formatTimeStr(activeBooking.start_time)} - {formatTimeStr(activeBooking.end_time)}</p>
                      </div>
                    </div>
                  </div>

                  {checkCancelAllowed(activeBooking.event_date, activeBooking.start_time) ? (
                    <button 
                      className="btn btn-danger"
                      style={{ width: '100%' }}
                      onClick={() => handleCancelBooking(activeBooking.booking_id, activeBooking.event_date, activeBooking.start_time)}
                    >
                      Cancel Appointment
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" style={{ width: '100%', opacity: 0.6, cursor: 'not-allowed' }} disabled>
                        Cancel Locked (within 2h)
                      </button>
                      <p style={{ fontSize: '0.75rem', color: 'var(--warning)', fontStyle: 'italic', textAlign: 'center', margin: 0 }}>
                        Meetings cannot be rescheduled or cancelled within 2 hours of the start time.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center', margin: '1rem 0' }}>
                  No upcoming meetings booked for this child.
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Time Grid and Notes History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
              <button 
                className={`btn ${activeTab === 'book' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}
                onClick={() => setActiveTab('book')}
              >
                Book Time Slot
              </button>
              <button 
                className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}
                onClick={() => setActiveTab('history')}
              >
                Meeting History & Notes ({pastBookings.length})
              </button>
            </div>

            {activeTab === 'book' && (
              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Available Scheduling Slots</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                      Select a PTM event and book a slot to meet {activeStudent?.class_teacher_name}.
                    </p>
                  </div>
                </div>

                {/* Event selector */}
                <div className="form-group" style={{ maxWidth: '300px', marginBottom: '2rem' }}>
                  <label>Select PTM Event</label>
                  <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} disabled={loadingEvents}>
                    {events.map((e) => (
                      <option key={e.id} value={e.id} disabled={e.status === 'cancelled'}>
                        {e.title} {e.status === 'cancelled' ? '(Cancelled)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {loadingSlots ? (
                  <div style={{ textAlign: 'center', padding: '3rem' }}>Loading time slots...</div>
                ) : slots.length === 0 ? (
                  <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', borderStyle: 'dashed' }}>
                    <p style={{ margin: 0, fontStyle: 'italic' }}>
                      {activeStudent?.class_teacher_id 
                        ? `No schedule slots generated by Teacher ${activeStudent.class_teacher_name} for this event yet.`
                        : `No class teacher assigned to this section.`}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                      {slots.map((slot) => {
                        const isBooked = !slot.is_available && !slot.is_booked_by_me;
                        const isAvailable = slot.is_available && !slot.is_booked_by_me;
                        
                        let cardBg = 'rgba(15, 23, 42, 0.4)';
                        let borderColor = 'var(--glass-border)';
                        let textColor = 'var(--text-secondary)';
                        
                        if (slot.is_booked_by_me) {
                          cardBg = 'rgba(16, 185, 129, 0.1)';
                          borderColor = 'rgba(16, 185, 129, 0.4)';
                          textColor = '#34d399';
                        } else if (isAvailable) {
                          cardBg = 'rgba(99, 102, 241, 0.03)';
                          borderColor = 'rgba(99, 102, 241, 0.2)';
                          textColor = '#fff';
                        }

                        // Determine date check
                        const selectedEvent = events.find(e => e.id === selectedEventId);
                        const isPast = selectedEvent 
                          ? new Date(`${selectedEvent.date}T${slot.start_time}`) < new Date()
                          : false;

                        return (
                          <div 
                            key={slot.id}
                            style={{
                              padding: '1rem',
                              borderRadius: '12px',
                              background: cardBg,
                              border: `1px solid ${borderColor}`,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.75rem',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              opacity: isPast ? 0.5 : 1
                            }}
                          >
                            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: textColor, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Clock size={14} />
                              {formatTimeStr(slot.start_time)}
                            </span>
                            
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Duration: {formatTimeStr(slot.start_time)} - {formatTimeStr(slot.end_time)}
                            </span>

                            {isPast ? (
                              <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', borderRadius: '4px' }}>
                                Past Slot
                              </span>
                            ) : slot.is_booked_by_me ? (
                              <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'rgba(16,185,129,0.15)', color: '#34d399', borderRadius: '4px', fontWeight: 'bold' }}>
                                Your Appointment
                              </span>
                            ) : isBooked ? (
                              <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'rgba(239,68,68,0.1)', color: '#fda4af', borderRadius: '4px' }}>
                                Unavailable
                              </span>
                            ) : (
                              <button 
                                className="btn btn-primary" 
                                style={{ width: '100%', padding: '0.35rem', fontSize: '0.75rem', marginTop: '0.25rem' }}
                                onClick={() => handleBookSlot(slot)}
                                disabled={bookingInProgress}
                              >
                                Book Slot
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="glass-card">
                <h3 style={{ marginBottom: '1.25rem' }}>Past Meetings & Feedback Summary</h3>
                
                {pastBookings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    No past PTM meetings found for this child profile.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {pastBookings.map((b) => (
                      <div 
                        key={b.booking_id}
                        style={{
                          padding: '1.25rem',
                          borderRadius: '12px',
                          background: 'rgba(15, 23, 42, 0.4)',
                          border: '1px solid var(--glass-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <h4 style={{ margin: 0, fontWeight: 700, color: '#fff' }}>{b.event_title}</h4>
                            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem' }}>
                              Teacher: <strong>{b.teacher_name}</strong> | Date: {new Date(b.event_date).toLocaleDateString()} ({formatTimeStr(b.start_time)} - {formatTimeStr(b.end_time)})
                            </p>
                          </div>
                          <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', borderRadius: '4px', fontWeight: 'bold' }}>
                            COMPLETED
                          </span>
                        </div>
                        
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
                          <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                            Teacher Feedback & Meeting Notes
                          </p>
                          {b.notes ? (
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#fff', lineHeight: 1.5 }}>{b.notes}</p>
                          ) : (
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                              No meeting notes saved by the teacher.
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

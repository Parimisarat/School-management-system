import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/auth';
import { Calendar, Clock, Plus, RefreshCw, FileText, Check, X } from 'lucide-react';

interface PtmEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  status: 'active' | 'cancelled';
  created_at: string;
}

interface PtmSlot {
  id: string;
  event_id: string;
  teacher_id: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  ptm_bookings?: {
    id: string;
    student_id: string;
    parent_id: string;
    notes: string;
    parent_profile?: {
      first_name: string;
      last_name: string;
    };
    student_profile?: {
      id: string;
      profile_id: string;
      roll_number: string;
      profiles?: {
        first_name: string;
        last_name: string;
      };
    };
  } | null;
}

export default function TeacherDashboard() {
  const { user, schoolId } = useAuth();
  
  // Tab control
  const [activeTab, setActiveTab] = useState<'manage' | 'notes'>('manage');
  
  // Loading states
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState(false);
  
  // Data states
  const [events, setEvents] = useState<PtmEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [slots, setSlots] = useState<PtmSlot[]>([]);
  const [bookingsList, setBookingsList] = useState<any[]>([]);

  // Event form states
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [slotDuration, setSlotDuration] = useState('15'); // '15' or '30'
  
  // Edit notes state
  const [activeBookingForNote, setActiveBookingForNote] = useState<any | null>(null);
  const [tempNotesText, setTempNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Reschedule state
  const [reschedulingEvent, setReschedulingEvent] = useState<PtmEvent | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [savingReschedule, setSavingReschedule] = useState(false);

  useEffect(() => {
    if (schoolId) {
      fetchEvents();
    }
  }, [schoolId]);

  useEffect(() => {
    if (selectedEventId) {
      fetchSlotsAndBookings(selectedEventId);
    } else {
      setSlots([]);
      setBookingsList([]);
    }
  }, [selectedEventId]);

  // Fetch PTM events
  async function fetchEvents() {
    setLoadingEvents(true);
    try {
      const { data, error } = await supabase
        .from('ptm_events')
        .select('*')
        .eq('school_id', schoolId)
        .order('date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
      
      // Auto-select the first event if none selected
      if (data && data.length > 0 && !selectedEventId) {
        setSelectedEventId(data[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching PTM events:', err.message);
    } finally {
      setLoadingEvents(false);
    }
  }

  // Fetch slots and bookings for a specific event
  async function fetchSlotsAndBookings(eventId: string) {
    setLoadingSlots(true);
    try {
      // 1. Fetch slots for this event and teacher
      const { data: slotsData, error: slotsError } = await supabase
        .from('ptm_slots')
        .select('*')
        .eq('event_id', eventId)
        .eq('teacher_id', user?.id)
        .order('start_time', { ascending: true });

      if (slotsError) throw slotsError;

      // 2. Fetch booking details for these slots
      // Since supabase JS client does not support deep nested joins on RLS tables smoothly in a single select sometimes,
      // we query bookings where slot_id belongs to this list of slots.
      if (slotsData && slotsData.length > 0) {
        const slotIds = slotsData.map(s => s.id);
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('ptm_bookings')
          .select(`
            id,
            slot_id,
            notes,
            student_id,
            parent_id,
            profiles:parent_id (first_name, last_name),
            students (
              id,
              roll_number,
              profiles:profile_id (first_name, last_name)
            )
          `)
          .in('slot_id', slotIds);

        if (bookingsError) throw bookingsError;

        // Map bookings to slots
        const mappedSlots = slotsData.map(slot => {
          const booking = bookingsData?.find(b => b.slot_id === slot.id);
          return {
            ...slot,
            ptm_bookings: booking ? {
              id: booking.id,
              student_id: booking.student_id,
              parent_id: booking.parent_id,
              notes: booking.notes || '',
              parent_profile: booking.profiles ? {
                first_name: (booking.profiles as any).first_name,
                last_name: (booking.profiles as any).last_name
              } : undefined,
              student_profile: booking.students ? {
                id: (booking.students as any).id,
                profile_id: '',
                roll_number: (booking.students as any).roll_number || '',
                profiles: (booking.students as any).profiles ? {
                  first_name: (booking.students as any).profiles.first_name,
                  last_name: (booking.students as any).profiles.last_name
                } : undefined
              } : undefined
            } : null
          };
        });

        setSlots(mappedSlots);
        
        // Populate flat bookings list for notes view
        const bookedList = mappedSlots
          .filter(s => s.ptm_bookings !== null)
          .map(s => ({
            slot_id: s.id,
            start_time: s.start_time,
            end_time: s.end_time,
            booking_id: s.ptm_bookings?.id,
            student_name: `${s.ptm_bookings?.student_profile?.profiles?.first_name || ''} ${s.ptm_bookings?.student_profile?.profiles?.last_name || ''}`.trim() || 'N/A',
            parent_name: `${s.ptm_bookings?.parent_profile?.first_name || ''} ${s.ptm_bookings?.parent_profile?.last_name || ''}`.trim() || 'N/A',
            roll_number: s.ptm_bookings?.student_profile?.roll_number || 'N/A',
            notes: s.ptm_bookings?.notes || ''
          }));
        setBookingsList(bookedList);
      } else {
        setSlots([]);
        setBookingsList([]);
      }
    } catch (err: any) {
      console.error('Error fetching slots/bookings:', err.message);
    } finally {
      setLoadingSlots(false);
    }
  }

  // Create PTM Event and generate slots
  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || !startTime || !endTime) {
      alert('Please fill in all event details.');
      return;
    }

    // Verify time constraints
    if (startTime >= endTime) {
      alert('Start time must be strictly before end time.');
      return;
    }

    setSubmittingEvent(true);
    try {
      // 1. Insert PTM Event
      const { data: newEvent, error: eventErr } = await supabase
        .from('ptm_events')
        .insert([{
          school_id: schoolId,
          title: title.trim(),
          date,
          description: description.trim(),
          status: 'active'
        }])
        .select()
        .single();

      if (eventErr) throw eventErr;

      // 2. Compute slot intervals
      const durationMin = parseInt(slotDuration, 10);
      const generatedIntervals = generateTimeIntervals(date, startTime, endTime, durationMin);

      if (generatedIntervals.length === 0) {
        throw new Error('No slots could be generated with the given times.');
      }

      // 3. Bulk insert slots into ptm_slots
      const slotsPayload = generatedIntervals.map(interval => ({
        school_id: schoolId,
        event_id: newEvent.id,
        teacher_id: user?.id,
        start_time: interval.start_time,
        end_time: interval.end_time,
        is_available: true
      }));

      const { error: slotsErr } = await supabase
        .from('ptm_slots')
        .insert(slotsPayload);

      if (slotsErr) throw slotsErr;

      alert(`PTM event and ${slotsPayload.length} slots generated successfully!`);
      
      // Reset form
      setTitle('');
      setDate('');
      setDescription('');
      
      // Reload and select new event
      await fetchEvents();
      setSelectedEventId(newEvent.id);
    } catch (err: any) {
      alert(`Error creating event: ${err.message}`);
    } finally {
      setSubmittingEvent(false);
    }
  }

  // Generate slots helper
  function generateTimeIntervals(dateStr: string, startT: string, endT: string, durationMin: number) {
    const slots = [];
    const current = new Date(`${dateStr}T${startT}:00`);
    const end = new Date(`${dateStr}T${endT}:00`);
    
    let loopTime = current;
    while (loopTime < end) {
      const nextTime = new Date(loopTime.getTime() + durationMin * 60 * 1000);
      if (nextTime > end) break;

      const formatTime = (d: Date) => {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}:00`;
      };

      slots.push({
        start_time: formatTime(loopTime),
        end_time: formatTime(nextTime)
      });
      loopTime = nextTime;
    }
    return slots;
  }

  // Block or Unblock a slot
  async function toggleSlotAvailability(slotId: string, currentAvailable: boolean) {
    try {
      const { error } = await supabase
        .from('ptm_slots')
        .update({ is_available: !currentAvailable })
        .eq('id', slotId);

      if (error) throw error;
      
      // Update local state
      setSlots(prev => prev.map(s => s.id === slotId ? { ...s, is_available: !currentAvailable } : s));
    } catch (err: any) {
      alert(`Error toggling slot: ${err.message}`);
    }
  }

  // Save Meeting Notes
  async function handleSaveNotes() {
    if (!activeBookingForNote) return;
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('ptm_bookings')
        .update({ notes: tempNotesText.trim() })
        .eq('id', activeBookingForNote.booking_id);

      if (error) throw error;

      alert('Notes saved successfully.');
      setActiveBookingForNote(null);
      fetchSlotsAndBookings(selectedEventId);
    } catch (err: any) {
      alert(`Error saving notes: ${err.message}`);
    } finally {
      setSavingNotes(false);
    }
  }

  // Cancel Event
  async function handleCancelEvent(eventId: string) {
    if (!confirm('Are you sure you want to cancel this PTM event? All booked parents will receive a cancellation notice.')) {
      return;
    }

    try {
      // 1. Mark event as cancelled in DB
      // We alter the title with prefix [CANCELLED] and set its description or status.
      // Since the table might not have status column if not executed yet, we prepend to title and update description too.
      const eventToCancel = events.find(e => e.id === eventId);
      if (!eventToCancel) return;

      const updatedTitle = `[CANCELLED] ${eventToCancel.title.replace(/^\[CANCELLED\]\s*/, '')}`;
      
      const payload: any = {
        title: updatedTitle,
        description: JSON.stringify({
          original_description: eventToCancel.description,
          cancelled_at: new Date().toISOString(),
          status: 'cancelled'
        }),
        status: 'cancelled'
      };

      const { error: eventError } = await supabase
        .from('ptm_events')
        .update(payload)
        .eq('id', eventId);

      if (eventError) throw eventError;

      // 2. Mark slots as unavailable and update bookings
      const { data: relatedSlots } = await supabase
        .from('ptm_slots')
        .select('id')
        .eq('event_id', eventId);

      if (relatedSlots && relatedSlots.length > 0) {
        const relatedSlotIds = relatedSlots.map(s => s.id);
        
        // Set slots to unavailable
        await supabase
          .from('ptm_slots')
          .update({ is_available: false })
          .in('id', relatedSlotIds);

        // Mark bookings as cancelled
        await supabase
          .from('ptm_bookings')
          .update({ status: 'cancelled' })
          .in('slot_id', relatedSlotIds);

        // Prepend [CANCELLED] to booking notes so parent portal can see it.
        const { data: bookings } = await supabase
          .from('ptm_bookings')
          .select('id, notes')
          .in('slot_id', relatedSlotIds);

        if (bookings && bookings.length > 0) {
          for (const b of bookings) {
            const cleanNotes = `[CANCELLED] ${b.notes || ''}`.trim();
            await supabase
              .from('ptm_bookings')
              .update({ notes: cleanNotes })
              .eq('id', b.id);
          }
        }
      }

      alert('PTM Event cancelled successfully.');
      fetchEvents();
      if (selectedEventId === eventId) {
        fetchSlotsAndBookings(eventId);
      }
    } catch (err: any) {
      alert(`Error cancelling event: ${err.message}`);
    }
  }

  // Reschedule Event (change date/times)
  async function handleRescheduleEvent() {
    if (!reschedulingEvent || !rescheduleDate) return;
    setSavingReschedule(true);
    try {
      const { error } = await supabase
        .from('ptm_events')
        .update({ date: rescheduleDate })
        .eq('id', reschedulingEvent.id);

      if (error) throw error;

      alert('Event date updated successfully.');
      setReschedulingEvent(null);
      fetchEvents();
    } catch (err: any) {
      alert(`Rescheduling failed: ${err.message}`);
    } finally {
      setSavingReschedule(false);
    }
  }

  const formatTimeStr = (t: string) => {
    return t.substring(0, 5);
  };

  const isEventCancelled = (event: PtmEvent | undefined) => {
    if (!event) return false;
    if (event.status === 'cancelled' || event.title.startsWith('[CANCELLED]')) return true;
    try {
      const descObj = JSON.parse(event.description);
      return descObj.status === 'cancelled';
    } catch (e) {
      return false;
    }
  };



  return (
    <div className="app-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Teacher PTM Portal</h1>
          <p>Create parent-teacher meeting events, allocate time-slots, and save private meeting feedback notes.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start' }}>
        {/* Left Column: Create Event and Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Create PTM Event Card */}
          <div className="glass-card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, paddingBottom: '0.75rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '1.25rem' }}>
              <Plus size={18} style={{ color: 'var(--primary)' }} /> Create PTM Event
            </h3>
            <form onSubmit={handleCreateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Event Title</label>
                <input
                  type="text"
                  placeholder="Term 1 Parent Teacher Meet"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Description</label>
                <textarea
                  placeholder="Brief instructions or notes for parents..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ minHeight: '60px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Slot Duration</label>
                <select value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)}>
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submittingEvent}>
                {submittingEvent ? 'Generating Event & Slots...' : 'Generate Slots & Save'}
              </button>
            </form>
          </div>

          {/* Event Selector List */}
          <div className="glass-card">
            <h3 style={{ margin: 0, paddingBottom: '0.75rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '1.25rem' }}>
              Your PTM Events
            </h3>
            {loadingEvents ? (
              <p>Loading events list...</p>
            ) : events.length === 0 ? (
              <p style={{ fontStyle: 'italic', fontSize: '0.9rem' }}>No PTM events generated yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {events.map((e) => {
                  const cancelled = isEventCancelled(e);
                  return (
                    <div 
                      key={e.id}
                      onClick={() => setSelectedEventId(e.id)}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        border: selectedEventId === e.id ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                        background: selectedEventId === e.id ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        transition: 'var(--transition)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem', textDecoration: cancelled ? 'line-through' : 'none' }}>
                          {e.title}
                        </span>
                        {cancelled && (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'bold' }}>
                            CANCELLED
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} /> {new Date(e.date).toLocaleDateString()}
                      </p>
                      
                      {!cancelled && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }} onClick={(clickEvent) => clickEvent.stopPropagation()}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => {
                              setReschedulingEvent(e);
                              setRescheduleDate(e.date);
                            }}
                          >
                            Reschedule
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}
                            onClick={() => handleCancelEvent(e.id)}
                          >
                            Cancel Meet
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Slot Grid or Bookings list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
            <button 
              className={`btn ${activeTab === 'manage' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}
              onClick={() => setActiveTab('manage')}
            >
              Time Slots Grid
            </button>
            <button 
              className={`btn ${activeTab === 'notes' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}
              onClick={() => setActiveTab('notes')}
            >
              Bookings & Meeting Notes ({bookingsList.length})
            </button>
          </div>

          {selectedEventId ? (
            <>
              {activeTab === 'manage' && (
                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0 }}>
                        {events.find(e => e.id === selectedEventId)?.title}
                      </h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                        {events.find(e => e.id === selectedEventId)?.date && new Date(events.find(e => e.id === selectedEventId)!.date).toLocaleDateString()}
                        {isEventCancelled(events.find(e => e.id === selectedEventId)) && " (Event Cancelled)"}
                      </p>
                    </div>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.5rem', borderRadius: '8px' }}
                      onClick={() => fetchSlotsAndBookings(selectedEventId)}
                      disabled={loadingSlots}
                    >
                      <RefreshCw size={14} className={loadingSlots ? 'spin' : ''} />
                    </button>
                  </div>

                  {loadingSlots ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>Loading time slots grid...</div>
                  ) : slots.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No slots generated for this event.
                    </div>
                  ) : (
                    <div>
                      <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                        Below is your generated timetable grid. You can manually block/unblock slots (e.g. for breaks).
                      </p>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                        {slots.map((slot) => {
                          const isBooked = slot.ptm_bookings !== null;
                          const isBlocked = !slot.is_available && !isBooked;
                          
                          let statusLabel = 'Available';
                          let statusColor = 'rgba(16, 185, 129, 0.15)';
                          let statusTextColor = '#34d399';
                          let borderColor = 'rgba(16,185,129,0.3)';
                          
                          if (isBooked) {
                            statusLabel = 'Booked';
                            statusColor = 'rgba(99, 102, 241, 0.2)';
                            statusTextColor = '#a5b4fc';
                            borderColor = 'rgba(99, 102, 241, 0.4)';
                          } else if (isBlocked) {
                            statusLabel = 'Blocked';
                            statusColor = 'rgba(255, 255, 255, 0.05)';
                            statusTextColor = '#94a3b8';
                            borderColor = 'var(--glass-border)';
                          }

                          return (
                            <div 
                              key={slot.id}
                              style={{
                                padding: '1rem',
                                borderRadius: '12px',
                                background: 'rgba(15, 23, 42, 0.4)',
                                border: `1px solid ${borderColor}`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                position: 'relative'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
                                  {formatTimeStr(slot.start_time)} - {formatTimeStr(slot.end_time)}
                                </span>
                                <span 
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold',
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '4px',
                                    background: statusColor,
                                    color: statusTextColor
                                  }}
                                >
                                  {statusLabel}
                                </span>
                              </div>

                              {isBooked && (
                                <div style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '6px' }}>
                                  <p style={{ margin: 0, color: '#fff', fontWeight: 600 }}>
                                    👩‍👦 Student: {slot.ptm_bookings?.student_profile?.profiles?.first_name} {slot.ptm_bookings?.student_profile?.profiles?.last_name}
                                  </p>
                                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem' }}>
                                    Parent: {slot.ptm_bookings?.parent_profile?.first_name} {slot.ptm_bookings?.parent_profile?.last_name}
                                  </p>
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                {!isBooked && (
                                  <button
                                    className={`btn ${isBlocked ? 'btn-secondary' : 'btn-danger'}`}
                                    style={{
                                      width: '100%',
                                      padding: '0.4rem',
                                      fontSize: '0.75rem',
                                      background: isBlocked ? 'rgba(255,255,255,0.08)' : 'rgba(239, 68, 68, 0.15)',
                                      color: isBlocked ? '#fff' : 'var(--danger)',
                                      border: isBlocked ? '1px solid var(--glass-border)' : '1px solid rgba(239,68,68,0.2)'
                                    }}
                                    onClick={() => toggleSlotAvailability(slot.id, slot.is_available)}
                                    disabled={isEventCancelled(events.find(e => e.id === selectedEventId))}
                                  >
                                    {isBlocked ? 'Unblock' : 'Block Slot'}
                                  </button>
                                )}
                                
                                {isBooked && (
                                  <button
                                    className="btn btn-primary"
                                    style={{ width: '100%', padding: '0.4rem', fontSize: '0.75rem' }}
                                    onClick={() => {
                                      setActiveBookingForNote({
                                        booking_id: slot.ptm_bookings?.id,
                                        student_name: `${slot.ptm_bookings?.student_profile?.profiles?.first_name || ''} ${slot.ptm_bookings?.student_profile?.profiles?.last_name || ''}`,
                                        time: `${formatTimeStr(slot.start_time)} - ${formatTimeStr(slot.end_time)}`,
                                        notes: slot.ptm_bookings?.notes || ''
                                      });
                                      setTempNotesText(slot.ptm_bookings?.notes || '');
                                    }}
                                  >
                                    <FileText size={12} /> Notes
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="glass-card">
                  <h3 style={{ marginBottom: '1.25rem' }}>Booked Appointments & Meeting Feedback</h3>
                  
                  {bookingsList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No booked parent appointments for this event.
                    </div>
                  ) : (
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Student (Roll No)</th>
                            <th>Parent</th>
                            <th>Meeting Notes</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookingsList.map((b) => (
                            <tr key={b.booking_id}>
                              <td style={{ fontWeight: 600, color: '#a5b4fc' }}>
                                {formatTimeStr(b.start_time)} - {formatTimeStr(b.end_time)}
                              </td>
                              <td>
                                <p style={{ margin: 0, fontWeight: 600, color: '#fff' }}>{b.student_name}</p>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Roll No: {b.roll_number}</span>
                              </td>
                              <td>{b.parent_name}</td>
                              <td style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {b.notes ? (
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{b.notes}</span>
                                ) : (
                                  <span style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>No notes added yet</span>
                                )}
                              </td>
                              <td>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                  onClick={() => {
                                    setActiveBookingForNote(b);
                                    setTempNotesText(b.notes);
                                  }}
                                >
                                  Edit Notes
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
              <Calendar size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem', opacity: 0.5 }} />
              <p>Please select a PTM event on the left, or generate a new event to manage slots.</p>
            </div>
          )}

        </div>
      </div>

      {/* Meeting Notes Editor Modal */}
      {activeBookingForNote && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="glass-card fade-in" style={{ maxWidth: '500px', width: '90%', background: '#0f172a' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Meeting Feedback Notes</span>
              <button 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                onClick={() => setActiveBookingForNote(null)}
              >
                <X size={18} />
              </button>
            </h3>

            <div style={{ margin: '1.5rem 0' }}>
              <p style={{ color: '#fff', fontWeight: 600, marginBottom: '0.5rem' }}>
                Student: <span style={{ color: 'var(--primary)' }}>{activeBookingForNote.student_name}</span>
              </p>
              <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Slot Time: {activeBookingForNote.time}
              </p>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Meeting Notes (Visible to Admin & Parent)</label>
                <textarea
                  placeholder="Enter private teacher notes, summary, or action items..."
                  value={tempNotesText}
                  onChange={(e) => setTempNotesText(e.target.value)}
                  style={{ minHeight: '150px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setActiveBookingForNote(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveNotes} disabled={savingNotes}>
                <Check size={16} /> {savingNotes ? 'Saving...' : 'Save Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Event Modal */}
      {reschedulingEvent && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="glass-card fade-in" style={{ maxWidth: '400px', width: '90%', background: '#0f172a' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Reschedule PTM Date</span>
              <button 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                onClick={() => setReschedulingEvent(null)}
              >
                <X size={18} />
              </button>
            </h3>

            <div style={{ margin: '1.5rem 0' }}>
              <p style={{ color: '#fff', fontWeight: 600, marginBottom: '1rem' }}>
                Rescheduling: <span style={{ color: 'var(--primary)' }}>{reschedulingEvent.title}</span>
              </p>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Select New Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setReschedulingEvent(null)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={handleRescheduleEvent} disabled={savingReschedule}>
                Update Date
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

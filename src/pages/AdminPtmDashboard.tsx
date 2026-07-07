import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/auth';
import { Calendar, Users, Clock, Search, Filter, Printer, RefreshCw, AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
}

interface ClassItem {
  id: string;
  name: string;
}

export default function AdminPtmDashboard() {
  const { schoolId } = useAuth();
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);

  // Raw data from DB
  const [rawEvents, setRawEvents] = useState<any[]>([]);
  const [rawSlots, setRawSlots] = useState<any[]>([]);
  const [rawBookings, setRawBookings] = useState<any[]>([]);
  const [rawSections, setRawSections] = useState<any[]>([]);
  const [rawTeachers, setRawTeachers] = useState<Teacher[]>([]);
  const [rawClasses, setRawClasses] = useState<ClassItem[]>([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEventId, setFilterEventId] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterTeacherId, setFilterTeacherId] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Combined mapped schedules
  const [schedules, setSchedules] = useState<any[]>([]);
  
  // Statistics
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalSlots: 0,
    bookedSlots: 0,
    blockedSlots: 0,
    bookingRate: 0
  });

  // Action modals
  const [reschedulingEvent, setReschedulingEvent] = useState<any | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');

  useEffect(() => {
    if (schoolId) {
      loadAllData();
    }
  }, [schoolId]);

  // Load all tables and combine them in-memory
  async function loadAllData() {
    setLoading(true);
    try {
      // 1. Fetch PTM Events
      const { data: eventsData } = await supabase
        .from('ptm_events')
        .select('*')
        .eq('school_id', schoolId)
        .order('date', { ascending: false });
      const eventsList = (eventsData || []).map(e => {
        let isCancelled = e.status === 'cancelled' || e.title.startsWith('[CANCELLED]');
        try {
          const descObj = JSON.parse(e.description);
          if (descObj.status === 'cancelled') isCancelled = true;
        } catch (err) {}
        return { ...e, status: isCancelled ? 'cancelled' : 'active' };
      });
      setRawEvents(eventsList);

      // 2. Fetch Classes
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', schoolId);
      setRawClasses(classesData || []);

      // 3. Fetch Sections (to associate teachers to classes)
      const { data: sectionsData } = await supabase
        .from('sections')
        .select('id, name, class_teacher_id, class_id, classes (name)')
        .eq('school_id', schoolId);
      setRawSections(sectionsData || []);

      // 4. Fetch Teacher profiles (roles = class_teacher)
      const { data: teacherRolesData } = await supabase
        .from('user_roles')
        .select(`
          profile_id,
          profiles:profile_id (id, first_name, last_name)
        `)
        .eq('school_id', schoolId)
        .eq('role', 'class_teacher');

      const teachersList: Teacher[] = [];
      teacherRolesData?.forEach((tr: any) => {
        if (tr.profiles && !teachersList.some(t => t.id === tr.profiles.id)) {
          teachersList.push({
            id: tr.profiles.id,
            first_name: tr.profiles.first_name,
            last_name: tr.profiles.last_name
          });
        }
      });
      setRawTeachers(teachersList);

      // 5. Fetch PTM Slots
      const { data: slotsData } = await supabase
        .from('ptm_slots')
        .select('*')
        .eq('school_id', schoolId);
      setRawSlots(slotsData || []);

      // 6. Fetch Bookings
      const { data: bookingsData } = await supabase
        .from('ptm_bookings')
        .select(`
          id,
          slot_id,
          notes,
          student_id,
          parent_id,
          parent_profile:parent_id (first_name, last_name),
          students (
            id,
            roll_number,
            profiles:profile_id (first_name, last_name)
          )
        `)
        .eq('school_id', schoolId);
      setRawBookings(bookingsData || []);

    } catch (err: any) {
      console.error('Error loading admin scheduling data:', err.message);
    } finally {
      setLoading(false);
    }
  }

  // Combine and apply filters in-memory
  useEffect(() => {
    if (rawSlots.length === 0) {
      setSchedules([]);
      return;
    }

    const combined = rawSlots.map(slot => {
      const event = rawEvents.find(e => e.id === slot.event_id);
      const teacher = rawTeachers.find(t => t.id === slot.teacher_id);
      const section = rawSections.find(sec => sec.class_teacher_id === slot.teacher_id);
      const booking = rawBookings.find(b => b.slot_id === slot.id);
      
      const eventCancelled = event ? (event.status === 'cancelled' || event.title.startsWith('[CANCELLED]')) : false;

      return {
        id: slot.id,
        event_id: slot.event_id,
        event_title: event?.title || 'PTM Meeting',
        event_date: event?.date || '',
        event_status: eventCancelled ? 'cancelled' : 'active',
        teacher_id: slot.teacher_id,
        teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : 'Unassigned',
        class_id: section?.class_id || '',
        class_name: section?.classes?.name || 'N/A',
        section_name: section?.name || 'N/A',
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_available: slot.is_available,
        booking: booking ? {
          id: booking.id,
          notes: booking.notes,
          student_name: `${booking.students?.profiles?.first_name || ''} ${booking.students?.profiles?.last_name || ''}`.trim() || 'N/A',
          roll_number: booking.students?.roll_number || 'N/A',
          parent_name: `${booking.parent_profile?.first_name || ''} ${booking.parent_profile?.last_name || ''}`.trim() || 'N/A'
        } : null
      };
    });

    // Apply filters
    const filtered = combined.filter(item => {
      // Event filter
      if (filterEventId && item.event_id !== filterEventId) return false;
      // Class filter
      if (filterClassId && item.class_id !== filterClassId) return false;
      // Teacher filter
      if (filterTeacherId && item.teacher_id !== filterTeacherId) return false;
      // Date filter
      if (filterDate && item.event_date !== filterDate) return false;
      // Search query (teacher, student, parent)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchTeacher = item.teacher_name.toLowerCase().includes(query);
        const matchStudent = item.booking?.student_name.toLowerCase().includes(query) || false;
        const matchParent = item.booking?.parent_name.toLowerCase().includes(query) || false;
        if (!matchTeacher && !matchStudent && !matchParent) return false;
      }
      return true;
    });

    // Sort by Date, then Time, then Class
    filtered.sort((a, b) => {
      if (a.event_date !== b.event_date) {
        return a.event_date.localeCompare(b.event_date);
      }
      if (a.start_time !== b.start_time) {
        return a.start_time.localeCompare(b.start_time);
      }
      return a.class_name.localeCompare(b.class_name);
    });

    setSchedules(filtered);

    // Compute stats on the filtered dataset
    const totalEvents = new Set(filtered.map(f => f.event_id)).size;
    const totalSlots = filtered.length;
    const booked = filtered.filter(f => f.booking !== null).length;
    const blocked = filtered.filter(f => !f.is_available && f.booking === null).length;
    const rate = totalSlots > 0 ? Math.round((booked / totalSlots) * 100) : 0;

    setStats({
      totalEvents,
      totalSlots,
      bookedSlots: booked,
      blockedSlots: blocked,
      bookingRate: rate
    });

  }, [rawSlots, rawEvents, rawBookings, rawSections, rawTeachers, filterEventId, filterClassId, filterTeacherId, filterDate, searchQuery]);

  // Reschedule Event
  async function handleReschedule() {
    if (!reschedulingEvent || !rescheduleDate) return;
    setLoadingAction(true);
    try {
      const { error } = await supabase
        .from('ptm_events')
        .update({ date: rescheduleDate })
        .eq('id', reschedulingEvent.id);

      if (error) throw error;
      alert('Event rescheduled successfully.');
      setReschedulingEvent(null);
      loadAllData();
    } catch (err: any) {
      alert(`Error rescheduling event: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  }

  // Cancel Event
  async function handleCancelEvent(eventId: string) {
    const event = rawEvents.find(e => e.id === eventId);
    if (!event) return;

    if (!confirm(`Are you sure you want to cancel the PTM Event "${event.title}"? All bookings will be marked cancelled.`)) {
      return;
    }

    setLoadingAction(true);
    try {
      const updatedTitle = `[CANCELLED] ${event.title.replace(/^\[CANCELLED\]\s*/, '')}`;
      const payload: any = {
        title: updatedTitle,
        description: JSON.stringify({
          original_description: event.description,
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

      // Make all slots unavailable
      const { data: eventSlots } = await supabase
        .from('ptm_slots')
        .select('id')
        .eq('event_id', eventId);

      if (eventSlots && eventSlots.length > 0) {
        const slotIds = eventSlots.map(s => s.id);
        
        await supabase
          .from('ptm_slots')
          .update({ is_available: false })
          .in('id', slotIds);

        // Update booking status
        await supabase
          .from('ptm_bookings')
          .update({ status: 'cancelled' })
          .in('slot_id', slotIds);

        // Fallback notes marking
        const { data: bookings } = await supabase
          .from('ptm_bookings')
          .select('id, notes')
          .in('slot_id', slotIds);

        if (bookings && bookings.length > 0) {
          for (const b of bookings) {
            await supabase
              .from('ptm_bookings')
              .update({ notes: `[CANCELLED] ${b.notes || ''}`.trim() })
              .eq('id', b.id);
          }
        }
      }

      alert('PTM Event cancelled successfully.');
      loadAllData();
    } catch (err: any) {
      alert(`Error cancelling event: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  }

  const formatTimeStr = (t: string) => {
    return t.substring(0, 5);
  };

  return (
    <div className="app-container fade-in print-area">
      {/* Dynamic styles for high-fidelity PDF print layout */}
      <style>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }
          header, .no-print, button, input, select, label {
            display: none !important;
          }
          .print-area {
            background: #fff !important;
            color: #000 !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .glass-card {
            background: none !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin-bottom: 2rem !important;
            color: #000 !important;
          }
          h1, h2, h3 {
            color: #000 !important;
            background: none !important;
            -webkit-text-fill-color: initial !important;
            margin-bottom: 10px !important;
          }
          table {
            border: 1px solid #000 !important;
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th {
            background: #f2f2f2 !important;
            color: #000 !important;
            border: 1px solid #000 !important;
            padding: 8px !important;
            font-size: 0.8rem !important;
          }
          td {
            border: 1px solid #000 !important;
            padding: 8px !important;
            color: #000 !important;
            font-size: 0.8rem !important;
            background: none !important;
          }
          .print-header {
            display: block !important;
            text-align: center !important;
            margin-bottom: 2rem !important;
            border-bottom: 2px solid #000 !important;
            padding-bottom: 1rem !important;
          }
          .print-stats {
            display: flex !important;
            justify-content: space-around !important;
            margin-bottom: 2rem !important;
            border: 1px solid #000 !important;
            padding: 1rem !important;
            background: #fafafa !important;
          }
        }
        
        .print-header, .print-stats {
          display: none;
        }
      `}</style>

      {/* HTML Header for web view */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>School-Wide PTM Monitor</h1>
          <p>Supervise schedule timetables, filter bookings across all classes, and export printable summaries.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={loadAllData} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Reload Data
          </button>
          <button className="btn btn-primary" onClick={() => window.print()} disabled={schedules.length === 0}>
            <Printer size={16} /> Export PDF / Print
          </button>
        </div>
      </div>

      {/* PDF Print Header */}
      <div className="print-header">
        <h2 style={{ margin: 0 }}>🏫 OAKRIDGE INTERNATIONAL SCHOOL</h2>
        <h3 style={{ margin: '4px 0 0 0', fontWeight: 600 }}>Parent Teacher Meeting (PTM) Timetable Schedule</h3>
        <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>
          Report Generated On: {new Date().toLocaleString()} | Filtered by School-Wide Admin Dashboard
        </p>
      </div>

      {/* Stats Cards Dashboard */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
            <Calendar size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Total Events</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem' }}>{stats.totalEvents}</h2>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--info)' }}>
            <Clock size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Total Slots</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#67e8f9' }}>{stats.totalSlots}</h2>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
            <Users size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Booked Slots</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#6ee7b7' }}>{stats.bookedSlots}</h2>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Blocked Slots</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#fde047' }}>{stats.blockedSlots}</h2>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(217, 70, 239, 0.15)', color: 'var(--accent)' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Booking Rate</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#f472b6' }}>{stats.bookingRate}%</h2>
          </div>
        </div>
      </div>

      {/* PDF Print Statistics */}
      <div className="print-stats">
        <div><strong>Total Events:</strong> {stats.totalEvents}</div>
        <div><strong>Total Time Slots:</strong> {stats.totalSlots}</div>
        <div><strong>Total Bookings:</strong> {stats.bookedSlots}</div>
        <div><strong>Blocked Slots:</strong> {stats.blockedSlots}</div>
        <div><strong>Booking Rate:</strong> {stats.bookingRate}%</div>
      </div>

      {/* Admin Filters Panel */}
      <div className="glass-card no-print" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><Search size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Search Key</label>
            <input
              type="text"
              placeholder="Student, Parent, or Teacher Name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><Filter size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Filter Event</label>
            <select value={filterEventId} onChange={(e) => setFilterEventId(e.target.value)}>
              <option value="">All Events</option>
              {rawEvents.map(e => (
                <option key={e.id} value={e.id}>
                  {e.title} {e.status === 'cancelled' ? '(Cancelled)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><Filter size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Filter Class</label>
            <select value={filterClassId} onChange={(e) => setFilterClassId(e.target.value)}>
              <option value="">All Classes</option>
              {rawClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><Filter size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Filter Teacher</label>
            <select value={filterTeacherId} onChange={(e) => setFilterTeacherId(e.target.value)}>
              <option value="">All Teachers</option>
              {rawTeachers.map(t => (
                <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><Calendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Filter Date</label>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.25rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              setSearchQuery('');
              setFilterEventId('');
              setFilterClassId('');
              setFilterTeacherId('');
              setFilterDate('');
            }}
            style={{ padding: '0.6rem 1.25rem' }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Main Schedules Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>Loading school-wide schedules...</div>
      ) : schedules.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <AlertTriangle size={36} style={{ color: 'var(--warning)', marginBottom: '1rem', opacity: 0.5 }} />
          <p>No PTM schedule slots found matching current filters.</p>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Event & Date</th>
                  <th>Class / Teacher</th>
                  <th>Time Slot</th>
                  <th>Status</th>
                  <th>Booking Details</th>
                  <th>Notes Feedback</th>
                  <th className="no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => {
                  const isBooked = s.booking !== null;
                  const isBlocked = !s.is_available && !isBooked;
                  const isCancelled = s.event_status === 'cancelled';
                  
                  let badgeText = 'Available';
                  let badgeClass = 'badge-converted'; // green
                  
                  if (isCancelled) {
                    badgeText = 'Cancelled';
                    badgeClass = 'badge-nointerest'; // red
                  } else if (isBooked) {
                    badgeText = 'Booked';
                    badgeClass = 'badge-new'; // purple
                  } else if (isBlocked) {
                    badgeText = 'Blocked';
                    badgeClass = 'badge-visit'; // yellow/gray
                  }

                  return (
                    <tr key={s.id} style={{ opacity: isCancelled ? 0.6 : 1 }}>
                      <td>
                        <p style={{ margin: 0, fontWeight: 700, color: '#fff' }}>{s.event_title}</p>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {new Date(s.event_date).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        <p style={{ margin: 0, fontWeight: 600, color: '#fff' }}>{s.class_name} - {s.section_name}</p>
                        <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 500 }}>
                          👨‍🏫 {s.teacher_name}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {formatTimeStr(s.start_time)} - {formatTimeStr(s.end_time)}
                      </td>
                      <td>
                        <span className={`badge ${badgeClass}`}>
                          {badgeText}
                        </span>
                      </td>
                      <td>
                        {isBooked ? (
                          <div style={{ fontSize: '0.85rem' }}>
                            <p style={{ margin: 0, color: '#fff', fontWeight: 600 }}>👩‍👦 {s.booking.student_name}</p>
                            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Parent: {s.booking.parent_name} (Roll: {s.booking.roll_number})
                            </p>
                          </div>
                        ) : (
                          <span style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>N/A</span>
                        )}
                      </td>
                      <td style={{ maxWidth: '200px', whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '0.85rem' }}>
                        {isBooked && s.booking.notes ? (
                          <span>{s.booking.notes}</span>
                        ) : (
                          <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>None</span>
                        )}
                      </td>
                      <td className="no-print">
                        {!isCancelled && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                              onClick={() => {
                                const matchedEvent = rawEvents.find(e => e.id === s.event_id);
                                if (matchedEvent) {
                                  setReschedulingEvent(matchedEvent);
                                  setRescheduleDate(matchedEvent.date);
                                }
                              }}
                            >
                              Reschedule
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}
                              onClick={() => handleCancelEvent(s.event_id)}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin Reschedule Modal */}
      {reschedulingEvent && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
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
              <button className="btn btn-primary" onClick={handleReschedule} disabled={loadingAction}>
                Update Date
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeft, User, Phone, BookOpen, Clock, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';

interface EnquiryDetailsPageProps {
  enquiryId: string;
  onBack: () => void;
}

interface TimelineEvent {
  type: 'status_change' | 'note' | 'conversion' | 'created';
  date: string;
  user?: string;
  description: string;
}

export default function EnquiryDetailsPage({ enquiryId, onBack }: EnquiryDetailsPageProps) {
  const [enquiry, setEnquiry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [status, setStatus] = useState('');
  const [staffName, setStaffName] = useState('Staff member');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [converting, setConverting] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchEnquiryDetails();
    fetchCurrentStaff();
  }, [enquiryId]);

  async function fetchCurrentStaff() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();
        if (profile) {
          setStaffName(`${profile.first_name} ${profile.last_name}`);
        }
      }
    } catch (e) {
      console.warn('Could not fetch user profile for signature.');
    }
  }

  async function fetchEnquiryDetails() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('enquiries')
        .select(`
          *,
          classes (
            name
          ),
          schools (
            name
          )
        `)
        .eq('id', enquiryId)
        .single();

      if (error) throw error;
      setEnquiry(data);
      setStatus(data.status);
      parseTimeline(data);
    } catch (err: any) {
      console.error('Error fetching details:', err.message);
    } finally {
      setLoading(false);
    }
  }

  const parseTimeline = (data: any) => {
    const list: TimelineEvent[] = [];

    // Created event
    list.push({
      type: 'created',
      date: data.created_at,
      description: 'Enquiry registered successfully.'
    });

    // Notes
    if (data.notes) {
      const regex = /\[(.*?)\]:\s*(.*?)(?=\n\n|$)/gs;
      let match;
      const content = data.notes;
      while ((match = regex.exec(content)) !== null) {
        const signatureParts = match[1].split(' - By ');
        list.push({
          type: 'note',
          date: new Date(signatureParts[0]).toISOString(),
          user: signatureParts[1] || 'Staff',
          description: match[2].trim()
        });
      }
    }

    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setTimeline(list);
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    setSavingStatus(true);
    try {
      const timestamp = new Date().toLocaleString();
      const updatedNotes = `[${timestamp} - By ${staffName}]: Status updated to "${newStatus}"\n\n${enquiry.notes || ''}`;

      const { error } = await supabase
        .from('enquiries')
        .update({
          status: newStatus,
          notes: updatedNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', enquiryId);

      if (error) throw error;
      
      const updatedData = { ...enquiry, status: newStatus, notes: updatedNotes };
      setEnquiry(updatedData);
      parseTimeline(updatedData);
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSavingNote(true);

    const timestamp = new Date().toLocaleString();
    const formattedNote = `[${timestamp} - By ${staffName}]: ${newNote}\n\n${enquiry.notes || ''}`;

    try {
      const { error } = await supabase
        .from('enquiries')
        .update({ notes: formattedNote, updated_at: new Date().toISOString() })
        .eq('id', enquiryId);

      if (error) throw error;

      const updatedData = { ...enquiry, notes: formattedNote };
      setEnquiry(updatedData);
      parseTimeline(updatedData);
      setNewNote('');
    } catch (err: any) {
      alert(`Error saving note: ${err.message}`);
    } finally {
      setSavingNote(false);
    }
  };

  const handleConvertToAdmission = async () => {
    setConverting(true);
    setShowModal(false);
    try {
      const firstName = enquiry.student_name.split(' ')[0] || enquiry.student_name;
      const lastName = enquiry.student_name.split(' ').slice(1).join(' ') || 'Doe';

      const initialTimeline = [
        {
          event: 'Admission Created',
          timestamp: new Date().toISOString(),
          staff: staffName,
          description: 'Admission record created automatically from enquiry conversion.'
        }
      ];

      const { data: admissionRecord, error: admissionErr } = await supabase
        .from('admissions')
        .insert([
          {
            school_id: enquiry.school_id,
            enquiry_id: enquiry.id,
            first_name: firstName,
            last_name: lastName,
            date_of_birth: new Date().toISOString().split('T')[0],
            gender: 'Other',
            grade_applied: enquiry.grade_interested,
            parent_name: enquiry.parent_name,
            parent_phone: enquiry.phone,
            parent_email: enquiry.email,
            status: 'Draft',
            activity_log: initialTimeline
          }
        ])
        .select();

      if (admissionErr) throw admissionErr;

      const newAdmissionId = admissionRecord?.[0]?.id;

      const timestamp = new Date().toLocaleString();
      const updatedNotes = `[${timestamp} - By ${staffName}]: Enquiry converted to admission successfully. Admission Code: ${newAdmissionId || ''}\n\n${enquiry.notes || ''}`;

      const { error: enquiryErr } = await supabase
        .from('enquiries')
        .update({
          status: 'Converted',
          notes: updatedNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', enquiryId);

      if (enquiryErr) throw enquiryErr;

      alert('Enquiry successfully converted to Admission entry!');
      if (newAdmissionId) {
        window.location.hash = `#/admissions/${newAdmissionId}`;
      } else {
        fetchEnquiryDetails();
      }
    } catch (err: any) {
      alert(`Failed to convert enquiry: ${err.message}`);
    } finally {
      setConverting(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'New': return 'badge-new';
      case 'Contacted': return 'badge-contacted';
      case 'Visit Scheduled': return 'badge-visit';
      case 'Converted': return 'badge-converted';
      case 'Not Interested': return 'badge-nointerest';
      default: return 'badge-new';
    }
  };

  if (loading) {
    return (
      <div className="app-container" style={{ textAlign: 'center', padding: '5rem' }}>
        <p>Loading enquiry details CRM panel...</p>
      </div>
    );
  }

  if (!enquiry) {
    return (
      <div className="app-container" style={{ textAlign: 'center', padding: '5rem' }}>
        <h2 style={{ color: 'var(--danger)' }}>Enquiry Not Found</h2>
        <button className="btn btn-secondary" onClick={onBack} style={{ marginTop: '1.5rem' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={onBack} style={{ padding: '0.6rem 1rem' }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 style={{ margin: 0, fontSize: '2rem' }}>{enquiry.enquiry_number || 'N/A'}</h1>
              <span className={`badge ${getStatusBadgeClass(enquiry.status)}`} style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}>
                {enquiry.status}
              </span>
            </div>
            <p style={{ fontSize: '0.85rem' }}>
              Received: {new Date(enquiry.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary"
          style={{ background: enquiry.status === 'Converted' ? 'var(--success)' : 'linear-gradient(135deg, var(--accent) 0%, #a21caf 100%)', boxShadow: 'none' }}
          disabled={enquiry.status === 'Converted'}
        >
          <CheckCircle2 size={16} /> {enquiry.status === 'Converted' ? 'Converted' : 'Convert to Admission'}
        </button>
      </div>

      {/* CRM Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        
        {/* Student Info Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <User size={20} />
            <h3 style={{ margin: 0 }}>Student Information</h3>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem' }}>Student Name</label>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>{enquiry.student_name}</p>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem' }}>Class Interested</label>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>{enquiry.classes?.name || 'Not specified'}</p>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem' }}>Lead Source</label>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>{enquiry.source || 'Direct Enquiry'}</p>
          </div>
        </div>

        {/* Parent Info Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--info)' }}>
            <Phone size={20} />
            <h3 style={{ margin: 0 }}>Parent Contact Details</h3>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem' }}>Parent Name</label>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>{enquiry.parent_name}</p>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem' }}>Phone Number</label>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>{enquiry.phone}</p>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem' }}>Email Address</label>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>{enquiry.email || 'N/A'}</p>
          </div>
        </div>

        {/* Enquiry/School Info Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}>
            <BookOpen size={20} />
            <h3 style={{ margin: 0 }}>Enquiry Metadata</h3>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem' }}>School Tenant</label>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>{enquiry.schools?.name || 'Main School Branch'}</p>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem' }}>Status Workflow</label>
            <div style={{ marginTop: '0.5rem' }}>
              <select
                value={status}
                onChange={handleStatusChange}
                disabled={savingStatus || enquiry.status === 'Converted'}
                style={{ padding: '0.6rem' }}
              >
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Visit Scheduled">Visit Scheduled</option>
                <option value="Converted">Converted</option>
                <option value="Not Interested">Not Interested</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline and Notes Split Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        
        {/* Notes systems */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0 }}>Follow-up Logs</h3>
          </div>

          <form onSubmit={handleAddNote}>
            <div className="form-group">
              <label>Add Follow-Up Log</label>
              <textarea
                placeholder="Enter details of conversation..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                style={{ minHeight: '80px' }}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={savingNote}>
              Save Note
            </button>
          </form>

          <div>
            <label>Log History</label>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)', maxHeight: '300px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.95rem', color: '#cbd5e1' }}>
              {enquiry.notes || 'No follow-up interactions logged.'}
            </div>
          </div>
        </div>

        {/* Timeline Systems */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={20} style={{ color: 'var(--info)' }} />
            <h3 style={{ margin: 0 }}>Chronological Activity Timeline</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', paddingLeft: '1.25rem', borderLeft: '2px solid var(--glass-border)', marginLeft: '0.5rem' }}>
            {timeline.map((evt, index) => (
              <div key={index} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-25px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: evt.type === 'created' ? 'var(--info)' : evt.type === 'note' ? 'var(--primary)' : 'var(--success)', border: '3px solid #0f172a' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {new Date(evt.date).toLocaleString()}
                  </span>
                  {evt.user && (
                    <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      By {evt.user}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.95rem', color: '#fff', margin: 0 }}>{evt.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="glass-card fade-in" style={{ maxWidth: '450px', width: '90%', textAlign: 'center', background: '#0f172a' }}>
            <AlertTriangle size={48} style={{ color: 'var(--warning)', marginBottom: '1rem' }} />
            <h2>Convert Lead to Admission?</h2>
            <p style={{ margin: '1rem 0 2rem 0' }}>
              This will create a new Pending Admission record pre-populated with student details, parent details, and target grade information. The enquiry status will transition to "Converted".
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ background: 'var(--success)' }} onClick={handleConvertToAdmission} disabled={converting}>
                {converting ? 'Converting...' : 'Confirm Conversion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

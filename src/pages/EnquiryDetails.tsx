import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { X, Save, Clock, ArrowRight, User, CheckCircle } from 'lucide-react';

interface EnquiryDetailsProps {
  enquiryId: string;
  onClose: () => void;
}

interface TimelineEvent {
  type: 'status_change' | 'note' | 'conversion' | 'created';
  date: string;
  user?: string;
  description: string;
}

export default function EnquiryDetails({ enquiryId, onClose }: EnquiryDetailsProps) {
  const [enquiry, setEnquiry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [status, setStatus] = useState('');
  const [staffName, setStaffName] = useState('Staff member');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [converting, setConverting] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

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
      console.warn('Could not fetch user profile for note signature, fallback to placeholder.');
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
          )
        `)
        .eq('id', enquiryId)
        .single();

      if (error) throw error;
      setEnquiry(data);
      setStatus(data.status);
      parseTimeline(data);
    } catch (err: any) {
      console.error('Error fetching enquiry detail:', err.message);
    } finally {
      setLoading(false);
    }
  }

  // Generate dynamic chronological activity list based on created_at and notes
  const parseTimeline = (data: any) => {
    const list: TimelineEvent[] = [];

    // Created event
    list.push({
      type: 'created',
      date: data.created_at,
      description: 'Enquiry registered successfully.'
    });

    // Parse the notes text area to extract note actions
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

    // Sort chronologically ascending
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setTimeline(list);
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    setSavingStatus(true);
    try {
      // Append a note regarding the status update automatically
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
    try {
      // Create admission record prefilled with this enquiry's info
      const firstName = enquiry.student_name.split(' ')[0] || enquiry.student_name;
      const lastName = enquiry.student_name.split(' ').slice(1).join(' ') || 'Doe';

      const { data: admissionRecord, error: admissionErr } = await supabase
        .from('admissions')
        .insert([
          {
            school_id: enquiry.school_id,
            enquiry_id: enquiry.id,
            first_name: firstName,
            last_name: lastName,
            date_of_birth: new Date().toISOString().split('T')[0], // placeholder DOB
            gender: 'Other',
            grade_applied: enquiry.grade_interested,
            parent_name: enquiry.parent_name,
            parent_phone: enquiry.phone,
            parent_email: enquiry.email,
            status: 'Pending'
          }
        ])
        .select();

      if (admissionErr) throw admissionErr;

      // Update enquiry status to Converted
      const timestamp = new Date().toLocaleString();
      const updatedNotes = `[${timestamp} - By ${staffName}]: Enquiry converted to admission successfully. Admission Code: ${admissionRecord?.[0]?.id || ''}\n\n${enquiry.notes || ''}`;

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
      fetchEnquiryDetails();
    } catch (err: any) {
      alert(`Failed to convert enquiry: ${err.message}`);
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading details...
      </div>
    );
  }

  if (!enquiry) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
        Failed to load details.
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{enquiry.enquiry_number || 'Enquiry Details'}</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Created: {new Date(enquiry.created_at).toLocaleString()}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <X size={24} />
        </button>
      </div>

      {/* Info Sections */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'rgba(255,255,255,0.02)' }}>
        <h3 style={{ fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>Student Profile</h3>
        <p style={{ margin: '0.4rem 0' }}><span style={{ color: 'var(--text-secondary)' }}>Name:</span> {enquiry.student_name}</p>
        <p style={{ margin: '0.4rem 0' }}><span style={{ color: 'var(--text-secondary)' }}>Class Interest:</span> {enquiry.classes?.name || 'Not specified'}</p>
        <p style={{ margin: '0.4rem 0' }}><span style={{ color: 'var(--text-secondary)' }}>Lead Source:</span> {enquiry.source || 'Direct'}</p>
      </div>

      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'rgba(255,255,255,0.02)' }}>
        <h3 style={{ fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>Parent Info</h3>
        <p style={{ margin: '0.4rem 0' }}><span style={{ color: 'var(--text-secondary)' }}>Parent Name:</span> {enquiry.parent_name}</p>
        <p style={{ margin: '0.4rem 0' }}><span style={{ color: 'var(--text-secondary)' }}>Phone:</span> {enquiry.phone}</p>
        <p style={{ margin: '0.4rem 0' }}><span style={{ color: 'var(--text-secondary)' }}>Email:</span> {enquiry.email || 'None'}</p>
      </div>

      {/* Conversion Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="status-select">Enquiry Status</label>
          <select
            id="status-select"
            value={status}
            onChange={handleStatusChange}
            disabled={savingStatus || enquiry.status === 'Converted'}
          >
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Visit Scheduled">Visit Scheduled</option>
            <option value="Converted">Converted</option>
            <option value="Not Interested">Not Interested</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={handleConvertToAdmission}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.8rem', background: enquiry.status === 'Converted' ? 'var(--success)' : 'linear-gradient(135deg, var(--accent) 0%, #a21caf 100%)', boxShadow: 'none' }}
            disabled={converting || enquiry.status === 'Converted'}
          >
            <CheckCircle size={16} /> {enquiry.status === 'Converted' ? 'Converted!' : 'Convert to Admission'}
          </button>
        </div>
      </div>

      {/* Follow-up Notes */}
      <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
        <h3>Notes Follow-up</h3>
        <form onSubmit={handleAddNote} style={{ marginBottom: '1.5rem' }}>
          <div className="form-group">
            <textarea
              placeholder="Enter details..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              style={{ minHeight: '60px', fontSize: '0.9rem' }}
              required
            />
          </div>
          <button type="submit" className="btn btn-secondary" style={{ width: '100%' }} disabled={savingNote}>
            Save Follow-up Note
          </button>
        </form>
      </div>

      {/* Dynamic Activity Timeline */}
      <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.25rem' }}>Activity Timeline</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', paddingLeft: '1rem', borderLeft: '2px solid var(--glass-border)' }}>
          {timeline.map((evt, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '-21px', top: '4px', width: '8px', height: '8px', borderRadius: '50%', background: evt.type === 'created' ? 'var(--info)' : evt.type === 'note' ? 'var(--primary)' : 'var(--success)', border: '2px solid #0f172a' }}></div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>
                {new Date(evt.date).toLocaleString()} {evt.user && `• By ${evt.user}`}
              </p>
              <p style={{ fontSize: '0.9rem', color: '#fff' }}>{evt.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

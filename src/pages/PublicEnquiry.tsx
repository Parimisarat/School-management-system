import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function PublicEnquiry() {
  const [schools, setSchools] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [gradeInterested, setGradeInterested] = useState('');
  
  const [studentName, setStudentName] = useState('');
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch initial schools list so user can target the correct school
  useEffect(() => {
    async function getInitialData() {
      const params = new URLSearchParams(window.location.search);
      const schoolParam = params.get('school_id');

      const { data: schoolsData, error } = await supabase.from('schools').select('id, name');
      if (error) {
        console.error('Fetch error:', error);
        setErrorMsg(`Failed to connect to Supabase: ${error.message} (Detail: ${error.details || 'None'})`);
        return;
      }

      if (schoolsData) {
        setSchools(schoolsData);
        if (schoolParam) {
          setSelectedSchool(schoolParam);
        } else if (schoolsData.length > 0) {
          setSelectedSchool(schoolsData[0].id);
        }
      }
    }
    getInitialData();
  }, []);

  // Fetch classes when school selection changes
  useEffect(() => {
    if (!selectedSchool) return;
    async function getClasses() {
      const { data } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', selectedSchool);
      if (data) {
        setClasses(data);
        if (data.length > 0) setGradeInterested(data[0].id);
      }
    }
    getClasses();
  }, [selectedSchool]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedSchool) {
      setErrorMsg('Please select a school to submit enquiry.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.from('enquiries').insert([
        {
          school_id: selectedSchool,
          student_name: studentName,
          parent_name: parentName,
          phone,
          email: email || null,
          grade_interested: gradeInterested || null,
          source: source || 'Public Web Form',
          status: 'New',
          notes: notes || null
        }
      ]).select();

      if (error) throw error;

      setSuccessMsg(`Enquiry submitted successfully! Code: ${data?.[0]?.enquiry_number || 'ENQ-Pending'}`);
      // Reset form fields
      setStudentName('');
      setParentName('');
      setPhone('');
      setEmail('');
      setNotes('');
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '600px', marginTop: '3rem' }}>
      <div className="glass-card fade-in">
        <h1 style={{ fontSize: '2rem', textAlign: 'center' }}>Admissions Enquiry</h1>
        <p style={{ textAlign: 'center', marginBottom: '2rem' }}>
          Interested in joining us? Please fill out the form below, and our admissions office will reach out.
        </p>

        {successMsg && (
          <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center' }}>
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="school">Select School</label>
            <select
              id="school"
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              required
            >
              <option value="">-- Choose School --</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="studentName">Student Full Name</label>
            <input
              type="text"
              id="studentName"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="e.g. Jane Doe"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="parentName">Parent/Guardian Name</label>
            <input
              type="text"
              id="parentName"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="e.g. John Doe"
              required
            />
          </div>

          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="phone">Phone Number</label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +1234567890"
                required
              />
            </div>
            <div>
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. parent@example.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="grade">Grade/Class Applying For</label>
            <select
              id="grade"
              value={gradeInterested}
              onChange={(e) => setGradeInterested(e.target.value)}
            >
              <option value="">-- Select Grade --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="source">How did you hear about us?</label>
            <input
              type="text"
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Social Media, Referral, Newspaper"
            />
          </div>

          <div className="form-group">
            <label htmlFor="notes">Additional Comments/Queries</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details you'd like to share..."
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Enquiry'}
          </button>
        </form>
      </div>
    </div>
  );
}

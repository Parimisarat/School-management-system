import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/auth';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  Calendar, 
  Filter, 
  Search, 
  Plus, 
  Edit2, 
  Check, 
  BarChart2, 
  X, 
  Settings, 
  AlertCircle 
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface Student {
  id: string;
  roll_number: string;
  profiles: {
    first_name: string;
    last_name: string;
  } | null;
  classes: {
    name: string;
  } | null;
  sections: {
    id: string;
    name: string;
    class_teacher_id: string | null;
  } | null;
}

interface Incident {
  id: string;
  school_id: string;
  student_id: string;
  incident_date: string;
  category_id: string;
  severity: 'Minor' | 'Moderate' | 'Serious';
  description: string;
  notes: string | null;
  reported_by: string;
  status: 'Logged' | 'Reviewed' | 'Escalated' | 'Closed';
  class_teacher_remarks: string | null;
  resolution_note: string | null;
  parent_acknowledged: boolean;
  parent_acknowledged_at: string | null;
  created_at: string;
  category: {
    name: string;
  } | null;
  student: {
    profiles: {
      first_name: string;
      last_name: string;
    } | null;
    classes: {
      name: string;
    } | null;
    sections: {
      name: string;
    } | null;
  } | null;
  reporter: {
    first_name: string;
    last_name: string;
  } | null;
}

interface ParentIncident {
  id: string;
  school_id: string;
  student_id: string;
  incident_date: string;
  category_name: string;
  severity: 'Minor' | 'Moderate' | 'Serious';
  description: string;
  parent_acknowledged: boolean;
  parent_acknowledged_at: string | null;
  created_at: string;
}

export default function DisciplineMonitor() {
  const { user, role, schoolId } = useAuth();
  const [activeTab, setActiveTab] = useState<'incidents' | 'flags' | 'categories' | 'summary'>('incidents');
  
  // Data states
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [parentIncidents, setParentIncidents] = useState<ParentIncident[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [flaggedStudents, setFlaggedStudents] = useState<any[]>([]);
  
  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Modal states
  const [showLogModal, setShowLogModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form states
  const [formStudentId, setFormStudentId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formSeverity, setFormSeverity] = useState<'Minor' | 'Moderate' | 'Serious'>('Minor');
  const [formDescription, setFormDescription] = useState('');
  const [formNotes, setFormNotes] = useState('');
  
  // Action states (Remarks / Resolution)
  const [actionRemarks, setActionRemarks] = useState('');
  const [actionStatus, setActionStatus] = useState<Incident['status']>('Reviewed');
  const [newCategoryName, setNewCategoryName] = useState('');

  // Determine current term start/end dates
  const getCurrentTermDates = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1; // 1-12
    let start: Date, end: Date;
    if (month >= 6 && month <= 9) {
      start = new Date(`${year}-06-01T00:00:00Z`);
      end = new Date(`${year}-09-30T23:59:59Z`);
    } else if (month >= 10 || month === 1) {
      const startYear = month === 1 ? year - 1 : year;
      const endYear = month === 1 ? year : year + 1;
      start = new Date(`${startYear}-10-01T00:00:00Z`);
      end = new Date(`${endYear}-01-31T23:59:59Z`);
    } else {
      start = new Date(`${year}-02-01T00:00:00Z`);
      end = new Date(`${year}-05-31T23:59:59Z`);
    }
    return { start, end };
  };

  useEffect(() => {
    if (schoolId) {
      fetchInitialData();
    }
  }, [schoolId, role]);

  const fetchInitialData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch Categories
      const { data: catData, error: catErr } = await supabase
        .from('discipline_categories')
        .select('*')
        .order('name');
      if (catErr) throw catErr;
      setCategories(catData || []);

      // 2. Fetch based on role
      if (role === 'parent') {
        await fetchParentData();
      } else {
        // For teachers, find if they are a class teacher and get their section
        let sectionId: string | null = null;
        if (role === 'class_teacher') {
          const { data: secData } = await supabase
            .from('sections')
            .select('id')
            .eq('class_teacher_id', user?.id)
            .maybeSingle();
          if (secData) {
            sectionId = secData.id;
          }
        }

        await fetchTeacherOrAdminData(sectionId);
      }
    } catch (err: any) {
      console.error('Error loading discipline data:', err);
      setErrorMsg(err.message || 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const fetchParentData = async () => {
    const { data, error } = await supabase
      .from('parent_discipline_incidents')
      .select('*')
      .order('incident_date', { ascending: false });
    
    if (error) throw error;
    setParentIncidents(data || []);
  };

  const fetchTeacherOrAdminData = async (classTeacherSectionId: string | null) => {
    // 1. Fetch Incidents
    let query = supabase
      .from('discipline_incidents')
      .select(`
        *,
        student:students (
          id,
          roll_number,
          profiles!students_profile_id_fkey (first_name, last_name),
          classes (name),
          sections (name)
        ),
        category:discipline_categories (name),
        reporter:profiles!reported_by (first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    // Restrict Class Teacher view to their own class students + incidents they reported
    if (role === 'class_teacher' && classTeacherSectionId) {
      // We can do this in JS or write a complex OR filter in Supabase.
      // Since a class teacher has RLS policy that allows them to read:
      // "reported_by = auth.uid() OR student's class_teacher_id = auth.uid()"
      // The RLS policy automatically filters the rows! So we can just query normally.
    } else if (role === 'subject_teacher') {
      // RLS policy automatically restricts subject_teacher to reported_by = auth.uid()
    }

    const { data: incidentData, error: incidentErr } = await query;
    if (incidentErr) throw incidentErr;
    setIncidents(incidentData || []);

    // 2. Fetch Students for the dropdown list
    let studentQuery = supabase
      .from('students')
      .select(`
        id,
        roll_number,
        profiles!students_profile_id_fkey (first_name, last_name),
        classes (name),
        sections (id, name, class_teacher_id)
      `);
    
    if (role === 'class_teacher' && classTeacherSectionId) {
      studentQuery = studentQuery.eq('section_id', classTeacherSectionId);
    }

    const { data: studentData, error: studentErr } = await studentQuery;
    if (studentErr) throw studentErr;
    
    // Map joined fields in case Supabase returns them as arrays
    const formattedStudents = (studentData || []).map((s: any) => ({
      id: s.id,
      roll_number: s.roll_number,
      profiles: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles,
      classes: Array.isArray(s.classes) ? s.classes[0] : s.classes,
      sections: Array.isArray(s.sections) ? s.sections[0] : s.sections,
    }));
    setStudents(formattedStudents);

    // 3. Calculate Repeat Offenses for the school/class (current term)
    calculateFlags(incidentData || []);
  };

  const calculateFlags = (allIncidentsList: Incident[]) => {
    const { start, end } = getCurrentTermDates();
    const termIncidents = allIncidentsList.filter(inst => {
      const date = new Date(inst.incident_date);
      return date >= start && date <= end;
    });

    const studentMap: { 
      [key: string]: {
        studentId: string;
        studentName: string;
        classSection: string;
        categories: { [categoryName: string]: number };
      }
    } = {};

    termIncidents.forEach(inst => {
      const studentId = inst.student_id;
      if (!inst.student) return;

      const first = inst.student.profiles?.first_name || '';
      const last = inst.student.profiles?.last_name || '';
      const studentName = `${first} ${last}`.trim() || 'Unknown Student';
      const classSection = `${inst.student.classes?.name || ''} - ${inst.student.sections?.name || ''}`;
      const categoryName = inst.category?.name || 'Other';

      if (!studentMap[studentId]) {
        studentMap[studentId] = {
          studentId,
          studentName,
          classSection,
          categories: {}
        };
      }

      if (!studentMap[studentId].categories[categoryName]) {
        studentMap[studentId].categories[categoryName] = 0;
      }
      studentMap[studentId].categories[categoryName]++;
    });

    const flagged: any[] = [];
    Object.values(studentMap).forEach(student => {
      const activeFlags: any[] = [];
      Object.entries(student.categories).forEach(([catName, count]) => {
        if (count >= 3) {
          activeFlags.push({ categoryName: catName, count });
        }
      });
      if (activeFlags.length > 0) {
        flagged.push({
          ...student,
          flags: activeFlags
        });
      }
    });

    setFlaggedStudents(flagged);
  };

  // Filtered Incidents (Client-side filtering for search & filters)
  const getFilteredIncidents = () => {
    return incidents.filter(inst => {
      // 1. Search filter
      if (searchQuery) {
        const first = inst.student?.profiles?.first_name || '';
        const last = inst.student?.profiles?.last_name || '';
        const studentName = `${first} ${last}`.toLowerCase();
        const repFirst = inst.reporter?.first_name || '';
        const repLast = inst.reporter?.last_name || '';
        const reporterName = `${repFirst} ${repLast}`.toLowerCase();
        const desc = inst.description.toLowerCase();
        const query = searchQuery.toLowerCase();

        if (!studentName.includes(query) && !reporterName.includes(query) && !desc.includes(query)) {
          return false;
        }
      }

      // 2. Category filter
      if (categoryFilter && inst.category_id !== categoryFilter) {
        return false;
      }

      // 3. Severity filter
      if (severityFilter && inst.severity !== severityFilter) {
        return false;
      }

      // 4. Status filter
      if (statusFilter && inst.status !== statusFilter) {
        return false;
      }

      // 5. Date filters
      if (startDate && inst.incident_date < startDate) {
        return false;
      }
      if (endDate && inst.incident_date > endDate) {
        return false;
      }

      return true;
    });
  };

  // Handle Log Incident (Create or Update)
  const handleSaveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentId || !formCategoryId || !formDescription) {
      alert('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      if (isEditing && selectedIncident) {
        // Update incident
        const { error } = await supabase
          .from('discipline_incidents')
          .update({
            student_id: formStudentId,
            incident_date: formDate,
            category_id: formCategoryId,
            severity: formSeverity,
            description: formDescription,
            notes: formNotes || null
          })
          .eq('id', selectedIncident.id);

        if (error) throw error;
      } else {
        // Create incident
        const { error } = await supabase
          .from('discipline_incidents')
          .insert([{
            school_id: schoolId,
            student_id: formStudentId,
            incident_date: formDate,
            category_id: formCategoryId,
            severity: formSeverity,
            description: formDescription,
            notes: formNotes || null,
            reported_by: user?.id,
            status: 'Logged'
          }]);

        if (error) throw error;
      }

      // Reset form & close modal
      resetForm();
      setShowLogModal(false);
      await fetchInitialData();
    } catch (err: any) {
      console.error('Error saving incident:', err);
      setErrorMsg(err.message || 'Failed to save incident. Note: Incidents cannot be edited after 24 hours.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Class Teacher Review
  const handleReviewIncident = async () => {
    if (!selectedIncident) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('discipline_incidents')
        .update({
          status: actionStatus,
          class_teacher_remarks: actionRemarks || null
        })
        .eq('id', selectedIncident.id);

      if (error) throw error;
      setShowDetailModal(false);
      await fetchInitialData();
    } catch (err: any) {
      console.error('Error reviewing incident:', err);
      setErrorMsg(err.message || 'Failed to update incident status.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Admin Close / Action
  const handleCloseIncident = async () => {
    if (!selectedIncident) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('discipline_incidents')
        .update({
          status: actionStatus,
          resolution_note: actionRemarks || null
        })
        .eq('id', selectedIncident.id);

      if (error) throw error;
      setShowDetailModal(false);
      await fetchInitialData();
    } catch (err: any) {
      console.error('Error closing incident:', err);
      setErrorMsg(err.message || 'Failed to close incident.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Parent Acknowledge
  const handleAcknowledgeIncident = async (incidentId: string) => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('discipline_incidents')
        .update({
          parent_acknowledged: true,
          parent_acknowledged_at: new Date().toISOString()
        })
        .eq('id', incidentId);

      if (error) throw error;
      await fetchInitialData();
    } catch (err: any) {
      console.error('Error acknowledging incident:', err);
      setErrorMsg(err.message || 'Failed to acknowledge incident.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Admin Category Management
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('discipline_categories')
        .insert([{ school_id: schoolId, name: newCategoryName.trim() }]);

      if (error) throw error;
      setNewCategoryName('');
      await fetchInitialData();
    } catch (err: any) {
      console.error('Error adding category:', err);
      setErrorMsg(err.message || 'Failed to add category.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm('Are you sure you want to delete this category? Any incidents linked to this category cannot be deleted and this action may fail.')) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('discipline_categories')
        .delete()
        .eq('id', catId);

      if (error) throw error;
      await fetchInitialData();
    } catch (err: any) {
      console.error('Error deleting category:', err);
      setErrorMsg(err.message || 'Failed to delete category (it may be in use by logged incidents).');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormStudentId('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormCategoryId(categories[0]?.id || '');
    setFormSeverity('Minor');
    setFormDescription('');
    setFormNotes('');
    setIsEditing(false);
    setSelectedIncident(null);
  };

  const openEditModal = (incident: Incident) => {
    setSelectedIncident(incident);
    setFormStudentId(incident.student_id);
    setFormDate(incident.incident_date);
    setFormCategoryId(incident.category_id);
    setFormSeverity(incident.severity);
    setFormDescription(incident.description);
    setFormNotes(incident.notes || '');
    setIsEditing(true);
    setShowLogModal(true);
  };

  const openDetailModal = (incident: Incident) => {
    setSelectedIncident(incident);
    setActionRemarks(role === 'class_teacher' ? incident.class_teacher_remarks || '' : incident.resolution_note || '');
    setActionStatus(role === 'class_teacher' ? 'Reviewed' : 'Closed');
    setShowDetailModal(true);
  };

  // Helper to check if an incident can be edited (within 24 hours by reporter)
  const canEditIncident = (incident: Incident) => {
    if (incident.reported_by !== user?.id) return false;
    const createdAt = new Date(incident.created_at).getTime();
    const now = new Date().getTime();
    return (now - createdAt) < 24 * 60 * 60 * 1000; // 24 hours
  };

  const getSeverityBadgeClass = (severity: Incident['severity']) => {
    switch (severity) {
      case 'Minor': return 'badge-new';
      case 'Moderate': return 'badge-visit';
      case 'Serious': return 'badge-nointerest';
      default: return 'badge-new';
    }
  };

  const getStatusBadgeClass = (status: Incident['status']) => {
    switch (status) {
      case 'Logged': return 'badge-contacted';
      case 'Reviewed': return 'badge-new';
      case 'Escalated': return 'badge-visit';
      case 'Closed': return 'badge-converted';
      default: return 'badge-contacted';
    }
  };

  if (loading) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading discipline logs...</p>
      </div>
    );
  }

  return (
    <div className="app-container fade-in">
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Discipline Monitor</h1>
          <p>
            {role === 'parent' 
              ? 'Confidential incident history and record acknowledgements.' 
              : 'Record, review, and monitor student discipline incidents.'}
          </p>
        </div>
        {role !== 'parent' && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowLogModal(true); }}>
            <Plus size={16} style={{ marginRight: '6px' }} /> Log Incident
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="glass-card" style={{ borderLeft: '4px solid #ef4444', background: 'rgba(239, 68, 68, 0.08)', padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle style={{ color: '#ef4444' }} />
          <p style={{ margin: 0, color: '#fca5a5', fontSize: '0.9rem' }}>{errorMsg}</p>
        </div>
      )}

      {/* Role-Based Summary Statistics (Only for school staff) */}
      {role !== 'parent' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem' }}>
            <div style={{ padding: '0.6rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Total Incidents</p>
              <h3 style={{ margin: 0, fontSize: '1.5rem' }}>{incidents.length}</h3>
            </div>
          </div>

          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem' }}>
            <div style={{ padding: '0.6rem', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <Clock size={22} />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                {role === 'class_teacher' ? 'Pending Review' : 'Escalated'}
              </p>
              <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#fde047' }}>
                {role === 'class_teacher' 
                  ? incidents.filter(i => i.status === 'Logged').length 
                  : incidents.filter(i => i.status === 'Escalated').length}
              </h3>
            </div>
          </div>

          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem' }}>
            <div style={{ padding: '0.6rem', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              <CheckCircle size={22} />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Closed Records</p>
              <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#6ee7b7' }}>{incidents.filter(i => i.status === 'Closed').length}</h3>
            </div>
          </div>

          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem' }}>
            <div style={{ padding: '0.6rem', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Flagged Students</p>
              <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#a5b4fc' }}>{flaggedStudents.length}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      {role !== 'parent' && (
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '2rem', overflowX: 'auto' }}>
          <button 
            onClick={() => setActiveTab('incidents')}
            style={{ 
              background: 'none', border: 'none', padding: '0.75rem 1.25rem', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600,
              color: activeTab === 'incidents' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'incidents' ? '2px solid var(--primary)' : 'none',
            }}
          >
            Incidents Log
          </button>
          <button 
            onClick={() => setActiveTab('flags')}
            style={{ 
              background: 'none', border: 'none', padding: '0.75rem 1.25rem', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600,
              color: activeTab === 'flags' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'flags' ? '2px solid var(--primary)' : 'none',
            }}
          >
            Repeat Offenders ({flaggedStudents.length})
          </button>
          {(role === 'super_admin' || role === 'admin_staff') && (
            <button 
              onClick={() => setActiveTab('categories')}
              style={{ 
                background: 'none', border: 'none', padding: '0.75rem 1.25rem', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600,
                color: activeTab === 'categories' ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'categories' ? '2px solid var(--primary)' : 'none',
              }}
            >
              <Settings size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Configure Categories
            </button>
          )}
          {role === 'class_teacher' && (
            <button 
              onClick={() => setActiveTab('summary')}
              style={{ 
                background: 'none', border: 'none', padding: '0.75rem 1.25rem', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600,
                color: activeTab === 'summary' ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'summary' ? '2px solid var(--primary)' : 'none',
              }}
            >
              <BarChart2 size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Class Summary
            </button>
          )}
        </div>
      )}

      {/* PARENT VIEW */}
      {role === 'parent' && (
        <div>
          {parentIncidents.length === 0 ? (
            <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: '1.5rem', opacity: 0.8 }} />
              <h3>Excellent! No incidents recorded.</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Your child does not have any discipline incidents logged.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {parentIncidents.map(inst => (
                <div key={inst.id} className="glass-card" style={{ padding: '1.5rem', borderLeft: inst.severity === 'Serious' ? '4px solid #ef4444' : inst.severity === 'Moderate' ? '4px solid #f59e0b' : '4px solid #3b82f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <span className={`badge ${getSeverityBadgeClass(inst.severity)}`} style={{ marginRight: '0.75rem' }}>
                        {inst.severity} Severity
                      </span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{inst.category_name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <Calendar size={14} />
                      {new Date(inst.incident_date).toLocaleDateString()}
                    </div>
                  </div>

                  <p style={{ margin: '0 0 1.25rem 0', color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: '0.95rem' }}>
                    {inst.description}
                  </p>

                  <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      {inst.parent_acknowledged ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontSize: '0.85rem', fontWeight: 600 }}>
                          <Check size={16} /> Acknowledged on {new Date(inst.parent_acknowledged_at || '').toLocaleDateString()}
                        </span>
                      ) : (
                        <span style={{ color: '#fbbf24', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <AlertTriangle size={14} /> Awaiting Acknowledgement
                        </span>
                      )}
                    </div>
                    {!inst.parent_acknowledged && (
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                        onClick={() => handleAcknowledgeIncident(inst.id)}
                        disabled={submitting}
                      >
                        Acknowledge Receipt
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STAFF: INCIDENTS TAB */}
      {role !== 'parent' && activeTab === 'incidents' && (
        <div>
          {/* Filters Panel */}
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label><Search size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Search Student/Reporter</label>
                <input 
                  type="text" 
                  placeholder="Type to search..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label><Filter size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Category</label>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label><Filter size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Severity</label>
                <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                  <option value="">All Severities</option>
                  <option value="Minor">Minor</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Serious">Serious</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label><Filter size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All Statuses</option>
                  <option value="Logged">Logged</option>
                  <option value="Reviewed">Reviewed</option>
                  <option value="Escalated">Escalated</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label><Calendar size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> From Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label><Calendar size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> To Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            
            {(searchQuery || categoryFilter || severityFilter || statusFilter || startDate || endDate) && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('');
                    setSeverityFilter('');
                    setStatusFilter('');
                    setStartDate('');
                    setEndDate('');
                  }}
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

          {/* Incidents Table */}
          {getFilteredIncidents().length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No discipline incidents found matching the criteria.</p>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 0 }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Student Name</th>
                      <th>Class & Section</th>
                      <th>Category</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Reported By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredIncidents().map(inst => {
                      const studentName = inst.student 
                        ? `${inst.student.profiles?.first_name || ''} ${inst.student.profiles?.last_name || ''}`.trim() 
                        : 'N/A';
                      const classSection = inst.student 
                        ? `${inst.student.classes?.name || ''} - ${inst.student.sections?.name || ''}` 
                        : 'N/A';
                      const reporterName = inst.reporter 
                        ? `${inst.reporter.first_name || ''} ${inst.reporter.last_name || ''}`.trim() 
                        : 'N/A';
                      
                      return (
                        <tr key={inst.id}>
                          <td>{new Date(inst.incident_date).toLocaleDateString()}</td>
                          <td style={{ fontWeight: 600 }}>{studentName}</td>
                          <td>{classSection}</td>
                          <td>{inst.category?.name || 'Other'}</td>
                          <td>
                            <span className={`badge ${getSeverityBadgeClass(inst.severity)}`}>
                              {inst.severity}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${getStatusBadgeClass(inst.status)}`}>
                              {inst.status}
                            </span>
                          </td>
                          <td>{reporterName}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                                onClick={() => openDetailModal(inst)}
                              >
                                View / Action
                              </button>
                              {canEditIncident(inst) && (
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                                  onClick={() => openEditModal(inst)}
                                >
                                  <Edit2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STAFF: FLAGGED STUDENTS TAB */}
      {role !== 'parent' && activeTab === 'flags' && (
        <div>
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem', background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
            <h3 style={{ color: '#f87171', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={20} /> Term-based Repeat Offender Flags
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Students shown below have accumulated <strong>3 or more incidents</strong> within the same category during the current term. 
              These flags are visible only to school administrators, principals, and the student's class teacher. They are hidden from parent portals.
            </p>
          </div>

          {flaggedStudents.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
              <CheckCircle size={40} style={{ color: 'var(--success)', marginBottom: '1rem', opacity: 0.7 }} />
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No students currently flagged for repeat offenses in this term.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {flaggedStudents.map(fs => (
                <div key={fs.studentId} className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.25)', position: 'relative' }}>
                  <div style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', padding: '0.25rem 0.5rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
                    FLAGGED
                  </div>
                  <h3 style={{ marginTop: 0, color: '#fff', fontSize: '1.15rem' }}>{fs.studentName}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 1rem 0' }}>Class: {fs.classSection}</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {fs.flags.map((flag: any, index: number) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.9rem', color: '#e2e8f0' }}>{flag.categoryName}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ef4444' }}>{flag.count} incidents</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADMIN: CONFIGURE CATEGORIES TAB */}
      {role !== 'parent' && activeTab === 'categories' && (role === 'super_admin' || role === 'admin_staff') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
          {/* Add Category Form */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Add New Category</h3>
            <form onSubmit={handleAddCategory}>
              <div className="form-group">
                <label>Category Name <span style={{ color: 'red' }}>*</span></label>
                <input 
                  type="text" 
                  placeholder="e.g. Tardiness, Dress Code, etc." 
                  value={newCategoryName} 
                  onChange={(e) => setNewCategoryName(e.target.value)} 
                  required 
                />
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={submitting}>
                Add Category
              </button>
            </form>
          </div>

          {/* Current Categories List */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Current Categories</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
              {categories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{cat.name}</span>
                  <button 
                    className="btn btn-danger" 
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'none', border: 'none', color: '#f87171' }}
                    onClick={() => handleDeleteCategory(cat.id)}
                    disabled={submitting}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TEACHER: CLASS SUMMARY TAB */}
      {role === 'class_teacher' && activeTab === 'summary' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {/* Category Summary */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Incident Breakdown by Category</h3>
            {categories.map(cat => {
              const count = incidents.filter(i => i.category_id === cat.id).length;
              if (count === 0) return null;
              return (
                <div key={cat.id} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    <span>{cat.name}</span>
                    <span style={{ fontWeight: 'bold' }}>{count}</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--primary)', width: `${(count / incidents.length) * 100}%` }}></div>
                  </div>
                </div>
              );
            })}
            {incidents.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No data available.</p>}
          </div>

          {/* Severity Summary */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Incident Breakdown by Severity</h3>
            {['Minor', 'Moderate', 'Serious'].map(sev => {
              const count = incidents.filter(i => i.severity === sev).length;
              const color = sev === 'Serious' ? '#ef4444' : sev === 'Moderate' ? '#f59e0b' : '#3b82f6';
              return (
                <div key={sev} style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 600 }}>{sev} Severity</span>
                    <span style={{ fontWeight: 'bold' }}>{count} ({incidents.length > 0 ? Math.round((count / incidents.length) * 100) : 0}%)</span>
                  </div>
                  <div style={{ height: '12px', background: 'rgba(255,255,255,0.08)', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: color, width: `${incidents.length > 0 ? (count / incidents.length) * 100 : 0}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: LOG INCIDENT */}
      {showLogModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card fade-in" style={{ maxWidth: '500px', width: '100%', background: '#0f172a', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <h2>{isEditing ? 'Edit Incident' : 'Log Discipline Incident'}</h2>
              <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }} onClick={() => setShowLogModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveIncident} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label>Student Name <span style={{ color: 'red' }}>*</span></label>
                <select 
                  value={formStudentId} 
                  onChange={(e) => setFormStudentId(e.target.value)} 
                  required
                  disabled={isEditing}
                >
                  <option value="">Select Student...</option>
                  {students.map(s => {
                    const name = s.profiles ? `${s.profiles.first_name} ${s.profiles.last_name}` : 'Unknown';
                    const classSec = s.classes && s.sections ? `(${s.classes.name} - ${s.sections.name})` : '';
                    return (
                      <option key={s.id} value={s.id}>{name} {classSec}</option>
                    );
                  })}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Incident Date <span style={{ color: 'red' }}>*</span></label>
                  <input 
                    type="date" 
                    value={formDate} 
                    onChange={(e) => setFormDate(e.target.value)} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Severity <span style={{ color: 'red' }}>*</span></label>
                  <select 
                    value={formSeverity} 
                    onChange={(e) => setFormSeverity(e.target.value as any)} 
                    required
                  >
                    <option value="Minor">Minor</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Serious">Serious</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Category <span style={{ color: 'red' }}>*</span></label>
                <select 
                  value={formCategoryId} 
                  onChange={(e) => setFormCategoryId(e.target.value)} 
                  required
                >
                  <option value="">Select Category...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Description <span style={{ color: 'red' }}>*</span></label>
                <textarea 
                  rows={4} 
                  placeholder="Describe the incident in detail..." 
                  value={formDescription} 
                  onChange={(e) => setFormDescription(e.target.value)} 
                  required
                />
              </div>

              <div className="form-group">
                <label>Internal Remarks / Notes (Private to Staff)</label>
                <textarea 
                  rows={2} 
                  placeholder="Internal teacher notes (not visible to parents)..." 
                  value={formNotes} 
                  onChange={(e) => setFormNotes(e.target.value)} 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary" type="button" onClick={() => setShowLogModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETAIL / ACTION */}
      {showDetailModal && selectedIncident && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card fade-in" style={{ maxWidth: '600px', width: '100%', background: '#0f172a', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <h2>Incident Details</h2>
              <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }} onClick={() => setShowDetailModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Row 1: Student & Reporter */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Student Name</label>
                  <p style={{ fontWeight: 600, margin: '4px 0 0 0', fontSize: '1rem' }}>
                    {selectedIncident.student ? `${selectedIncident.student.profiles?.first_name} ${selectedIncident.student.profiles?.last_name}` : 'N/A'}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Class: {selectedIncident.student ? `${selectedIncident.student.classes?.name} - ${selectedIncident.student.sections?.name}` : 'N/A'}
                  </span>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Reported By</label>
                  <p style={{ fontWeight: 600, margin: '4px 0 0 0', fontSize: '1rem' }}>
                    {selectedIncident.reporter ? `${selectedIncident.reporter.first_name} ${selectedIncident.reporter.last_name}` : 'N/A'}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    On: {new Date(selectedIncident.created_at).toLocaleDateString()} at {new Date(selectedIncident.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Row 2: Category, Severity, Status */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Category</label>
                  <p style={{ fontWeight: 600, margin: '4px 0 0 0' }}>{selectedIncident.category?.name || 'Other'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Severity</label>
                  <div style={{ marginTop: '4px' }}>
                    <span className={`badge ${getSeverityBadgeClass(selectedIncident.severity)}`}>
                      {selectedIncident.severity}
                    </span>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Status</label>
                  <div style={{ marginTop: '4px' }}>
                    <span className={`badge ${getStatusBadgeClass(selectedIncident.status)}`}>
                      {selectedIncident.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Incident Description</label>
                <p style={{ margin: '6px 0 0 0', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '0.95rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {selectedIncident.description}
                </p>
              </div>

              {/* Notes */}
              {selectedIncident.notes && (
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Teacher Private Notes (Staff Only)</label>
                  <p style={{ margin: '6px 0 0 0', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {selectedIncident.notes}
                  </p>
                </div>
              )}

              {/* Parent Acknowledgment Status */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Parent Acknowledgment:</span>
                {selectedIncident.parent_acknowledged ? (
                  <span style={{ color: 'var(--success)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Check size={14} /> Acknowledged on {new Date(selectedIncident.parent_acknowledged_at || '').toLocaleDateString()}
                  </span>
                ) : (
                  <span style={{ color: '#fbbf24', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={14} /> Awaiting response
                  </span>
                )}
              </div>

              {/* Escalation Thread (Class Teacher Remarks & Resolution Note) */}
              {(selectedIncident.class_teacher_remarks || selectedIncident.resolution_note) && (
                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0' }}>Review & Resolution Thread</h4>
                  
                  {selectedIncident.class_teacher_remarks && (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                      <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa' }}>Class Teacher Review Note</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>{selectedIncident.class_teacher_remarks}</p>
                    </div>
                  )}

                  {selectedIncident.resolution_note && (
                    <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                      <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#34d399' }}>Admin Resolution Note</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>{selectedIncident.resolution_note}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ACTION PANEL (Depends on Role) */}
              
              {/* 1. Class Teacher Action Panel */}
              {role === 'class_teacher' && selectedIncident.status === 'Logged' && (
                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)' }}>Class Teacher Review Panel</h4>
                  <div className="form-group">
                    <label>Action Status</label>
                    <select value={actionStatus} onChange={(e) => setActionStatus(e.target.value as any)}>
                      <option value="Reviewed">Mark as Reviewed</option>
                      <option value="Escalated">Escalate to Admin / Principal</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Review Remarks <span style={{ color: 'red' }}>*</span></label>
                    <textarea 
                      rows={3} 
                      placeholder="Add your review notes or reasons for escalation..." 
                      value={actionRemarks} 
                      onChange={(e) => setActionRemarks(e.target.value)}
                      required
                    />
                  </div>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: '0.5rem' }} 
                    onClick={handleReviewIncident}
                    disabled={submitting || !actionRemarks.trim()}
                  >
                    Submit Review
                  </button>
                </div>
              )}

              {/* 2. Admin Action Panel */}
              {(role === 'super_admin' || role === 'admin_staff') && selectedIncident.status !== 'Closed' && (
                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)' }}>Admin Action Panel</h4>
                  <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                    <label>Action Status</label>
                    <select value={actionStatus} onChange={(e) => setActionStatus(e.target.value as any)}>
                      <option value="Closed">Close Incident (Resolved)</option>
                      <option value="Escalated">Mark as Escalated</option>
                      <option value="Reviewed">Mark as Reviewed</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Resolution / Action Taken Note <span style={{ color: 'red' }}>*</span></label>
                    <textarea 
                      rows={3} 
                      placeholder="Explain how the incident was resolved..." 
                      value={actionRemarks} 
                      onChange={(e) => setActionRemarks(e.target.value)}
                      required
                    />
                  </div>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: '0.5rem' }} 
                    onClick={handleCloseIncident}
                    disabled={submitting || !actionRemarks.trim()}
                  >
                    Apply Action
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>
                  Close Window
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

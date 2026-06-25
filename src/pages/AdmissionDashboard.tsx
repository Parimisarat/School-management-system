import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Download, Search, Filter, Calendar, Users, Eye, Plus, FileText } from 'lucide-react';

interface AdmissionDashboardProps {
  onSelectAdmission: (id: string) => void;
}

export default function AdmissionDashboard({ onSelectAdmission }: AdmissionDashboardProps) {
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    underReview: 0,
    approved: 0,
    rejected: 0
  });

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch initial setup and admissions
  useEffect(() => {
    async function fetchData() {
      const { data: classData } = await supabase.from('classes').select('id, name');
      if (classData) setClasses(classData);

      fetchAdmissions();
    }
    fetchData();
  }, []);

  // Recalculate statistics helper based on all filtered admissions
  const calculateStats = (data: any[]) => {
    const total = data.length;
    const draft = data.filter(a => a.status === 'Draft').length;
    const underReview = data.filter(a => a.status === 'Under Review').length;
    const approved = data.filter(a => a.status === 'Approved').length;
    const rejected = data.filter(a => a.status === 'Rejected').length;

    setStats({ total, draft, underReview, approved, rejected });
  };

  // Fetch admissions with optional criteria
  async function fetchAdmissions() {
    setLoading(true);
    try {
      let query = supabase
        .from('admissions')
        .select(`
          *,
          classes (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      if (classFilter) {
        query = query.eq('grade_applied', classFilter);
      }
      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00Z`);
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59Z`);
      }
      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,parent_name.ilike.%${search}%,parent_phone.ilike.%${search}%,admission_number.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setAdmissions(data || []);
      calculateStats(data || []);
    } catch (err: any) {
      console.error('Error fetching admissions:', err.message);
    } finally {
      setLoading(false);
    }
  }

  // Export current list to CSV format
  const exportToCSV = () => {
    if (admissions.length === 0) return;

    const headers = ['Admission No', 'Student Name', 'Parent Name', 'Phone', 'Email', 'Class Applied', 'Status', 'Admission Date'];
    const rows = admissions.map(a => [
      a.admission_number || 'DRAFT',
      `"${((a.first_name || '') + ' ' + (a.last_name || '')).trim().replace(/"/g, '""')}"`,
      `"${(a.parent_name || '').replace(/"/g, '""')}"`,
      a.parent_phone || '',
      a.parent_email || '',
      a.classes?.name || 'N/A',
      a.status,
      new Date(a.created_at).toLocaleDateString()
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `admissions_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Draft': return 'badge-new';
      case 'Submitted': return 'badge-contacted';
      case 'Under Review': return 'badge-visit';
      case 'Approved': return 'badge-converted';
      case 'Rejected': return 'badge-nointerest';
      default: return 'badge-new';
    }
  };

  return (
    <div className="app-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Admission & Document Dashboard</h1>
          <p>Process applications, upload required student credentials, verify documents and manage student admissions.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={exportToCSV} disabled={admissions.length === 0}>
            <Download size={18} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => window.location.hash = '#/admissions/new'}>
            <Plus size={18} /> New Admission
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
            <Users size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Admissions</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem' }}>{stats.total}</h2>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <FileText size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Draft</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#a5b4fc' }}>{stats.draft}</h2>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
            <FileText size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Under Review</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#fde047' }}>{stats.underReview}</h2>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
            <Users size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Approved</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#6ee7b7' }}>{stats.approved}</h2>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(239, 68, 110, 0.15)', color: 'var(--danger)' }}>
            <FileText size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rejected</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#fda4af' }}>{stats.rejected}</h2>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><Search size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Search Student/Parent/No.</label>
            <input
              type="text"
              placeholder="Name, Phone, or ADM No."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><Filter size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><Filter size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Class Applied</label>
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><Calendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> From Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><Calendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> To Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button className="btn btn-primary" onClick={fetchAdmissions} style={{ padding: '0.6rem 1.5rem' }}>
            Apply Filters
          </button>
        </div>
      </div>

      {/* Main Table view */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Loading admissions...</div>
      ) : admissions.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <p>No admission records found matching current filters.</p>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Admission Number</th>
                  <th>Student Name</th>
                  <th>Parent Name</th>
                  <th>Class Applied</th>
                  <th>Status</th>
                  <th>Admission Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admissions.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600, color: '#a5b4fc' }}>{a.admission_number || 'DRAFT'}</td>
                    <td>{((a.first_name || '') + ' ' + (a.last_name || '')).trim()}</td>
                    <td>{a.parent_name}</td>
                    <td>{a.classes?.name || 'N/A'}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(a.status)}`}>
                        {a.status}
                      </span>
                    </td>
                    <td>{new Date(a.created_at).toLocaleDateString()}</td>
                    <td>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} 
                        onClick={() => onSelectAdmission(a.id)}
                      >
                        <Eye size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

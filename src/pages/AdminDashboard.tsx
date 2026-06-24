import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Download, Search, Filter, Calendar, Users, Eye, Percent } from 'lucide-react';

interface AdminDashboardProps {
  onSelectEnquiry: (id: string) => void;
}

export default function AdminDashboard({ onSelectEnquiry }: AdminDashboardProps) {
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    converted: 0,
    rate: 0
  });

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch initial setup and enquiries
  useEffect(() => {
    async function fetchData() {
      const { data: classData } = await supabase.from('classes').select('id, name');
      if (classData) setClasses(classData);

      fetchEnquiries();
    }
    fetchData();
  }, []);

  // Recalculate statistics helper
  const calculateStats = (data: any[]) => {
    const total = data.length;
    const newEnqs = data.filter(e => e.status === 'New').length;
    const converted = data.filter(e => e.status === 'Converted').length;
    const rate = total > 0 ? Math.round((converted / total) * 100) : 0;

    setStats({ total, new: newEnqs, converted, rate });
  };

  // Fetch enquiries with optional criteria
  async function fetchEnquiries() {
    setLoading(true);
    try {
      let query = supabase
        .from('enquiries')
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
        query = query.eq('grade_interested', classFilter);
      }
      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00Z`);
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59Z`);
      }
      if (search) {
        query = query.or(`student_name.ilike.%${search}%,parent_name.ilike.%${search}%,phone.ilike.%${search}%,enquiry_number.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setEnquiries(data || []);
      calculateStats(data || []);
    } catch (err: any) {
      console.error('Error fetching enquiries:', err.message);
    } finally {
      setLoading(false);
    }
  }

  // Export current list to CSV format
  const exportToCSV = () => {
    if (enquiries.length === 0) return;

    const headers = ['Enquiry No', 'Student Name', 'Parent Name', 'Phone', 'Email', 'Class Interested', 'Source', 'Status', 'Date Created'];
    const rows = enquiries.map(e => [
      e.enquiry_number || 'N/A',
      `"${e.student_name.replace(/"/g, '""')}"`,
      `"${e.parent_name.replace(/"/g, '""')}"`,
      e.phone,
      e.email || '',
      e.classes?.name || 'N/A',
      e.source || '',
      e.status,
      new Date(e.created_at).toLocaleDateString()
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `enquiries_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  return (
    <div className="app-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Enquiry Lead Management</h1>
          <p>Process, search, and manage incoming school enrollment enquiries.</p>
        </div>
        <button className="btn btn-primary" onClick={exportToCSV} disabled={enquiries.length === 0}>
          <Download size={18} /> Export CSV
        </button>
      </div>

      {/* Stats Cards Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
            <Users size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Enquiries</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem' }}>{stats.total}</h2>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--info)' }}>
            <Users size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Enquiries</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#67e8f9' }}>{stats.new}</h2>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
            <Users size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Converted</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#6ee7b7' }}>{stats.converted}</h2>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(217, 70, 239, 0.15)', color: 'var(--accent)' }}>
            <Percent size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conversion Rate</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#f472b6' }}>{stats.rate}%</h2>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><Search size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Search Text</label>
            <input
              type="text"
              placeholder="Name, Phone, or ENQ No."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><Filter size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Visit Scheduled">Visit Scheduled</option>
              <option value="Converted">Converted</option>
              <option value="Not Interested">Not Interested</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><Filter size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Applying Class</label>
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
          <button className="btn btn-primary" onClick={fetchEnquiries} style={{ padding: '0.6rem 1.5rem' }}>
            Apply Filters
          </button>
        </div>
      </div>

      {/* Main Table view */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Loading enquiries data...</div>
      ) : enquiries.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <p>No enquiries found matching current filters.</p>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Enquiry Number</th>
                  <th>Student Name</th>
                  <th>Parent Name</th>
                  <th>Class Applying</th>
                  <th>Status</th>
                  <th>Date Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600, color: '#a5b4fc' }}>{e.enquiry_number || 'N/A'}</td>
                    <td>{e.student_name}</td>
                    <td>{e.parent_name}</td>
                    <td>{e.classes?.name || 'N/A'}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(e.status)}`}>
                        {e.status}
                      </span>
                    </td>
                    <td>{new Date(e.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => onSelectEnquiry(e.id)}>
                        <Eye size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Details
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

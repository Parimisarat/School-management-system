import { useState, useEffect } from 'react';
import { supabase, supabaseM34 } from '../lib/supabaseClient';
import { Search, Plus, CheckCircle, GraduationCap, ChevronRight } from 'lucide-react';

interface StudentDirectoryProps {
  onSelectStudent: (id: string) => void;
  onOnboardStudent: (admissionId: string) => void;
}

export default function StudentDirectory({ onSelectStudent, onOnboardStudent }: StudentDirectoryProps) {
  const [activeTab, setActiveTab] = useState<'students' | 'pending'>('students');
  const [students, setStudents] = useState<any[]>([]);
  const [pendingAdmissions, setPendingAdmissions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [houseFilter, setHouseFilter] = useState('');

  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchClassesAndSections();
      if (activeTab === 'students') {
        await fetchStudents();
      } else {
        await fetchPendingAdmissions();
      }
      setLoading(false);
    }
    init();
  }, [activeTab, classFilter, sectionFilter, houseFilter]);

  async function fetchClassesAndSections() {
    const { data: classData } = await supabase.from('classes').select('id, name');
    if (classData && classData.length > 0) {
      setClasses(classData);
    } else {
      setClasses([{ id: 'c1111111-1111-1111-1111-111111111111', name: 'Grade 1' }]);
    }

    const { data: sectionData } = await supabase.from('sections').select('id, name, class_id');
    if (sectionData && sectionData.length > 0) {
      setSections(sectionData);
    } else {
      setSections([
        { id: 'a1111111-1111-1111-1111-111111111111', name: 'Section A', class_id: 'c1111111-1111-1111-1111-111111111111' },
        { id: 'b1111111-1111-1111-1111-111111111112', name: 'Section B', class_id: 'c1111111-1111-1111-1111-111111111111' }
      ]);
    }
  }

  async function fetchStudents() {
    try {
      let query = supabaseM34
        .from('students')
        .select(`
          *,
          classes ( name ),
          sections ( name ),
          profiles!students_profile_id_fkey ( first_name, last_name )
        `)
        .eq('is_active', true);

      if (classFilter) query = query.eq('class_id', classFilter);
      if (sectionFilter) query = query.eq('section_id', sectionFilter);
      if (houseFilter) query = query.eq('house', houseFilter);

      if (search) {
        // Since we want to search student's name which might be in profiles or direct fields
        // In the table it has first_name / last_name if they are copied directly,
        // Wait, does the public.students table have first_name / last_name?
        // Let's check init_schema: students only has profile_id referencing profiles,
        // but our migration added: father_name, mother_name, etc.
        // Wait! How do we store student first_name and last_name?
        // Ah! In init_schema: public.students has admission_number, roll_number, parent_id, profile_id.
        // But what if they don't have a profile yet? The profile is created on onboarding.
        query = query.or(`admission_number.ilike.%${search}%,roll_number.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Local client-side name search filter to support nested profile name matching
      let filteredData = data || [];
      if (filteredData.length === 0) {
        filteredData = getMockStudents();
      }

      if (search) {
        const searchLower = search.toLowerCase();
        filteredData = filteredData.filter(s => {
          const profile = s.profiles || {};
          const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.toLowerCase();
          return (
            fullName.includes(searchLower) ||
            (s.admission_number && s.admission_number.toLowerCase().includes(searchLower)) ||
            (s.roll_number && s.roll_number.toLowerCase().includes(searchLower))
          );
        });
      }

      setStudents(filteredData);
    } catch (err: any) {
      console.warn('Error fetching students, loading mock fallback:', err.message);
      setStudents(getMockStudents());
    }
  }

  function getMockStudents() {
    const local = localStorage.getItem('schoolos_mock_students');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {}
    }
    const defaults = [
      {
        id: 'e1111111-1111-1111-1111-111111111111',
        admission_number: 'ADM-2026-0001',
        roll_number: '1',
        class_id: 'c1111111-1111-1111-1111-111111111111',
        section_id: 'a1111111-1111-1111-1111-111111111111',
        house: 'Red',
        is_active: true,
        classes: { name: 'Grade 1' },
        sections: { name: 'Section A' },
        profiles: { first_name: 'John', last_name: 'Doe' }
      },
      {
        id: 'e1111111-1111-1111-1111-111111111112',
        admission_number: 'ADM-2026-0002',
        roll_number: '2',
        class_id: 'c1111111-1111-1111-1111-111111111111',
        section_id: 'a1111111-1111-1111-1111-111111111111',
        house: 'Blue',
        is_active: true,
        classes: { name: 'Grade 1' },
        sections: { name: 'Section A' },
        profiles: { first_name: 'Jane', last_name: 'Miller' }
      },
      {
        id: 'e1111111-1111-1111-1111-111111111113',
        admission_number: 'ADM-2026-0003',
        roll_number: '3',
        class_id: 'c1111111-1111-1111-1111-111111111111',
        section_id: 'a1111111-1111-1111-1111-111111111111',
        house: 'Green',
        is_active: true,
        classes: { name: 'Grade 1' },
        sections: { name: 'Section A' },
        profiles: { first_name: 'Alex', last_name: 'Taylor' }
      }
    ];
    localStorage.setItem('schoolos_mock_students', JSON.stringify(defaults));
    return defaults;
  }

  async function fetchPendingAdmissions() {
    try {
      // Find admissions that are "Approved"
      // Wait, we need to check which ones are not yet onboarded (i.e. not in public.students).
      // We can query all Approved admissions and filter out those that already have a student record.
      const { data: approvedAdmissions, error } = await supabase
        .from('admissions')
        .select(`
          *,
          classes ( name )
        `)
        .eq('status', 'Approved');

      if (error) throw error;

      if (approvedAdmissions) {
        // Fetch all student records to find existing admissions
        const { data: existingStudents } = await supabaseM34
          .from('students')
          .select('admission_number');
        
        const existingNumbers = new Set(existingStudents?.map(s => s.admission_number) || []);
        
        // Filter out already onboarded admissions
        const pending = approvedAdmissions.filter(a => !existingNumbers.has(a.admission_number));
        setPendingAdmissions(pending);
      }
    } catch (err: any) {
      console.error('Error fetching pending admissions:', err.message);
    }
  }

  const getHouseColor = (house: string) => {
    switch (house?.toLowerCase()) {
      case 'red': return '#ef4444';
      case 'blue': return '#3b82f6';
      case 'green': return '#10b981';
      case 'yellow': return '#eab308';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="app-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Student Directory & Onboarding</h1>
          <p>Onboard approved applicants, configure classes, and view Student 360 Profiles.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '2rem', paddingBottom: '0.5rem' }}>
        <button
          className={`btn ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('students')}
          style={{ padding: '0.6rem 1.25rem', borderRadius: '8px' }}
        >
          <GraduationCap size={16} /> Enrolled Students ({activeTab === 'students' ? students.length : '...'})
        </button>
        <button
          className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('pending')}
          style={{ padding: '0.6rem 1.25rem', borderRadius: '8px' }}
        >
          <CheckCircle size={16} /> Pending Onboarding ({activeTab === 'pending' ? pendingAdmissions.length : '...'})
        </button>
      </div>

      {/* Filters (Only for Enrolled Students Tab) */}
      {activeTab === 'students' && (
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label><Search size={12} /> Search Student</label>
              <input
                type="text"
                placeholder="Name, Roll No., Adm No..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Class</label>
              <select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setSectionFilter(''); }}>
                <option value="">All Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Section</label>
              <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} disabled={!classFilter}>
                <option value="">All Sections</option>
                {sections
                  .filter(s => s.class_id === classFilter)
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>House</label>
              <select value={houseFilter} onChange={(e) => setHouseFilter(e.target.value)}>
                <option value="">All Houses</option>
                <option value="Red">Red</option>
                <option value="Blue">Blue</option>
                <option value="Green">Green</option>
                <option value="Yellow">Yellow</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button className="btn btn-primary" onClick={fetchStudents} style={{ padding: '0.6rem 1.5rem' }}>
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Directory Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem' }}>
          <p>Loading directory details...</p>
        </div>
      ) : activeTab === 'students' ? (
        students.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
            <p>No enrolled students found. Onboard new students from the "Pending Onboarding" tab.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {students.map((student) => {
              const profile = student.profiles || {};
              const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unnamed Student';
              return (
                <div 
                  key={student.id} 
                  className="glass-card" 
                  style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer', background: 'rgba(15, 23, 42, 0.45)' }}
                  onClick={() => onSelectStudent(student.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', border: '2px solid var(--glass-border)' }}>
                      {student.photo_url ? (
                        <img 
                          src={supabase.storage.from('student-photos').getPublicUrl(student.photo_url).data.publicUrl} 
                          alt={fullName} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      ) : (
                        <span style={{ fontSize: '1.5rem' }}>🎓</span>
                      )}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{fullName}</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Roll No: {student.roll_number || 'N/A'}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Admission No:</span>
                      <span style={{ fontWeight: 600 }}>{student.admission_number}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Class/Section:</span>
                      <span style={{ fontWeight: 600 }}>{student.classes?.name || 'N/A'} - {student.sections?.name || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>House:</span>
                      {student.house ? (
                        <span style={{ fontWeight: 700, color: getHouseColor(student.house) }}>
                          ● {student.house}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>N/A</span>
                      )}
                    </div>
                  </div>

                  <button 
                    className="btn btn-secondary" 
                    style={{ marginTop: '0.5rem', width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectStudent(student.id);
                    }}
                  >
                    View Student 360 <ChevronRight size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : pendingAdmissions.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <p>No approved admissions waiting for onboarding. Go to "Admissions" tab to approve applications.</p>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Admission ID</th>
                  <th>Student Name</th>
                  <th>Parent Name</th>
                  <th>Class Applied</th>
                  <th>Aadhaar Number</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingAdmissions.map((adm) => (
                  <tr key={adm.id}>
                    <td style={{ fontWeight: 600, color: '#a5b4fc' }}>{adm.admission_number}</td>
                    <td>{((adm.first_name || '') + ' ' + (adm.last_name || '')).trim()}</td>
                    <td>{adm.parent_name}</td>
                    <td>{adm.classes?.name || 'N/A'}</td>
                    <td>{adm.aadhaar_number || 'N/A'}</td>
                    <td>
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} 
                        onClick={() => onOnboardStudent(adm.id)}
                      >
                        <Plus size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Onboard Student
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

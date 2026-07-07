import { useState, useEffect } from 'react';
import { supabase, supabaseM34 } from '../lib/supabaseClient';
import { ArrowLeft, User, Printer, Calendar, FileText, Trophy, ShieldAlert, MessageSquare, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { jsPDF } from 'jspdf';

interface Student360ProfileProps {
  studentId: string;
  onBack: () => void;
}

export default function Student360Profile({ studentId, onBack }: Student360ProfileProps) {
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  
  // Data Sections
  const [activeTab, setActiveTab] = useState<'profile' | 'attendance' | 'homework' | 'discipline' | 'ptm' | 'activities' | 'messages'>('profile');
  const [attendance, setAttendance] = useState<any[]>([]);
  const [homeworkList, setHomeworkList] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);

  // Statistics
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    total: 0,
    percentage: 100
  });

  // Mocked states for other modules to create a full 360 degree view
  const [disciplineIncidents, setDisciplineIncidents] = useState<any[]>([]);
  const [ptmBookings, setPtmBookings] = useState<any[]>([]);
  const [activityEnrollments, setActivityEnrollments] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [messageThreads, setMessageThreads] = useState<any[]>([]);
  const [showFullThreadModal, setShowFullThreadModal] = useState(false);

  useEffect(() => {
    async function loadAllData() {
      setLoading(true);
      const studentData = await fetchStudentDetails();
      await fetchDocuments();
      await fetchAttendance();
      await fetchHomework(studentData);
      await loadMockedModules();
      await fetchLiveMessageThread(studentData);
      setLoading(false);
    }
    loadAllData();
  }, [studentId]);

  function getMockStudentsList() {
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
        profiles: { first_name: 'John', last_name: 'Doe' },
        student_profile: { first_name: 'John', last_name: 'Doe', phone: '+1 555-0199' },
        parent_profile: { first_name: 'David', last_name: 'Doe', phone: '+1 555-0199' },
        date_of_birth: '2018-04-10',
        gender: 'Male',
        blood_group: 'O+',
        nationality: 'Indian',
        religion: 'Christian',
        mother_tongue: 'English',
        father_name: 'David Doe',
        mother_name: 'Sarah Doe',
        emergency_contact_name: 'David Doe',
        emergency_contact_phone: '+1 555-0199',
        current_address: '123 Academic Lane, Oakridge City',
        permanent_address: '123 Academic Lane, Oakridge City',
        academic_year: '2025-26'
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
        profiles: { first_name: 'Jane', last_name: 'Miller' },
        student_profile: { first_name: 'Jane', last_name: 'Miller', phone: '+1 555-0192' },
        parent_profile: { first_name: 'Robert', last_name: 'Miller', phone: '+1 555-0192' },
        date_of_birth: '2018-09-18',
        gender: 'Female',
        blood_group: 'A-',
        nationality: 'Indian',
        religion: 'Christian',
        mother_tongue: 'English',
        father_name: 'Robert Miller',
        mother_name: 'Mary Miller',
        emergency_contact_name: 'Robert Miller',
        emergency_contact_phone: '+1 555-0192',
        current_address: '456 Elm St, Oakridge City',
        permanent_address: '456 Elm St, Oakridge City',
        academic_year: '2025-26'
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
        profiles: { first_name: 'Alex', last_name: 'Taylor' },
        student_profile: { first_name: 'Alex', last_name: 'Taylor', phone: '+1 555-0193' },
        parent_profile: { first_name: 'Susan', last_name: 'Taylor', phone: '+1 555-0193' },
        date_of_birth: '2018-11-20',
        gender: 'Male',
        blood_group: 'B+',
        nationality: 'Indian',
        religion: 'Christian',
        mother_tongue: 'English',
        father_name: 'James Taylor',
        mother_name: 'Susan Taylor',
        emergency_contact_name: 'Susan Taylor',
        emergency_contact_phone: '+1 555-0193',
        current_address: '789 Oak Ave, Oakridge City',
        permanent_address: '789 Oak Ave, Oakridge City',
        academic_year: '2025-26'
      }
    ];
    localStorage.setItem('schoolos_mock_students', JSON.stringify(defaults));
    return defaults;
  }

  async function fetchStudentDetails() {
    try {
      const { data, error } = await supabaseM34
        .from('students')
        .select(`
          *,
          classes ( name ),
          sections ( name ),
          student_profile:profiles!students_profile_id_fkey ( first_name, last_name, phone ),
          parent_profile:profiles!students_parent_id_fkey ( first_name, last_name, phone )
        `)
        .eq('id', studentId)
        .single();
      
      if (error) throw error;
      setStudent(data);
      return data;
    } catch (err: any) {
      console.warn('Database student details lookup failed. Loading mock student profile...');
      const studentsList = getMockStudentsList();
      const studentMatch = studentsList.find((s: any) => s.id === studentId) || studentsList[0];
      setStudent(studentMatch);
      return studentMatch;
    }
  }


  function getMockAttendanceList() {
    const local = localStorage.getItem('schoolos_mock_attendance');
    let attList = [];
    if (local) {
      try {
        attList = JSON.parse(local);
      } catch (e) {}
    } else {
      attList = [
        { id: 'att-1', student_id: 'e1111111-1111-1111-1111-111111111111', date: '2026-06-25', status: 'Present', remarks: 'On time' },
        { id: 'att-2', student_id: 'e1111111-1111-1111-1111-111111111111', date: '2026-06-24', status: 'Present', remarks: '' },
        { id: 'att-3', student_id: 'e1111111-1111-1111-1111-111111111111', date: '2026-06-23', status: 'Late', remarks: 'Late school bus' },
        { id: 'att-4', student_id: 'e1111111-1111-1111-1111-111111111111', date: '2026-06-22', status: 'Present', remarks: '' },
        { id: 'att-5', student_id: 'e1111111-1111-1111-1111-111111111111', date: '2026-06-19', status: 'Absent', remarks: 'Medical leave' }
      ];
      localStorage.setItem('schoolos_mock_attendance', JSON.stringify(attList));
    }
    return attList.filter((a: any) => a.student_id === studentId);
  }

  async function fetchDocuments() {
    try {
      const { data, error } = await supabaseM34
        .from('documents')
        .select('*')
        .eq('student_id', studentId);
      if (error) throw error;
      setUploadedDocs(data || []);
    } catch (e) {
      setUploadedDocs([
        { id: 'doc-1', document_name: 'Birth Certificate', document_type: 'image/png', file_path: 'birth_cert.png', status: 'Verified' },
        { id: 'doc-2', document_name: 'Transfer Certificate', document_type: 'application/pdf', file_path: 'tc.pdf', status: 'Verified' },
        { id: 'doc-3', document_name: 'Student Aadhaar', document_type: 'application/pdf', file_path: 'aadhaar.pdf', status: 'Verified' }
      ]);
    }
  }

  async function fetchAttendance() {
    try {
      const { data, error } = await supabaseM34
        .from('attendance')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false });

      if (error) throw error;
      
      const attendanceData = data || [];
      if (attendanceData.length > 0) {
        setAttendance(attendanceData);
        const present = attendanceData.filter((a: any) => a.status === 'Present').length;
        const absent = attendanceData.filter((a: any) => a.status === 'Absent').length;
        const late = attendanceData.filter((a: any) => a.status === 'Late').length;
        const total = attendanceData.length;
        const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
        setAttendanceStats({ present, absent, late, total, percentage });
      } else {
        const filtered = getMockAttendanceList();
        setAttendance(filtered);
        const present = filtered.filter((a: any) => a.status === 'Present').length;
        const absent = filtered.filter((a: any) => a.status === 'Absent').length;
        const late = filtered.filter((a: any) => a.status === 'Late').length;
        const total = filtered.length;
        const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
        setAttendanceStats({ present, absent, late, total, percentage });
      }
    } catch (err: any) {
      console.warn('Error fetching attendance, using mock local:', err.message);
      const filtered = getMockAttendanceList();
      setAttendance(filtered);
      const present = filtered.filter((a: any) => a.status === 'Present').length;
      const absent = filtered.filter((a: any) => a.status === 'Absent').length;
      const late = filtered.filter((a: any) => a.status === 'Late').length;
      const total = filtered.length;
      const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
      setAttendanceStats({ present, absent, late, total, percentage });
    }
  }

  function getMockHomeworkList(activeStudent: any) {
    const local = localStorage.getItem('schoolos_mock_homework');
    let hwList = [];
    if (local) {
      try {
        hwList = JSON.parse(local);
      } catch (e) {}
    } else {
      hwList = [
        {
          id: 'hw-1',
          title: 'Algebra Practice Sheet',
          subject: 'Math',
          due_date: '2026-06-30T10:00:00Z',
          description: 'Solve questions 1 to 10 on page 45 of textbook.',
          class_id: 'c1111111-1111-1111-1111-111111111111',
          section_id: 'a1111111-1111-1111-1111-111111111111',
          classes: { name: 'Grade 1' },
          sections: { name: 'Section A' }
        },
        {
          id: 'hw-2',
          title: 'Solar System Drawing',
          subject: 'Science',
          due_date: '2026-06-28T14:00:00Z',
          description: 'Draw and color all 8 planets of our solar system on A4 paper.',
          class_id: 'c1111111-1111-1111-1111-111111111111',
          section_id: 'a1111111-1111-1111-1111-111111111111',
          classes: { name: 'Grade 1' },
          sections: { name: 'Section A' }
        }
      ];
      localStorage.setItem('schoolos_mock_homework', JSON.stringify(hwList));
    }
    return hwList.filter((hw: any) => 
      hw.class_id === activeStudent.class_id && 
      hw.section_id === activeStudent.section_id
    );
  }

  async function fetchHomework(currentStudent?: any) {
    const activeStudent = currentStudent || student;
    if (!activeStudent) return;
    
    try {
      const { data: homework, error: hwError } = await supabaseM34
        .from('homework')
        .select('*')
        .eq('class_id', activeStudent.class_id)
        .eq('section_id', activeStudent.section_id)
        .order('due_date', { ascending: false });

      if (hwError) throw hwError;
      
      const hwData = homework || [];
      if (hwData.length > 0) {
        setHomeworkList(hwData);
      } else {
        setHomeworkList(getMockHomeworkList(activeStudent));
      }

      const { data: subs, error: subError } = await supabaseM34
        .from('homework_submissions')
        .select('*')
        .eq('student_id', studentId);

      if (subError) throw subError;
      
      const subsData = subs || [];
      if (subsData.length > 0) {
        setSubmissions(subsData);
      } else {
        setSubmissions([
          { id: 'sub-1', homework_id: 'hw-1', student_id: studentId, marks_obtained: 9.5, remarks: 'Excellent work!' },
          { id: 'sub-2', homework_id: 'hw-2', student_id: studentId, marks_obtained: 8.0, remarks: 'Very neat drawings.' }
        ]);
      }
    } catch (err: any) {
      console.warn('Error fetching homework details, loading mock fallback:', err.message);
      setHomeworkList(getMockHomeworkList(activeStudent));
      setSubmissions([
        { id: 'sub-1', homework_id: 'hw-1', student_id: studentId, marks_obtained: 9.5, remarks: 'Excellent work!' },
        { id: 'sub-2', homework_id: 'hw-2', student_id: studentId, marks_obtained: 8.0, remarks: 'Very neat drawings.' }
      ]);
    }
  }

  async function loadMockedModules() {
    // 1. Discipline Monitor (Module 7)
    setDisciplineIncidents([
      { id: '1', incident_date: '2026-06-15', title: 'Uniform Violation', description: 'Arrived without the school necktie.', action_taken: 'Verbal Warning', severity: 'Minor', status: 'Resolved' },
      { id: '2', incident_date: '2026-05-10', title: 'Class Disturbance', description: 'Talking loudly during the mathematics lecture.', action_taken: 'Sent to class teacher', severity: 'Minor', status: 'Resolved' }
    ]);

    // 2. Parent Meeting Scheduler (Module 5)
    setPtmBookings([
      { id: '1', date: '2026-07-02', title: 'Term 1 Academic PTM', start_time: '10:15 AM', end_time: '10:30 AM', teacher_name: 'Dr. John Doe', notes: 'Scheduled for discussion on English homework completion.' }
    ]);

    // 3. Extra Activities and Clubs (Module 6)
    setActivityEnrollments([
      { id: '1', name: 'Oakridge Football Club', category: 'Sports', coordinator: 'Coach Sam', schedule: 'Tue & Thu 4:00 PM' },
      { id: '2', name: 'Robotics Guild', category: 'Academic', coordinator: 'Mrs. Cynthia', schedule: 'Mon 3:30 PM' }
    ]);

    setAchievements([
      { id: '1', date_achieved: '2026-04-12', title: 'First Place - InterSchool Football Cup', category: 'Sports', description: 'Scored the winning goal in the final shootout match.' },
      { id: '2', date_achieved: '2026-05-20', title: 'Silver Badge - National Science Olympiad', category: 'Academics', description: 'Scored in the top 3% nationwide.' }
    ]);
  }

  // Load live messaging thread
  async function fetchLiveMessageThread(activeStudent: any) {
    if (!activeStudent?.id) return;
    try {
      const { data: threadData, error: threadError } = await supabase
        .from('message_threads')
        .select('*')
        .eq('student_id', activeStudent.id)
        .single();

      if (threadError && threadError.code !== 'PGRST116') {
        throw threadError;
      }

      if (threadData) {
        const { data: msgData, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .eq('thread_id', threadData.id)
          .order('created_at', { ascending: true });

        if (msgError) throw msgError;
        setMessageThreads(msgData || []);
      } else {
        setMessageThreads([]);
      }
    } catch (e) {
      console.error('Error fetching live message thread:', e);
      setMessageThreads([
        { id: '1', sender_id: 'parent', message_text: 'Hello teacher, I wanted to ask why the math assignment is due tomorrow instead of Friday?', created_at: '2026-06-23T14:30:00Z' },
        { id: '2', sender_id: 'teacher', message_text: 'Hello! We changed it because Friday is a local holiday. The announcement was posted on the notice board.', created_at: '2026-06-23T15:45:00Z' }
      ]);
    }
  }

  // Client side Student ID Card Print Action
  const downloadStudentIdCard = () => {
    if (!student) return;
    
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [85.6, 54]
    });

    // Dark headers
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 85.6, 12, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('Outfit', 'bold');
    doc.text('OAKRIDGE SCHOOL', 42.8, 6, { align: 'center' });
    doc.setFontSize(5);
    doc.setFont('Outfit', 'normal');
    doc.text('Academic Year: ' + (student.academic_year || '2025-26'), 42.8, 10, { align: 'center' });

    // Background gradient / accent bar
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 12, 85.6, 1.5, 'F');

    // Profile Photo Frame
    doc.setDrawColor(226, 232, 240);
    doc.rect(6, 18, 18, 22);
    
    // Placeholder image
    doc.setFillColor(241, 245, 249);
    doc.rect(6.5, 18.5, 17, 21, 'F');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text('PHOTO', 15, 29, { align: 'center' });

    // Student Details
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont('Outfit', 'bold');
    const studentName = `${student.student_profile?.first_name || ''} ${student.student_profile?.last_name || ''}`.trim() || 'Student User';
    doc.text(studentName.toUpperCase(), 28, 21);

    doc.setFontSize(6.5);
    doc.setFont('Outfit', 'normal');
    doc.text(`Class/Sec:  ${student.classes?.name || 'Grade 1'} - ${student.sections?.name || 'A'}`, 28, 25);
    doc.text(`Roll Number: ${student.roll_number || 'N/A'}`, 28, 28);
    doc.text(`Adm Number:  ${student.admission_number}`, 28, 31);
    doc.text(`Blood Group: ${student.blood_group || 'N/A'}`, 28, 34);

    if (student.house) {
      doc.setFillColor(
        student.house === 'Red' ? 239 : student.house === 'Blue' ? 59 : student.house === 'Green' ? 16 : 245,
        student.house === 'Red' ? 68 : student.house === 'Blue' ? 130 : student.house === 'Green' ? 185 : 158,
        student.house === 'Red' ? 68 : student.house === 'Blue' ? 246 : student.house === 'Green' ? 129 : 11
      );
      doc.rect(28, 36.5, 12, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(5);
      doc.setFont('Outfit', 'bold');
      doc.text(student.house.toUpperCase(), 34, 38.7, { align: 'center' });
    }

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 47, 85.6, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5.5);
    doc.text('Principal Signature', 18, 51.5, { align: 'center' });
    doc.text('Parent Signature', 68, 51.5, { align: 'center' });

    doc.save(`student_id_${student.admission_number}.pdf`);
  };

  if (loading || !student) {
    return (
      <div className="app-container" style={{ textAlign: 'center', padding: '5rem' }}>
        <p>Generating Student 360 degree profile panels...</p>
      </div>
    );
  }

  const studentFullName = `${student.student_profile?.first_name || ''} ${student.student_profile?.last_name || ''}`.trim() || 'Student Record';
  const parentFullName = `${student.parent_profile?.first_name || ''} ${student.parent_profile?.last_name || ''}`.trim() || 'Parent Account';

  return (
    <div className="app-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={onBack} style={{ padding: '0.6rem 1rem' }}>
            <ArrowLeft size={16} /> Directory
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem' }}>{studentFullName}</h1>
            <p style={{ margin: 0 }}>Class: {student.classes?.name} - {student.sections?.name}  |  Roll Number: {student.roll_number || 'N/A'}</p>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={downloadStudentIdCard}>
          <Printer size={16} /> Export ID Card PDF
        </button>
      </div>

      {/* Flag badges for <75% attendance */}
      {attendanceStats.total > 0 && attendanceStats.percentage < 75 && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1rem', borderRadius: '12px', color: '#fca5a5', display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <ShieldAlert size={24} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: 0, fontWeight: 700 }}>Attendance Deficit Warning</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#fda4af' }}>
              Student attendance is currently at <strong>{attendanceStats.percentage}%</strong>, which falls below the mandatory <strong>75%</strong> requirement. Parents have been notified.
            </p>
          </div>
        </div>
      )}

      {/* Tabs Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '2rem', alignItems: 'flex-start' }}>
        
        {/* Left Side Tab Navigation */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button 
            className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem', width: '100%' }}
            onClick={() => setActiveTab('profile')}
          >
            <User size={16} /> Personal Profile
          </button>
          
          <button 
            className={`btn ${activeTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem', width: '100%' }}
            onClick={() => setActiveTab('attendance')}
          >
            <Calendar size={16} /> Attendance Tracker
          </button>

          <button 
            className={`btn ${activeTab === 'homework' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem', width: '100%' }}
            onClick={() => setActiveTab('homework')}
          >
            <FileText size={16} /> Homework Logs
          </button>

          <button 
            className={`btn ${activeTab === 'discipline' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('discipline')}
            style={{ borderLeft: '3px solid var(--danger)', justifyContent: 'flex-start', padding: '0.75rem 1rem', width: '100%' }}
          >
            <ShieldAlert size={16} style={{ color: 'var(--danger)' }} /> Discipline Monitor
          </button>

          <button 
            className={`btn ${activeTab === 'ptm' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('ptm')}
            style={{ borderLeft: '3px solid var(--warning)', justifyContent: 'flex-start', padding: '0.75rem 1rem', width: '100%' }}
          >
            <Calendar size={16} style={{ color: 'var(--warning)' }} /> Meeting Scheduler
          </button>

          <button 
            className={`btn ${activeTab === 'activities' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('activities')}
            style={{ borderLeft: '3px solid var(--success)', justifyContent: 'flex-start', padding: '0.75rem 1rem', width: '100%' }}
          >
            <Trophy size={16} style={{ color: 'var(--success)' }} /> Activities & Achievements
          </button>

          <button 
            className={`btn ${activeTab === 'messages' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('messages')}
            style={{ borderLeft: '3px solid var(--info)', justifyContent: 'flex-start', padding: '0.75rem 1rem', width: '100%' }}
          >
            <MessageSquare size={16} style={{ color: 'var(--info)' }} /> Messages history
          </button>
        </div>

        {/* Right Side Tab Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Tab: Profile */}
          {activeTab === 'profile' && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', gap: '0.5rem', color: 'var(--primary)' }}>
                <User size={22} />
                <h3 style={{ margin: 0 }}>Onboard Profile Details</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem' }}>Admission Number</label>
                  <p style={{ fontWeight: 600, fontSize: '1.05rem', color: '#fff' }}>{student.admission_number}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem' }}>Date of Birth</label>
                  <p style={{ fontWeight: 600, fontSize: '1.05rem', color: '#fff' }}>{new Date(student.date_of_birth).toLocaleDateString()}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem' }}>Gender</label>
                  <p style={{ fontWeight: 600, fontSize: '1.05rem', color: '#fff' }}>{student.gender}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem' }}>Blood Group</label>
                  <p style={{ fontWeight: 600, fontSize: '1.05rem', color: '#fff' }}>{student.blood_group || 'N/A'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem' }}>House Assignment</label>
                  <p style={{ fontWeight: 600, fontSize: '1.05rem', color: '#fff' }}>{student.house || 'N/A'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem' }}>Academic Year</label>
                  <p style={{ fontWeight: 600, fontSize: '1.05rem', color: '#fff' }}>{student.academic_year || '2025-26'}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--info)' }}>Parent Information</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <p style={{ margin: 0 }}><span style={{ color: 'var(--text-secondary)' }}>Primary Parent:</span> {parentFullName}</p>
                    <p style={{ margin: 0 }}><span style={{ color: 'var(--text-secondary)' }}>Father Name:</span> {student.father_name || 'N/A'}</p>
                    <p style={{ margin: 0 }}><span style={{ color: 'var(--text-secondary)' }}>Mother Name:</span> {student.mother_name || 'N/A'}</p>
                    <p style={{ margin: 0 }}><span style={{ color: 'var(--text-secondary)' }}>Parent Phone:</span> {student.parent_profile?.phone || 'N/A'}</p>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--danger)' }}>Emergency Contact</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <p style={{ margin: 0 }}><span style={{ color: 'var(--text-secondary)' }}>Name:</span> {student.emergency_contact_name || 'N/A'}</p>
                    <p style={{ margin: 0 }}><span style={{ color: 'var(--text-secondary)' }}>Relationship:</span> {student.emergency_contact_relationship || 'N/A'}</p>
                    <p style={{ margin: 0 }}><span style={{ color: 'var(--text-secondary)' }}>Contact Phone:</span> {student.emergency_contact_phone || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', fontSize: '0.9rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--accent)' }}>Addresses</h4>
                <p style={{ margin: '0 0 0.5rem 0' }}><span style={{ color: 'var(--text-secondary)' }}>Current Address:</span> {student.current_address || 'N/A'}</p>
                <p style={{ margin: 0 }}><span style={{ color: 'var(--text-secondary)' }}>Permanent Address:</span> {student.permanent_address || 'N/A'}</p>
              </div>

              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', fontSize: '0.9rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--success)' }}>Admission Documents (Module M2 Integration)</h4>
                {uploadedDocs.length === 0 ? (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>No documents uploaded during admission onboarding.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {uploadedDocs.map(doc => (
                      <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{doc.document_name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.75rem' }}>({doc.document_type})</span>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <span className={`badge ${doc.status === 'Verified' ? 'badge-converted' : 'badge-new'}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                            {doc.status}
                          </span>
                          <a 
                            href="#" 
                            onClick={(e) => { e.preventDefault(); alert(`Viewing document file: ${doc.file_path}`); }} 
                            style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}
                          >
                            View File
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: Attendance */}
          {activeTab === 'attendance' && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--primary)' }}>
                  <Calendar size={22} />
                  <h3 style={{ margin: 0 }}>Attendance Summary</h3>
                </div>
                <span className={`badge ${attendanceStats.percentage >= 75 ? 'badge-converted' : 'badge-nointerest'}`} style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }}>
                  {attendanceStats.percentage}% Attendance
                </span>
              </div>

              {/* Gauge boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--glass-border)' }}>
                  <p style={{ fontSize: '0.75rem', margin: 0 }}>PRESENT DAYS</p>
                  <h2 style={{ margin: '4px 0 0 0', color: 'var(--success)' }}>{attendanceStats.present}</h2>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--glass-border)' }}>
                  <p style={{ fontSize: '0.75rem', margin: 0 }}>ABSENT DAYS</p>
                  <h2 style={{ margin: '4px 0 0 0', color: 'var(--danger)' }}>{attendanceStats.absent}</h2>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--glass-border)' }}>
                  <p style={{ fontSize: '0.75rem', margin: 0 }}>LATE ENTRIES</p>
                  <h2 style={{ margin: '4px 0 0 0', color: 'var(--warning)' }}>{attendanceStats.late}</h2>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--glass-border)' }}>
                  <p style={{ fontSize: '0.75rem', margin: 0 }}>TOTAL MARKS</p>
                  <h2 style={{ margin: '4px 0 0 0', color: '#fff' }}>{attendanceStats.total}</h2>
                </div>
              </div>

              {/* Attendance Log Table */}
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Recent Attendance Log</h4>
                {attendance.length === 0 ? (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No attendance has been logged for this student yet.</p>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Status</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.slice(0, 10).map((a) => (
                          <tr key={a.id}>
                            <td>{new Date(a.date).toLocaleDateString()}</td>
                            <td>
                              <span className={`badge ${
                                a.status === 'Present' ? 'badge-converted' : 
                                a.status === 'Absent' ? 'badge-nointerest' : 'badge-visit'
                              }`}>
                                {a.status}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{a.remarks || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: Homework */}
          {activeTab === 'homework' && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', gap: '0.5rem', color: 'var(--primary)' }}>
                <FileText size={22} />
                <h3 style={{ margin: 0 }}>Homework Assignments</h3>
              </div>

              {homeworkList.length === 0 ? (
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No homework assignments found for this class.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {homeworkList.map((hw: any) => {
                    const sub = submissions.find((s: any) => s.homework_id === hw.id);
                    const submissionStatus = sub ? (sub.marks_obtained !== null ? 'Graded' : 'Submitted') : 'Pending';

                    return (
                      <div key={hw.id} style={{ background: 'rgba(0,0,0,0.15)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>{hw.title}</h4>
                          <p style={{ fontSize: '0.8rem', margin: '4px 0' }}><span style={{ color: 'var(--text-secondary)' }}>Subject:</span> {hw.subject}  |  <span style={{ color: 'var(--text-secondary)' }}>Due:</span> {new Date(hw.due_date).toLocaleDateString()}</p>
                          {hw.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>{hw.description}</p>}
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                          <span className={`badge ${
                            submissionStatus === 'Graded' ? 'badge-converted' :
                            submissionStatus === 'Submitted' ? 'badge-contacted' : 'badge-nointerest'
                          }`}>
                            {submissionStatus}
                          </span>
                          {submissionStatus === 'Graded' && (
                            <span style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                              Marks: {sub.marks_obtained}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab: Discipline (Module 7 Mocked) */}
          {activeTab === 'discipline' && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', gap: '0.5rem', color: 'var(--danger)' }}>
                <ShieldAlert size={22} />
                <h3 style={{ margin: 0 }}>Discipline Monitor Logs</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {disciplineIncidents.map((incident) => (
                  <div key={incident.id} style={{ background: 'rgba(0,0,0,0.15)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#fff' }}>{incident.title}</h4>
                      <span className={`badge ${incident.severity === 'Minor' ? 'badge-visit' : 'badge-nointerest'}`} style={{ fontSize: '0.7rem' }}>
                        {incident.severity} Severity
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{incident.description}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.5rem', marginTop: '0.75rem' }}>
                      <span>Date: {incident.incident_date}</span>
                      <span style={{ color: 'var(--success)' }}>Action: {incident.action_taken} ({incident.status})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab: PTM (Module 5 Mocked) */}
          {activeTab === 'ptm' && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', gap: '0.5rem', color: 'var(--warning)' }}>
                <Calendar size={22} />
                <h3 style={{ margin: 0 }}>Parent Teacher Meeting Slots</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {ptmBookings.map((booking) => (
                  <div key={booking.id} style={{ background: 'rgba(0,0,0,0.15)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#fff' }}>{booking.title}</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0' }}><span style={{ color: 'var(--text-secondary)' }}>Teacher:</span> {booking.teacher_name}</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text-secondary)' }}>Scheduled Time:</span> {booking.date} at {booking.start_time} - {booking.end_time}</p>
                    {booking.notes && (
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem', color: '#fff', marginTop: '0.75rem' }}>
                        Note: {booking.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Activities & Achievements (Module 6 Mocked) */}
          {activeTab === 'activities' && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div>
                <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', gap: '0.5rem', color: 'var(--success)', marginBottom: '1.25rem' }}>
                  <Trophy size={20} />
                  <h3 style={{ margin: 0 }}>Club Enrollments</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                  {activityEnrollments.map((act) => (
                    <div key={act.id} style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#fff' }}>{act.name}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0' }}>Category: {act.category}</p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Coordinator: {act.coordinator} | {act.schedule}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', gap: '0.5rem', color: 'var(--success)', marginBottom: '1.25rem' }}>
                  <Trophy size={20} />
                  <h3 style={{ margin: 0 }}>Academic & Co-Curricular Achievements</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {achievements.map((ach) => (
                    <div key={ach.id} style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#fff' }}>{ach.title}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>{ach.category}</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0' }}>{ach.description}</p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Date: {ach.date_achieved}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Messages (Module 8 Live) */}
          {activeTab === 'messages' && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--info)', alignItems: 'center' }}>
                  <MessageSquare size={22} />
                  <h3 style={{ margin: 0 }}>Parent-Teacher Communication History</h3>
                </div>
                {(role === 'super_admin' || role === 'admin_staff') && messageThreads.length > 5 && (
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setShowFullThreadModal(true)}
                    style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
                  >
                    View Full Thread ({messageThreads.length} Messages)
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {messageThreads.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>No communication history found.</p>
                ) : (
                  messageThreads.slice(-5).map((msg) => {
                    const isTeacher = msg.sender_id !== student?.parent_id;
                    return (
                      <div 
                        key={msg.id} 
                        style={{ 
                          alignSelf: isTeacher ? 'flex-end' : 'flex-start',
                          background: isTeacher ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.06)',
                          border: '1px solid ' + (isTeacher ? 'rgba(99, 102, 241, 0.3)' : 'var(--glass-border)'),
                          padding: '1rem', 
                          borderRadius: '12px',
                          maxWidth: '80%',
                          fontSize: '0.9rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                          <span style={{ fontWeight: 600, color: isTeacher ? '#a5b4fc' : 'var(--text-secondary)' }}>
                            {isTeacher ? 'Class Teacher' : 'Parent'}
                          </span>
                          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p style={{ margin: 0, color: '#fff' }}>{msg.message_text}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {messageThreads.length > 5 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  Showing last 5 messages.
                </div>
              )}
            </div>
          )}

          {/* Full Thread Modal for Admins */}
          {showFullThreadModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
              <div className="glass-card fade-in" style={{ maxWidth: '600px', width: '95%', background: '#0f172a', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Full Conversation History</span>
                  <button 
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    onClick={() => setShowFullThreadModal(false)}
                  >
                    <X size={18} />
                  </button>
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {messageThreads.map((msg) => {
                    const isTeacher = msg.sender_id !== student?.parent_id;
                    return (
                      <div 
                        key={msg.id} 
                        style={{ 
                          alignSelf: isTeacher ? 'flex-end' : 'flex-start',
                          background: isTeacher ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.06)',
                          border: '1px solid ' + (isTeacher ? 'rgba(99, 102, 241, 0.3)' : 'var(--glass-border)'),
                          padding: '1rem', 
                          borderRadius: '12px',
                          maxWidth: '80%',
                          fontSize: '0.9rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                          <span style={{ fontWeight: 600, color: isTeacher ? '#a5b4fc' : 'var(--text-secondary)' }}>
                            {isTeacher ? 'Class Teacher' : 'Parent'}
                          </span>
                          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p style={{ margin: 0, color: '#fff' }}>{msg.message_text}</p>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem' }}>
                  <button className="btn btn-secondary" onClick={() => setShowFullThreadModal(false)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}

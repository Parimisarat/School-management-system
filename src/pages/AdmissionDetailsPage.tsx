import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeft, Save, User, Phone, BookOpen, Clock, FileText, CheckCircle2, AlertTriangle, Trash2, Check, Upload, Eye, Printer } from 'lucide-react';

interface AdmissionDetailsPageProps {
  admissionId?: string;
  isEdit?: boolean;
  onBack: () => void;
}

const REQUIRED_DOCUMENTS = [
  'Birth Certificate',
  'Transfer Certificate',
  'Student Aadhaar',
  'Parent Aadhaar',
  'Student Photograph',
  'Medical Certificate'
];

const OPTIONAL_DOCUMENTS = [
  'Caste Certificate'
];

export default function AdmissionDetailsPage({ admissionId, isEdit = false, onBack }: AdmissionDetailsPageProps) {
  const isNew = !admissionId;
  const [editing, setEditing] = useState(isEdit || isNew);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState('11111111-1111-1111-1111-111111111111');
  const [staffName, setStaffName] = useState('Super Admin');
  const [currentUserId, setCurrentUserId] = useState<string>('00000000-0000-0000-0000-000000000000');
  const [isSuperAdmin, setIsSuperAdmin] = useState(true);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [bloodGroup, setBloodGroup] = useState('');
  const [nationality, setNationality] = useState('Indian');
  const [religion, setReligion] = useState('');
  const [motherTongue, setMotherTongue] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');

  // Parent Info
  const [parentName, setParentName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');

  // Address
  const [currentAddress, setCurrentAddress] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [sameAsCurrent, setSameAsCurrent] = useState(false);

  // Academic Info
  const [previousSchool, setPreviousSchool] = useState('');
  const [previousClass, setPreviousClass] = useState('');
  const [percentageGrade, setPercentageGrade] = useState('');
  const [gradeApplied, setGradeApplied] = useState('');

  // Emergency Contact
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  // Metadata / Logs / Status
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [status, setStatus] = useState('Draft');
  const [createdAt, setCreatedAt] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [enquiryId, setEnquiryId] = useState<string | null>(null);
  
  // Custom Arrays
  const [reviewNotes, setReviewNotes] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);

  // Local Interaction State
  const [newNoteText, setNewNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [showStatusModal, setShowStatusModal] = useState<{ show: boolean, targetStatus: string }>({ show: false, targetStatus: '' });

  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchClasses();
      await fetchCurrentStaff();
      if (!isNew) {
        await fetchAdmissionDetails();
      } else {
        setCreatedAt(new Date().toISOString());
        setLoading(false);
      }
    }
    init();
  }, [admissionId]);

  async function fetchClasses() {
    const { data } = await supabase.from('classes').select('id, name');
    if (data) setClasses(data);
  }

  async function fetchCurrentStaff() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, school_id')
          .eq('id', user.id)
          .single();
        if (profile) {
          setStaffName(`${profile.first_name} ${profile.last_name}`);
          setSchoolId(profile.school_id);
        }
        
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('profile_id', user.id);
        if (roles) {
          const isSuper = roles.some(r => r.role === 'super_admin');
          setIsSuperAdmin(isSuper);
        }
      }
    } catch (e) {
      console.warn('Fallback to default auth values.');
    }
  }

  async function fetchAdmissionDetails() {
    try {
      const { data, error } = await supabase
        .from('admissions')
        .select('*')
        .eq('id', admissionId)
        .single();
      
      if (error) throw error;

      if (data) {
        setSchoolId(data.school_id);
        setEnquiryId(data.enquiry_id);
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setDob(data.date_of_birth || '');
        setGender(data.gender || 'Male');
        setBloodGroup(data.blood_group || '');
        setNationality(data.nationality || 'Indian');
        setReligion(data.religion || '');
        setMotherTongue(data.mother_tongue || '');
        setAadhaarNumber(data.aadhaar_number || '');

        setParentName(data.parent_name || '');
        setFatherName(data.father_name || '');
        setMotherName(data.mother_name || '');
        setOccupation(data.occupation || '');
        setParentPhone(data.parent_phone || '');
        setAlternatePhone(data.alternate_phone || '');
        setParentEmail(data.parent_email || '');

        setCurrentAddress(data.current_address || '');
        setPermanentAddress(data.permanent_address || '');
        setSameAsCurrent(data.current_address === data.permanent_address && !!data.current_address);

        setPreviousSchool(data.previous_school || '');
        setPreviousClass(data.previous_class || '');
        setPercentageGrade(data.percentage_grade || '');
        setGradeApplied(data.grade_applied || '');

        setEmergencyContactName(data.emergency_contact_name || '');
        setEmergencyContactRelationship(data.emergency_contact_relationship || '');
        setEmergencyContactPhone(data.emergency_contact_phone || '');

        setAdmissionNumber(data.admission_number || '');
        setStatus(data.status || 'Draft');
        setCreatedAt(data.created_at || '');
        setUpdatedAt(data.updated_at || '');

        setReviewNotes(data.review_notes || []);
        setActivityLog(data.activity_log || []);

        await fetchDocuments();
      }
    } catch (err: any) {
      console.error('Error fetching admission details:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDocuments() {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('admission_id', admissionId);
    if (!error && data) {
      setUploadedDocs(data);
    }
  }

  const handleSameAsCurrentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSameAsCurrent(e.target.checked);
    if (e.target.checked) {
      setPermanentAddress(currentAddress);
    }
  };

  // Validations
  const validateForm = () => {
    if (!firstName.trim() || !lastName.trim()) {
      alert('Student First and Last Name are required.');
      return false;
    }
    if (!parentName.trim()) {
      alert('Parent Name is required.');
      return false;
    }
    if (!parentPhone.trim()) {
      alert('Parent Phone Number is required.');
      return false;
    }
    if (!gradeApplied) {
      alert('Applying Class is required.');
      return false;
    }

    // Email format validation
    if (parentEmail && !/\S+@\S+\.\S+/.test(parentEmail)) {
      alert('Invalid parent email format.');
      return false;
    }

    // Aadhaar number validation (exactly 12 digits)
    if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) {
      alert('Aadhaar Number must be exactly 12 digits.');
      return false;
    }

    return true;
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    const logEvent = (evtText: string) => {
      const newLog = {
        event: evtText,
        timestamp: new Date().toISOString(),
        staff: staffName,
        description: `${evtText} by ${staffName}`
      };
      return [...activityLog, newLog];
    };

    const isRecordCreating = isNew;
    const currentActivityLog = isRecordCreating 
      ? [{ event: 'Admission Created', timestamp: new Date().toISOString(), staff: staffName, description: 'Admission record manually created.' }]
      : logEvent('Admission Details Updated');

    const updatePayload = {
      school_id: schoolId,
      enquiry_id: enquiryId,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dob || new Date().toISOString().split('T')[0],
      gender,
      blood_group: bloodGroup,
      nationality,
      religion,
      mother_tongue: motherTongue,
      aadhaar_number: aadhaarNumber,
      parent_name: parentName,
      father_name: fatherName,
      mother_name: motherName,
      occupation,
      parent_phone: parentPhone,
      alternate_phone: alternatePhone,
      parent_email: parentEmail,
      current_address: currentAddress,
      permanent_address: sameAsCurrent ? currentAddress : permanentAddress,
      previous_school: previousSchool,
      previous_class: previousClass,
      percentage_grade: percentageGrade,
      grade_applied: gradeApplied,
      emergency_contact_name: emergencyContactName,
      emergency_contact_relationship: emergencyContactRelationship,
      emergency_contact_phone: emergencyContactPhone,
      status,
      activity_log: currentActivityLog,
      updated_at: new Date().toISOString()
    };

    try {
      if (isNew) {
        const { data, error } = await supabase
          .from('admissions')
          .insert([updatePayload])
          .select()
          .single();
        if (error) throw error;
        alert('Admission record created successfully!');
        if (data?.id) {
          window.location.hash = `#/admissions/${data.id}`;
        }
      } else {
        const { error } = await supabase
          .from('admissions')
          .update(updatePayload)
          .eq('id', admissionId);
        if (error) throw error;
        setActivityLog(currentActivityLog);
        alert('Admission record saved successfully!');
        setEditing(false);
        fetchAdmissionDetails();
      }
    } catch (err: any) {
      alert(`Error saving admission: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Add Review Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    setSavingNote(true);

    const noteObj = {
      staff: staffName,
      timestamp: new Date().toISOString(),
      note: newNoteText.trim()
    };

    const updatedNotes = [...reviewNotes, noteObj];
    const updatedTimeline = [
      ...activityLog,
      {
        event: 'Review Note Added',
        timestamp: new Date().toISOString(),
        staff: staffName,
        description: `Review note added: "${newNoteText.trim().substring(0, 30)}..."`
      }
    ];

    try {
      const { error } = await supabase
        .from('admissions')
        .update({
          review_notes: updatedNotes,
          activity_log: updatedTimeline,
          updated_at: new Date().toISOString()
        })
        .eq('id', admissionId);

      if (error) throw error;

      setReviewNotes(updatedNotes);
      setActivityLog(updatedTimeline);
      setNewNoteText('');
    } catch (err: any) {
      alert(`Error adding note: ${err.message}`);
    } finally {
      setSavingNote(false);
    }
  };

  // Document management (upload/delete/verify)
  const handleDocumentUpload = async (docName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate progress
    setUploadProgress(prev => ({ ...prev, [docName]: 10 }));
    let progress = 10;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 20) + 10;
      if (progress >= 90) {
        clearInterval(interval);
        setUploadProgress(prev => ({ ...prev, [docName]: 90 }));
      } else {
        setUploadProgress(prev => ({ ...prev, [docName]: progress }));
      }
    }, 150);

    try {
      // 1. Upload to storage
      const fileExt = file.name.split('.').pop();
      const storagePath = `${admissionId}/${docName.replace(/\s+/g, '_')}_${Date.now()}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, { cacheControl: '3600', upsert: true });

      if (uploadErr) throw uploadErr;

      clearInterval(interval);
      setUploadProgress(prev => ({ ...prev, [docName]: 100 }));

      // Check if document record already exists
      const existingDoc = uploadedDocs.find(d => d.document_name === docName);

      if (existingDoc) {
        // Update document path
        const { error: dbErr } = await supabase
          .from('documents')
          .update({
            file_path: storagePath,
            document_type: file.type,
            status: 'Uploaded',
            created_at: new Date().toISOString()
          })
          .eq('id', existingDoc.id);
        if (dbErr) throw dbErr;
      } else {
        // Insert new document record
        const { error: dbErr } = await supabase
          .from('documents')
          .insert([
            {
              school_id: schoolId,
              admission_id: admissionId,
              document_name: docName,
              document_type: file.type,
              file_path: storagePath,
              uploaded_by: currentUserId || '00000000-0000-0000-0000-000000000000',
              status: 'Uploaded'
            }
          ]);
        if (dbErr) throw dbErr;
      }

      // Add timeline event
      const updatedTimeline = [
        ...activityLog,
        {
          event: 'Document Uploaded',
          timestamp: new Date().toISOString(),
          staff: staffName,
          description: `${docName} successfully uploaded.`
        }
      ];

      await supabase
        .from('admissions')
        .update({
          activity_log: updatedTimeline,
          updated_at: new Date().toISOString()
        })
        .eq('id', admissionId);

      setActivityLog(updatedTimeline);
      await fetchDocuments();
      setTimeout(() => {
        setUploadProgress(prev => {
          const copy = { ...prev };
          delete copy[docName];
          return copy;
        });
      }, 1000);
    } catch (err: any) {
      clearInterval(interval);
      setUploadProgress(prev => ({ ...prev, [docName]: 0 }));
      alert(`Upload failed: ${err.message}`);
    }
  };

  const handleDocumentDelete = async (doc: any) => {
    if (!confirm(`Are you sure you want to delete the uploaded file for ${doc.document_name}?`)) return;

    try {
      // Delete from storage
      const { error: storageErr } = await supabase.storage
        .from('documents')
        .remove([doc.file_path]);

      if (storageErr) console.warn('Could not delete file from bucket storage directly:', storageErr.message);

      // Delete database record
      const { error: dbErr } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (dbErr) throw dbErr;

      // Add timeline event
      const updatedTimeline = [
        ...activityLog,
        {
          event: 'Document Deleted',
          timestamp: new Date().toISOString(),
          staff: staffName,
          description: `${doc.document_name} deleted.`
        }
      ];

      await supabase
        .from('admissions')
        .update({
          activity_log: updatedTimeline,
          updated_at: new Date().toISOString()
        })
        .eq('id', admissionId);

      setActivityLog(updatedTimeline);
      await fetchDocuments();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleDocumentVerify = async (doc: any) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ status: 'Verified' })
        .eq('id', doc.id);

      if (error) throw error;

      // Add timeline event
      const updatedTimeline = [
        ...activityLog,
        {
          event: 'Document Verified',
          timestamp: new Date().toISOString(),
          staff: staffName,
          description: `${doc.document_name} verified by ${staffName}.`
        }
      ];

      await supabase
        .from('admissions')
        .update({
          activity_log: updatedTimeline,
          updated_at: new Date().toISOString()
        })
        .eq('id', admissionId);

      setActivityLog(updatedTimeline);
      await fetchDocuments();
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    }
  };

  // Workflow transitions (Approve / Reject / Submit)
  const handleWorkflowChange = async (targetStatus: string) => {
    setShowStatusModal({ show: false, targetStatus: '' });

    // Validate requirements before approval
    if (targetStatus === 'Approved') {
      // 1. Validate fields first
      if (!validateForm()) return;

      // 2. Validate all required documents are uploaded/verified
      const missingDocs = REQUIRED_DOCUMENTS.filter(reqName => {
        const docRecord = uploadedDocs.find(d => d.document_name === reqName);
        return !docRecord || docRecord.status === 'Pending';
      });

      if (missingDocs.length > 0) {
        alert(`Cannot approve admission. The following required documents are missing or pending upload:\n- ${missingDocs.join('\n- ')}`);
        return;
      }
    }

    setSaving(true);
    try {
      let generatedAdmissionNumber = admissionNumber;
      const timelineEvents = [...activityLog];

      if (targetStatus === 'Approved' && !admissionNumber) {
        // Generate Admission Number sequential format: ADM-YYYY-00001
        const year = new Date().getFullYear();
        const prefix = `ADM-${year}-`;
        
        // Fetch last admission number
        const { data: lastAdmissions } = await supabase
          .from('admissions')
          .select('admission_number')
          .like('admission_number', `${prefix}%`)
          .order('admission_number', { ascending: false })
          .limit(1);

        let nextNum = 1;
        if (lastAdmissions && lastAdmissions.length > 0 && lastAdmissions[0].admission_number) {
          const parts = lastAdmissions[0].admission_number.split('-');
          const lastSeq = parseInt(parts[2], 10);
          if (!isNaN(lastSeq)) {
            nextNum = lastSeq + 1;
          }
        }
        generatedAdmissionNumber = `${prefix}${String(nextNum).padStart(5, '0')}`;
        setAdmissionNumber(generatedAdmissionNumber);
        
        timelineEvents.push({
          event: 'Admission Approved',
          timestamp: new Date().toISOString(),
          staff: staffName,
          description: `Admission approved and Admission Number generated: ${generatedAdmissionNumber}`
        });
      } else if (targetStatus === 'Rejected') {
        timelineEvents.push({
          event: 'Admission Rejected',
          timestamp: new Date().toISOString(),
          staff: staffName,
          description: `Admission rejected by ${staffName}.`
        });
      } else {
        timelineEvents.push({
          event: 'Status Changed',
          timestamp: new Date().toISOString(),
          staff: staffName,
          description: `Status transitioned from "${status}" to "${targetStatus}"`
        });
      }

      const updatePayload: any = {
        status: targetStatus,
        admission_number: generatedAdmissionNumber,
        activity_log: timelineEvents,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('admissions')
        .update(updatePayload)
        .eq('id', admissionId);

      if (error) throw error;

      // If we approved, let's mark the linked enquiry status as Converted as well (if it exists)
      if (targetStatus === 'Approved' && enquiryId) {
        await supabase
          .from('enquiries')
          .update({ status: 'Converted' })
          .eq('id', enquiryId);
      }

      setStatus(targetStatus);
      setActivityLog(timelineEvents);
      alert(`Admission workflow status transitioned to ${targetStatus}!`);
      
      // Reload details
      fetchAdmissionDetails();
    } catch (err: any) {
      alert(`Workflow transition failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getPreviewUrl = (filePath: string) => {
    const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
    return data?.publicUrl || '#';
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

  // Lock editing of admission data (except by Super Admin) when Approved
  const isLocked = status === 'Approved' && !isSuperAdmin;

  if (loading) {
    return (
      <div className="app-container" style={{ textAlign: 'center', padding: '5rem' }}>
        <p>Loading admission record panels...</p>
      </div>
    );
  }

  return (
    <div className="app-container fade-in print-area">
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }
          header, .no-print, button, input:not([value]), select:not([value]), textarea:not([value]) {
            display: none !important;
          }
          .print-area {
            background: #fff !important;
            color: #000 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .glass-card {
            background: none !important;
            border: none !important;
            box-shadow: none !important;
            padding: 1rem 0 !important;
            color: #000 !important;
          }
          input, select, textarea {
            background: none !important;
            border: none !important;
            border-bottom: 1px solid #ccc !important;
            color: #000 !important;
            padding: 4px 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          h1, h2, h3, label {
            color: #000 !important;
            background: none !important;
            -webkit-text-fill-color: initial !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={onBack} style={{ padding: '0.6rem 1rem' }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 style={{ margin: 0, fontSize: '2rem' }}>
                {isNew ? 'New Admission Draft' : (admissionNumber || 'DRAFT')}
              </h1>
              <span className={`badge ${getStatusBadgeClass(status)}`} style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}>
                {status}
              </span>
            </div>
            {!isNew && (
              <p style={{ fontSize: '0.85rem' }}>
                Created: {new Date(createdAt).toLocaleString()} {updatedAt && `| Last Updated: ${new Date(updatedAt).toLocaleString()}`}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {status !== 'Approved' && !isNew && (
            <>
              {editing ? (
                <button className="btn btn-primary" onClick={() => handleSave()} disabled={saving}>
                  <Save size={16} /> Save Changes
                </button>
              ) : (
                <button className="btn btn-secondary" onClick={() => setEditing(true)}>
                  Edit Admission
                </button>
              )}

              {status === 'Draft' && (
                <button className="btn btn-primary" style={{ background: 'var(--info)' }} onClick={() => handleWorkflowChange('Submitted')}>
                  Submit for Review
                </button>
              )}
            </>
          )}

          {!isNew && (
            <>
              {status !== 'Approved' && (
                <button 
                  className="btn btn-primary" 
                  style={{ background: 'var(--success)' }} 
                  onClick={() => setShowStatusModal({ show: true, targetStatus: 'Approved' })}
                >
                  <CheckCircle2 size={16} /> Approve
                </button>
              )}
              {status !== 'Rejected' && status !== 'Approved' && (
                <button 
                  className="btn btn-danger" 
                  onClick={() => setShowStatusModal({ show: true, targetStatus: 'Rejected' })}
                >
                  Reject
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={16} /> Print / Save PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Form Fields */}
      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          
          {/* Student Info Card */}
          <div className="glass-card">
            <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
              <User size={20} />
              <h3 style={{ margin: 0 }}>Student Information</h3>
            </div>
            
            <div className="form-group">
              <label>First Name *</label>
              <input 
                type="text" 
                value={firstName} 
                onChange={(e) => setFirstName(e.target.value)} 
                disabled={!editing || isLocked}
                required 
              />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input 
                type="text" 
                value={lastName} 
                onChange={(e) => setLastName(e.target.value)} 
                disabled={!editing || isLocked}
                required 
              />
            </div>
            <div className="form-group">
              <label>Date of Birth *</label>
              <input 
                type="date" 
                value={dob} 
                onChange={(e) => setDob(e.target.value)} 
                disabled={!editing || isLocked}
                required 
              />
            </div>
            <div className="form-group">
              <label>Gender</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)} disabled={!editing || isLocked}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Blood Group</label>
              <input 
                type="text" 
                placeholder="e.g. O+ve" 
                value={bloodGroup} 
                onChange={(e) => setBloodGroup(e.target.value)} 
                disabled={!editing || isLocked} 
              />
            </div>
            <div className="form-group">
              <label>Nationality</label>
              <input 
                type="text" 
                value={nationality} 
                onChange={(e) => setNationality(e.target.value)} 
                disabled={!editing || isLocked} 
              />
            </div>
            <div className="form-group">
              <label>Religion</label>
              <input 
                type="text" 
                value={religion} 
                onChange={(e) => setReligion(e.target.value)} 
                disabled={!editing || isLocked} 
              />
            </div>
            <div className="form-group">
              <label>Mother Tongue</label>
              <input 
                type="text" 
                value={motherTongue} 
                onChange={(e) => setMotherTongue(e.target.value)} 
                disabled={!editing || isLocked} 
              />
            </div>
            <div className="form-group">
              <label>Aadhaar Number</label>
              <input 
                type="text" 
                maxLength={12} 
                placeholder="12 digit Aadhaar" 
                value={aadhaarNumber} 
                onChange={(e) => setAadhaarNumber(e.target.value)} 
                disabled={!editing || isLocked} 
              />
            </div>
          </div>

          {/* Parent Info Card */}
          <div className="glass-card">
            <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--info)' }}>
              <Phone size={20} />
              <h3 style={{ margin: 0 }}>Parent Information</h3>
            </div>
            
            <div className="form-group">
              <label>Primary Parent Name *</label>
              <input 
                type="text" 
                value={parentName} 
                onChange={(e) => setParentName(e.target.value)} 
                disabled={!editing || isLocked}
                required 
              />
            </div>
            <div className="form-group">
              <label>Father Name</label>
              <input 
                type="text" 
                value={fatherName} 
                onChange={(e) => setFatherName(e.target.value)} 
                disabled={!editing || isLocked} 
              />
            </div>
            <div className="form-group">
              <label>Mother Name</label>
              <input 
                type="text" 
                value={motherName} 
                onChange={(e) => setMotherName(e.target.value)} 
                disabled={!editing || isLocked} 
              />
            </div>
            <div className="form-group">
              <label>Occupation</label>
              <input 
                type="text" 
                value={occupation} 
                onChange={(e) => setOccupation(e.target.value)} 
                disabled={!editing || isLocked} 
              />
            </div>
            <div className="form-group">
              <label>Phone Number *</label>
              <input 
                type="tel" 
                value={parentPhone} 
                onChange={(e) => setParentPhone(e.target.value)} 
                disabled={!editing || isLocked}
                required 
              />
            </div>
            <div className="form-group">
              <label>Alternate Phone</label>
              <input 
                type="tel" 
                value={alternatePhone} 
                onChange={(e) => setAlternatePhone(e.target.value)} 
                disabled={!editing || isLocked} 
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                value={parentEmail} 
                onChange={(e) => setParentEmail(e.target.value)} 
                disabled={!editing || isLocked} 
              />
            </div>
          </div>

          {/* Address & Academic Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Address */}
            <div>
              <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}>
                <BookOpen size={20} />
                <h3 style={{ margin: 0 }}>Addresses</h3>
              </div>
              <div className="form-group">
                <label>Current Address</label>
                <textarea 
                  value={currentAddress} 
                  onChange={(e) => setCurrentAddress(e.target.value)} 
                  disabled={!editing || isLocked}
                  style={{ minHeight: '60px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }} className="no-print">
                <input 
                  type="checkbox" 
                  id="sameAsCurrent" 
                  checked={sameAsCurrent} 
                  onChange={handleSameAsCurrentChange} 
                  disabled={!editing || isLocked}
                  style={{ width: 'auto' }}
                />
                <label htmlFor="sameAsCurrent" style={{ margin: 0, textTransform: 'none', cursor: 'pointer' }}>Permanent Address same as Current</label>
              </div>
              {!sameAsCurrent && (
                <div className="form-group">
                  <label>Permanent Address</label>
                  <textarea 
                    value={permanentAddress} 
                    onChange={(e) => setPermanentAddress(e.target.value)} 
                    disabled={!editing || isLocked}
                    style={{ minHeight: '60px' }}
                  />
                </div>
              )}
            </div>

            {/* Academics */}
            <div>
              <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
                <BookOpen size={20} />
                <h3 style={{ margin: 0 }}>Academic Information</h3>
              </div>
              <div className="form-group">
                <label>Applying Class *</label>
                <select value={gradeApplied} onChange={(e) => setGradeApplied(e.target.value)} disabled={!editing || isLocked} required>
                  <option value="">Select Class</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Previous School</label>
                <input 
                  type="text" 
                  value={previousSchool} 
                  onChange={(e) => setPreviousSchool(e.target.value)} 
                  disabled={!editing || isLocked} 
                />
              </div>
              <div className="form-group">
                <label>Previous Class</label>
                <input 
                  type="text" 
                  value={previousClass} 
                  onChange={(e) => setPreviousClass(e.target.value)} 
                  disabled={!editing || isLocked} 
                />
              </div>
              <div className="form-group">
                <label>Percentage / Grade obtained</label>
                <input 
                  type="text" 
                  value={percentageGrade} 
                  onChange={(e) => setPercentageGrade(e.target.value)} 
                  disabled={!editing || isLocked} 
                />
              </div>
            </div>

            {/* Emergency Contacts */}
            <div>
              <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
                <Phone size={20} />
                <h3 style={{ margin: 0 }}>Emergency Contact</h3>
              </div>
              <div className="form-group">
                <label>Contact Name</label>
                <input 
                  type="text" 
                  value={emergencyContactName} 
                  onChange={(e) => setEmergencyContactName(e.target.value)} 
                  disabled={!editing || isLocked} 
                />
              </div>
              <div className="form-group">
                <label>Relationship</label>
                <input 
                  type="text" 
                  value={emergencyContactRelationship} 
                  onChange={(e) => setEmergencyContactRelationship(e.target.value)} 
                  disabled={!editing || isLocked} 
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input 
                  type="tel" 
                  value={emergencyContactPhone} 
                  onChange={(e) => setEmergencyContactPhone(e.target.value)} 
                  disabled={!editing || isLocked} 
                />
              </div>
            </div>

          </div>
        </div>

        {/* Save button for creation mode */}
        {isNew && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.8rem 2.5rem' }} disabled={saving}>
              Create Admission Draft
            </button>
          </div>
        )}
      </form>

      {/* Documents, Notes, Timeline Split (Visible only on existing Admission records) */}
      {!isNew && (
        <>
          {/* Documents Section */}
          <div className="glass-card" style={{ marginBottom: '2.5rem' }}>
            <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
              <FileText size={20} />
              <h3 style={{ margin: 0 }}>Document Verification Panel</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {[...REQUIRED_DOCUMENTS, ...OPTIONAL_DOCUMENTS].map((docName) => {
                const docObj = uploadedDocs.find(d => d.document_name === docName);
                const isRequired = REQUIRED_DOCUMENTS.includes(docName);
                const isUploading = uploadProgress[docName] !== undefined;

                return (
                  <div key={docName} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', background: 'rgba(15, 23, 42, 0.4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{docName}</h4>
                        <span style={{ fontSize: '0.7rem', color: isRequired ? 'var(--danger)' : 'var(--text-secondary)' }}>
                          {isRequired ? 'REQUIRED' : 'OPTIONAL'}
                        </span>
                      </div>
                      
                      {docObj ? (
                        <span className={`badge ${docObj.status === 'Verified' ? 'badge-converted' : 'badge-visit'}`}>
                          {docObj.status}
                        </span>
                      ) : (
                        <span className="badge badge-new">Pending</span>
                      )}
                    </div>

                    {isUploading ? (
                      <div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${uploadProgress[docName]}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.1s linear' }}></div>
                        </div>
                        <p style={{ fontSize: '0.7rem', marginTop: '4px', textAlign: 'right' }}>Uploading: {uploadProgress[docName]}%</p>
                      </div>
                    ) : docObj ? (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', flexWrap: 'wrap' }} className="no-print">
                        <a 
                          href={getPreviewUrl(docObj.file_path)} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="btn btn-secondary" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        >
                          <Eye size={12} /> Preview
                        </a>
                        
                        {docObj.status !== 'Verified' && (
                          <button 
                            className="btn btn-primary" 
                            style={{ background: 'var(--success)', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => handleDocumentVerify(docObj)}
                          >
                            <Check size={12} /> Verify
                          </button>
                        )}

                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', position: 'relative' }}
                        >
                          <Upload size={12} /> Replace
                          <input 
                            type="file" 
                            accept="image/*,application/pdf"
                            onChange={(e) => handleDocumentUpload(docName, e)}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                          />
                        </button>

                        <button 
                          className="btn btn-secondary" 
                          style={{ color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => handleDocumentDelete(docObj)}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    ) : (
                      <div className="no-print" style={{ marginTop: 'auto' }}>
                        <button className="btn btn-secondary" style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', position: 'relative' }}>
                          <Upload size={14} /> Upload File
                          <input 
                            type="file" 
                            accept="image/*,application/pdf"
                            onChange={(e) => handleDocumentUpload(docName, e)}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                          />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes & Timeline */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
            
            {/* Review Notes */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0 }}>Review Notes</h3>
              </div>

              <form onSubmit={handleAddNote} className="no-print">
                <div className="form-group">
                  <label>Add Note</label>
                  <textarea
                    placeholder="Enter review findings or action logs..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    style={{ minHeight: '80px' }}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={savingNote}>
                  Save Note
                </button>
              </form>

              <div>
                <label>Notes History</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto' }}>
                  {reviewNotes.length === 0 ? (
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No review notes have been saved yet.</p>
                  ) : (
                    reviewNotes.map((n, idx) => (
                      <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                          <span>{n.staff}</span>
                          <span>{new Date(n.timestamp).toLocaleString()}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#f8fafc', whiteSpace: 'pre-wrap' }}>{n.note}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Chronological Activity Timeline */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={20} style={{ color: 'var(--info)' }} />
                <h3 style={{ margin: 0 }}>Chronological Activity Timeline</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', paddingLeft: '1.25rem', borderLeft: '2px solid var(--glass-border)', marginLeft: '0.5rem', maxHeight: '550px', overflowY: 'auto' }}>
                {activityLog.length === 0 ? (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No actions logged yet.</p>
                ) : (
                  activityLog.map((evt, index) => (
                    <div key={index} style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-25px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: evt.event.includes('Approved') ? 'var(--success)' : evt.event.includes('Rejected') ? 'var(--danger)' : 'var(--primary)', border: '3px solid #0f172a' }}></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {new Date(evt.timestamp).toLocaleString()}
                        </span>
                        {evt.staff && (
                          <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                            By {evt.staff}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.95rem', color: '#fff', margin: 0, fontWeight: 600 }}>{evt.event}</p>
                      {evt.description && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>{evt.description}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </>
      )}

      {/* Confirmation Modal */}
      {showStatusModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="glass-card fade-in" style={{ maxWidth: '450px', width: '90%', textAlign: 'center', background: '#0f172a' }}>
            <AlertTriangle size={48} style={{ color: showStatusModal.targetStatus === 'Approved' ? 'var(--success)' : 'var(--danger)', marginBottom: '1rem' }} />
            <h2>{showStatusModal.targetStatus === 'Approved' ? 'Approve Admission?' : 'Reject Admission?'}</h2>
            <p style={{ margin: '1rem 0 2rem 0' }}>
              {showStatusModal.targetStatus === 'Approved' 
                ? 'Approving this admission will lock editing of student information and generate a sequence-based Admission ID (ADM-YYYY-00001).'
                : 'Rejecting this admission draft will record the decision in the timeline and notify staff.'}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowStatusModal({ show: false, targetStatus: '' })}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                style={{ background: showStatusModal.targetStatus === 'Approved' ? 'var(--success)' : 'var(--danger)' }} 
                onClick={() => handleWorkflowChange(showStatusModal.targetStatus)}
                disabled={saving}
              >
                {saving ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import TimePicker24 from '@/components/TimePicker24';

// Initial number of rows for each table (user can add more)
const FENDER_ROWS = 3;
const HOSE_ROWS = 3;
const OTHER_EQUIPMENT_ROWS = 3;

// Helper function to convert relative signature URLs to absolute URLs
const getSignatureUrl = (signature) => {
  if (!signature) return '';
  if (signature.startsWith('http://') || signature.startsWith('https://') || signature.startsWith('data:')) {
    return signature;
  }
  if (signature.startsWith('/uploads') || signature.startsWith('/')) {
    const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
    const baseUrl = backendBaseUrl.replace(/\/api\/operations\/sts-checklist\/?$/, '');
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBaseUrl}${signature}`;
  }
  return signature;
};

// Helper function to extract base64 from data URL
const extractBase64 = (dataUrl) => {
  if (!dataUrl) return '';
  if (dataUrl.startsWith('data:')) {
    const parts = dataUrl.split(',');
    return parts.length > 1 ? parts[1] : dataUrl;
  }
  return dataUrl;
};

// Helper: default empty fender row
const emptyFenderRow = () => ({
  fenderId: '',
  endPlates: '',
  bShackle: '',
  swivel: '',
  secondShackle: '',
  mooringShackle: '',
  fenderBody: '',
  tires: '',
  pressure: '',
});

// Helper: default empty hose row
const emptyHoseRow = () => ({
  hoseId: '',
  endFlanges: '',
  bodyCondition: '',
  nutsBolts: '',
  markings: '',
});

// Helper: default empty other-equipment row
const emptyOtherEquipmentRow = () => ({
  equipmentId: '',
  gaskets: '',
  ropes: '',
  wires: '',
  billyPugh: '',
  liftingStrops: '',
});

// Helper: build initial form state
const getInitialFormData = (opRef = '') => ({
  operationRef: opRef,
  documentInfo: {
    formNo: 'OPS-OFD-014',
    issueDate: new Date().toISOString().split('T')[0],
    approvedBy: 'JS',
  },
  jobInfo: {
    date: new Date().toISOString().split('T')[0],
    time: '',
    mooringMasterName: '',
    location: '',
    operationPhase: 'BEFORE_OPERATION',
  },
  fenderEquipment: new Array(FENDER_ROWS).fill(null).map(() => emptyFenderRow()),
  hoseEquipment: new Array(HOSE_ROWS).fill(null).map(() => emptyHoseRow()),
  otherEquipment: new Array(OTHER_EQUIPMENT_ROWS).fill(null).map(() => emptyOtherEquipmentRow()),
  remarks: '',
  signatureBlock: {
    mooringMasterSignature: '',
  },
});

export default function STSEquipmentChecklist() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read URL params
  const rawOperationRef = searchParams.get('operationRef');
  const operationRef = rawOperationRef ? rawOperationRef.replace(/,\s*$/, '').trim() : null;
  const mode = searchParams.get('mode');

  const signatureFileInputRef = useRef(null);

  const [formData, setFormData] = useState(getInitialFormData(operationRef || ''));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);

  // ─── Helper functions ──────────────────────────────────────────────

  const getUserFriendlyError = (error) => {
    if (!error) return 'An unexpected error occurred. Please try again.';
    const errorMessage = typeof error === 'string' ? error : error.message || '';
    const errorLower = errorMessage.toLowerCase();

    if (errorMessage === 'CHECKLIST_NOT_FOUND') return 'Checklist not found. Please verify the operation reference number.';
    if (errorMessage === 'INVALID_RESPONSE_FORMAT') return 'Invalid response from server. Please try again.';
    if (errorMessage === 'NO_DATA_RECEIVED') return 'No data received from server. Please try again.';
    if (errorMessage.startsWith('SERVER_ERROR_')) return 'Server error occurred. Please try again later or contact support.';
    if (errorLower.includes('fetch') || errorLower.includes('network') || errorLower.includes('connection')) return 'Unable to connect to server. Please check your internet connection and try again.';
    if (errorLower.includes('timeout') || errorLower.includes('aborted')) return 'Request took too long. Please try again.';
    if (errorLower.includes('404') || errorLower.includes('not found') || errorLower.includes('no checklist found')) return 'Checklist not found. Please verify the operation reference number.';
    if (errorLower.includes('500') || errorLower.includes('internal server error')) return 'Server error occurred. Please try again later or contact support.';
    if (errorLower.includes('502') || errorLower.includes('503') || errorLower.includes('bad gateway') || errorLower.includes('service unavailable')) return 'Service temporarily unavailable. Please try again in a few moments.';
    if (errorLower.includes('cannot reach') || errorLower.includes('oceane-marine') || errorLower.includes('backend')) return 'Unable to connect to server. Please ensure the server is running.';
    if (errorLower.includes('json') || errorLower.includes('parse') || errorLower.includes('invalid response')) return 'Invalid response from server. Please try again.';
    if (errorLower.includes('cast to objectid') || errorLower.includes('objectid failed')) return 'Invalid operation reference format. Please check the link and try again.';
    if ((errorLower.includes('required') || errorLower.includes('invalid') || errorLower.includes('missing')) && errorMessage.length < 80) return errorMessage;
    if (errorMessage.length > 100 || errorMessage.includes('http://') || errorMessage.includes('localhost') || errorMessage.includes('node_modules')) return 'An error occurred while processing your request. Please try again.';
    return errorMessage;
  };

  const safeParseDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // ─── Reset helpers ─────────────────────────────────────────────────

  const resetForm = () => {
    setFormData(getInitialFormData(operationRef || ''));
    if (signatureFileInputRef.current) signatureFileInputRef.current.value = '';
  };

  const resetFormToCreateMode = () => {
    setFormData(getInitialFormData(''));
    if (signatureFileInputRef.current) signatureFileInputRef.current.value = '';
    setIsUpdateMode(false);
    router.replace('/OPS-OFD-014');
  };

  // ─── Fetch existing data for update mode ───────────────────────────

  const fetchExistingData = async (refNumber) => {
    try {
      setLoadingData(true);
      setSubmitError(null);
      const trimmedRef = refNumber?.replace(/,\s*$/, '').trim();
      if (!trimmedRef) throw new Error('Operation reference is required');

      const encodedRef = encodeURIComponent(trimmedRef);
      const res = await fetch(`/api/sts-proxy/ops-ofd-014?operationRef=${encodedRef}`);

      if (res.status === 404) throw new Error('CHECKLIST_NOT_FOUND');

      const contentType = res.headers.get('content-type');
      let responseData;
      try {
        if (contentType?.includes('application/json')) {
          responseData = await res.json();
        } else {
          const text = await res.text();
          try { responseData = JSON.parse(text); } catch { throw new Error('INVALID_RESPONSE_FORMAT'); }
        }
      } catch (parseError) {
        if (parseError.message === 'INVALID_RESPONSE_FORMAT') throw parseError;
        throw new Error('INVALID_RESPONSE_FORMAT');
      }

      if (!res.ok) {
        const errorMsg = responseData?.error || responseData?.message || `SERVER_ERROR_${res.status}`;
        throw new Error(errorMsg);
      }

      const data = responseData?.data || responseData;
      if (!data) throw new Error('NO_DATA_RECEIVED');

      const cleanOperationRef = (data.operationRef || trimmedRef || '').replace(/,\s*$/, '').trim();

      // Map fetched data into form state
      setFormData({
        operationRef: cleanOperationRef,
        documentInfo: {
          formNo: data.documentInfo?.formNo || 'OPS-OFD-014',
          issueDate: safeParseDate(data.documentInfo?.issueDate) || new Date().toISOString().split('T')[0],
          approvedBy: data.documentInfo?.approvedBy || 'JS',
        },
        jobInfo: {
          date: safeParseDate(data.jobInfo?.date) || new Date().toISOString().split('T')[0],
          time: data.jobInfo?.time || '',
          mooringMasterName: data.jobInfo?.mooringMasterName || '',
          location: data.jobInfo?.location || '',
          operationPhase: data.jobInfo?.operationPhase || 'BEFORE_OPERATION',
        },
        fenderEquipment:
          Array.isArray(data.fenderEquipment) && data.fenderEquipment.length > 0
            ? data.fenderEquipment.map((r) => ({
                fenderId: r.fenderId || '',
                endPlates: r.endPlates || '',
                bShackle: r.bShackle || '',
                swivel: r.swivel || '',
                secondShackle: r.secondShackle || '',
                mooringShackle: r.mooringShackle || '',
                fenderBody: r.fenderBody || '',
                tires: r.tires || '',
                pressure: r.pressure || '',
              }))
            : new Array(FENDER_ROWS).fill(null).map(() => emptyFenderRow()),
        hoseEquipment:
          Array.isArray(data.hoseEquipment) && data.hoseEquipment.length > 0
            ? data.hoseEquipment.map((r) => ({
                hoseId: r.hoseId || '',
                endFlanges: r.endFlanges || '',
                bodyCondition: r.bodyCondition || '',
                nutsBolts: r.nutsBolts || '',
                markings: r.markings || '',
              }))
            : new Array(HOSE_ROWS).fill(null).map(() => emptyHoseRow()),
        otherEquipment:
          Array.isArray(data.otherEquipment) && data.otherEquipment.length > 0
            ? data.otherEquipment.map((r) => ({
                equipmentId: r.equipmentId || '',
                gaskets: r.gaskets || '',
                ropes: r.ropes || '',
                wires: r.wires || '',
                billyPugh: r.billyPugh || '',
                liftingStrops: r.liftingStrops || '',
              }))
            : new Array(OTHER_EQUIPMENT_ROWS).fill(null).map(() => emptyOtherEquipmentRow()),
        remarks: data.remarks || '',
        signatureBlock: {
          mooringMasterSignature: getSignatureUrl(data.signatureBlock?.mooringMasterSignature || ''),
        },
      });
    } catch (err) {
      const userFriendlyError = getUserFriendlyError(err);
      setSubmitError(userFriendlyError);
      console.error('Error fetching checklist data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // ─── useEffect: handle mode + operationRef ─────────────────────────

  useEffect(() => {
    if (operationRef) {
      setFormData((prev) => ({ ...prev, operationRef }));
    }
    if (mode === 'update' && operationRef) {
      setIsUpdateMode(true);
      fetchExistingData(operationRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operationRef, mode]);

  // ─── Change handlers ───────────────────────────────────────────────

  const handleJobInfoChange = (field, value) => {
    setFormData({ ...formData, jobInfo: { ...formData.jobInfo, [field]: value } });
  };

  const handleFenderEquipmentChange = (rowIndex, field, value) => {
    const updatedRows = [...formData.fenderEquipment];
    updatedRows[rowIndex] = { ...updatedRows[rowIndex], [field]: value };
    setFormData({ ...formData, fenderEquipment: updatedRows });
  };

  const handleHoseEquipmentChange = (rowIndex, field, value) => {
    const updatedRows = [...formData.hoseEquipment];
    updatedRows[rowIndex] = { ...updatedRows[rowIndex], [field]: value };
    setFormData({ ...formData, hoseEquipment: updatedRows });
  };

  const handleOtherEquipmentChange = (rowIndex, field, value) => {
    const updatedRows = [...formData.otherEquipment];
    updatedRows[rowIndex] = { ...updatedRows[rowIndex], [field]: value };
    setFormData({ ...formData, otherEquipment: updatedRows });
  };

  // Add row handlers
  const handleAddFenderRow = () => {
    setFormData({ ...formData, fenderEquipment: [...formData.fenderEquipment, emptyFenderRow()] });
  };
  const handleAddHoseRow = () => {
    setFormData({ ...formData, hoseEquipment: [...formData.hoseEquipment, emptyHoseRow()] });
  };
  const handleAddOtherEquipmentRow = () => {
    setFormData({ ...formData, otherEquipment: [...formData.otherEquipment, emptyOtherEquipmentRow()] });
  };

  // Remove row handlers
  const handleRemoveFenderRow = (rowIndex) => {
    if (formData.fenderEquipment.length > 1) {
      setFormData({ ...formData, fenderEquipment: formData.fenderEquipment.filter((_, i) => i !== rowIndex) });
    }
  };
  const handleRemoveHoseRow = (rowIndex) => {
    if (formData.hoseEquipment.length > 1) {
      setFormData({ ...formData, hoseEquipment: formData.hoseEquipment.filter((_, i) => i !== rowIndex) });
    }
  };
  const handleRemoveOtherEquipmentRow = (rowIndex) => {
    if (formData.otherEquipment.length > 1) {
      setFormData({ ...formData, otherEquipment: formData.otherEquipment.filter((_, i) => i !== rowIndex) });
    }
  };

  // Remarks handler
  const handleRemarksChange = (value) => {
    setFormData({ ...formData, remarks: value });
  };

  // Signature handler
  const handleSignatureUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          signatureBlock: { mooringMasterSignature: reader.result },
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // ─── Submit ────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitSuccess) return;
    if (submitting) return;

    // Resolve operationRef from formData or URL
    let cleanOperationRef = (formData.operationRef || '').replace(/,\s*$/, '').trim();
    if (!cleanOperationRef && operationRef) cleanOperationRef = operationRef;
    if (!cleanOperationRef) {
      const sp = searchParams.get('operationRef');
      if (sp) cleanOperationRef = sp.replace(/,\s*$/, '').trim();
    }
    if (!cleanOperationRef) {
      setSubmitError('Invalid operation reference. Please use a valid link.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(false);

      const payload = {
        operationRef: cleanOperationRef,
        documentInfo: formData.documentInfo,
        jobInfo: formData.jobInfo,
        fenderEquipment: formData.fenderEquipment,
        hoseEquipment: formData.hoseEquipment,
        otherEquipment: formData.otherEquipment,
        remarks: formData.remarks,
        signatureBlock: {
          mooringMasterSignature: extractBase64(formData.signatureBlock.mooringMasterSignature),
        },
        status: 'DRAFT',
      };

      const form = new FormData();
      form.append('data', JSON.stringify(payload));

      const method = isUpdateMode ? 'PUT' : 'POST';
      const encodedRef = encodeURIComponent(cleanOperationRef);
      const url = isUpdateMode
        ? `/api/sts-proxy/ops-ofd-014?operationRef=${encodedRef}`
        : '/api/sts-proxy/ops-ofd-014/create';

      let res;
      try {
        res = await fetch(url, { method, body: form });
      } catch (fetchError) {
        if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
          throw new Error('Network error: Unable to connect to server. Please check your connection.');
        }
        throw fetchError;
      }

      const ct = res.headers.get('content-type');
      let responseData;
      try {
        if (ct?.includes('application/json')) {
          responseData = await res.json();
        } else {
          const text = await res.text();
          try { responseData = JSON.parse(text); } catch { throw new Error(text || `Server error: ${res.status} ${res.statusText}`); }
        }
      } catch (parseError) {
        throw new Error(parseError.message || `Server error: ${res.status} ${res.statusText}`);
      }

      if (!res.ok) {
        const errorMsg = responseData?.error || responseData?.message || `Submission failed: ${res.status} ${res.statusText}`;
        throw new Error(errorMsg);
      }

      setSubmitSuccess(true);
      if (isUpdateMode) {
        resetFormToCreateMode();
      } else {
        resetForm();
      }
    } catch (err) {
      const userFriendlyError = getUserFriendlyError(err);
      setSubmitError(userFriendlyError);
      console.error('Error submitting checklist:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading screen ────────────────────────────────────────────────

  if (loadingData) {
    return (
      <div className="min-h-screen relative">
        {/* Background image with blur */}
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/image/background.img)',
            // filter: 'blur(3px)',
            zIndex: 0
          }}
        />
        {/* Overlay for better contrast */}
        <div className="fixed inset-0 bg-gray-900/75 z-10" />
        {/* Content */}
        <div className="relative z-20 min-h-screen text-white p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto bg-gray-800/95 rounded-lg shadow-2xl p-4 sm:p-6 lg:p-8 backdrop-blur-sm">
            <div className="flex items-center justify-center py-12 sm:py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-white/60 text-sm sm:text-base">Loading existing data...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen relative">
      {/* Background image with blur */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/image/background.img)',
          // filter: 'blur(3px)',
          zIndex: 0
        }}
      />
      {/* Overlay for better contrast */}
      <div className="fixed inset-0 bg-gray-900/75 z-10" />
      {/* Content */}
      <div className="relative z-20 min-h-screen text-white p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto bg-gray-800/95 rounded-lg shadow-2xl p-4 sm:p-6 lg:p-8 backdrop-blur-sm">

        {/* ── Header Section ─────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-6 lg:mb-8 border-b border-gray-700 pb-4 lg:pb-6 gap-4 lg:gap-0">
          <div className="relative w-32 h-16 sm:w-40 sm:h-18 lg:w-48 lg:h-20 mx-auto lg:mx-0">
            <Image
              src="/image/logo.png"
              alt="OCEANE GROUP - SHIP-TO-SHIP TRANSFER"
              fill
              className="object-contain"
              priority
            />
          </div>

          <div className="flex-1 flex flex-col items-center text-center px-2">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1 sm:mb-2">
              STS Equipment Checklist
            </h1>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="operationPhase"
                  value="BEFORE_OPERATION"
                  checked={formData.jobInfo.operationPhase === 'BEFORE_OPERATION'}
                  onChange={(e) => handleJobInfoChange('operationPhase', e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-xs sm:text-sm">Before Operation</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="operationPhase"
                  value="AFTER_OPERATION"
                  checked={formData.jobInfo.operationPhase === 'AFTER_OPERATION'}
                  onChange={(e) => handleJobInfoChange('operationPhase', e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-xs sm:text-sm">After Operation</span>
              </label>
            </div>
            {isUpdateMode && (
              <div className="mt-2 px-3 sm:px-4 py-1 bg-yellow-600/30 border border-yellow-500 rounded text-yellow-300 text-xs sm:text-sm font-semibold">
                EDIT MODE
              </div>
            )}
          </div>

          <div className="bg-gray-700 p-3 sm:p-4 rounded w-full lg:w-auto lg:min-w-[200px]">
            <div className="text-xs sm:text-sm space-y-1">
              <div><strong>Form No:</strong> {formData.documentInfo.formNo}</div>
              <div><strong>Issue Date:</strong> {formData.documentInfo.issueDate}</div>
              <div><strong>Approved by:</strong> {formData.documentInfo.approvedBy}</div>
              <div><strong>Operation Ref:</strong> {formData.operationRef || '—'}</div>
            </div>
          </div>
        </div>

        {/* ── Job Information Section ────────────────────────────── */}
        <div className="mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Job Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label htmlFor="job-date" className="block text-xs sm:text-sm mb-1 font-semibold">Date:</label>
              <input
                id="job-date"
                type="date"
                value={formData.jobInfo.date}
                onChange={(e) => handleJobInfoChange('date', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label htmlFor="job-time" className="block text-xs sm:text-sm mb-1 font-semibold">Time:</label>
              <TimePicker24
                id="job-time"
                value={formData.jobInfo.time}
                onChange={(v) => handleJobInfoChange('time', v)}
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="mooring-master" className="block text-xs sm:text-sm mb-1 font-semibold">Mooring Master:</label>
              <input
                id="mooring-master"
                type="text"
                value={formData.jobInfo.mooringMasterName}
                onChange={(e) => handleJobInfoChange('mooringMasterName', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm"
                placeholder="Enter Mooring M. Name"
              />
            </div>
            <div>
              <label htmlFor="location" className="block text-xs sm:text-sm mb-1 font-semibold">Location:</label>
              <input
                id="location"
                type="text"
                value={formData.jobInfo.location}
                onChange={(e) => handleJobInfoChange('location', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm"
                placeholder="Enter Location"
              />
            </div>
          </div>
        </div>

        {/* ── Fender Equipment Table ─────────────────────────────── */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Fender Equipment Checklist</h2>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full border-collapse border border-gray-600">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="border border-gray-600 p-2 sm:p-3 text-center bg-gray-600 text-xs sm:text-sm">Fender ID #</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">End Plates</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">B. Shackle</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Swivel</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">2nd Shackle</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Mooring Shackle</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Fender Body</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Tires</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Pressure</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center w-16 sm:w-20 text-xs sm:text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.fenderEquipment.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-700">
                      <td className="border border-gray-600 p-1 sm:p-2 bg-gray-600">
                        <input type="text" value={row.fenderId} onChange={(e) => handleFenderEquipmentChange(index, 'fenderId', e.target.value)}
                          className="w-full bg-gray-700 border border-gray-500 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.endPlates} onChange={(e) => handleFenderEquipmentChange(index, 'endPlates', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.bShackle} onChange={(e) => handleFenderEquipmentChange(index, 'bShackle', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.swivel} onChange={(e) => handleFenderEquipmentChange(index, 'swivel', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.secondShackle} onChange={(e) => handleFenderEquipmentChange(index, 'secondShackle', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.mooringShackle} onChange={(e) => handleFenderEquipmentChange(index, 'mooringShackle', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.fenderBody} onChange={(e) => handleFenderEquipmentChange(index, 'fenderBody', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.tires} onChange={(e) => handleFenderEquipmentChange(index, 'tires', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.pressure} onChange={(e) => handleFenderEquipmentChange(index, 'pressure', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2 text-center">
                        {formData.fenderEquipment.length > 1 && (
                          <button type="button" onClick={() => handleRemoveFenderRow(index)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs">
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button type="button" onClick={handleAddFenderRow}
            className="mt-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 rounded text-white text-xs sm:text-sm">
            + Add Row
          </button>
        </div>

        {/* ── Hose Equipment Table ───────────────────────────────── */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Hose Equipment Checklist</h2>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full border-collapse border border-gray-600">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="border border-gray-600 p-2 sm:p-3 text-center bg-gray-600 text-xs sm:text-sm">Hose ID #</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">End Flanges</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Body Condition</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Nuts/Bolts</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Markings</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center w-16 sm:w-20 text-xs sm:text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.hoseEquipment.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-700">
                      <td className="border border-gray-600 p-1 sm:p-2 bg-gray-600">
                        <input type="text" value={row.hoseId} onChange={(e) => handleHoseEquipmentChange(index, 'hoseId', e.target.value)}
                          className="w-full bg-gray-700 border border-gray-500 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.endFlanges} onChange={(e) => handleHoseEquipmentChange(index, 'endFlanges', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.bodyCondition} onChange={(e) => handleHoseEquipmentChange(index, 'bodyCondition', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.nutsBolts} onChange={(e) => handleHoseEquipmentChange(index, 'nutsBolts', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.markings} onChange={(e) => handleHoseEquipmentChange(index, 'markings', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2 text-center">
                        {formData.hoseEquipment.length > 1 && (
                          <button type="button" onClick={() => handleRemoveHoseRow(index)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs">
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button type="button" onClick={handleAddHoseRow}
            className="mt-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 rounded text-white text-xs sm:text-sm">
            + Add Row
          </button>
        </div>

        {/* ── Other Equipment Table ──────────────────────────────── */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Other Equipment Checklist</h2>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full border-collapse border border-gray-600">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="border border-gray-600 p-2 sm:p-3 text-center bg-gray-600 text-xs sm:text-sm">Other Equipment ID #</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Gaskets</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Ropes</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Wires</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Billy Pugh</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Lifting Strops</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center w-16 sm:w-20 text-xs sm:text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.otherEquipment.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-700">
                      <td className="border border-gray-600 p-1 sm:p-2 bg-gray-600">
                        <input type="text" value={row.equipmentId} onChange={(e) => handleOtherEquipmentChange(index, 'equipmentId', e.target.value)}
                          className="w-full bg-gray-700 border border-gray-500 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.gaskets} onChange={(e) => handleOtherEquipmentChange(index, 'gaskets', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.ropes} onChange={(e) => handleOtherEquipmentChange(index, 'ropes', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.wires} onChange={(e) => handleOtherEquipmentChange(index, 'wires', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.billyPugh} onChange={(e) => handleOtherEquipmentChange(index, 'billyPugh', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={row.liftingStrops} onChange={(e) => handleOtherEquipmentChange(index, 'liftingStrops', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2 text-center">
                        {formData.otherEquipment.length > 1 && (
                          <button type="button" onClick={() => handleRemoveOtherEquipmentRow(index)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs">
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button type="button" onClick={handleAddOtherEquipmentRow}
            className="mt-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 rounded text-white text-xs sm:text-sm">
            + Add Row
          </button>
        </div>

        {/* ── Signature and Remarks Section ──────────────────────── */}
        <div className="mb-6 sm:mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label htmlFor="signature" className="block text-xs sm:text-sm mb-1 font-semibold">Signature of Mooring Master:</label>
            <input
              ref={signatureFileInputRef}
              id="signature"
              type="file"
              accept="image/*"
              onChange={handleSignatureUpload}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-xs sm:text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
            />
            {formData.signatureBlock.mooringMasterSignature && (
              <div className="mt-2">
                <img
                  src={formData.signatureBlock.mooringMasterSignature}
                  alt="Signature preview"
                  className="max-w-full h-24 sm:h-32 border border-gray-600 rounded bg-white p-2 object-contain"
                  onError={(e) => {
                    const img = e.target;
                    img.style.display = 'none';
                    if (!img.parentElement.querySelector('.signature-error')) {
                      const errorDiv = document.createElement('div');
                      errorDiv.className = 'signature-error text-xs text-gray-400 italic p-2 bg-gray-700 rounded';
                      errorDiv.textContent = 'Signature image could not be loaded';
                      img.parentElement.appendChild(errorDiv);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, signatureBlock: { mooringMasterSignature: '' } });
                    if (signatureFileInputRef.current) signatureFileInputRef.current.value = '';
                  }}
                  className="mt-2 text-xs sm:text-sm text-red-400 hover:text-red-300"
                >
                  Remove Signature
                </button>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="remarks" className="block text-xs sm:text-sm mb-1 font-semibold">Remarks:</label>
            <textarea
              id="remarks"
              value={formData.remarks}
              onChange={(e) => handleRemarksChange(e.target.value)}
              rows={6}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-xs sm:text-sm"
              placeholder="Enter remarks..."
            />
          </div>
        </div>

        {/* ── Error Message ──────────────────────────────────────── */}
        {submitError && (
          <div className="mb-4 p-3 sm:p-4 bg-red-900/30 border border-red-600 rounded text-red-300">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="font-semibold mb-1 text-sm sm:text-base">Error</p>
                <p className="text-xs sm:text-sm overflow-wrap-break-word">{submitError}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Submit Button ──────────────────────────────────────── */}
        <div className="flex justify-end gap-3 sm:gap-4">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-base w-full sm:w-auto"
          >
            {(() => {
              if (submitting) return isUpdateMode ? 'Updating...' : 'Submitting...';
              return isUpdateMode ? 'Update Checklist' : 'Submit Checklist';
            })()}
          </button>
        </div>

        {submitSuccess && (
          <div className="mt-4 p-3 sm:p-4 bg-green-900/30 border border-green-600 rounded text-green-300 text-xs sm:text-sm">
            {isUpdateMode
              ? 'Checklist updated successfully.'
              : 'Form submitted successfully.'
            }
          </div>
        )}

        </div>
      </div>
    </div>
  );
}

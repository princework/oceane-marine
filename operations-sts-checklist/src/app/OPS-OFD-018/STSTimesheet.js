'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import TimePicker24 from '@/components/TimePicker24';

// Predefined activities for STS Operation Timings
const PREDEFINED_ACTIVITIES = [
  'COMM SHORE MOBILISATION',
  'SUPPORT CRAFT SAILS',
  'M/M ONBOARD',
  'COMM MOB EQUIPMENT ON VESSEL',
  'COMM RUN IN',
  'MOORING',
  'HOSES CONNECTION',
  'CARGO OPERATION',
  'HOSE DISCONNECTION',
  'FIGURES / DOCUMENTS ETC',
  'UNMOORING',
  'COMM DEMOB EQUIPMENT',
  'SUPPORT CRAFT DEPARTS VESSEL',
  'SHORE DEMOBILISATION',
];

// Helper: empty additional-activity row
const emptyAdditionalActivity = () => ({
  activityName: '',
  fromDate: '',
  fromTime: '',
  toDate: '',
  toTime: '',
  remarks: '',
});

// Helper: build initial form state
const getInitialFormData = (opRef = '') => ({
  operationRef: opRef,
  documentInfo: {
    formNo: 'OPS-OFD-018',
    issueDate: new Date().toISOString().split('T')[0],
    approvedBy: 'JS',
  },
  basicInfo: {
    stsSuperintendent: '',
    jobNumber: '',
    receivingVessel: '',
    dischargingVessel: '',
    supportCraftMobDemob: '',
    location: '',
  },
  operationTimings: PREDEFINED_ACTIVITIES.map((a) => ({
    activityName: a,
    fromDate: '',
    fromTime: '',
    toDate: '',
    toTime: '',
    remarks: '',
  })),
  additionalActivities: [emptyAdditionalActivity()],
  weatherDelay: {
    sea: '',
    swell: '',
    wind: '',
    totalExposureHours: '',
  },
  cargoInfo: {
    cargoName: '',
    cargoQuantity: '',
    cargoPumpingTime: '',
  },
  finalRemarks: '',
});

// Helper: user-friendly error messages
const getUserFriendlyError = (error) => {
  if (!error) return 'An unexpected error occurred. Please try again.';
  const msg = typeof error === 'string' ? error : error.message || '';
  const lo = msg.toLowerCase();
  if (msg === 'CHECKLIST_NOT_FOUND') return 'Record not found. Please verify the operation reference number.';
  if (msg === 'INVALID_RESPONSE_FORMAT') return 'Invalid response from server. Please try again.';
  if (msg === 'NO_DATA_RECEIVED') return 'No data received from server. Please try again.';
  if (msg.startsWith('SERVER_ERROR_')) return 'Server error occurred. Please try again later or contact support.';
  if (lo.includes('fetch') || lo.includes('network') || lo.includes('connection')) return 'Unable to connect to server. Please check your internet connection and try again.';
  if (lo.includes('timeout') || lo.includes('aborted')) return 'Request took too long. Please try again.';
  if (lo.includes('404') || lo.includes('not found') || lo.includes('no checklist found')) return 'Record not found. Please verify the operation reference number.';
  if (lo.includes('500') || lo.includes('internal server error')) return 'Server error occurred. Please try again later or contact support.';
  if (lo.includes('502') || lo.includes('503') || lo.includes('bad gateway') || lo.includes('service unavailable')) return 'Service temporarily unavailable. Please try again in a few moments.';
  if (lo.includes('cannot reach') || lo.includes('oceane-marine') || lo.includes('backend')) return 'Unable to connect to server. Please ensure the server is running.';
  if (lo.includes('json') || lo.includes('parse') || lo.includes('invalid response')) return 'Invalid response from server. Please try again.';
  if (lo.includes('cast to objectid') || lo.includes('objectid failed')) return 'Invalid operation reference format. Please check the link and try again.';
  if ((lo.includes('required') || lo.includes('invalid') || lo.includes('missing')) && msg.length < 80) return msg;
  if (msg.length > 100 || msg.includes('http://') || msg.includes('localhost') || msg.includes('node_modules')) return 'An error occurred while processing your request. Please try again.';
  return msg;
};

// Helper: safe date parse
const safeParseDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

export default function STSTimesheet() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawOperationRef = searchParams.get('operationRef');
  const operationRef = rawOperationRef ? rawOperationRef.replace(/,\s*$/, '').trim() : null;
  const mode = searchParams.get('mode');

  const [formData, setFormData] = useState(getInitialFormData(operationRef || ''));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);

  // ─── Reset helpers ─────────────────────────────────────────────────

  const resetForm = () => {
    setFormData(getInitialFormData(operationRef || ''));
  };

  const resetFormToCreateMode = () => {
    setFormData(getInitialFormData(''));
    setIsUpdateMode(false);
    router.replace('/OPS-OFD-018');
  };

  // ─── Fetch existing data for update mode ───────────────────────────

  const fetchExistingData = async (refNumber) => {
    try {
      setLoadingData(true);
      setSubmitError(null);
      const trimmedRef = refNumber?.replace(/,\s*$/, '').trim();
      if (!trimmedRef) throw new Error('Operation reference is required');

      const encodedRef = encodeURIComponent(trimmedRef);
      const res = await fetch(`/api/sts-proxy/ops-ofd-018?operationRef=${encodedRef}`);

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

      const cleanRef = (data.operationRef || trimmedRef || '').replace(/,\s*$/, '').trim();

      // Map a timing row from API data
      const mapTimingRow = (r) => ({
        activityName: r.activityName || '',
        fromDate: safeParseDate(r.fromDate) || '',
        fromTime: r.fromTime || '',
        toDate: safeParseDate(r.toDate) || '',
        toTime: r.toTime || '',
        remarks: r.remarks || '',
      });

      setFormData({
        operationRef: cleanRef,
        documentInfo: {
          formNo: data.documentInfo?.formNo || 'OPS-OFD-018',
          issueDate: safeParseDate(data.documentInfo?.issueDate) || new Date().toISOString().split('T')[0],
          approvedBy: data.documentInfo?.approvedBy || 'JS',
        },
        basicInfo: {
          stsSuperintendent: data.basicInfo?.stsSuperintendent || '',
          jobNumber: data.basicInfo?.jobNumber || '',
          receivingVessel: data.basicInfo?.receivingVessel || '',
          dischargingVessel: data.basicInfo?.dischargingVessel || '',
          supportCraftMobDemob: data.basicInfo?.supportCraftMobDemob || '',
          location: data.basicInfo?.location || '',
        },
        operationTimings:
          Array.isArray(data.operationTimings) && data.operationTimings.length > 0
            ? data.operationTimings.map(mapTimingRow)
            : PREDEFINED_ACTIVITIES.map((a) => ({ activityName: a, fromDate: '', fromTime: '', toDate: '', toTime: '', remarks: '' })),
        additionalActivities:
          Array.isArray(data.additionalActivities) && data.additionalActivities.length > 0
            ? data.additionalActivities.map(mapTimingRow)
            : [emptyAdditionalActivity()],
        weatherDelay: {
          sea: data.weatherDelay?.sea || '',
          swell: data.weatherDelay?.swell || '',
          wind: data.weatherDelay?.wind || '',
          totalExposureHours: data.weatherDelay?.totalExposureHours != null ? String(data.weatherDelay.totalExposureHours) : '',
        },
        cargoInfo: {
          cargoName: data.cargoInfo?.cargoName || '',
          cargoQuantity: data.cargoInfo?.cargoQuantity || '',
          cargoPumpingTime: data.cargoInfo?.cargoPumpingTime || '',
        },
        finalRemarks: data.finalRemarks || '',
      });
    } catch (err) {
      setSubmitError(getUserFriendlyError(err));
      console.error('Error fetching timesheet data:', err);
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

  const handleBasicInfoChange = (field, value) => {
    setFormData({ ...formData, basicInfo: { ...formData.basicInfo, [field]: value } });
  };

  const handleOperationTimingChange = (index, field, value) => {
    const updated = [...formData.operationTimings];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, operationTimings: updated });
  };

  const handleAdditionalActivityChange = (index, field, value) => {
    const updated = [...formData.additionalActivities];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, additionalActivities: updated });
  };

  const handleAddAdditionalActivityRow = () => {
    setFormData({ ...formData, additionalActivities: [...formData.additionalActivities, emptyAdditionalActivity()] });
  };

  const handleRemoveAdditionalActivityRow = (index) => {
    if (formData.additionalActivities.length > 1) {
      setFormData({ ...formData, additionalActivities: formData.additionalActivities.filter((_, i) => i !== index) });
    }
  };

  const handleWeatherDelayChange = (field, value) => {
    setFormData({ ...formData, weatherDelay: { ...formData.weatherDelay, [field]: value } });
  };

  const handleCargoInfoChange = (field, value) => {
    setFormData({ ...formData, cargoInfo: { ...formData.cargoInfo, [field]: value } });
  };

  const handleFinalRemarksChange = (value) => {
    setFormData({ ...formData, finalRemarks: value });
  };

  // ─── Submit ────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitSuccess || submitting) return;

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
        basicInfo: formData.basicInfo,
        operationTimings: formData.operationTimings,
        additionalActivities: formData.additionalActivities,
        weatherDelay: formData.weatherDelay,
        cargoInfo: formData.cargoInfo,
        finalRemarks: formData.finalRemarks,
        status: 'DRAFT',
      };

      const form = new FormData();
      form.append('data', JSON.stringify(payload));

      const method = isUpdateMode ? 'PUT' : 'POST';
      const encodedRef = encodeURIComponent(cleanOperationRef);
      const url = isUpdateMode
        ? `/api/sts-proxy/ops-ofd-018?operationRef=${encodedRef}`
        : '/api/sts-proxy/ops-ofd-018/create';

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
      setSubmitError(getUserFriendlyError(err));
      console.error('Error submitting timesheet:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render timing row (shared for both tables) ────────────────────

  const renderTimingRow = (row, index, isAdditional = false) => {
    const handleChange = isAdditional ? handleAdditionalActivityChange : handleOperationTimingChange;
    return (
      <tr key={isAdditional ? `add-${index}` : `op-${index}`} className="hover:bg-gray-700">
        <td className="border border-gray-600 p-1 sm:p-2">
          {isAdditional ? (
            <input
              type="text"
              value={row.activityName}
              onChange={(e) => handleChange(index, 'activityName', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm"
              placeholder="Activity name"
            />
          ) : (
            <span className="text-xs sm:text-sm font-semibold">{row.activityName}</span>
          )}
        </td>
        <td className="border border-gray-600 p-1 sm:p-2">
          <input type="date" value={row.fromDate} onChange={(e) => handleChange(index, 'fromDate', e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
        </td>
        <td className="border border-gray-600 p-1 sm:p-2">
          <TimePicker24 value={row.fromTime} onChange={(v) => handleChange(index, 'fromTime', v)}
            className="w-full" />
        </td>
        <td className="border border-gray-600 p-1 sm:p-2">
          <input type="date" value={row.toDate} onChange={(e) => handleChange(index, 'toDate', e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
        </td>
        <td className="border border-gray-600 p-1 sm:p-2">
          <TimePicker24 value={row.toTime} onChange={(v) => handleChange(index, 'toTime', v)}
            className="w-full" />
        </td>
        <td className="border border-gray-600 p-1 sm:p-2">
          <input type="text" value={row.remarks} onChange={(e) => handleChange(index, 'remarks', e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" placeholder="Remarks" />
        </td>
        {isAdditional && (
          <td className="border border-gray-600 p-1 sm:p-2 text-center">
            {formData.additionalActivities.length > 1 && (
              <button type="button" onClick={() => handleRemoveAdditionalActivityRow(index)}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs">
                Remove
              </button>
            )}
          </td>
        )}
      </tr>
    );
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
              TIMESHEET
            </h1>
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

        {/* ── Basic Info Section ──────────────────────────────────── */}
        <div className="mb-6 sm:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div>
              <label htmlFor="sts-superintendent" className="block text-xs sm:text-sm mb-1 font-semibold">STS SUPERINTENDENT:</label>
              <input id="sts-superintendent" type="text" value={formData.basicInfo.stsSuperintendent}
                onChange={(e) => handleBasicInfoChange('stsSuperintendent', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label htmlFor="job-number" className="block text-xs sm:text-sm mb-1 font-semibold">JOB No.:</label>
              <input id="job-number" type="text" value={formData.basicInfo.jobNumber}
                onChange={(e) => handleBasicInfoChange('jobNumber', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label htmlFor="receiving-vessel" className="block text-xs sm:text-sm mb-1 font-semibold">RECEIVING VESSEL:</label>
              <input id="receiving-vessel" type="text" value={formData.basicInfo.receivingVessel}
                onChange={(e) => handleBasicInfoChange('receivingVessel', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label htmlFor="discharging-vessel" className="block text-xs sm:text-sm mb-1 font-semibold">DISCHARGING VESSEL:</label>
              <input id="discharging-vessel" type="text" value={formData.basicInfo.dischargingVessel}
                onChange={(e) => handleBasicInfoChange('dischargingVessel', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label htmlFor="support-craft" className="block text-xs sm:text-sm mb-1 font-semibold">SUPPORT CRAFT USED FOR MOB / DEMOB:</label>
              <input id="support-craft" type="text" value={formData.basicInfo.supportCraftMobDemob}
                onChange={(e) => handleBasicInfoChange('supportCraftMobDemob', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label htmlFor="location" className="block text-xs sm:text-sm mb-1 font-semibold">LOCATION:</label>
              <input id="location" type="text" value={formData.basicInfo.location}
                onChange={(e) => handleBasicInfoChange('location', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
          </div>
        </div>

        {/* ── STS Operation Timings Table ─────────────────────────── */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">STS OPERATION TIMINGS</h2>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full border-collapse border border-gray-600">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Activities</th>
                    <th colSpan="2" className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">From</th>
                    <th colSpan="2" className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">To</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">REMARKS</th>
                  </tr>
                  <tr className="bg-gray-700">
                    <th className="border border-gray-600 p-1 sm:p-2"></th>
                    <th className="border border-gray-600 p-1 sm:p-2 text-center text-xs sm:text-sm">Date</th>
                    <th className="border border-gray-600 p-1 sm:p-2 text-center text-xs sm:text-sm">Time</th>
                    <th className="border border-gray-600 p-1 sm:p-2 text-center text-xs sm:text-sm">Date</th>
                    <th className="border border-gray-600 p-1 sm:p-2 text-center text-xs sm:text-sm">Time</th>
                    <th className="border border-gray-600 p-1 sm:p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.operationTimings.map((row, index) => renderTimingRow(row, index, false))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Additional Activity Table ───────────────────────────── */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">ADDITIONAL ACTIVITY</h2>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full border-collapse border border-gray-600">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Activities</th>
                    <th colSpan="2" className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">FROM</th>
                    <th colSpan="2" className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">TO</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">REMARKS</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center w-16 sm:w-20 text-xs sm:text-sm">Action</th>
                  </tr>
                  <tr className="bg-gray-700">
                    <th className="border border-gray-600 p-1 sm:p-2"></th>
                    <th className="border border-gray-600 p-1 sm:p-2 text-center text-xs sm:text-sm">Date</th>
                    <th className="border border-gray-600 p-1 sm:p-2 text-center text-xs sm:text-sm">Time</th>
                    <th className="border border-gray-600 p-1 sm:p-2 text-center text-xs sm:text-sm">Date</th>
                    <th className="border border-gray-600 p-1 sm:p-2 text-center text-xs sm:text-sm">Time</th>
                    <th className="border border-gray-600 p-1 sm:p-2"></th>
                    <th className="border border-gray-600 p-1 sm:p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.additionalActivities.map((row, index) => renderTimingRow(row, index, true))}
                </tbody>
              </table>
            </div>
          </div>
          <button type="button" onClick={handleAddAdditionalActivityRow}
            className="mt-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 rounded text-white text-xs sm:text-sm">
            + Add Row
          </button>
        </div>

        {/* ── Weather Delay and Cargo Info ────────────────────────── */}
        <div className="mb-6 sm:mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Weather Delay */}
          <div>
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">SIGNIFICANT WEATHER WHICH CAUSED DELAY</h2>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label htmlFor="sea" className="block text-xs sm:text-sm mb-1 font-semibold">SEA:</label>
                <input id="sea" type="text" value={formData.weatherDelay.sea}
                  onChange={(e) => handleWeatherDelayChange('sea', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label htmlFor="swell" className="block text-xs sm:text-sm mb-1 font-semibold">SWELL:</label>
                <input id="swell" type="text" value={formData.weatherDelay.swell}
                  onChange={(e) => handleWeatherDelayChange('swell', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label htmlFor="wind" className="block text-xs sm:text-sm mb-1 font-semibold">WIND:</label>
                <input id="wind" type="text" value={formData.weatherDelay.wind}
                  onChange={(e) => handleWeatherDelayChange('wind', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label htmlFor="total-exposure-hours" className="block text-xs sm:text-sm mb-1 font-semibold">TOTAL EXPOSURE HOURS:</label>
                <input id="total-exposure-hours" type="number" step="0.01" value={formData.weatherDelay.totalExposureHours}
                  onChange={(e) => handleWeatherDelayChange('totalExposureHours', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
              </div>
            </div>
          </div>

          {/* Cargo Info */}
          <div>
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">CARGO</h2>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label htmlFor="cargo-name" className="block text-xs sm:text-sm mb-1 font-semibold">CARGO:</label>
                <input id="cargo-name" type="text" value={formData.cargoInfo.cargoName}
                  onChange={(e) => handleCargoInfoChange('cargoName', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label htmlFor="cargo-quantity" className="block text-xs sm:text-sm mb-1 font-semibold">QUANTITY:</label>
                <input id="cargo-quantity" type="text" value={formData.cargoInfo.cargoQuantity}
                  onChange={(e) => handleCargoInfoChange('cargoQuantity', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label htmlFor="cargo-pumping-time" className="block text-xs sm:text-sm mb-1 font-semibold">CARGO PUMPING TIME:</label>
                <input id="cargo-pumping-time" type="text" value={formData.cargoInfo.cargoPumpingTime}
                  onChange={(e) => handleCargoInfoChange('cargoPumpingTime', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Final Remarks ──────────────────────────────────────── */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">EQUIPMENT / OPERATIONAL / INCIDENT / DELAYS ETC, REMARKS</h2>
          <textarea
            value={formData.finalRemarks}
            onChange={(e) => handleFinalRemarksChange(e.target.value)}
            rows={4}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-xs sm:text-sm"
            placeholder="Enter remarks..."
          />
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
              return isUpdateMode ? 'Update Timesheet' : 'Submit Timesheet';
            })()}
          </button>
        </div>

        {submitSuccess && (
          <div className="mt-4 p-3 sm:p-4 bg-green-900/30 border border-green-600 rounded text-green-300 text-xs sm:text-sm">
            {isUpdateMode ? 'Timesheet updated successfully.' : 'Form submitted successfully.'}
          </div>
        )}

        </div>
      </div>
    </div>
  );
}

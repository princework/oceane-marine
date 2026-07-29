'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import TimePicker24 from '@/components/TimePicker24';

// Initial number of rows
const INITIAL_ROWS = 1;

// Helper: default empty hourly record row
const emptyHourlyRecord = (serialNumber = 1) => ({
  serialNumber,
  date: '',
  time: '',
  dischargedQuantity: '',
  receivedQuantity: '',
  differenceQuantity: '',
  checkedBy: '',
});

// Helper: build initial form state
const getInitialFormData = (opRef = '') => ({
  operationRef: opRef,
  transferInfo: {
    dischargingShipName: '',
    receivingShipName: '',
    transferStartDate: new Date().toISOString().split('T')[0],
    jobNumber: '',
  },
  hourlyRecords: new Array(INITIAL_ROWS).fill(null).map((_, i) => emptyHourlyRecord(i + 1)),
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

export default function STSHourlyQuantityLog() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read URL params
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
    router.replace('/OPS-OFD-015');
  };

  // ─── Fetch existing data for update mode ───────────────────────────

  const fetchExistingData = async (refNumber) => {
    try {
      setLoadingData(true);
      setSubmitError(null);
      const trimmedRef = refNumber?.replace(/,\s*$/, '').trim();
      if (!trimmedRef) throw new Error('Operation reference is required');

      const encodedRef = encodeURIComponent(trimmedRef);
      const res = await fetch(`/api/sts-proxy/ops-ofd-015?operationRef=${encodedRef}`);

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

      setFormData({
        operationRef: cleanRef,
        transferInfo: {
          dischargingShipName: data.transferInfo?.dischargingShipName || '',
          receivingShipName: data.transferInfo?.receivingShipName || '',
          transferStartDate: safeParseDate(data.transferInfo?.transferStartDate) || new Date().toISOString().split('T')[0],
          jobNumber: data.transferInfo?.jobNumber || '',
        },
        hourlyRecords:
          Array.isArray(data.hourlyRecords) && data.hourlyRecords.length > 0
            ? data.hourlyRecords.map((r, i) => ({
                serialNumber: r.serialNumber || i + 1,
                date: safeParseDate(r.date) || '',
                time: r.time || '',
                dischargedQuantity: r.dischargedQuantity != null ? String(r.dischargedQuantity) : '',
                receivedQuantity: r.receivedQuantity != null ? String(r.receivedQuantity) : '',
                differenceQuantity: r.differenceQuantity != null ? String(r.differenceQuantity) : '',
                checkedBy: r.checkedBy || '',
              }))
            : [emptyHourlyRecord(1)],
      });
    } catch (err) {
      setSubmitError(getUserFriendlyError(err));
      console.error('Error fetching data:', err);
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

  const handleTransferInfoChange = (field, value) => {
    setFormData({ ...formData, transferInfo: { ...formData.transferInfo, [field]: value } });
  };

  const handleHourlyRecordChange = (index, field, value) => {
    const updatedRecords = [...formData.hourlyRecords];
    updatedRecords[index] = { ...updatedRecords[index], [field]: value };

    // Auto-calculate difference
    if (field === 'dischargedQuantity' || field === 'receivedQuantity') {
      const discharged = parseFloat(updatedRecords[index].dischargedQuantity) || 0;
      const received = parseFloat(updatedRecords[index].receivedQuantity) || 0;
      const difference = discharged - received;
      updatedRecords[index].differenceQuantity = isNaN(difference) ? '' : difference.toFixed(2);
    }

    setFormData({ ...formData, hourlyRecords: updatedRecords });
  };

  const handleAddRow = () => {
    const newSerial = formData.hourlyRecords.length + 1;
    setFormData({ ...formData, hourlyRecords: [...formData.hourlyRecords, emptyHourlyRecord(newSerial)] });
  };

  const handleRemoveRow = (index) => {
    if (formData.hourlyRecords.length > 1) {
      const updatedRecords = formData.hourlyRecords
        .filter((_, i) => i !== index)
        .map((record, i) => ({ ...record, serialNumber: i + 1 }));
      setFormData({ ...formData, hourlyRecords: updatedRecords });
    }
  };

  // ─── Submit ────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitSuccess || submitting) return;

    // Resolve operationRef
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
        transferInfo: formData.transferInfo,
        hourlyRecords: formData.hourlyRecords.map((r) => ({
          serialNumber: r.serialNumber,
          date: r.date || null,
          time: r.time || '',
          dischargedQuantity: parseFloat(r.dischargedQuantity) || 0,
          receivedQuantity: parseFloat(r.receivedQuantity) || 0,
          differenceQuantity: parseFloat(r.differenceQuantity) || 0,
          checkedBy: r.checkedBy || '',
        })),
        status: 'DRAFT',
      };

      const form = new FormData();
      form.append('data', JSON.stringify(payload));

      const method = isUpdateMode ? 'PUT' : 'POST';
      const encodedRef = encodeURIComponent(cleanOperationRef);
      const url = isUpdateMode
        ? `/api/sts-proxy/ops-ofd-015?operationRef=${encodedRef}`
        : '/api/sts-proxy/ops-ofd-015/create';

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
      console.error('Error submitting log:', err);
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
              HOURLY CHECKS ON THE DISCHARGED AND RECEIVED QUANTITIES
            </h1>
            {isUpdateMode && (
              <div className="mt-2 px-3 sm:px-4 py-1 bg-yellow-600/30 border border-yellow-500 rounded text-yellow-300 text-xs sm:text-sm font-semibold">
                EDIT MODE
              </div>
            )}
          </div>

          <div className="bg-gray-700 p-3 sm:p-4 rounded w-full lg:w-auto lg:min-w-[200px]">
            <div className="text-xs sm:text-sm space-y-1">
              <div><strong>Form No:</strong> OPS-OFD-015</div>
              <div><strong>Operation Ref:</strong> {formData.operationRef || '—'}</div>
            </div>
          </div>
        </div>

        {/* ── General Information Section ─────────────────────────── */}
        <div className="mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">General Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label htmlFor="discharging-ship-name" className="block text-xs sm:text-sm mb-1 font-semibold">Discharging Ship&apos;s Name:</label>
              <input
                id="discharging-ship-name"
                type="text"
                value={formData.transferInfo.dischargingShipName}
                onChange={(e) => handleTransferInfoChange('dischargingShipName', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label htmlFor="receiving-ship-name" className="block text-xs sm:text-sm mb-1 font-semibold">Receiving Ship&apos;s Name:</label>
              <input
                id="receiving-ship-name"
                type="text"
                value={formData.transferInfo.receivingShipName}
                onChange={(e) => handleTransferInfoChange('receivingShipName', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label htmlFor="transfer-start-date" className="block text-xs sm:text-sm mb-1 font-semibold">Date of commencement of Transfer:</label>
              <input
                id="transfer-start-date"
                type="date"
                value={formData.transferInfo.transferStartDate}
                onChange={(e) => handleTransferInfoChange('transferStartDate', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label htmlFor="job-number" className="block text-xs sm:text-sm mb-1 font-semibold">Job No.:</label>
              <input
                id="job-number"
                type="text"
                value={formData.transferInfo.jobNumber}
                onChange={(e) => handleTransferInfoChange('jobNumber', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* ── Hourly Records Table ───────────────────────────────── */}
        <div className="mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Hourly Records</h3>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full border-collapse border border-gray-600">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Sr.No.</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Date</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Time</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">
                      Discharged Qty
                      <div className="text-[10px] sm:text-xs font-normal mt-1">(barrels / M3 / Lts. / MT)</div>
                    </th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">
                      Received Qty
                      <div className="text-[10px] sm:text-xs font-normal mt-1">(barrels / M3 / Lts. / MT)</div>
                    </th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">
                      Difference
                      <div className="text-[10px] sm:text-xs font-normal mt-1">(barrels / M3 / Lts. / MT)</div>
                    </th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Checked by (sign)</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center w-16 sm:w-20 text-xs sm:text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.hourlyRecords.map((record, index) => (
                    <tr key={`row-${record.serialNumber}`} className="hover:bg-gray-700">
                      <td className="border border-gray-600 p-2 sm:p-3 text-center font-semibold bg-gray-600 text-xs sm:text-sm">
                        {record.serialNumber}
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input
                          type="date"
                          value={record.date}
                          onChange={(e) => handleHourlyRecordChange(index, 'date', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm"
                        />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <TimePicker24
                          value={record.time}
                          onChange={(v) => handleHourlyRecordChange(index, 'time', v)}
                          className="w-full"
                        />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input
                          type="number"
                          step="0.01"
                          value={record.dischargedQuantity}
                          onChange={(e) => handleHourlyRecordChange(index, 'dischargedQuantity', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input
                          type="number"
                          step="0.01"
                          value={record.receivedQuantity}
                          onChange={(e) => handleHourlyRecordChange(index, 'receivedQuantity', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input
                          type="number"
                          step="0.01"
                          value={record.differenceQuantity}
                          readOnly
                          className="w-full bg-gray-700 border border-gray-500 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm cursor-not-allowed"
                          placeholder="Auto"
                        />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input
                          type="text"
                          value={record.checkedBy}
                          onChange={(e) => handleHourlyRecordChange(index, 'checkedBy', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm"
                          placeholder="Name or signature"
                        />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2 text-center">
                        {formData.hourlyRecords.length > 1 && (
                          <button type="button" onClick={() => handleRemoveRow(index)}
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
          <button type="button" onClick={handleAddRow}
            className="mt-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 rounded text-white text-xs sm:text-sm">
            + Add Row
          </button>
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
              return isUpdateMode ? 'Update Log' : 'Submit Log';
            })()}
          </button>
        </div>

        {submitSuccess && (
          <div className="mt-4 p-3 sm:p-4 bg-green-900/30 border border-green-600 rounded text-green-300 text-xs sm:text-sm">
            {isUpdateMode ? 'Log updated successfully.' : 'Form submitted successfully.'}
          </div>
        )}

        </div>
      </div>
    </div>
  );
}

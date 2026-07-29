'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import TimePicker24 from '@/components/TimePicker24';

// Helper: empty expense row
const emptyExpenseRow = () => ({
  description: '',
  numberOfDaysOrMisc: '',
  dailyRate: '',
  amount: '',
  officeTotal: 0,
});

// Helper: build initial form state
const getInitialFormData = (opRef = '') => ({
  operationRef: opRef,
  personalDetails: {
    name: '',
    country: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    jobNumber: '',
    operationLocation: '',
  },
  bankDetails: {
    accountHolderName: '',
    accountNumber: '',
    ibanOrSortCode: '',
    invoiceCurrency: '',
  },
  travelDetails: {
    departureFromHomeTown: { date: '', time: '', remarks: '' },
    arrivalAtHomeTown: { date: '', time: '', remarks: '' },
  },
  statementOfExpenses: [emptyExpenseRow()],
  totals: { subTotal: 0, vatAmount: 0, grandTotal: 0 },
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

export default function MooringMasterExpenseSheet() {
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

  // ─── Auto-calculate totals ─────────────────────────────────────────

  const calculateTotals = (expenses, vatAmount) => {
    const updatedExpenses = expenses.map((expense) => {
      let officeTotal = 0;
      if (expense.numberOfDaysOrMisc && expense.dailyRate) {
        const days = parseFloat(expense.numberOfDaysOrMisc) || 0;
        const rate = parseFloat(expense.dailyRate) || 0;
        officeTotal = days * rate;
      } else if (expense.amount) {
        officeTotal = parseFloat(expense.amount) || 0;
      }
      return { ...expense, officeTotal };
    });
    const subTotal = updatedExpenses.reduce((sum, e) => sum + e.officeTotal, 0);
    const vat = parseFloat(vatAmount) || 0;
    const grandTotal = subTotal + vat;
    return { updatedExpenses, subTotal, grandTotal };
  };

  // ─── Reset helpers ─────────────────────────────────────────────────

  const resetForm = () => {
    setFormData(getInitialFormData(operationRef || ''));
  };

  const resetFormToCreateMode = () => {
    setFormData(getInitialFormData(''));
    setIsUpdateMode(false);
    router.replace('/OPS-OFD-029');
  };

  // ─── Fetch existing data for update mode ───────────────────────────

  const fetchExistingData = async (refNumber) => {
    try {
      setLoadingData(true);
      setSubmitError(null);
      const trimmedRef = refNumber?.replace(/,\s*$/, '').trim();
      if (!trimmedRef) throw new Error('Operation reference is required');

      const encodedRef = encodeURIComponent(trimmedRef);
      const res = await fetch(`/api/sts-proxy/ops-ofd-029?operationRef=${encodedRef}`);

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

      // Map expense rows
      const mappedExpenses =
        Array.isArray(data.statementOfExpenses) && data.statementOfExpenses.length > 0
          ? data.statementOfExpenses.map((e) => ({
              description: e.description || '',
              numberOfDaysOrMisc: e.numberOfDaysOrMisc != null ? String(e.numberOfDaysOrMisc) : '',
              dailyRate: e.dailyRate != null ? String(e.dailyRate) : '',
              amount: e.amount != null ? String(e.amount) : '',
              officeTotal: parseFloat(e.officeTotal) || 0,
            }))
          : [emptyExpenseRow()];

      // Recalculate totals from fetched data
      const vatVal = data.totals?.vatAmount != null ? String(data.totals.vatAmount) : '0';
      const { updatedExpenses, subTotal, grandTotal } = calculateTotals(mappedExpenses, vatVal);

      setFormData({
        operationRef: cleanRef,
        personalDetails: {
          name: data.personalDetails?.name || '',
          country: data.personalDetails?.country || '',
          invoiceDate: safeParseDate(data.personalDetails?.invoiceDate) || new Date().toISOString().split('T')[0],
          jobNumber: data.personalDetails?.jobNumber || '',
          operationLocation: data.personalDetails?.operationLocation || '',
        },
        bankDetails: {
          accountHolderName: data.bankDetails?.accountHolderName || '',
          accountNumber: data.bankDetails?.accountNumber || '',
          ibanOrSortCode: data.bankDetails?.ibanOrSortCode || '',
          invoiceCurrency: data.bankDetails?.invoiceCurrency || '',
        },
        travelDetails: {
          departureFromHomeTown: {
            date: safeParseDate(data.travelDetails?.departureFromHomeTown?.date) || '',
            time: data.travelDetails?.departureFromHomeTown?.time || '',
            remarks: data.travelDetails?.departureFromHomeTown?.remarks || '',
          },
          arrivalAtHomeTown: {
            date: safeParseDate(data.travelDetails?.arrivalAtHomeTown?.date) || '',
            time: data.travelDetails?.arrivalAtHomeTown?.time || '',
            remarks: data.travelDetails?.arrivalAtHomeTown?.remarks || '',
          },
        },
        statementOfExpenses: updatedExpenses,
        totals: {
          subTotal,
          vatAmount: vatVal,
          grandTotal,
        },
      });
    } catch (err) {
      setSubmitError(getUserFriendlyError(err));
      console.error('Error fetching expense sheet data:', err);
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

  const handlePersonalDetailsChange = (field, value) => {
    setFormData({ ...formData, personalDetails: { ...formData.personalDetails, [field]: value } });
  };

  const handleBankDetailsChange = (field, value) => {
    setFormData({ ...formData, bankDetails: { ...formData.bankDetails, [field]: value } });
  };

  const handleTravelDetailsChange = (type, field, value) => {
    setFormData({
      ...formData,
      travelDetails: {
        ...formData.travelDetails,
        [type]: { ...formData.travelDetails[type], [field]: value },
      },
    });
  };

  const handleExpenseChange = (index, field, value) => {
    const updatedExpenses = [...formData.statementOfExpenses];
    updatedExpenses[index] = { ...updatedExpenses[index], [field]: value };
    const { updatedExpenses: calc, subTotal, grandTotal } = calculateTotals(updatedExpenses, formData.totals.vatAmount);
    setFormData({ ...formData, statementOfExpenses: calc, totals: { ...formData.totals, subTotal, grandTotal } });
  };

  const handleAddExpenseRow = () => {
    const newExpenses = [...formData.statementOfExpenses, emptyExpenseRow()];
    const { updatedExpenses, subTotal, grandTotal } = calculateTotals(newExpenses, formData.totals.vatAmount);
    setFormData({ ...formData, statementOfExpenses: updatedExpenses, totals: { ...formData.totals, subTotal, grandTotal } });
  };

  const handleRemoveExpenseRow = (index) => {
    if (formData.statementOfExpenses.length > 1) {
      const filtered = formData.statementOfExpenses.filter((_, i) => i !== index);
      const { updatedExpenses, subTotal, grandTotal } = calculateTotals(filtered, formData.totals.vatAmount);
      setFormData({ ...formData, statementOfExpenses: updatedExpenses, totals: { ...formData.totals, subTotal, grandTotal } });
    }
  };

  const handleTotalsChange = (field, value) => {
    const vatAmount = field === 'vatAmount' ? value : formData.totals.vatAmount;
    const { subTotal, grandTotal } = calculateTotals(formData.statementOfExpenses, vatAmount);
    setFormData({ ...formData, totals: { ...formData.totals, [field]: value, subTotal, grandTotal } });
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
        personalDetails: formData.personalDetails,
        bankDetails: formData.bankDetails,
        travelDetails: formData.travelDetails,
        statementOfExpenses: formData.statementOfExpenses.map((exp) => ({
          description: exp.description || '',
          numberOfDaysOrMisc: exp.numberOfDaysOrMisc || '',
          dailyRate: parseFloat(exp.dailyRate) || 0,
          amount: parseFloat(exp.amount) || 0,
          officeTotal: parseFloat(exp.officeTotal) || 0,
        })),
        totals: {
          subTotal: formData.totals.subTotal,
          vatAmount: parseFloat(formData.totals.vatAmount) || 0,
          grandTotal: formData.totals.grandTotal,
        },
        status: 'DRAFT',
      };

      const form = new FormData();
      form.append('data', JSON.stringify(payload));

      const method = isUpdateMode ? 'PUT' : 'POST';
      const encodedRef = encodeURIComponent(cleanOperationRef);
      const url = isUpdateMode
        ? `/api/sts-proxy/ops-ofd-029?operationRef=${encodedRef}`
        : '/api/sts-proxy/ops-ofd-029/create';

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
      console.error('Error submitting expense sheet:', err);
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
              Mooring Master Expense Sheet
            </h1>
            {isUpdateMode && (
              <div className="mt-2 px-3 sm:px-4 py-1 bg-yellow-600/30 border border-yellow-500 rounded text-yellow-300 text-xs sm:text-sm font-semibold">
                EDIT MODE
              </div>
            )}
          </div>

          <div className="bg-gray-700 p-3 sm:p-4 rounded w-full lg:w-auto lg:min-w-[200px]">
            <div className="text-xs sm:text-sm space-y-1">
              <div><strong>Form No:</strong> OPS-OFD-029</div>
              <div><strong>Operation Ref:</strong> {formData.operationRef || '—'}</div>
            </div>
          </div>
        </div>

        {/* ── Company Information ─────────────────────────────────── */}
        <div className="mb-4 sm:mb-6">
          <div className="text-xs sm:text-sm space-y-1">
            <div className="font-bold">OCEANE FENDERS DMCC</div>
            <div>1201, Fortune Tower</div>
            <div>Cluster C, JLT, Dubai</div>
          </div>
        </div>

        {/* ── Personal Details ────────────────────────────────────── */}
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 border border-gray-600 rounded">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Personal Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label htmlFor="name" className="block text-xs sm:text-sm mb-1 font-semibold">Name:</label>
              <input id="name" type="text" value={formData.personalDetails.name}
                onChange={(e) => handlePersonalDetailsChange('name', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label htmlFor="country" className="block text-xs sm:text-sm mb-1 font-semibold">Country:</label>
              <input id="country" type="text" value={formData.personalDetails.country}
                onChange={(e) => handlePersonalDetailsChange('country', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label htmlFor="invoice-date" className="block text-xs sm:text-sm mb-1 font-semibold">Date of Invoice:</label>
              <input id="invoice-date" type="date" value={formData.personalDetails.invoiceDate}
                onChange={(e) => handlePersonalDetailsChange('invoiceDate', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label htmlFor="job-number" className="block text-xs sm:text-sm mb-1 font-semibold">Job Number:</label>
              <input id="job-number" type="text" value={formData.personalDetails.jobNumber}
                onChange={(e) => handlePersonalDetailsChange('jobNumber', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label htmlFor="operation-location" className="block text-xs sm:text-sm mb-1 font-semibold">Location of Operation:</label>
              <input id="operation-location" type="text" value={formData.personalDetails.operationLocation}
                onChange={(e) => handlePersonalDetailsChange('operationLocation', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
          </div>
        </div>

        {/* ── Bank Details ────────────────────────────────────────── */}
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 border border-gray-600 rounded">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Bank Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label htmlFor="account-holder-name" className="block text-xs sm:text-sm mb-1 font-semibold">Name of Account Holder:</label>
              <input id="account-holder-name" type="text" value={formData.bankDetails.accountHolderName}
                onChange={(e) => handleBankDetailsChange('accountHolderName', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label htmlFor="account-number" className="block text-xs sm:text-sm mb-1 font-semibold">Account Number:</label>
              <input id="account-number" type="text" value={formData.bankDetails.accountNumber}
                onChange={(e) => handleBankDetailsChange('accountNumber', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label htmlFor="iban-sort-code" className="block text-xs sm:text-sm mb-1 font-semibold">SORT Code / IBAN Number:</label>
              <input id="iban-sort-code" type="text" value={formData.bankDetails.ibanOrSortCode}
                onChange={(e) => handleBankDetailsChange('ibanOrSortCode', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label htmlFor="invoice-currency" className="block text-xs sm:text-sm mb-1 font-semibold">Currency of Invoice:</label>
              <input id="invoice-currency" type="text" value={formData.bankDetails.invoiceCurrency}
                onChange={(e) => handleBankDetailsChange('invoiceCurrency', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
          </div>
        </div>

        {/* ── Travel / Expense Details ────────────────────────────── */}
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 border border-gray-600 rounded">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Expense Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div>
              <label htmlFor="departure-date" className="block text-xs sm:text-sm mb-1 font-semibold">Date of departure from home town:</label>
              <input id="departure-date" type="date" value={formData.travelDetails.departureFromHomeTown.date}
                onChange={(e) => handleTravelDetailsChange('departureFromHomeTown', 'date', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label htmlFor="arrival-date" className="block text-xs sm:text-sm mb-1 font-semibold">Date of arrival at home town:</label>
              <input id="arrival-date" type="date" value={formData.travelDetails.arrivalAtHomeTown.date}
                onChange={(e) => handleTravelDetailsChange('arrivalAtHomeTown', 'date', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
          </div>
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-3 sm:px-0">
              <table className="min-w-full border-collapse border border-gray-600">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="border border-gray-600 p-2 text-left text-xs sm:text-sm">Date</th>
                    <th className="border border-gray-600 p-2 text-left text-xs sm:text-sm">Time</th>
                    <th className="border border-gray-600 p-2 text-left text-xs sm:text-sm">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-700">
                    <td className="border border-gray-600 p-1 sm:p-2">
                      <input type="date" value={formData.travelDetails.departureFromHomeTown.date}
                        onChange={(e) => handleTravelDetailsChange('departureFromHomeTown', 'date', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                    </td>
                    <td className="border border-gray-600 p-1 sm:p-2">
                      <TimePicker24 value={formData.travelDetails.departureFromHomeTown.time}
                        onChange={(v) => handleTravelDetailsChange('departureFromHomeTown', 'time', v)}
                        className="w-full" />
                    </td>
                    <td className="border border-gray-600 p-1 sm:p-2">
                      <input type="text" value={formData.travelDetails.departureFromHomeTown.remarks}
                        onChange={(e) => handleTravelDetailsChange('departureFromHomeTown', 'remarks', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" placeholder="Remarks" />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-700">
                    <td className="border border-gray-600 p-1 sm:p-2">
                      <input type="date" value={formData.travelDetails.arrivalAtHomeTown.date}
                        onChange={(e) => handleTravelDetailsChange('arrivalAtHomeTown', 'date', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" />
                    </td>
                    <td className="border border-gray-600 p-1 sm:p-2">
                      <TimePicker24 value={formData.travelDetails.arrivalAtHomeTown.time}
                        onChange={(v) => handleTravelDetailsChange('arrivalAtHomeTown', 'time', v)}
                        className="w-full" />
                    </td>
                    <td className="border border-gray-600 p-1 sm:p-2">
                      <input type="text" value={formData.travelDetails.arrivalAtHomeTown.remarks}
                        onChange={(e) => handleTravelDetailsChange('arrivalAtHomeTown', 'remarks', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" placeholder="Remarks" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Statement of Expenses Table ─────────────────────────── */}
        <div className="mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Statement of Expenses</h2>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full border-collapse border border-gray-600">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">No. of days / Misc</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Daily Rate</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Amount</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">
                      Total (in Dirhams)
                      <div className="text-[10px] sm:text-xs font-normal">For Office Use</div>
                    </th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center w-16 sm:w-20 text-xs sm:text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.statementOfExpenses.map((expense, index) => (
                    <tr key={`exp-${index}`} className="hover:bg-gray-700">
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={expense.description}
                          onChange={(e) => handleExpenseChange(index, 'description', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" placeholder="Description" />
                        <input type="text" value={expense.numberOfDaysOrMisc}
                          onChange={(e) => handleExpenseChange(index, 'numberOfDaysOrMisc', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm mt-1" placeholder="No. of days / Misc" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="number" step="0.01" value={expense.dailyRate}
                          onChange={(e) => handleExpenseChange(index, 'dailyRate', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" placeholder="Daily Rate" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="number" step="0.01" value={expense.amount}
                          onChange={(e) => handleExpenseChange(index, 'amount', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm" placeholder="Amount" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2">
                        <input type="text" value={expense.officeTotal.toFixed(2)} readOnly
                          className="w-full bg-gray-700 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm cursor-not-allowed" />
                      </td>
                      <td className="border border-gray-600 p-1 sm:p-2 text-center">
                        {formData.statementOfExpenses.length > 1 && (
                          <button type="button" onClick={() => handleRemoveExpenseRow(index)}
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
          <button type="button" onClick={handleAddExpenseRow}
            className="mt-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 rounded text-white text-xs sm:text-sm">
            + Add Row
          </button>
        </div>

        {/* ── Totals Section ─────────────────────────────────────── */}
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 border border-gray-600 rounded">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-2xl">
            <div>
              <label htmlFor="sub-total" className="block text-xs sm:text-sm mb-1 font-semibold">Sub Total:</label>
              <input id="sub-total" type="text" value={formData.totals.subTotal.toFixed(2)} readOnly
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm cursor-not-allowed" />
            </div>
            <div>
              <label htmlFor="vat-amount" className="block text-xs sm:text-sm mb-1 font-semibold">VAT (if applicable):</label>
              <input id="vat-amount" type="number" step="0.01" value={formData.totals.vatAmount}
                onChange={(e) => handleTotalsChange('vatAmount', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label htmlFor="grand-total" className="block text-xs sm:text-sm mb-1 font-semibold">Grand Total:</label>
              <input id="grand-total" type="text" value={formData.totals.grandTotal.toFixed(2)} readOnly
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm cursor-not-allowed font-bold" />
            </div>
          </div>
        </div>

        {/* ── Footer Disclaimer ──────────────────────────────────── */}
        <div className="mb-4 sm:mb-6 text-xs sm:text-sm text-gray-400 italic">
          All Expenses of whatsoever must be supported by a valid receipt.
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
              return isUpdateMode ? 'Update Expense Sheet' : 'Submit Expense Sheet';
            })()}
          </button>
        </div>

        {submitSuccess && (
          <div className="mt-4 p-3 sm:p-4 bg-green-900/30 border border-green-600 rounded text-green-300 text-xs sm:text-sm">
            {isUpdateMode ? 'Expense sheet updated successfully.' : 'Form submitted successfully.'}
          </div>
        )}

        </div>
      </div>
    </div>
  );
}

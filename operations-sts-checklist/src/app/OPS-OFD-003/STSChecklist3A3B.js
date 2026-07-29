'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';

// Helper function to convert relative signature URLs to absolute URLs
const getSignatureUrl = (signature) => {
    if (!signature) return '';
    
    // If it's already a full URL (http/https) or base64, return as is
    if (signature.startsWith('http://') || signature.startsWith('https://') || signature.startsWith('data:')) {
        return signature;
    }
    
    // If it's a relative path starting with /uploads, convert to absolute URL
    if (signature.startsWith('/uploads') || signature.startsWith('/')) {
        // Get backend base URL from environment variable
        const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
        // Remove /api/operations/sts-checklist from backend URL if present to get base URL
        const baseUrl = backendBaseUrl.replace(/\/api\/operations\/sts-checklist\/?$/, '');
        // Ensure base URL doesn't end with /
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        return `${cleanBaseUrl}${signature}`;
    }
    
    return signature;
};

// Helper function to extract base64 from data URL
const extractBase64 = (dataUrl) => {
    if (!dataUrl) return '';
    if (dataUrl.startsWith('data:')) {
        return dataUrl.split(',')[1] || dataUrl;
    }
    return dataUrl;
};

// Default checklist items for 3A (Generic Checks 1-21)
const DEFAULT_CHECKLIST_3A = [
  { clNumber: 1, description: 'Mooring and fendering arrangement is effective', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 2, description: 'Unused cargo connections are blanked', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 3, description: 'The ship\'s plan to use vapour balancing', status: '', remarks: '', hasNotApplicable: true },
  { clNumber: 4, description: 'Inert Gas System (IGS) is ready for use', status: '', remarks: '', hasNotApplicable: true },
  { clNumber: 5, description: 'Firefighting equipment is ready for use', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 6, description: 'Spill response equipment is on station and ready for immediate deployment', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 7, description: 'Scuppers and save-alls are plugged', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 8, description: 'Cargo system sea connections and overboard discharges are secured', status: '', remarks: '', hasNotApplicable: true },
  { clNumber: 9, description: 'Designated transceivers are in low power mode and designated radio antennae are isolated', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 10, description: 'External openings in superstructure are closed', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 11, description: 'Spaces to be routinely monitored for any build-up of flammable and/or toxic vapour have been identified', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 12, description: 'Pumproom ventilation is operational', status: '', remarks: '', hasNotApplicable: true },
  { clNumber: 13, description: 'Accommodation spaces are at positive pressure', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 14, description: 'Fire control plans are readily available', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 15, description: 'Cargo monitoring system is fully operational and tested', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 16, description: 'Cargo gauging system operation and alarm set points are confirmed', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 17, description: 'Emergency Shutdown (ESD) system is tested and operational', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 18, description: 'Transfer equipment is in safe condition (isolated, drained and de-pressurised), Cargo manifold connections prepared, blanked and marked', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 19, description: 'The cargo transfer hoses/arms have been tested and certified and they are in apparent good condition', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 20, description: 'The hose lifting equipment is suitable and ready for use', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 21, description: 'P/V valves are operational', status: '', remarks: '', hasNotApplicable: false },
];

// Default checklist items for 3B (LPG/LNG Additional)
const DEFAULT_CHECKLIST_3B = [
  { clNumber: 1, description: 'Cargo lines have been cooled', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 2, description: 'All safety systems, including firefighting, cryogenic protection, ESD, gas detection and ventilation system are ready for use/in use', status: '', remarks: '', hasNotApplicable: false },
  { clNumber: 3, description: 'All cargo transfer equipment tested and ready for use', status: '', remarks: '', hasNotApplicable: false },
];

export default function STSChecklist3A3B() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Trim trailing comma from operationRef if present
  const rawOperationRef = searchParams.get('operationRef');
  const operationRef = rawOperationRef ? rawOperationRef.replace(/,\s*$/, '').trim() : null;
  const mode = searchParams.get('mode'); // 'update' or null
  const signatureFileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    operationRef: operationRef || '',
    formNo: 'OPS-OFD-003',
    issueDate: new Date().toISOString().split('T')[0],
    approvedBy: 'JS',
    // Transfer Info
    constantHeadingShip: '',
    manoeuvringShip: '',
    designatedPOACName: '',
    stsSuperintendentName: '',
    transferDate: '',
    transferLocation: '',
    // Checklist 3A
    checklist3A: DEFAULT_CHECKLIST_3A.map(item => ({ ...item, hasNotApplicable: item.hasNotApplicable || false })),
    // Checklist 3B
    checklist3B: DEFAULT_CHECKLIST_3B.map(item => ({ ...item, hasNotApplicable: item.hasNotApplicable || false })),
    // Signature
    signature: {
      rank: '',
      signature: '',
      date: '',
    },
  });

  const handleTransferInfoChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleChecklistChange = (checklistType, index, field, value) => {
    const updatedChecklist = [...formData[checklistType]];
    updatedChecklist[index][field] = value;
    setFormData({ ...formData, [checklistType]: updatedChecklist });
  };

  const handleSignatureChange = (field, value) => {
    setFormData({
      ...formData,
      signature: {
        ...formData.signature,
        [field]: value,
      },
    });
  };

  const handleSignatureUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        handleSignatureChange('signature', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper function to convert technical errors to user-friendly messages
  const getUserFriendlyError = (error) => {
    if (!error) return 'An unexpected error occurred. Please try again.';
    
    const errorMessage = typeof error === 'string' ? error : error.message || '';
    const errorLower = errorMessage.toLowerCase();
    
    // Specific error codes
    if (errorMessage === 'CHECKLIST_NOT_FOUND') {
      return 'Checklist not found. Please verify the operation reference number.';
    }
    if (errorMessage === 'INVALID_RESPONSE_FORMAT') {
      return 'Invalid response from server. Please try again.';
    }
    if (errorMessage === 'NO_DATA_RECEIVED') {
      return 'No data received from server. Please try again.';
    }
    if (errorMessage.startsWith('SERVER_ERROR_')) {
      return 'Server error occurred. Please try again later or contact support.';
    }
    
    // Network errors
    if (errorLower.includes('fetch') || errorLower.includes('network') || errorLower.includes('connection')) {
      return 'Unable to connect to server. Please check your internet connection and try again.';
    }
    
    // Timeout errors
    if (errorLower.includes('timeout') || errorLower.includes('aborted')) {
      return 'Request took too long. Please try again.';
    }
    
    // 404 errors
    if (errorLower.includes('404') || errorLower.includes('not found') || errorLower.includes('no checklist found')) {
      return 'Checklist not found. Please verify the operation reference number.';
    }
    
    // 500 errors
    if (errorLower.includes('500') || errorLower.includes('internal server error')) {
      return 'Server error occurred. Please try again later or contact support.';
    }
    
    // 502/503 errors
    if (errorLower.includes('502') || errorLower.includes('503') || errorLower.includes('bad gateway') || errorLower.includes('service unavailable')) {
      return 'Service temporarily unavailable. Please try again in a few moments.';
    }
    
    // Backend connection errors
    if (errorLower.includes('cannot reach') || errorLower.includes('oceane-marine') || errorLower.includes('backend')) {
      return 'Unable to connect to server. Please ensure the server is running.';
    }
    
    // JSON parsing errors
    if (errorLower.includes('json') || errorLower.includes('parse') || errorLower.includes('invalid response')) {
      return 'Invalid response from server. Please try again.';
    }
    
    // MongoDB/ObjectId errors
    if (errorLower.includes('cast to objectid') || errorLower.includes('objectid failed')) {
      return 'Invalid operation reference format. Please check the link and try again.';
    }
    
    // Validation errors - keep as is if they're short and clear
    if ((errorLower.includes('required') || errorLower.includes('invalid') || errorLower.includes('missing')) && errorMessage.length < 80) {
      return errorMessage;
    }
    
    // Generic fallback - return a simple message without technical details
    if (errorMessage.length > 100 || errorMessage.includes('http://') || errorMessage.includes('localhost') || errorMessage.includes('node_modules')) {
      return 'An error occurred while processing your request. Please try again.';
    }
    
    return errorMessage;
  };

  // Helper function to safely parse date
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

  // Function to reset form to initial state (for create mode)
  const resetForm = () => {
    setFormData({
      operationRef: operationRef || '',
      formNo: 'OPS-OFD-003',
      issueDate: new Date().toISOString().split('T')[0],
      approvedBy: 'JS',
      constantHeadingShip: '',
      manoeuvringShip: '',
      designatedPOACName: '',
      stsSuperintendentName: '',
      transferDate: '',
      transferLocation: '',
      checklist3A: DEFAULT_CHECKLIST_3A.map(item => ({ ...item, hasNotApplicable: item.hasNotApplicable || false })),
      checklist3B: DEFAULT_CHECKLIST_3B.map(item => ({ ...item, hasNotApplicable: item.hasNotApplicable || false })),
      signature: {
        rank: '',
        signature: '',
        date: '',
      },
    });
    // Reset file input
    if (signatureFileInputRef.current) {
      signatureFileInputRef.current.value = '';
    }
  };

  // Function to reset form completely and clear URL params (for update mode after submission)
  const resetFormToCreateMode = () => {
    setFormData({
      operationRef: '',
      formNo: 'OPS-OFD-003',
      issueDate: new Date().toISOString().split('T')[0],
      approvedBy: 'JS',
      constantHeadingShip: '',
      manoeuvringShip: '',
      designatedPOACName: '',
      stsSuperintendentName: '',
      transferDate: '',
      transferLocation: '',
      checklist3A: DEFAULT_CHECKLIST_3A.map(item => ({ ...item, hasNotApplicable: item.hasNotApplicable || false })),
      checklist3B: DEFAULT_CHECKLIST_3B.map(item => ({ ...item, hasNotApplicable: item.hasNotApplicable || false })),
      signature: {
        rank: '',
        signature: '',
        date: '',
      },
    });
    // Reset file input
    if (signatureFileInputRef.current) {
      signatureFileInputRef.current.value = '';
    }
    // Clear update mode
    setIsUpdateMode(false);
    // Clear URL parameters
    router.replace('/OPS-OFD-003');
  };

  // Function to fetch existing data for update mode
  const fetchExistingData = async (refNumber) => {
    try {
      setLoadingData(true);
      setSubmitError(null);
      
      // Trim trailing comma and whitespace
      const trimmedRef = refNumber?.replace(/,\s*$/, '').trim();
      
      if (!trimmedRef) {
        throw new Error('Operation reference is required');
      }
      
      // URL encode the operationRef
      const encodedRef = encodeURIComponent(trimmedRef);
      const res = await fetch(`/api/sts-proxy/ops-ofd-003?operationRef=${encodedRef}`);
      
      // Handle 404 specifically (data not found)
      if (res.status === 404) {
        throw new Error('CHECKLIST_NOT_FOUND');
      }
      
      // Parse response (read body only once)
      const contentType = res.headers.get("content-type");
      let responseData;
      
      try {
        if (contentType?.includes("application/json")) {
          responseData = await res.json();
        } else {
          const text = await res.text();
          // Try to parse as JSON
          try {
            responseData = JSON.parse(text);
          } catch {
            throw new Error('INVALID_RESPONSE_FORMAT');
          }
        }
      } catch (parseError) {
        throw new Error('INVALID_RESPONSE_FORMAT');
      }
      
      if (!res.ok) {
        const errorMsg = responseData?.error || responseData?.message || `SERVER_ERROR_${res.status}`;
        throw new Error(errorMsg);
      }
      
      // Populate form with fetched data
      // Handle both response.data and direct response
      const data = responseData?.data || responseData;
      
      if (!data) {
        throw new Error('NO_DATA_RECEIVED');
      }
      
      // Clean operationRef from data (remove trailing comma if present)
      const cleanOperationRef = (data.operationRef || trimmedRef || '')?.replace(/,\s*$/, '').trim();
      
      setFormData({
        operationRef: cleanOperationRef || '',
        formNo: (data.formNo || 'OPS-OFD-003')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-003',
        issueDate: safeParseDate(data.issueDate) || new Date().toISOString().split('T')[0],
        approvedBy: data.approvedBy || 'JS',
        constantHeadingShip: data.constantHeadingShip || '',
        manoeuvringShip: data.manoeuvringShip || '',
        designatedPOACName: data.designatedPOACName || '',
        stsSuperintendentName: data.stsSuperintendentName || '',
        transferDate: safeParseDate(data.transferDate) || '',
        transferLocation: data.transferLocation || '',
        checklist3A: data.checklist3A && Array.isArray(data.checklist3A) && data.checklist3A.length > 0
          ? data.checklist3A.map((check, index) => ({
            clNumber: check.clNumber || DEFAULT_CHECKLIST_3A[index]?.clNumber || index + 1,
            description: check.description || DEFAULT_CHECKLIST_3A[index]?.description || '',
            status: check.status || '',
            remarks: check.remarks || '',
            hasNotApplicable: DEFAULT_CHECKLIST_3A[index]?.hasNotApplicable || false,
          }))
          : DEFAULT_CHECKLIST_3A.map(item => ({ ...item, hasNotApplicable: item.hasNotApplicable || false })),
        checklist3B: data.checklist3B && Array.isArray(data.checklist3B) && data.checklist3B.length > 0
          ? data.checklist3B.map((check, index) => ({
            clNumber: check.clNumber || DEFAULT_CHECKLIST_3B[index]?.clNumber || index + 1,
            description: check.description || DEFAULT_CHECKLIST_3B[index]?.description || '',
            status: check.status || '',
            remarks: check.remarks || '',
            hasNotApplicable: DEFAULT_CHECKLIST_3B[index]?.hasNotApplicable || false,
          }))
          : DEFAULT_CHECKLIST_3B.map(item => ({ ...item, hasNotApplicable: item.hasNotApplicable || false })),
        signature: {
          rank: data.signature?.rank || '',
          signature: getSignatureUrl(data.signature?.signature || ''),
          date: safeParseDate(data.signature?.date) || '',
        },
      });
    } catch (err) {
      // Convert technical error to user-friendly message
      const userFriendlyError = getUserFriendlyError(err);
      setSubmitError(userFriendlyError);
      // Log technical details to console for debugging (not shown to user)
      console.error('Error fetching checklist data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // Check for mode and operationRef on component mount
  useEffect(() => {
    if (operationRef) {
      setFormData(prev => ({
        ...prev,
        operationRef
      }));
    }
    
    // Check if mode is 'update'
    if (mode === 'update' && operationRef) {
      setIsUpdateMode(true);
      fetchExistingData(operationRef);
    }
  }, [operationRef, mode]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitSuccess) return;
    if (!formData.operationRef) {
      setSubmitError("Invalid operation reference. Please use valid link.");
      return;
    }

    if (submitting) return;
    try {
      setSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(false);
      // Clean operationRef (remove trailing comma if present)
      const cleanOperationRef = (formData.operationRef || '')?.replace(/,\s*$/, '').trim();
      
      if (!cleanOperationRef) {
        setSubmitError("Operation reference is required. Please check the link you received.");
        setSubmitting(false);
        return;
      }

      const payload = {
        operationRef: cleanOperationRef,
        formNo: (formData.formNo || 'OPS-OFD-003')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-003',
        revisionNo: formData.revisionNo || '',
        issueDate: formData.issueDate || null,
        approvedBy: formData.approvedBy,
        constantHeadingShip: formData.constantHeadingShip || '',
        manoeuvringShip: formData.manoeuvringShip || '',
        designatedPOACName: formData.designatedPOACName || '',
        stsSuperintendentName: formData.stsSuperintendentName || '',
        transferDate: formData.transferDate || null,
        transferLocation: formData.transferLocation || '',
        checklist3A: (formData.checklist3A || []).map((item) => ({
          clNumber: item.clNumber,
          description: item.description || '',
          status: item.status === 'YES' ? 'YES' : 'NO',
          remarks: item.remarks === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : (item.remarks || ''),
        })),
        checklist3B: (formData.checklist3B || []).map((item) => ({
          clNumber: item.clNumber,
          description: item.description || '',
          status: item.status === 'YES' ? 'YES' : 'NO',
          remarks: item.remarks === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : (item.remarks || ''),
        })),
        signature: {
          rank: formData.signature.rank || '',
          date: formData.signature.date || null,
          signature: extractBase64(formData.signature.signature || ''),
        },
        status: 'DRAFT',
      };

      const form = new FormData();
      form.append("data", JSON.stringify(payload));

      // Use PUT for update mode, POST for create mode
      const method = isUpdateMode ? "PUT" : "POST";
      const encodedRef = encodeURIComponent(cleanOperationRef);
      const url = isUpdateMode 
        ? `/api/sts-proxy/ops-ofd-003?operationRef=${encodedRef}`
        : "/api/sts-proxy/ops-ofd-003/create";

      let res;
      try {
        res = await fetch(url, {
          method: method,
          body: form
        });
      } catch (fetchError) {
        // Handle network errors
        if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
          throw new Error('Network error: Unable to connect to server. Please check your connection.');
        }
        throw fetchError;
      }

      // Parse response (handle both success and error cases)
      const contentType = res.headers.get("content-type");
      let responseData;
      
      try {
        if (contentType?.includes("application/json")) {
          responseData = await res.json();
        } else {
          const text = await res.text();
          // Try to parse as JSON if it looks like JSON
          try {
            responseData = JSON.parse(text);
          } catch {
            // If not JSON, use the text as error message
            throw new Error(text || `Server error: ${res.status} ${res.statusText}`);
          }
        }
      } catch (parseError) {
        // If we can't parse, use the parse error or status
        throw new Error(parseError.message || `Server error: ${res.status} ${res.statusText}`);
      }

      if (!res.ok) {
        const errorMsg = responseData?.error || responseData?.message || `Submission failed: ${res.status} ${res.statusText}`;
        throw new Error(errorMsg);
      }

      setSubmitSuccess(true);
      // Reset form after successful submission
      if (isUpdateMode) {
        // After update, reset to create mode and clear URL params
        resetFormToCreateMode();
      } else {
        // After create, just reset form (keep operationRef if in URL)
        resetForm();
      }

    } catch (err) {
      // Convert technical error to user-friendly message
      const userFriendlyError = getUserFriendlyError(err);
      setSubmitError(userFriendlyError);
      // Log technical details to console for debugging (not shown to user)
      console.error('Error submitting checklist:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const renderChecklistTable = (checklistType, title) => {
    const checklist = formData[checklistType];
    
    return (
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-600">
            <thead>
              <tr className="bg-gray-700">
                <th className="border border-gray-600 p-3 text-center w-16">CL</th>
                <th className="border border-gray-600 p-3 text-left">Description</th>
                <th className="border border-gray-600 p-3 text-center w-32">Status</th>
                <th className="border border-gray-600 p-3 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {checklist.map((item, index) => (
                <tr key={item.clNumber} className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold">
                    {item.clNumber}
                  </td>
                  <td className="border border-gray-600 p-3">
                    <div className="text-white text-sm">
                      {item.description}
                    </div>
                  </td>
                  <td className="border border-gray-600 p-3 text-center">
                    <label className="flex items-center justify-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.status === 'YES'}
                        onChange={(e) => handleChecklistChange(checklistType, index, 'status', e.target.checked ? 'YES' : '')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Yes</span>
                    </label>
                  </td>
                  <td className="border border-gray-600 p-3">
                    {item.hasNotApplicable ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.remarks === 'NOT_APPLICABLE'}
                          onChange={(e) => handleChecklistChange(checklistType, index, 'remarks', e.target.checked ? 'NOT_APPLICABLE' : '')}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Not applicable</span>
                      </label>
                    ) : (
                      <input
                        type="text"
                        value={item.remarks}
                        onChange={(e) => handleChecklistChange(checklistType, index, 'remarks', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                        placeholder="Add remarks..."
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Show loading state while fetching data
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
        {/* Header Section */}
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
              AT SEA SHIP TO SHIP TRANSFER
            </h1>
            <h2 className="text-base sm:text-lg lg:text-xl font-semibold">
              CHECKLIST 3A & 3B - BEFORE CARGO TRANSFER
            </h2>
            {isUpdateMode && (
              <div className="mt-2 px-3 sm:px-4 py-1 bg-yellow-600/30 border border-yellow-500 rounded text-yellow-300 text-xs sm:text-sm font-semibold">
                EDIT MODE
              </div>
            )}
          </div>
          <div className="bg-gray-700 p-3 sm:p-4 rounded w-full lg:w-auto lg:min-w-[200px]">
            <div className="text-xs sm:text-sm space-y-1">
              <div><strong>Form No:</strong> {formData.formNo}</div>
              <div><strong>Issue Date:</strong> {formData.issueDate}</div>
              <div><strong>Approved by:</strong> {formData.approvedBy}</div>
              <div><strong>Operation Ref:</strong> {formData.operationRef || '—'}</div>
            </div>
          </div>
        </div>

        {/* Transfer Info Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Transfer Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Constant Heading Ship:</label>
              <input
                type="text"
                value={formData.constantHeadingShip}
                onChange={(e) => handleTransferInfoChange('constantHeadingShip', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Manoeuvring Ship:</label>
              <input
                type="text"
                value={formData.manoeuvringShip}
                onChange={(e) => handleTransferInfoChange('manoeuvringShip', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Name of Designated POAC:</label>
              <input
                type="text"
                value={formData.designatedPOACName}
                onChange={(e) => handleTransferInfoChange('designatedPOACName', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Name of STS Superintendent if Different from POAC:</label>
              <input
                type="text"
                value={formData.stsSuperintendentName}
                onChange={(e) => handleTransferInfoChange('stsSuperintendentName', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Date of Transfer:</label>
              <input
                type="date"
                value={formData.transferDate}
                onChange={(e) => handleTransferInfoChange('transferDate', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Location of Transfer:</label>
              <input
                type="text"
                value={formData.transferLocation}
                onChange={(e) => handleTransferInfoChange('transferLocation', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Checklist 3A Section */}
        {renderChecklistTable('checklist3A', 'CHECKLIST 3A - Generic Checks (1-21)')}

        {/* Checklist 3B Section */}
        {renderChecklistTable('checklist3B', 'CHECKLIST 3B - LPG/LNG Additional Checks')}

        {/* Submit error */}
        {submitError && (
          <div className="mb-4 p-3 sm:p-4 bg-red-900/30 border border-red-600 rounded text-red-300">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="font-semibold mb-1 text-sm sm:text-base">Error</p>
                <p className="text-xs sm:text-sm wrap-break-word">{submitError}</p>
              </div>
            </div>
          </div>
        )}
        {/* Signature Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Signature</h3>
          <div className="bg-gray-700 p-6 rounded">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm mb-1">Rank:</label>
                <input
                  type="text"
                  value={formData.signature.rank}
                  onChange={(e) => handleSignatureChange('rank', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Date:</label>
                <input
                  type="date"
                  value={formData.signature.date}
                  onChange={(e) => handleSignatureChange('date', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm mb-1">Signature:</label>
                <input
                  ref={signatureFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
                {formData.signature.signature && (
                  <div className="mt-2">
                    <img
                      src={formData.signature.signature}
                      alt="Signature preview"
                      className="max-w-full h-24 border border-gray-600 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => handleSignatureChange('signature', '')}
                      className="mt-2 text-sm text-red-400 hover:text-red-300"
                    >
                      Remove Signature
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 sm:gap-4">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto"
          >
            {(() => {
              if (submitting) {
                return isUpdateMode ? 'Updating...' : 'Submitting...';
              }
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


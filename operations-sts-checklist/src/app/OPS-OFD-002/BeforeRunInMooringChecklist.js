'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';

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
        const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL1 || 'http://localhost:3000';
        // Remove /api/operations/sts-checklist from backend URL if present to get base URL
        const baseUrl = backendBaseUrl.replace(/\/api\/operations\/sts-checklist\/?$/, '');
        // Ensure base URL doesn't end with /
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        return `${cleanBaseUrl}${signature}`;
    }
    
    return signature;
};

// Helper function to extract base64 from data URL for docx generation
const extractBase64 = (dataUrl) => {
    if (!dataUrl) return '';
    if (dataUrl.startsWith('data:')) {
        return dataUrl.split(',')[1] || dataUrl;
    }
    return dataUrl;
};

const GENERIC_CHECKS = [
  { id: 1, description: 'Fenders and associated equipment are visually inspected, in good condition, correctly positioned and rigged', remark: '', hasNotApplicable: false },
  { id: 2, description: 'There are no overhanging projections on the side of berthing', remark: '', hasNotApplicable: false },
  { id: 3, description: 'A proficient helms person is at the wheel', remark: 'Not applicable if moored', hasNotApplicable: false },
  { id: 4, description: 'Course and speed information is agreed', remark: 'Not applicable if moored', hasNotApplicable: false },
  { id: 5, description: 'The method for controlling the ship\'s speed is agreed', remark: 'Not applicable if moored', hasNotApplicable: false },
  { id: 6, description: 'Navigational signals are displayed', remark: 'Not applicable if moored', hasNotApplicable: false },
  { id: 7, description: 'Adequate illumination is available', remark: '', hasNotApplicable: false },
  { id: 8, description: 'Power is available for mooring winches, and they are in good order', remark: '', hasNotApplicable: false },
  { id: 9, description: 'Mooring lines, rope messengers, rope stoppers, chain stoppers and heaving lines are ready for use', remark: '', hasNotApplicable: false },
  { id: 10, description: 'Crew are standing by at their mooring stations', remark: '', hasNotApplicable: false },
  { id: 11, description: 'Communications are established with mooring personnel and with the other ship', remark: '', hasNotApplicable: false },
  { id: 12, description: 'Firefighting and anti-pollution equipment is ready for use', remark: '', hasNotApplicable: false },
  { id: 13, description: 'Shipping traffic in the area is being monitored and, if applicable, Vessel Traffic Services (VTS) are informed', remark: '', hasNotApplicable: false },
  { id: 14, description: 'The Automatic Identification System (AIS) is appropriately set', remark: '', hasNotApplicable: false },
  { id: 15, description: 'Cargo tanks are inerted', remark: '', hasNotApplicable: true },
];

export default function BeforeRunInMooringChecklist() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const signatureFileInputRef = useRef(null);
  
  // Read URL params inside useEffect to ensure reactivity
  const rawOperationRef = searchParams.get('operationRef');
  const operationRef = rawOperationRef ? rawOperationRef.replace(/,\s*$/, '').trim() : null;
  const mode = searchParams.get('mode'); // 'update' or null

  const [formData, setFormData] = useState({
    operationRef: operationRef || '',
    formNo: 'OPS-OFD-002',
    issueDate: new Date().toISOString().split('T')[0],
    approvedBy: 'JS',
    // Operation Details
    constantHeadingShip: '',
    maneuveringShip: '',
    nameOfDesignatedPOAC: '',
    nameOfSTSSuperintendent: '',
    dateOfTransfer: '',
    locationOfTransfer: '',
    // Generic Checks
    genericChecks: GENERIC_CHECKS.map(check => ({
      id: check.id,
      description: check.description,
      status: false,
      notApplicable: false,
      remark: check.remark,
      userRemark: '',
      hasNotApplicable: check.hasNotApplicable,
    })),
    // Signature
    signature: {
      name: '',
      rank: '',
      signature: '',
      date: '',
    },
  });

  // Function to reset form to initial state (for create mode)
  const resetForm = () => {
    setFormData({
      operationRef: operationRef || '',
      formNo: 'OPS-OFD-002',
      issueDate: new Date().toISOString().split('T')[0],
      approvedBy: 'JS',
      constantHeadingShip: '',
      maneuveringShip: '',
      nameOfDesignatedPOAC: '',
      nameOfSTSSuperintendent: '',
      dateOfTransfer: '',
      locationOfTransfer: '',
      genericChecks: GENERIC_CHECKS.map(check => ({
        id: check.id,
        description: check.description,
        status: false,
        notApplicable: false,
        remark: check.remark,
        userRemark: '',
        hasNotApplicable: check.hasNotApplicable,
      })),
      signature: {
        name: '',
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
      formNo: 'OPS-OFD-002',
      issueDate: new Date().toISOString().split('T')[0],
      approvedBy: 'JS',
      constantHeadingShip: '',
      maneuveringShip: '',
      nameOfDesignatedPOAC: '',
      nameOfSTSSuperintendent: '',
      dateOfTransfer: '',
      locationOfTransfer: '',
      genericChecks: GENERIC_CHECKS.map(check => ({
        id: check.id,
        description: check.description,
        status: false,
        notApplicable: false,
        remark: check.remark,
        userRemark: '',
        hasNotApplicable: check.hasNotApplicable,
      })),
      signature: {
        name: '',
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
    router.replace('/OPS-OFD-002');
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

  // Function to fetch existing data for update mode
  const fetchExistingData = async (refNumber) => {
    try {
      setLoadingData(true);
      setSubmitError(null);
      
      // Trim trailing comma and whitespace
      const trimmedRef = refNumber?.replace(/,\s*$/, '').trim();
      
      console.log('[OPS-OFD-002] fetchExistingData called with:', { refNumber, trimmedRef });
      
      if (!trimmedRef) {
        throw new Error('Operation reference is required');
      }
      
      // URL encode the operationRef
      const encodedRef = encodeURIComponent(trimmedRef);
      const fetchUrl = `/api/sts-proxy/ops-ofd-002?operationRef=${encodedRef}`;
      console.log('[OPS-OFD-002] Fetching data from:', fetchUrl);
      
      const res = await fetch(fetchUrl);
      
      console.log('Response status:', res.status);
      
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
      
      console.log('Response data:', responseData);
      
      if (!res.ok) {
        const errorMsg = responseData?.error || responseData?.message || `SERVER_ERROR_${res.status}`;
        throw new Error(errorMsg);
      }
      
      // Populate form with fetched data
      // Handle both response.data and direct response
      const data = responseData?.data || responseData;
      
      console.log('Extracted data:', data);
      
      if (!data) {
        throw new Error('NO_DATA_RECEIVED');
      }
      
      // Clean operationRef from data (remove trailing comma if present)
      const cleanOperationRef = (data.operationRef || trimmedRef || '')?.replace(/,\s*$/, '').trim();
      
      console.log('[OPS-OFD-002] Raw data from API:', data);
      
      // Extract values from MongoDB structure
      const transferInfo = data.transferInfo || {};
      const documentInfo = data.documentInfo || {};
      const checklistItems = data.checklistItems || [];
      const signature = data.signature || {};
      
      const newFormData = {
        operationRef: cleanOperationRef || '',
        formNo: (documentInfo.formNo || 'OPS-OFD-002')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-002',
        issueDate: safeParseDate(documentInfo.issueDate) || new Date().toISOString().split('T')[0],
        approvedBy: documentInfo.approvedBy || 'JS',
        // Transfer Info mapping
        constantHeadingShip: transferInfo.constantHeadingShip || '',
        maneuveringShip: transferInfo.manoeuvringShip || '',
        nameOfDesignatedPOAC: transferInfo.designatedPOACName || '',
        nameOfSTSSuperintendent: transferInfo.stsSuperintendentName || '',
        dateOfTransfer: safeParseDate(transferInfo.transferDate) || '',
        locationOfTransfer: transferInfo.transferLocation || '',
        // Map checklistItems to genericChecks
        genericChecks: checklistItems && checklistItems.length > 0
          ? checklistItems.map((item, index) => ({
              id: item.clNumber || GENERIC_CHECKS[index]?.id || index + 1,
              description: item.description || GENERIC_CHECKS[index]?.description || '',
              status: item.status?.yes || false,
              notApplicable: item.status?.notApplicable || false,
              remark: GENERIC_CHECKS[index]?.remark || '',
              userRemark: item.remarks || '',
              hasNotApplicable: GENERIC_CHECKS[index]?.hasNotApplicable || false,
            }))
          : GENERIC_CHECKS.map(check => ({
              id: check.id,
              description: check.description,
              status: false,
              notApplicable: false,
              remark: check.remark,
              userRemark: '',
              hasNotApplicable: check.hasNotApplicable,
            })),
        // Signature mapping
        signature: {
          name: signature.name || '',
          rank: signature.rank || '',
          signature: getSignatureUrl(signature.signature || ''),
          date: safeParseDate(signature.date) || '',
        },
      };
      
      console.log('[OPS-OFD-002] Setting form data:', newFormData);
      setFormData(newFormData);
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
    console.log('useEffect triggered:', { operationRef, mode });
    
    if (operationRef) {
      setFormData(prev => ({
        ...prev,
        operationRef
      }));
    }
    
    // Check if mode is 'update'
    if (mode === 'update' && operationRef) {
      console.log('Update mode detected, fetching data for:', operationRef);
      setIsUpdateMode(true);
      fetchExistingData(operationRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operationRef, mode]);

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleChecklistChange = (index, checked) => {
    const updatedChecks = [...formData.genericChecks];
    updatedChecks[index].status = checked;
    if (checked) {
      updatedChecks[index].notApplicable = false;
    }
    setFormData({ ...formData, genericChecks: updatedChecks });
  };

  const handleNotApplicableChange = (index, checked) => {
    const updatedChecks = [...formData.genericChecks];
    updatedChecks[index].notApplicable = checked;
    if (checked) {
      updatedChecks[index].status = false;
    }
    setFormData({ ...formData, genericChecks: updatedChecks });
  };

  const handleRemarkChange = (index, value) => {
    const updatedChecks = [...formData.genericChecks];
    updatedChecks[index].userRemark = value;
    setFormData({ ...formData, genericChecks: updatedChecks });
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
        formNo: (formData.formNo || 'OPS-OFD-002')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-002',
        revisionNo: formData.revisionNo || '',
        revisionDate: formData.issueDate || null,
        approvedBy: formData.approvedBy,
        constantHeadingShip: formData.constantHeadingShip,
        maneuveringShip: formData.maneuveringShip,
        nameOfDesignatedPOAC: formData.nameOfDesignatedPOAC,
        nameOfSTSSuperintendent: formData.nameOfSTSSuperintendent,
        dateOfTransfer: formData.dateOfTransfer || null,
        locationOfTransfer: formData.locationOfTransfer,
        genericChecks: formData.genericChecks.map((c) => ({
          id: c.id,
          clNumber: c.id,
          description: c.description || '',
          status: c.status,
          notApplicable: c.notApplicable,
          remarks: c.remark || '',
          userRemark: c.userRemark || '',
        })),
        signature: {
          name: formData.signature.name || '',
          rank: formData.signature.rank || '',
          date: formData.signature.date || null,
        },
        signatureBlock: { 
          signature: extractBase64(formData.signature.signature || '') 
        },
        status: 'DRAFT',
      };

      const form = new FormData();
      form.append("data", JSON.stringify(payload));

      // Use PUT for update mode, POST for create mode
      const method = isUpdateMode ? "PUT" : "POST";
      const encodedRef = encodeURIComponent(cleanOperationRef);
      const url = isUpdateMode 
        ? `/api/sts-proxy/ops-ofd-002?operationRef=${encodedRef}`
        : "/api/sts-proxy/ops-ofd-002/create";

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
              CHECKLIST 2 - BEFORE RUN IN & MOORING
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
              <div><strong>Operation Ref:</strong> {formData.operationRef}</div>
            </div>
          </div>
        </div>

        {/* Operation Details Section */}
        <div className="mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Operation Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label htmlFor="constantHeadingShip" className="block text-sm mb-1">Constant Heading Ship:</label>
              <input
                id="constantHeadingShip"
                type="text"
                value={formData.constantHeadingShip}
                onChange={(e) => handleInputChange('constantHeadingShip', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
              />
            </div>
            <div>
              <label htmlFor="maneuveringShip" className="block text-sm mb-1">Maneuvering Ship:</label>
              <input
                id="maneuveringShip"
                type="text"
                value={formData.maneuveringShip}
                onChange={(e) => handleInputChange('maneuveringShip', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
              />
            </div>
            <div>
              <label htmlFor="nameOfDesignatedPOAC" className="block text-sm mb-1">Name of Designated POAC:</label>
              <input
                id="nameOfDesignatedPOAC"
                type="text"
                value={formData.nameOfDesignatedPOAC}
                onChange={(e) => handleInputChange('nameOfDesignatedPOAC', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
              />
            </div>
            <div>
              <label htmlFor="nameOfSTSSuperintendent" className="block text-sm mb-1">Name of STS Superintendent if Different from POAC:</label>
              <input
                id="nameOfSTSSuperintendent"
                type="text"
                value={formData.nameOfSTSSuperintendent}
                onChange={(e) => handleInputChange('nameOfSTSSuperintendent', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
              />
            </div>
            <div>
              <label htmlFor="dateOfTransfer" className="block text-sm mb-1">Date of Transfer:</label>
              <input
                id="dateOfTransfer"
                type="date"
                value={formData.dateOfTransfer}
                onChange={(e) => handleInputChange('dateOfTransfer', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
              />
            </div>
            <div>
              <label htmlFor="locationOfTransfer" className="block text-sm mb-1">Location of Transfer:</label>
              <input
                id="locationOfTransfer"
                type="text"
                value={formData.locationOfTransfer}
                onChange={(e) => handleInputChange('locationOfTransfer', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
              />
            </div>
          </div>
        </div>

        {/* Generic Checks Table */}
        <div className="mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Generic Checks</h3>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full border-collapse border border-gray-600">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="border border-gray-600 p-2 sm:p-3 text-center w-12 sm:w-16 text-xs sm:text-sm">CL</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Generic Checks</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center w-24 sm:w-32 text-xs sm:text-sm">Status</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.genericChecks.map((check, index) => (
                    <tr key={check.id} className="hover:bg-gray-700">
                      <td className="border border-gray-600 p-2 sm:p-3 text-center font-semibold text-xs sm:text-sm">
                        {check.id}
                      </td>
                      <td className="border border-gray-600 p-2 sm:p-3 text-xs sm:text-sm">
                        {check.description}
                        {check.remark && (
                          <span className="block text-xs text-gray-400 mt-1 italic">
                            ({check.remark})
                          </span>
                        )}
                      </td>
                      <td className="border border-gray-600 p-2 sm:p-3">
                        <div className="flex flex-col gap-2 items-center">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={check.status}
                              onChange={(e) => handleChecklistChange(index, e.target.checked)}
                              className="w-4 h-4"
                            />
                            <span className="text-xs sm:text-sm">Yes</span>
                          </label>
                          {check.hasNotApplicable && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={check.notApplicable}
                                onChange={(e) => handleNotApplicableChange(index, e.target.checked)}
                                className="w-4 h-4"
                              />
                              <span className="text-xs sm:text-sm">Not applicable</span>
                            </label>
                          )}
                        </div>
                      </td>
                      <td className="border border-gray-600 p-2 sm:p-3">
                        <input
                          type="text"
                          value={check.userRemark}
                          onChange={(e) => handleRemarkChange(index, e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm"
                          placeholder="Add remark..."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Signature Section */}
        <div className="mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Signature</h3>
          <div className="bg-gray-700 p-4 sm:p-6 rounded">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="signatureName" className="block text-sm mb-1">Name:</label>
                <input
                  id="signatureName"
                  type="text"
                  value={formData.signature.name}
                  onChange={(e) => handleSignatureChange('name', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
                />
              </div>
              <div>
                <label htmlFor="signatureRank" className="block text-sm mb-1">Rank:</label>
                <input
                  id="signatureRank"
                  type="text"
                  value={formData.signature.rank}
                  onChange={(e) => handleSignatureChange('rank', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
                />
              </div>
              <div>
                <label htmlFor="signatureFile" className="block text-sm mb-1">Signature:</label>
                <input
                  ref={signatureFileInputRef}
                  id="signatureFile"
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
                      className="max-w-full h-24 border border-gray-600 rounded object-contain bg-gray-700"
                      onError={(e) => {
                        // Handle image load errors gracefully
                        const img = e.target;
                        img.style.display = 'none';
                        // Check if error message already exists
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
                      onClick={() => handleSignatureChange('signature', '')}
                      className="mt-2 text-sm text-red-400 hover:text-red-300"
                    >
                      Remove Signature
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="signatureDate" className="block text-sm mb-1">Date:</label>
                <input
                  id="signatureDate"
                  type="date"
                  value={formData.signature.date}
                  onChange={(e) => handleSignatureChange('date', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="mb-4 p-3 sm:p-4 bg-red-900/30 border border-red-600 rounded text-red-300">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="font-semibold mb-1 text-sm sm:text-base">Error</p>
                <p className="text-xs sm:text-sm break-words">{submitError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-3 sm:gap-4">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto"
          >
            {submitting 
              ? (isUpdateMode ? 'Updating...' : 'Submitting...') 
              : (isUpdateMode ? 'Update Checklist' : 'Submit Checklist')
            }
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


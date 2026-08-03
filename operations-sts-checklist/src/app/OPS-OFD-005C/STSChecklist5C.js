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

// Default Checklist Items
const DEFAULT_CHECKLIST_ITEMS = [
  { clNumber: 1, description: 'Relevant local requirements, including permissions, are obtained and complied with OCIMF' },
  { clNumber: 2, description: 'Procedures for cargo and ballast operations have been reviewed and accepted by all parties.' },
  { clNumber: 3, description: 'Effective communication between the ships and the terminal is established' },
  { clNumber: 4, description: 'Security information has been exchanged and, if required, a Declaration of Security has been completed' },
  { clNumber: 5, description: 'Present and forecast weather and sea conditions have been considered' },
  { clNumber: 6, description: 'Cargo specifications, hazardous properties, SDS and any requirements for inerting, heating, reactivity and inhibitors have been exchanged' },
  { clNumber: 7, description: 'Tank venting system and dosed operation procedures are agreed' },
  { clNumber: 8, description: 'Procedures for vapour control/balancing have been agreed' },
  { clNumber: 9, description: 'Access to the cargo deck is restricted and controlled during cargo transfer operations' },
  { clNumber: 10, description: 'All personnel on deck are wearing appropriate PPE, including gas detectors as per company PPE matrix' },
];

export default function STSChecklist5C() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Trim trailing comma from operationRef if present
  const rawOperationRef = searchParams.get('operationRef');
  const operationRef = rawOperationRef ? rawOperationRef.replace(/,\s*$/, '').trim() : null;
  const mode = searchParams.get('mode'); // 'update' or null

  const [formData, setFormData] = useState({
    operationRef: operationRef || '',
    // Document Info
    documentInfo: {
      formNo: 'OPS-OFD-005C',
      issueDate: new Date().toISOString().split('T')[0],
      approvedBy: 'JS',
    },
    // Terminal Transfer Info
    terminalTransferInfo: {
      terminalBerthedShip: '',
      outerShip: '',
      terminal: '',
    },
    // Checklist Items
    checklistItems: DEFAULT_CHECKLIST_ITEMS.map(item => ({
      clNumber: item.clNumber,
      description: item.description,
      status: {
        terminalBerthedShip: false,
        outerShip: false,
        terminal: false,
      },
      remarks: '',
    })),
    // Responsible Persons
    responsiblePersons: {
      chsOfficerName: '',
      msOfficerName: '',
      terminalRepresentativeName: '',
      stsSuperintendentName: '',
    },
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);

  // Function to reset form to initial state (for create mode)
  const resetForm = () => {
    setFormData({
      operationRef: operationRef || '',
      documentInfo: {
        formNo: 'OPS-OFD-005C',
        issueDate: new Date().toISOString().split('T')[0],
        approvedBy: 'JS',
      },
      terminalTransferInfo: {
        terminalBerthedShip: '',
        outerShip: '',
        terminal: '',
      },
      checklistItems: DEFAULT_CHECKLIST_ITEMS.map(item => ({
        clNumber: item.clNumber,
        description: item.description,
        status: {
          terminalBerthedShip: false,
          outerShip: false,
          terminal: false,
        },
        remarks: '',
      })),
      responsiblePersons: {
        chsOfficerName: '',
        msOfficerName: '',
        terminalRepresentativeName: '',
        stsSuperintendentName: '',
      },
    });
  };

  // Function to reset form completely and clear URL params (for update mode after submission)
  const resetFormToCreateMode = () => {
    setFormData({
      operationRef: '',
      documentInfo: {
        formNo: 'OPS-OFD-005C',
        issueDate: new Date().toISOString().split('T')[0],
        approvedBy: 'JS',
      },
      terminalTransferInfo: {
        terminalBerthedShip: '',
        outerShip: '',
        terminal: '',
      },
      checklistItems: DEFAULT_CHECKLIST_ITEMS.map(item => ({
        clNumber: item.clNumber,
        description: item.description,
        status: {
          terminalBerthedShip: false,
          outerShip: false,
          terminal: false,
        },
        remarks: '',
      })),
      responsiblePersons: {
        chsOfficerName: '',
        msOfficerName: '',
        terminalRepresentativeName: '',
        stsSuperintendentName: '',
      },
    });
    // Clear update mode
    setIsUpdateMode(false);
    // Clear URL parameters
    router.replace('/OPS-OFD-005C');
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
      const res = await fetch(`/api/sts-proxy/ops-ofd-005c?operationRef=${encodedRef}`);
      
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
        documentInfo: {
          formNo: (data.documentInfo?.formNo || 'OPS-OFD-005C')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-005C',
          issueDate: safeParseDate(data.documentInfo?.issueDate) || new Date().toISOString().split('T')[0],
          approvedBy: data.documentInfo?.approvedBy || 'JS',
        },
        terminalTransferInfo: {
          terminalBerthedShip: data.terminalTransferInfo?.terminalBerthedShip || '',
          outerShip: data.terminalTransferInfo?.outerShip || '',
          terminal: data.terminalTransferInfo?.terminal || '',
        },
        checklistItems: data.checklistItems && Array.isArray(data.checklistItems) && data.checklistItems.length > 0
          ? data.checklistItems.map((item, index) => ({
              clNumber: item.clNumber || DEFAULT_CHECKLIST_ITEMS[index]?.clNumber || index + 1,
              description: item.description || DEFAULT_CHECKLIST_ITEMS[index]?.description || '',
              status: {
                terminalBerthedShip: item.status?.terminalBerthedShip || false,
                outerShip: item.status?.outerShip || false,
                terminal: item.status?.terminal || false,
              },
              remarks: item.remarks || '',
            }))
          : DEFAULT_CHECKLIST_ITEMS.map(item => ({
              clNumber: item.clNumber,
              description: item.description,
              status: {
                terminalBerthedShip: false,
                outerShip: false,
                terminal: false,
              },
              remarks: '',
            })),
        responsiblePersons: {
          chsOfficerName: data.responsiblePersons?.chsOfficerName || '',
          msOfficerName: data.responsiblePersons?.msOfficerName || '',
          terminalRepresentativeName: data.responsiblePersons?.terminalRepresentativeName || '',
          stsSuperintendentName: data.responsiblePersons?.stsSuperintendentName || '',
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

  // Document Info handlers
  const handleDocumentInfoChange = (field, value) => {
    setFormData({
      ...formData,
      documentInfo: {
        ...formData.documentInfo,
        [field]: value,
      },
    });
  };

  // Terminal Transfer Info handlers
  const handleTerminalTransferInfoChange = (field, value) => {
    setFormData({
      ...formData,
      terminalTransferInfo: {
        ...formData.terminalTransferInfo,
        [field]: value,
      },
    });
  };

  // Checklist Item handlers
  const handleChecklistItemStatusChange = (index, field, checked) => {
    const updatedItems = [...formData.checklistItems];
    updatedItems[index].status[field] = checked;
    setFormData({ ...formData, checklistItems: updatedItems });
  };

  const handleChecklistItemRemarksChange = (index, value) => {
    const updatedItems = [...formData.checklistItems];
    updatedItems[index].remarks = value;
    setFormData({ ...formData, checklistItems: updatedItems });
  };

  // Responsible Persons handlers
  const handleResponsiblePersonChange = (field, value) => {
    setFormData({
      ...formData,
      responsiblePersons: {
        ...formData.responsiblePersons,
        [field]: value,
      },
    });
  };

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
        documentInfo: {
          formNo: (formData.documentInfo.formNo || 'OPS-OFD-005C')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-005C',
          issueDate: formData.documentInfo.issueDate || null,
          approvedBy: formData.documentInfo.approvedBy || 'JS',
        },
        terminalTransferInfo: {
          terminalBerthedShip: formData.terminalTransferInfo.terminalBerthedShip || '',
          outerShip: formData.terminalTransferInfo.outerShip || '',
          terminal: formData.terminalTransferInfo.terminal || '',
        },
        checklistItems: formData.checklistItems.map((item) => ({
          clNumber: item.clNumber,
          description: item.description || '',
          status: {
            terminalBerthedShip: item.status?.terminalBerthedShip || false,
            outerShip: item.status?.outerShip || false,
            terminal: item.status?.terminal || false,
          },
          remarks: item.remarks || '',
        })),
        responsiblePersons: {
          chsOfficerName: formData.responsiblePersons.chsOfficerName || '',
          msOfficerName: formData.responsiblePersons.msOfficerName || '',
          terminalRepresentativeName: formData.responsiblePersons.terminalRepresentativeName || '',
          stsSuperintendentName: formData.responsiblePersons.stsSuperintendentName || '',
        },
        status: 'DRAFT',
      };

      const form = new FormData();
      form.append("data", JSON.stringify(payload));

      // Use PUT for update mode, POST for create mode
      const method = isUpdateMode ? "PUT" : "POST";
      const encodedRef = encodeURIComponent(cleanOperationRef);
      const url = isUpdateMode 
        ? `/api/sts-proxy/ops-ofd-005c?operationRef=${encodedRef}`
        : "/api/sts-proxy/ops-ofd-005c/create";

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
              CHECKLIST 7 - CHECKS PRE TRANSFER CONFERENCE ALONGSIDE A TERMINAL
            </h2>
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
              {formData.operationRef && (
                <div><strong>Operation Ref:</strong> {formData.operationRef}</div>
              )}
            </div>
          </div>
        </div>

        {/* Terminal Transfer Information Section */}
        <div className="mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Transfer Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label htmlFor="terminal-berthed-ship" className="block text-sm mb-1">Terminal Berthed Ship:</label>
              <input
                id="terminal-berthed-ship"
                type="text"
                value={formData.terminalTransferInfo.terminalBerthedShip}
                onChange={(e) => handleTerminalTransferInfoChange('terminalBerthedShip', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
              />
            </div>
            <div>
              <label htmlFor="outer-ship" className="block text-sm mb-1">Outer Ship:</label>
              <input
                id="outer-ship"
                type="text"
                value={formData.terminalTransferInfo.outerShip}
                onChange={(e) => handleTerminalTransferInfoChange('outerShip', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
              />
            </div>
            <div>
              <label htmlFor="terminal" className="block text-sm mb-1">Terminal:</label>
              <input
                id="terminal"
                type="text"
                value={formData.terminalTransferInfo.terminal}
                onChange={(e) => handleTerminalTransferInfoChange('terminal', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
              />
            </div>
          </div>
        </div>

        {/* Checklist Items Section */}
        <div className="mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Checklist Items</h3>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="w-full border-collapse border border-gray-600">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Description</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center min-w-[100px] sm:min-w-[120px] text-xs sm:text-sm">Terminal Berthed Ship</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center min-w-[100px] sm:min-w-[120px] text-xs sm:text-sm">Outer ship</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-center min-w-[100px] sm:min-w-[120px] text-xs sm:text-sm">Terminal</th>
                    <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.checklistItems.map((item, index) => (
                    <tr key={item.clNumber} className="hover:bg-gray-700">
                      <td className="border border-gray-600 p-2 sm:p-3">
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-gray-300 text-xs sm:text-sm">{item.clNumber}.</span>
                          <span className="text-xs sm:text-sm">{item.description}</span>
                        </div>
                      </td>
                      <td className="border border-gray-600 p-2 sm:p-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.status.terminalBerthedShip}
                          onChange={(e) => handleChecklistItemStatusChange(index, 'terminalBerthedShip', e.target.checked)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="border border-gray-600 p-2 sm:p-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.status.outerShip}
                          onChange={(e) => handleChecklistItemStatusChange(index, 'outerShip', e.target.checked)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="border border-gray-600 p-2 sm:p-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.status.terminal}
                          onChange={(e) => handleChecklistItemStatusChange(index, 'terminal', e.target.checked)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="border border-gray-600 p-2 sm:p-3">
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={(e) => handleChecklistItemRemarksChange(index, e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm"
                          placeholder="Add remarks..."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Responsible Persons Section */}
        <div className="mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Responsible Persons</h3>
          <div className="bg-gray-700 p-4 sm:p-6 rounded">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="chs-officer-name" className="block text-sm mb-1">Officer in charge of CHS: Name:</label>
                <input
                  id="chs-officer-name"
                  type="text"
                  value={formData.responsiblePersons.chsOfficerName}
                  onChange={(e) => handleResponsiblePersonChange('chsOfficerName', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
                />
              </div>
              <div>
                <label htmlFor="terminal-rep-name" className="block text-sm mb-1">Terminal Rep: Name:</label>
                <input
                  id="terminal-rep-name"
                  type="text"
                  value={formData.responsiblePersons.terminalRepresentativeName}
                  onChange={(e) => handleResponsiblePersonChange('terminalRepresentativeName', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
                />
              </div>
              <div>
                <label htmlFor="ms-officer-name" className="block text-sm mb-1">Officer in charge of MS: Name:</label>
                <input
                  id="ms-officer-name"
                  type="text"
                  value={formData.responsiblePersons.msOfficerName}
                  onChange={(e) => handleResponsiblePersonChange('msOfficerName', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
                />
              </div>
              <div>
                <label htmlFor="sts-supdt-name" className="block text-sm mb-1">STS Supdt: Name:</label>
                <input
                  id="sts-supdt-name"
                  type="text"
                  value={formData.responsiblePersons.stsSuperintendentName}
                  onChange={(e) => handleResponsiblePersonChange('stsSuperintendentName', e.target.value)}
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

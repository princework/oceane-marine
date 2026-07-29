'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';

// Default Checklist 6A items
const DEFAULT_CHECKLIST_6A = [
  { clNumber: 1, description: 'Cargo hoses, fixed cargo pipelines, vapour return lines and manifolds are drained and confirmed to be liquid-free', hasNotApplicable: false },
  { clNumber: 2, description: 'Cargo hoses, vapour return lines, fixed pipelines and manifolds are:', hasNotApplicable: false, hasPipelineConditions: true },
  { clNumber: 3, description: 'All remotely and manually operated valves are closed ready for disconnection', hasNotApplicable: false },
  { clNumber: 4, description: 'Sufficient personnel with responsible officer available for disconnection', hasNotApplicable: false },
  { clNumber: 5, description: 'Correct PPE is used', hasNotApplicable: false },
  { clNumber: 6, description: 'The other ship is notified on "ready to disconnect"', hasNotApplicable: false },
];

// Default Checklist 6B items
const DEFAULT_CHECKLIST_6B = [
  { clNumber: 1, description: 'Cargo hoses and/or manifolds are securely blanked', hasNotApplicable: false },
  { clNumber: 2, description: 'Cargo area on the ship is cleared and restored to standard condition', hasNotApplicable: false },
  { clNumber: 3, description: 'Cargo documents signed and exchanged', hasNotApplicable: false },
  { clNumber: 4, description: 'Terminal or transfer location authority is notified on the completion of the STS operation', hasNotApplicable: true },
  { clNumber: 5, description: 'The transfer side of the ship is clear of obstructions (including hose lifting equipment)', hasNotApplicable: true },
  { clNumber: 6, description: 'The method of letting go of moorings and separation of ships has been agreed', hasNotApplicable: true },
  { clNumber: 7, description: 'Mooring winches ready for operation', hasNotApplicable: true },
  { clNumber: 8, description: 'Rope messengers and stoppers are available at mooring stations', hasNotApplicable: true },
  { clNumber: 9, description: 'Communications are established with mooring personnel and with the other ship', hasNotApplicable: true },
  { clNumber: 10, description: 'Shipping traffic in the area is being monitored and a VHF alert has been transmitted', hasNotApplicable: true },
  { clNumber: 11, description: 'Manoeuvring, mooring and navigational equipment has been tested and is ready for departure', hasNotApplicable: true },
  { clNumber: 12, description: 'The other ship has been notified that unmooring can commence', hasNotApplicable: true },
];

export default function STSChecklist6AB() {
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
      formNo: 'OPS-OFD-005B',
      revisionDate: new Date().toISOString().split('T')[0],
      approvedBy: 'JS',
    },
    // Transfer Info
    transferInfo: {
      constantHeadingShip: '',
      manoeuvringShip: '',
      designatedPOACName: '',
      stsSuperintendentName: '',
      transferDate: '',
      transferLocation: '',
    },
    // Checklist 6A
    checklist6A: {
      checks: DEFAULT_CHECKLIST_6A.map(item => ({
        clNumber: item.clNumber,
        description: item.description,
        status: { yes: false, notApplicable: false },
        remarks: '',
        hasNotApplicable: item.hasNotApplicable,
        hasPipelineConditions: item.hasPipelineConditions || false,
      })),
      pipelineConditions: {
        purged: false,
        inerted: false,
        depressurized: false,
      },
    },
    // Checklist 6B
    checklist6B: DEFAULT_CHECKLIST_6B.map(item => ({
      clNumber: item.clNumber,
      description: item.description,
      status: { yes: false, notApplicable: false },
      remarks: '',
      hasNotApplicable: item.hasNotApplicable,
    })),
    // Responsible Persons
    responsiblePersons: {
      chsOfficerName: '',
      msOfficerName: '',
      terminalName: '',
      stsSuperintendentName: '',
    },
  });

  // Transfer Info handlers
  const handleTransferInfoChange = (field, value) => {
    setFormData({
      ...formData,
      transferInfo: {
        ...formData.transferInfo,
        [field]: value,
      },
    });
  };

  // Checklist 6A handlers
  const handleChecklist6AStatusChange = (index, field, checked) => {
    const updatedChecks = [...formData.checklist6A.checks];
    updatedChecks[index].status[field] = checked;
    // If one is checked, uncheck the other
    if (checked && field === 'yes') {
      updatedChecks[index].status.notApplicable = false;
    } else if (checked && field === 'notApplicable') {
      updatedChecks[index].status.yes = false;
    }
    setFormData({
      ...formData,
      checklist6A: {
        ...formData.checklist6A,
        checks: updatedChecks,
      },
    });
  };

  const handleChecklist6ARemarksChange = (index, value) => {
    const updatedChecks = [...formData.checklist6A.checks];
    updatedChecks[index].remarks = value;
    setFormData({
      ...formData,
      checklist6A: {
        ...formData.checklist6A,
        checks: updatedChecks,
      },
    });
  };

  const handlePipelineConditionChange = (field, checked) => {
    setFormData({
      ...formData,
      checklist6A: {
        ...formData.checklist6A,
        pipelineConditions: {
          ...formData.checklist6A.pipelineConditions,
          [field]: checked,
        },
      },
    });
  };

  // Checklist 6B handlers
  const handleChecklist6BStatusChange = (index, field, checked) => {
    const updatedChecklist = [...formData.checklist6B];
    updatedChecklist[index].status[field] = checked;
    // If one is checked, uncheck the other
    if (checked && field === 'yes') {
      updatedChecklist[index].status.notApplicable = false;
    } else if (checked && field === 'notApplicable') {
      updatedChecklist[index].status.yes = false;
    }
    setFormData({ ...formData, checklist6B: updatedChecklist });
  };

  const handleChecklist6BRemarksChange = (index, value) => {
    const updatedChecklist = [...formData.checklist6B];
    updatedChecklist[index].remarks = value;
    setFormData({ ...formData, checklist6B: updatedChecklist });
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

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);

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

  // Helper function to extract base64 from data URL
  const extractBase64 = (dataUrl) => {
    if (!dataUrl) return '';
    if (typeof dataUrl !== 'string') return '';
    // If it's already a base64 string (starts with data:), return as is
    if (dataUrl.startsWith('data:')) return dataUrl;
    // If it's a URL, we might need to fetch it, but for now just return empty
    if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) return '';
    // Otherwise assume it's already base64
    return dataUrl;
  };

  // Function to reset form to initial state (for create mode)
  const resetForm = () => {
    setFormData({
      operationRef: operationRef || '',
      // Document Info
      documentInfo: {
        formNo: 'OPS-OFD-005B',
        revisionDate: new Date().toISOString().split('T')[0],
        approvedBy: 'JS',
      },
      // Transfer Info
      transferInfo: {
        constantHeadingShip: '',
        manoeuvringShip: '',
        designatedPOACName: '',
        stsSuperintendentName: '',
        transferDate: '',
        transferLocation: '',
      },
      // Checklist 6A
      checklist6A: {
        checks: DEFAULT_CHECKLIST_6A.map(item => ({
          clNumber: item.clNumber,
          description: item.description,
          status: { yes: false, notApplicable: false },
          remarks: '',
          hasNotApplicable: item.hasNotApplicable,
          hasPipelineConditions: item.hasPipelineConditions || false,
        })),
        pipelineConditions: {
          purged: false,
          inerted: false,
          depressurized: false,
        },
      },
      // Checklist 6B
      checklist6B: DEFAULT_CHECKLIST_6B.map(item => ({
        clNumber: item.clNumber,
        description: item.description,
        status: { yes: false, notApplicable: false },
        remarks: '',
        hasNotApplicable: item.hasNotApplicable,
      })),
      // Responsible Persons
      responsiblePersons: {
        chsOfficerName: '',
        msOfficerName: '',
        terminalName: '',
        stsSuperintendentName: '',
      },
    });
  };

  // Function to reset form completely and clear URL params (for update mode after submission)
  const resetFormToCreateMode = () => {
    resetForm();
    // Clear update mode
    setIsUpdateMode(false);
    // Clear URL parameters
    router.replace('/OPS-OFD-005B');
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
      const res = await fetch(`/api/sts-proxy/ops-ofd-005b?operationRef=${encodedRef}`);
      
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
        // Document Info
        documentInfo: {
          formNo: (data.documentInfo?.formNo || 'OPS-OFD-005B')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-005B',
          revisionDate: safeParseDate(data.documentInfo?.issueDate || data.documentInfo?.revisionDate) || new Date().toISOString().split('T')[0],
          approvedBy: data.documentInfo?.approvedBy || 'JS',
        },
        // Transfer Info
        transferInfo: {
          constantHeadingShip: data.transferInfo?.constantHeadingShip || '',
          manoeuvringShip: data.transferInfo?.manoeuvringShip || '',
          designatedPOACName: data.transferInfo?.designatedPOACName || '',
          stsSuperintendentName: data.transferInfo?.stsSuperintendentName || '',
          transferDate: safeParseDate(data.transferInfo?.transferDate) || '',
          transferLocation: data.transferInfo?.transferLocation || '',
        },
        // Checklist 6A
        checklist6A: {
          checks: data.checklist6A?.checks && Array.isArray(data.checklist6A.checks) && data.checklist6A.checks.length > 0
            ? data.checklist6A.checks.map((check, index) => ({
                clNumber: check.clNumber || DEFAULT_CHECKLIST_6A[index]?.clNumber || index + 1,
                description: check.description || DEFAULT_CHECKLIST_6A[index]?.description || '',
                status: {
                  yes: check.status?.yes || false,
                  notApplicable: check.status?.notApplicable || false,
                },
                remarks: check.remarks || '',
                hasNotApplicable: DEFAULT_CHECKLIST_6A[index]?.hasNotApplicable || false,
                hasPipelineConditions: DEFAULT_CHECKLIST_6A[index]?.hasPipelineConditions || false,
              }))
            : DEFAULT_CHECKLIST_6A.map(item => ({
                clNumber: item.clNumber,
                description: item.description,
                status: { yes: false, notApplicable: false },
                remarks: '',
                hasNotApplicable: item.hasNotApplicable,
                hasPipelineConditions: item.hasPipelineConditions || false,
              })),
          pipelineConditions: {
            purged: data.checklist6A?.pipelineConditions?.purged || false,
            inerted: data.checklist6A?.pipelineConditions?.inerted || false,
            depressurized: data.checklist6A?.pipelineConditions?.depressurized || false,
          },
        },
        // Checklist 6B
        checklist6B: data.checklist6B && Array.isArray(data.checklist6B) && data.checklist6B.length > 0
          ? data.checklist6B.map((check, index) => ({
              clNumber: check.clNumber || DEFAULT_CHECKLIST_6B[index]?.clNumber || index + 1,
              description: check.description || DEFAULT_CHECKLIST_6B[index]?.description || '',
              status: {
                yes: check.status?.yes || false,
                notApplicable: check.status?.notApplicable || false,
              },
              remarks: check.remarks || '',
              hasNotApplicable: DEFAULT_CHECKLIST_6B[index]?.hasNotApplicable || false,
            }))
          : DEFAULT_CHECKLIST_6B.map(item => ({
              clNumber: item.clNumber,
              description: item.description,
              status: { yes: false, notApplicable: false },
              remarks: '',
              hasNotApplicable: item.hasNotApplicable,
            })),
        // Responsible Persons
        responsiblePersons: {
          chsOfficerName: data.responsiblePersons?.chsOfficerName || '',
          msOfficerName: data.responsiblePersons?.msOfficerName || '',
          terminalName: data.responsiblePersons?.terminalName || '',
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
        operationRef: operationRef
      }));
    }
    
    // Check if mode is 'update'
    if (mode === 'update' && operationRef) {
      setIsUpdateMode(true);
      fetchExistingData(operationRef);
    }
  }, [operationRef, mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitSuccess) return;
    if (submitting) return;
    
    try {
      setSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(false);
      
      // Clean operationRef (remove trailing comma if present)
      // Use formData.operationRef first, then fallback to URL param
      const cleanOperationRef = (formData.operationRef || operationRef || '')?.replace(/,\s*$/, '').trim();
      
      if (!cleanOperationRef) {
        setSubmitError("Operation reference is required. Please check the link you received.");
        setSubmitting(false);
        return;
      }

      const payload = {
        operationRef: cleanOperationRef,
        documentInfo: {
          formNo: (formData.documentInfo.formNo || 'OPS-OFD-005B')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-005B',
          issueDate: formData.documentInfo.revisionDate || null,
          approvedBy: formData.documentInfo.approvedBy || 'JS',
        },
        transferInfo: {
          constantHeadingShip: formData.transferInfo.constantHeadingShip || '',
          manoeuvringShip: formData.transferInfo.manoeuvringShip || '',
          designatedPOACName: formData.transferInfo.designatedPOACName || '',
          stsSuperintendentName: formData.transferInfo.stsSuperintendentName || '',
          transferDate: formData.transferInfo.transferDate || null,
          transferLocation: formData.transferInfo.transferLocation || '',
        },
        checklist6A: {
          checks: formData.checklist6A.checks.map((check) => ({
            clNumber: check.clNumber,
            description: check.description || '',
            status: {
              yes: check.status?.yes || false,
              notApplicable: check.status?.notApplicable || false,
            },
            remarks: check.remarks || '',
            hasNotApplicable: check.hasNotApplicable || false,
            hasPipelineConditions: check.hasPipelineConditions || false,
          })),
          pipelineConditions: {
            purged: formData.checklist6A.pipelineConditions.purged || false,
            inerted: formData.checklist6A.pipelineConditions.inerted || false,
            depressurized: formData.checklist6A.pipelineConditions.depressurized || false,
          },
        },
        checklist6B: formData.checklist6B.map((check) => ({
          clNumber: check.clNumber,
          description: check.description || '',
          status: {
            yes: check.status?.yes || false,
            notApplicable: check.status?.notApplicable || false,
          },
          remarks: check.remarks || '',
          hasNotApplicable: check.hasNotApplicable || false,
        })),
        responsiblePersons: {
          chsOfficerName: formData.responsiblePersons.chsOfficerName || '',
          msOfficerName: formData.responsiblePersons.msOfficerName || '',
          terminalName: formData.responsiblePersons.terminalName || '',
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
        ? `/api/sts-proxy/ops-ofd-005b?operationRef=${encodedRef}`
        : "/api/sts-proxy/ops-ofd-005b/create";

      // Log request details for debugging
      console.log('Submitting form:', {
        method: method,
        url: url,
        isUpdateMode: isUpdateMode,
        operationRef: cleanOperationRef,
        payload: payload
      });

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
        // Log detailed error information for debugging
        console.error('Server error response:', {
          status: res.status,
          statusText: res.statusText,
          responseData: responseData,
          url: url,
          method: method
        });
        
        // Try to extract more detailed error message
        let errorMsg = responseData?.error || responseData?.message;
        
        // If error is an object, try to stringify it
        if (typeof errorMsg === 'object' && errorMsg !== null) {
          errorMsg = JSON.stringify(errorMsg);
        }
        
        // If still no error message, use status
        if (!errorMsg) {
          errorMsg = `Submission failed: ${res.status} ${res.statusText}`;
        }
        
        throw new Error(errorMsg);
      }

      setSubmitSuccess(true);
      // Reset form after successful submission
      if (isUpdateMode) {
        // In update mode, reset to create mode after a delay
        setTimeout(() => {
          resetFormToCreateMode();
        }, 2000);
      } else {
        // In create mode, just reset the form
        setTimeout(() => {
          resetForm();
        }, 2000);
      }
    } catch (err) {
      // Log full error details for debugging
      console.error('Error submitting checklist:', {
        error: err,
        message: err.message,
        stack: err.stack,
        isUpdateMode: isUpdateMode,
        operationRef: operationRef
      });
      
      const userFriendlyError = getUserFriendlyError(err);
      setSubmitError(userFriendlyError);
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
        <div className="relative z-20 min-h-screen text-white p-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-lg">Loading checklist data...</p>
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
      <div className="relative z-20 min-h-screen text-white p-8">
        <div className="max-w-7xl mx-auto bg-gray-800/95 rounded-lg shadow-2xl p-8 backdrop-blur-sm">
        {/* Edit Mode Badge */}
        {isUpdateMode && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-600 rounded text-yellow-300 text-sm font-semibold">
            EDIT MODE: You are editing an existing checklist. Changes will update the existing record.
          </div>
        )}
        {/* Header Section */}
        <div className="flex justify-between items-start mb-8 border-b border-gray-700 pb-6">
          <div className="relative w-48 h-20">
            <Image
              src="/image/logo.png"
              alt="OCEANE GROUP - SHIP-TO-SHIP TRANSFER"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="flex-1 flex flex-col items-center text-center">
            <h1 className="text-2xl font-bold mb-2">
              AT SEA SHIP TO SHIP TRANSFER
            </h1>
            <h2 className="text-xl font-semibold">
              CHECKLIST 6A & B – CHECKS BEFORE & AFTER DISCONNECTION
            </h2>
          </div>
          <div className="bg-gray-700 p-4 rounded min-w-[200px]">
            <div className="text-sm space-y-1">
              <div><strong>Form No:</strong> {formData.documentInfo.formNo}</div>
              <div><strong>Rev Date:</strong> {formData.documentInfo.revisionDate || ''}</div>
              <div><strong>Approved by:</strong> {formData.documentInfo.approvedBy}</div>
              <div className="text-blue-300 mt-2">
                <strong>Operation Ref:</strong> {formData.operationRef || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Transfer Information Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Transfer Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="constant-heading-ship" className="block text-sm mb-1">Constant Heading Ship:</label>
              <input
                id="constant-heading-ship"
                type="text"
                value={formData.transferInfo.constantHeadingShip}
                onChange={(e) => handleTransferInfoChange('constantHeadingShip', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="manoeuvring-ship" className="block text-sm mb-1">Maneuvering Ship:</label>
              <input
                id="manoeuvring-ship"
                type="text"
                value={formData.transferInfo.manoeuvringShip}
                onChange={(e) => handleTransferInfoChange('manoeuvringShip', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="designated-poac-name" className="block text-sm mb-1">Name of Designated POAC:</label>
              <input
                id="designated-poac-name"
                type="text"
                value={formData.transferInfo.designatedPOACName}
                onChange={(e) => handleTransferInfoChange('designatedPOACName', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="sts-superintendent-name" className="block text-sm mb-1">Name of STS Superintendent if Different from POAC:</label>
              <input
                id="sts-superintendent-name"
                type="text"
                value={formData.transferInfo.stsSuperintendentName}
                onChange={(e) => handleTransferInfoChange('stsSuperintendentName', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="transfer-date" className="block text-sm mb-1">Date of Transfer:</label>
              <input
                id="transfer-date"
                type="date"
                value={formData.transferInfo.transferDate}
                onChange={(e) => handleTransferInfoChange('transferDate', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="transfer-location" className="block text-sm mb-1">Location of Transfer:</label>
              <input
                id="transfer-location"
                type="text"
                value={formData.transferInfo.transferLocation}
                onChange={(e) => handleTransferInfoChange('transferLocation', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Checklist 6A Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">CL:6A – CHECKS AFTER TRANSFER BEFORE DISCONNECTION</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-3 text-center w-16">CL 6A</th>
                  <th className="border border-gray-600 p-3 text-left">Checks before Disconnection</th>
                  <th className="border border-gray-600 p-3 text-center w-32">Status</th>
                  <th className="border border-gray-600 p-3 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {formData.checklist6A.checks.map((item, index) => (
                  <tr key={item.clNumber} className="hover:bg-gray-700">
                    <td className="border border-gray-600 p-3 text-center font-semibold">
                      {item.clNumber}
                    </td>
                    <td className="border border-gray-600 p-3">
                      <span className="text-sm">{item.description}</span>
                      {item.hasPipelineConditions && (
                        <div className="mt-2 flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.checklist6A.pipelineConditions.purged}
                              onChange={(e) => handlePipelineConditionChange('purged', e.target.checked)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">Purged</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.checklist6A.pipelineConditions.inerted}
                              onChange={(e) => handlePipelineConditionChange('inerted', e.target.checked)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">Inerted</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.checklist6A.pipelineConditions.depressurized}
                              onChange={(e) => handlePipelineConditionChange('depressurized', e.target.checked)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">Depressurized</span>
                          </label>
                        </div>
                      )}
                    </td>
                    <td className="border border-gray-600 p-3">
                      <div className="flex flex-col gap-2 items-center">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.status.yes}
                            onChange={(e) => handleChecklist6AStatusChange(index, 'yes', e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Yes</span>
                        </label>
                        {item.hasNotApplicable && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.status.notApplicable}
                              onChange={(e) => handleChecklist6AStatusChange(index, 'notApplicable', e.target.checked)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">NA</span>
                          </label>
                        )}
                      </div>
                    </td>
                    <td className="border border-gray-600 p-3">
                      <input
                        type="text"
                        value={item.remarks}
                        onChange={(e) => handleChecklist6ARemarksChange(index, e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                        placeholder="Add remarks..."
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Checklist 6B Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">CL:6B – CHECKS AFTER DISCONNECTION BEFORE UNMOORING</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-3 text-center w-16">CL 6B</th>
                  <th className="border border-gray-600 p-3 text-left">Checks before Unmooring</th>
                  <th className="border border-gray-600 p-3 text-center w-32">Status</th>
                  <th className="border border-gray-600 p-3 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {formData.checklist6B.map((item, index) => (
                  <tr key={item.clNumber} className="hover:bg-gray-700">
                    <td className="border border-gray-600 p-3 text-center font-semibold">
                      {item.clNumber}
                    </td>
                    <td className="border border-gray-600 p-3">
                      <span className="text-sm">{item.description}</span>
                    </td>
                    <td className="border border-gray-600 p-3">
                      <div className="flex flex-col gap-2 items-center">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.status.yes}
                            onChange={(e) => handleChecklist6BStatusChange(index, 'yes', e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Yes</span>
                        </label>
                        {item.hasNotApplicable && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.status.notApplicable}
                              onChange={(e) => handleChecklist6BStatusChange(index, 'notApplicable', e.target.checked)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">NA</span>
                          </label>
                        )}
                      </div>
                    </td>
                    <td className="border border-gray-600 p-3">
                      <input
                        type="text"
                        value={item.remarks}
                        onChange={(e) => handleChecklist6BRemarksChange(index, e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                        placeholder="Add remarks..."
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Responsible Persons Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Responsible Persons</h3>
          <div className="bg-gray-700 p-6 rounded">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label htmlFor="chs-officer-name" className="block text-sm mb-1">Officer in charge of CHS: Name:</label>
                <input
                  id="chs-officer-name"
                  type="text"
                  value={formData.responsiblePersons.chsOfficerName}
                  onChange={(e) => handleResponsiblePersonChange('chsOfficerName', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label htmlFor="ms-officer-name" className="block text-sm mb-1">Officer in charge of MS: Name:</label>
                <input
                  id="ms-officer-name"
                  type="text"
                  value={formData.responsiblePersons.msOfficerName}
                  onChange={(e) => handleResponsiblePersonChange('msOfficerName', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label htmlFor="terminal-name" className="block text-sm mb-1">Terminal: Name:</label>
                <input
                  id="terminal-name"
                  type="text"
                  value={formData.responsiblePersons.terminalName}
                  onChange={(e) => handleResponsiblePersonChange('terminalName', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label htmlFor="sts-supdt-name" className="block text-sm mb-1">STS Supdt: Name:</label>
                <input
                  id="sts-supdt-name"
                  type="text"
                  value={formData.responsiblePersons.stsSuperintendentName}
                  onChange={(e) => handleResponsiblePersonChange('stsSuperintendentName', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {submitError && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-600 rounded text-red-300 text-sm">{submitError}</div>
        )}
        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Checklist'}
          </button>
        </div>
        {submitSuccess && (
          <div className="mt-4 p-4 bg-green-900/30 border border-green-600 rounded text-green-300 text-sm">
            Form submitted successfully.
          </div>
        )}
        </div>
      </div>
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import DateTimePicker24 from '@/components/DateTimePicker24';
import { toDateTimeLocalValue } from '@/lib/datetime24';

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

// Default Checklist 5A items
const DEFAULT_CHECKLIST_5A = [
  { clNumber: 1, description: 'Gas detection systems are tested and operational', hasNotApplicable: false },
  { clNumber: 2, description: 'Deck seal and P/V breaker levels have been checked and are satisfactory', hasNotApplicable: true },
  { clNumber: 3, description: 'Oxygen analyser has been checked and calibrated', hasNotApplicable: true },
  { clNumber: 4, description: 'Ship\'s ESD arrangements, including automatic valves, are tested and ready for activation', hasNotApplicable: false },
  { clNumber: 5, description: 'Linked ESD connections are established and tested', hasNotApplicable: true },
  { clNumber: 6, description: 'Other parties informed on \'ready to transfer\'', hasNotApplicable: false },
];

// Default Checklist 5B Ship Repetitive Check rows
const DEFAULT_CHECKLIST_5B_ROWS = [
  { checkName: 'Date/time of check', hasRef: false, hasNotApplicable: false },
  { checkName: 'Weather/wave conditions within limits', hasRef: false, hasNotApplicable: false },
  { checkName: 'Mooring and fender arrangement is effective', hasRef: false, hasNotApplicable: false },
  { checkName: 'Access to and from the ship is safe and controlled', hasRef: false, hasNotApplicable: false },
  { checkName: 'IGS and monitoring and recording system are operational, tank atmospheres are at positive pressure', hasRef: false, hasNotApplicable: true },
  { checkName: 'Communication is effective', hasRef: false, hasNotApplicable: false },
  { checkName: 'Illumination is sufficient and effective', hasRef: false, hasNotApplicable: false },
  { checkName: 'Cargo transfer and level monitoring system is operational', hasRef: false, hasNotApplicable: false },
  { checkName: 'External openings in superstructures are controlled', hasRef: false, hasNotApplicable: false },
  { checkName: 'Pumproom ventilation is effective', hasRef: false, hasNotApplicable: true },
  { checkName: 'Ignition source and toxicity restrictions are observed', hasRef: false, hasNotApplicable: false },
  { checkName: 'MOB restrictions are observed', hasRef: false, hasNotApplicable: true },
  { checkName: 'ESD system is operational', hasRef: false, hasNotApplicable: false },
  { checkName: 'Initials', hasRef: false, hasNotApplicable: false },
];

// Default Checklist 5C Terminal Repetitive Check rows
const DEFAULT_CHECKLIST_5C_ROWS = [
  { checkName: 'Date/time of check', hasRef: false, hasNotApplicable: false },
  { checkName: 'Weather / Wave conditions Within limits', hasRef: false, hasNotApplicable: false },
  { checkName: 'Mooring and fendering arrangement is effective', hasRef: false, hasNotApplicable: false },
  { checkName: 'Access to and from the ship and terminal is safe and controlled', hasRef: false, hasNotApplicable: false },
  { checkName: 'Communication is effective', hasRef: false, hasNotApplicable: false },
  { checkName: 'Illumination is sufficient and effective', hasRef: false, hasNotApplicable: false },
  { checkName: 'Ignition Source and toxicity restrictions are observed', hasRef: false, hasNotApplicable: false },
  { checkName: 'SIMOPS restrictions are observed', hasRef: false, hasNotApplicable: false },
  { checkName: 'Terminal Emergency response is prepared', hasRef: false, hasNotApplicable: false },
  { checkName: 'Initials', hasRef: false, hasNotApplicable: false },
];

// Number of time columns for repetitive checks
const NUM_TIME_COLUMNS = 6; // For 5B (fixed from 7 to 6 based on images)
const NUM_TIME_COLUMNS_5C = 6; // For 5C

export default function STSChecklist5AC() {
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
      formNo: 'OPS-OFD-005',
      revisionNo: '1.2',
      issueDate: new Date().toISOString().split('T')[0],
      approvedBy: 'JS',
      page: '1 of 4',
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
    // Checklist 5A
    checklist5A: DEFAULT_CHECKLIST_5A.map(item => ({
      clNumber: item.clNumber,
      description: item.description,
      status: { yes: false, notApplicable: false },
      remarks: '',
      hasNotApplicable: item.hasNotApplicable,
    })),
    // Checklist 5B Ship
    checklist5BShip: {
      noteIntervalHours: '',
      entityName: '',
      rows: DEFAULT_CHECKLIST_5B_ROWS.map(row => ({
        checkName: row.checkName,
        ref: '',
        timeChecks: new Array(NUM_TIME_COLUMNS).fill(null).map((_, idx) => ({
          timeLabel: `Time${idx + 1}`,
          yes: false,
          dateTime: '', // For Date/time of check row
        })),
        notApplicable: false,
        remarks: '',
        hasNotApplicable: row.hasNotApplicable,
        hasRef: row.hasRef,
      })),
      initials: new Array(NUM_TIME_COLUMNS).fill(''),
    },
    // Checklist 5C Terminal
    checklist5CTerminal: {
      noteIntervalHours: '',
      entityName: '',
      rows: DEFAULT_CHECKLIST_5C_ROWS.map(row => ({
        checkName: row.checkName,
        ref: '',
        timeChecks: new Array(NUM_TIME_COLUMNS_5C).fill(null).map((_, idx) => ({
          timeLabel: `Time${idx + 1}`,
          yes: false,
          dateTime: '', // For Date/time of check row
        })),
        notApplicable: false,
        remarks: '',
        hasNotApplicable: row.hasNotApplicable,
        hasRef: row.hasRef,
      })),
      initials: new Array(NUM_TIME_COLUMNS_5C).fill(''),
    },
    // Signature
    signature: {
      name: '',
      rank: '',
      signature: '',
      date: '',
    },
  });

  // Document Info handlers (currently not used but kept for future use)
  // const handleDocumentInfoChange = (field, value) => {
  //   setFormData({
  //     ...formData,
  //     documentInfo: {
  //       ...formData.documentInfo,
  //       [field]: value,
  //     },
  //   });
  // };

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

  // Checklist 5A handlers
  const handleChecklist5AStatusChange = (index, field, checked) => {
    const updatedChecklist = [...formData.checklist5A];
    updatedChecklist[index].status[field] = checked;
    // If one is checked, uncheck the other
    if (checked && field === 'yes') {
      updatedChecklist[index].status.notApplicable = false;
    } else if (checked && field === 'notApplicable') {
      updatedChecklist[index].status.yes = false;
    }
    setFormData({ ...formData, checklist5A: updatedChecklist });
  };

  const handleChecklist5ARemarksChange = (index, value) => {
    const updatedChecklist = [...formData.checklist5A];
    updatedChecklist[index].remarks = value;
    setFormData({ ...formData, checklist5A: updatedChecklist });
  };

  // Checklist 5B Ship handlers
  const handleChecklist5BShipFieldChange = (field, value) => {
    setFormData({
      ...formData,
      checklist5BShip: {
        ...formData.checklist5BShip,
        [field]: value,
      },
    });
  };

  const handleChecklist5BShipRowTimeCheck = (rowIndex, timeIndex, checked) => {
    const updatedRows = [...formData.checklist5BShip.rows];
    updatedRows[rowIndex].timeChecks[timeIndex].yes = checked;
    setFormData({
      ...formData,
      checklist5BShip: {
        ...formData.checklist5BShip,
        rows: updatedRows,
      },
    });
  };

  const handleChecklist5BShipRowDateTimeChange = (rowIndex, timeIndex, value) => {
    const updatedRows = [...formData.checklist5BShip.rows];
    updatedRows[rowIndex].timeChecks[timeIndex].dateTime = value;
    setFormData({
      ...formData,
      checklist5BShip: {
        ...formData.checklist5BShip,
        rows: updatedRows,
      },
    });
  };

  const handleChecklist5BShipRowNotApplicable = (rowIndex, checked) => {
    const updatedRows = [...formData.checklist5BShip.rows];
    updatedRows[rowIndex].notApplicable = checked;
    setFormData({
      ...formData,
      checklist5BShip: {
        ...formData.checklist5BShip,
        rows: updatedRows,
      },
    });
  };

  const handleChecklist5BShipRowRemarksChange = (rowIndex, value) => {
    const updatedRows = [...formData.checklist5BShip.rows];
    updatedRows[rowIndex].remarks = value;
    setFormData({
      ...formData,
      checklist5BShip: {
        ...formData.checklist5BShip,
        rows: updatedRows,
      },
    });
  };

  const handleChecklist5BShipInitialsChange = (timeIndex, value) => {
    const updatedInitials = [...formData.checklist5BShip.initials];
    updatedInitials[timeIndex] = value;
    setFormData({
      ...formData,
      checklist5BShip: {
        ...formData.checklist5BShip,
        initials: updatedInitials,
      },
    });
  };

  // Checklist 5C Terminal handlers
  const handleChecklist5CTerminalFieldChange = (field, value) => {
    setFormData({
      ...formData,
      checklist5CTerminal: {
        ...formData.checklist5CTerminal,
        [field]: value,
      },
    });
  };

  const handleChecklist5CTerminalRowTimeCheck = (rowIndex, timeIndex, checked) => {
    const updatedRows = [...formData.checklist5CTerminal.rows];
    updatedRows[rowIndex].timeChecks[timeIndex].yes = checked;
    setFormData({
      ...formData,
      checklist5CTerminal: {
        ...formData.checklist5CTerminal,
        rows: updatedRows,
      },
    });
  };

  const handleChecklist5CTerminalRowDateTimeChange = (rowIndex, timeIndex, value) => {
    const updatedRows = [...formData.checklist5CTerminal.rows];
    updatedRows[rowIndex].timeChecks[timeIndex].dateTime = value;
    setFormData({
      ...formData,
      checklist5CTerminal: {
        ...formData.checklist5CTerminal,
        rows: updatedRows,
      },
    });
  };

  const handleChecklist5CTerminalRowNotApplicable = (rowIndex, checked) => {
    const updatedRows = [...formData.checklist5CTerminal.rows];
    updatedRows[rowIndex].notApplicable = checked;
    setFormData({
      ...formData,
      checklist5CTerminal: {
        ...formData.checklist5CTerminal,
        rows: updatedRows,
      },
    });
  };

  const handleChecklist5CTerminalRowRemarksChange = (rowIndex, value) => {
    const updatedRows = [...formData.checklist5CTerminal.rows];
    updatedRows[rowIndex].remarks = value;
    setFormData({
      ...formData,
      checklist5CTerminal: {
        ...formData.checklist5CTerminal,
        rows: updatedRows,
      },
    });
  };

  const handleChecklist5CTerminalInitialsChange = (timeIndex, value) => {
    const updatedInitials = [...formData.checklist5CTerminal.initials];
    updatedInitials[timeIndex] = value;
    setFormData({
      ...formData,
      checklist5CTerminal: {
        ...formData.checklist5CTerminal,
        initials: updatedInitials,
      },
    });
  };

  // Signature handlers
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
      // Document Info
      documentInfo: {
        formNo: 'OPS-OFD-005',
        revisionNo: '1.2',
        issueDate: new Date().toISOString().split('T')[0],
        approvedBy: 'JS',
        page: '1 of 4',
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
      // Checklist 5A
      checklist5A: DEFAULT_CHECKLIST_5A.map(item => ({
        clNumber: item.clNumber,
        description: item.description,
        status: { yes: false, notApplicable: false },
        remarks: '',
        hasNotApplicable: item.hasNotApplicable,
      })),
      // Checklist 5B Ship
      checklist5BShip: {
        noteIntervalHours: '',
        entityName: '',
        rows: DEFAULT_CHECKLIST_5B_ROWS.map(row => ({
          checkName: row.checkName,
          ref: '',
          timeChecks: new Array(NUM_TIME_COLUMNS).fill(null).map((_, idx) => ({
            timeLabel: `Time${idx + 1}`,
            yes: false,
            dateTime: '',
          })),
          notApplicable: false,
          remarks: '',
          hasNotApplicable: row.hasNotApplicable,
          hasRef: row.hasRef,
        })),
        initials: new Array(NUM_TIME_COLUMNS).fill(''),
      },
      // Checklist 5C Terminal
      checklist5CTerminal: {
        noteIntervalHours: '',
        entityName: '',
        rows: DEFAULT_CHECKLIST_5C_ROWS.map(row => ({
          checkName: row.checkName,
          ref: '',
          timeChecks: new Array(NUM_TIME_COLUMNS_5C).fill(null).map((_, idx) => ({
            timeLabel: `Time${idx + 1}`,
            yes: false,
            dateTime: '',
          })),
          notApplicable: false,
          remarks: '',
          hasNotApplicable: row.hasNotApplicable,
          hasRef: row.hasRef,
        })),
        initials: new Array(NUM_TIME_COLUMNS_5C).fill(''),
      },
      // Signature
      signature: {
        name: '',
        rank: '',
        signature: '',
        date: '',
      },
    });
  };

  // Function to reset form completely and clear URL params (for update mode after submission)
  const resetFormToCreateMode = () => {
    resetForm();
    // Clear update mode
    setIsUpdateMode(false);
    // Clear URL parameters
    router.replace('/OPS-OFD-005');
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
      const res = await fetch(`/api/sts-proxy/ops-ofd-005?operationRef=${encodedRef}`);
      
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
          formNo: (data.documentInfo?.formNo || 'OPS-OFD-005')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-005',
          revisionNo: data.documentInfo?.revisionNo || '1.2',
          issueDate: safeParseDate(data.documentInfo?.issueDate) || new Date().toISOString().split('T')[0],
          approvedBy: data.documentInfo?.approvedBy || 'JS',
          page: data.documentInfo?.page || '1 of 4',
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
        // Checklist 5A
        checklist5A: data.checklist5A && Array.isArray(data.checklist5A) && data.checklist5A.length > 0
          ? data.checklist5A.map((item, index) => ({
              clNumber: item.clNumber || DEFAULT_CHECKLIST_5A[index]?.clNumber || index + 1,
              description: item.description || DEFAULT_CHECKLIST_5A[index]?.description || '',
              status: {
                yes: item.status?.yes || false,
                notApplicable: item.status?.notApplicable || false,
              },
              remarks: item.remarks || '',
              hasNotApplicable: DEFAULT_CHECKLIST_5A[index]?.hasNotApplicable || false,
            }))
          : DEFAULT_CHECKLIST_5A.map(item => ({
              clNumber: item.clNumber,
              description: item.description,
              status: { yes: false, notApplicable: false },
              remarks: '',
              hasNotApplicable: item.hasNotApplicable,
            })),
        // Checklist 5B Ship
        checklist5BShip: {
          noteIntervalHours: data.checklist5BShip?.noteIntervalHours || '',
          entityName: data.checklist5BShip?.entityName || '',
          rows: data.checklist5BShip?.rows && Array.isArray(data.checklist5BShip.rows) && data.checklist5BShip.rows.length > 0
            ? data.checklist5BShip.rows.map((row, index) => ({
                checkName: row.checkName || DEFAULT_CHECKLIST_5B_ROWS[index]?.checkName || '',
                ref: row.ref || '',
                timeChecks: row.timeChecks && Array.isArray(row.timeChecks) && row.timeChecks.length === NUM_TIME_COLUMNS
                  ? row.timeChecks.map(tc => ({
                      timeLabel: tc.timeLabel || `Time${tc.timeIndex || 0 + 1}`,
                      yes: tc.yes || false,
                      dateTime: toDateTimeLocalValue(tc.dateTime) || '',
                    }))
                  : new Array(NUM_TIME_COLUMNS).fill(null).map((_, idx) => ({
                      timeLabel: `Time${idx + 1}`,
                      yes: false,
                      dateTime: '',
                    })),
                notApplicable: row.notApplicable || false,
                remarks: row.remarks || '',
                hasNotApplicable: DEFAULT_CHECKLIST_5B_ROWS[index]?.hasNotApplicable || false,
                hasRef: DEFAULT_CHECKLIST_5B_ROWS[index]?.hasRef || false,
              }))
            : DEFAULT_CHECKLIST_5B_ROWS.map(row => ({
                checkName: row.checkName,
                ref: '',
                timeChecks: new Array(NUM_TIME_COLUMNS).fill(null).map((_, idx) => ({
                  timeLabel: `Time${idx + 1}`,
                  yes: false,
                  dateTime: '',
                })),
                notApplicable: false,
                remarks: '',
                hasNotApplicable: row.hasNotApplicable,
                hasRef: row.hasRef,
              })),
          initials: data.checklist5BShip?.initials && Array.isArray(data.checklist5BShip.initials) && data.checklist5BShip.initials.length === NUM_TIME_COLUMNS
            ? data.checklist5BShip.initials
            : new Array(NUM_TIME_COLUMNS).fill(''),
        },
        // Checklist 5C Terminal
        checklist5CTerminal: {
          noteIntervalHours: data.checklist5CTerminal?.noteIntervalHours || '',
          entityName: data.checklist5CTerminal?.entityName || '',
          rows: data.checklist5CTerminal?.rows && Array.isArray(data.checklist5CTerminal.rows) && data.checklist5CTerminal.rows.length > 0
            ? data.checklist5CTerminal.rows.map((row, index) => ({
                checkName: row.checkName || DEFAULT_CHECKLIST_5C_ROWS[index]?.checkName || '',
                ref: row.ref || '',
                timeChecks: row.timeChecks && Array.isArray(row.timeChecks) && row.timeChecks.length === NUM_TIME_COLUMNS_5C
                  ? row.timeChecks.map(tc => ({
                      timeLabel: tc.timeLabel || `Time${tc.timeIndex || 0 + 1}`,
                      yes: tc.yes || false,
                      dateTime: toDateTimeLocalValue(tc.dateTime) || '',
                    }))
                  : new Array(NUM_TIME_COLUMNS_5C).fill(null).map((_, idx) => ({
                      timeLabel: `Time${idx + 1}`,
                      yes: false,
                      dateTime: '',
                    })),
                notApplicable: row.notApplicable || false,
                remarks: row.remarks || '',
                hasNotApplicable: DEFAULT_CHECKLIST_5C_ROWS[index]?.hasNotApplicable || false,
                hasRef: DEFAULT_CHECKLIST_5C_ROWS[index]?.hasRef || false,
              }))
            : DEFAULT_CHECKLIST_5C_ROWS.map(row => ({
                checkName: row.checkName,
                ref: '',
                timeChecks: new Array(NUM_TIME_COLUMNS_5C).fill(null).map((_, idx) => ({
                  timeLabel: `Time${idx + 1}`,
                  yes: false,
                  dateTime: '',
                })),
                notApplicable: false,
                remarks: '',
                hasNotApplicable: row.hasNotApplicable,
                hasRef: row.hasRef,
              })),
          initials: data.checklist5CTerminal?.initials && Array.isArray(data.checklist5CTerminal.initials) && data.checklist5CTerminal.initials.length === NUM_TIME_COLUMNS_5C
            ? data.checklist5CTerminal.initials
            : new Array(NUM_TIME_COLUMNS_5C).fill(''),
        },
        // Signature
        signature: {
          name: data.signature?.name || '',
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
          formNo: (formData.documentInfo.formNo || 'OPS-OFD-005')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-005',
          revisionNo: formData.documentInfo.revisionNo || '1.2',
          issueDate: formData.documentInfo.issueDate || null,
          approvedBy: formData.documentInfo.approvedBy || 'JS',
          page: formData.documentInfo.page || '1 of 4',
        },
        transferInfo: {
          constantHeadingShip: formData.transferInfo.constantHeadingShip || '',
          manoeuvringShip: formData.transferInfo.manoeuvringShip || '',
          designatedPOACName: formData.transferInfo.designatedPOACName || '',
          stsSuperintendentName: formData.transferInfo.stsSuperintendentName || '',
          transferDate: formData.transferInfo.transferDate || null,
          transferLocation: formData.transferInfo.transferLocation || '',
        },
        checklist5A: formData.checklist5A.map(item => ({
          clNumber: item.clNumber,
          description: item.description || '',
          status: {
            yes: item.status?.yes || false,
            notApplicable: item.status?.notApplicable || false,
          },
          remarks: item.remarks || '',
          hasNotApplicable: item.hasNotApplicable || false,
        })),
        checklist5BShip: {
          noteIntervalHours: formData.checklist5BShip.noteIntervalHours || '',
          entityName: formData.checklist5BShip.entityName || '',
          rows: formData.checklist5BShip.rows.map(row => ({
            checkName: row.checkName || '',
            ref: row.ref || '',
            timeChecks: row.timeChecks.map(tc => ({
              timeLabel: tc.timeLabel || '',
              yes: tc.yes || false,
              dateTime: tc.dateTime || '',
            })),
            notApplicable: row.notApplicable || false,
            remarks: row.remarks || '',
            hasNotApplicable: row.hasNotApplicable || false,
            hasRef: row.hasRef || false,
          })),
          initials: formData.checklist5BShip.initials || [],
        },
        checklist5CTerminal: {
          noteIntervalHours: formData.checklist5CTerminal.noteIntervalHours || '',
          entityName: formData.checklist5CTerminal.entityName || '',
          rows: formData.checklist5CTerminal.rows.map(row => ({
            checkName: row.checkName || '',
            ref: row.ref || '',
            timeChecks: row.timeChecks.map(tc => ({
              timeLabel: tc.timeLabel || '',
              yes: tc.yes || false,
              dateTime: tc.dateTime || '',
            })),
            notApplicable: row.notApplicable || false,
            remarks: row.remarks || '',
            hasNotApplicable: row.hasNotApplicable || false,
            hasRef: row.hasRef || false,
          })),
          initials: formData.checklist5CTerminal.initials || [],
        },
        signature: {
          name: formData.signature.name || '',
          rank: formData.signature.rank || '',
          signature: extractBase64(formData.signature.signature) || '',
          date: formData.signature.date || null,
        },
        status: 'DRAFT',
      };

      const form = new FormData();
      form.append("data", JSON.stringify(payload));

      // Use PUT for update mode, POST for create mode
      const method = isUpdateMode ? "PUT" : "POST";
      const encodedRef = encodeURIComponent(cleanOperationRef);
      const url = isUpdateMode 
        ? `/api/sts-proxy/ops-ofd-005?operationRef=${encodedRef}`
        : "/api/sts-proxy/ops-ofd-005/create";

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

  // Render repetitive check section
  const renderRepetitiveCheckSection = (sectionData, sectionType, numTimeColumns) => {
    const is5B = sectionType === '5B';
    const sectionTitle = is5B 
      ? 'CHECKLIST 5B - SHIP REPETITIVE CHECKS DURING TRANSFER'
      : 'CL 5C - TERMINAL REPETATIVE CHECKS DURING TRANSFER';
    const entityLabel = is5B ? 'For Ship:' : 'Terminal:';
    
    const handleFieldChange = is5B 
      ? handleChecklist5BShipFieldChange 
      : handleChecklist5CTerminalFieldChange;
    const handleTimeCheck = is5B
      ? handleChecklist5BShipRowTimeCheck
      : handleChecklist5CTerminalRowTimeCheck;
    const handleDateTimeChange = is5B
      ? handleChecklist5BShipRowDateTimeChange
      : handleChecklist5CTerminalRowDateTimeChange;
    const handleNotApplicable = is5B
      ? handleChecklist5BShipRowNotApplicable
      : handleChecklist5CTerminalRowNotApplicable;
    const handleRemarksChange = is5B
      ? handleChecklist5BShipRowRemarksChange
      : handleChecklist5CTerminalRowRemarksChange;
    const handleInitialsChange = is5B
      ? handleChecklist5BShipInitialsChange
      : handleChecklist5CTerminalInitialsChange;

    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{sectionTitle}</h3>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <label htmlFor={`note-interval-${sectionType}`} className="text-sm">Note interval:</label>
              <input
                id={`note-interval-${sectionType}`}
                type="number"
                value={sectionData.noteIntervalHours}
                onChange={(e) => handleFieldChange('noteIntervalHours', e.target.value)}
                className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
              />
              <span className="text-sm">hrs.</span>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor={`entity-name-${sectionType}`} className="text-sm">{entityLabel}</label>
              <input
                id={`entity-name-${sectionType}`}
                type="text"
                value={sectionData.entityName}
                onChange={(e) => handleFieldChange('entityName', e.target.value)}
                className="w-48 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-600">
            <thead>
              <tr className="bg-gray-700">
                <th className="border border-gray-600 p-3 text-left">Check</th>
                {sectionData.rows[0]?.hasRef && (
                  <th className="border border-gray-600 p-3 text-center w-24">Ref.</th>
                )}
                {new Array(numTimeColumns).fill(null).map((_, idx) => (
                  <th key={idx} className="border border-gray-600 p-3 text-center min-w-[100px]">
                    Time
                  </th>
                ))}
                <th className="border border-gray-600 p-3 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {sectionData.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3">
                    <span className="text-sm">{row.checkName}</span>
                  </td>
                  {row.hasRef && (
                    <td className="border border-gray-600 p-3">
                      <input
                        type="text"
                        value={row.ref}
                        onChange={(e) => {
                          const updatedRows = [...sectionData.rows];
                          updatedRows[rowIndex].ref = e.target.value;
                          handleFieldChange('rows', updatedRows);
                        }}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                      />
                    </td>
                  )}
                  {row.timeChecks.map((timeCheck, timeIndex) => (
                    <td key={timeIndex} className="border border-gray-600 p-3 text-center">
                      {row.checkName === 'Date/time of check' ? (
                        <DateTimePicker24
                          value={timeCheck.dateTime || ''}
                          onChange={(v) => handleDateTimeChange(rowIndex, timeIndex, v)}
                          className="w-full min-w-[12rem]"
                        />
                      ) : row.checkName === 'Initials' ? (
                        <input
                          type="text"
                          value={sectionData.initials[timeIndex] || ''}
                          onChange={(e) => handleInitialsChange(timeIndex, e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                          placeholder="Initials"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <input
                            type="checkbox"
                            checked={timeCheck.yes}
                            onChange={(e) => handleTimeCheck(rowIndex, timeIndex, e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-xs">Yes</span>
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="border border-gray-600 p-3">
                    {row.checkName === 'Initials' ? (
                      <span className="text-sm text-gray-500">-</span>
                    ) : row.hasNotApplicable ? (
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.notApplicable}
                            onChange={(e) => handleNotApplicable(rowIndex, e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Not applicable</span>
                        </label>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={row.remarks}
                        onChange={(e) => handleRemarksChange(rowIndex, e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                        placeholder="Remarks..."
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
              CHECKLIST 5A-C – AFTER CONNECTION CHECKS TILL DISCONNECTION
            </h2>
          </div>
          <div className="bg-gray-700 p-4 rounded min-w-[200px]">
            <div className="text-sm space-y-1">
              <div><strong>Form No:</strong> {formData.documentInfo.formNo}</div>
              <div><strong>Rev.No.:</strong> {formData.documentInfo.revisionNo || '1.2'}</div>
              <div><strong>Issue Date:</strong> {formData.documentInfo.issueDate || ''}</div>
              <div><strong>Approved by:</strong> {formData.documentInfo.approvedBy}</div>
              <div><strong>Page:</strong> {formData.documentInfo.page || '1 of 4'}</div>
              <div className="text-blue-300 mt-2">
                <strong>Operation Ref:</strong> {formData.operationRef || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Transfer Information Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">General Information</h3>
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

        {/* Checklist 5A Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">CHECKLIST 5A: After Connection Checks before Operation</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-3 text-center w-16">CL 5A</th>
                  <th className="border border-gray-600 p-3 text-left">Check</th>
                  <th className="border border-gray-600 p-3 text-center w-32">Status</th>
                  <th className="border border-gray-600 p-3 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {formData.checklist5A.map((item, index) => (
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
                            onChange={(e) => handleChecklist5AStatusChange(index, 'yes', e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Yes</span>
                        </label>
                        {item.hasNotApplicable && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.status.notApplicable}
                              onChange={(e) => handleChecklist5AStatusChange(index, 'notApplicable', e.target.checked)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">Not applicable</span>
                          </label>
                        )}
                      </div>
                    </td>
                    <td className="border border-gray-600 p-3">
                      <input
                        type="text"
                        value={item.remarks}
                        onChange={(e) => handleChecklist5ARemarksChange(index, e.target.value)}
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

        {/* Checklist 5B Ship Repetitive Section */}
        {renderRepetitiveCheckSection(formData.checklist5BShip, '5B', NUM_TIME_COLUMNS)}

        {/* Checklist 5C Terminal Repetitive Section */}
        {renderRepetitiveCheckSection(formData.checklist5CTerminal, '5C', NUM_TIME_COLUMNS_5C)}

        {/* Signature Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Signature</h3>
          <div className="bg-gray-700 p-6 rounded">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label htmlFor="signature-name" className="block text-sm mb-1">Name:</label>
                <input
                  id="signature-name"
                  type="text"
                  value={formData.signature.name}
                  onChange={(e) => handleSignatureChange('name', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label htmlFor="signature-rank" className="block text-sm mb-1">Rank:</label>
                <input
                  id="signature-rank"
                  type="text"
                  value={formData.signature.rank}
                  onChange={(e) => handleSignatureChange('rank', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label htmlFor="signature-file" className="block text-sm mb-1">Signature:</label>
                <input
                  id="signature-file"
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
                {formData.signature.signature && (
                  <div className="mt-2">
                    <img
                      src={getSignatureUrl(formData.signature.signature)}
                      alt="Signature preview"
                      className="max-w-full h-24 border border-gray-600 rounded"
                      onError={(e) => {
                        console.error('Error loading image:', e);
                        e.target.style.display = 'none';
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
                <label htmlFor="signature-date" className="block text-sm mb-1">Date:</label>
                <input
                  id="signature-date"
                  type="date"
                  value={formData.signature.date}
                  onChange={(e) => handleSignatureChange('date', e.target.value)}
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


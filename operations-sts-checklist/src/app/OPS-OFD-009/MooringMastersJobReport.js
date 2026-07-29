'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';

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

// Helper to ensure equipment set has proper structure
const ensureEquipmentSet = (data) => {
    if (!data) return { values: ['', ''] };
    if (Array.isArray(data)) return { values: data.length >= 2 ? data : [...data, ...new Array(2 - data.length).fill('')] };
    if (data.values && Array.isArray(data.values)) {
        return { values: data.values.length >= 2 ? data.values : [...data.values, ...new Array(2 - data.values.length).fill('')] };
    }
    return { values: ['', ''] };
};

export default function MooringMastersJobReport() {
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
      formNo: 'OPS-OFD-009',
      issueDate: new Date().toISOString().split('T')[0],
      approvedBy: 'JS',
    },
    // Ship to be Lightered (STBL)
    shipToBeLighted: {
      locationSTSPosition: '',
      vesselName: '',
      arrivalDisplacement: '',
      arrivalDrafts: '',
      pblCommencementArrivalDrafts: '',
      pblCentreManifoldForwardArrival: '',
      pblCentreManifoldAftArrival: '',
      pblCompletionDepartureDrafts: '',
      maxFreeboard: '',
      minFreeboard: '',
      deadSlowAheadSpeed: '',
      bridgeWingToCentreManifoldDistance: '',
      craneCertifiedForPersonnelTransfer: false,
      masterWillingIfCraneNotCertified: false,
      maxCraneReachOverShipsSide: '',
      bowThrusterFitted: false,
      nightBerthingAccepted: false,
      cargo: '',
      quantityToTransfer: '',
      fenderSizes: { values: ['', ''] },
      fenderSerialNumbers: { values: ['', ''] },
      vaporHoses: { values: ['', ''] },
      hoseSizes: { values: ['', ''] },
      hoseSerialNumbers: { values: ['', ''] },
      agents: '',
      otherInformation: '',
    },
    // Receiving Ship
    receivingShip: {
      locationSTSPosition: '',
      vesselName: '',
      arrivalDisplacement: '',
      arrivalDrafts: '',
      pblCommencementArrivalDrafts: '',
      pblCentreManifoldForwardArrival: '',
      pblCentreManifoldAftArrival: '',
      pblCompletionDepartureDrafts: '',
      maxFreeboard: '',
      minFreeboard: '',
      deadSlowAheadSpeed: '',
      bridgeWingToCentreManifoldDistance: '',
      craneCertifiedForPersonnelTransfer: false,
      masterWillingIfCraneNotCertified: false,
      maxCraneReachOverShipsSide: '',
      bowThrusterFitted: false,
      nightBerthingAccepted: false,
      cargo: '',
      quantityToTransfer: '',
      fenderSizes: { values: ['', ''] },
      fenderSerialNumbers: { values: ['', ''] },
      vaporHoses: { values: ['', ''] },
      hoseSizes: { values: ['', ''] },
      hoseSerialNumbers: { values: ['', ''] },
      agents: '',
      otherInformation: '',
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
        formNo: 'OPS-OFD-009',
        issueDate: new Date().toISOString().split('T')[0],
        approvedBy: 'JS',
      },
      shipToBeLighted: {
        locationSTSPosition: '',
        vesselName: '',
        arrivalDisplacement: '',
        arrivalDrafts: '',
        pblCommencementArrivalDrafts: '',
        pblCentreManifoldForwardArrival: '',
        pblCentreManifoldAftArrival: '',
        pblCompletionDepartureDrafts: '',
        maxFreeboard: '',
        minFreeboard: '',
        deadSlowAheadSpeed: '',
        bridgeWingToCentreManifoldDistance: '',
        craneCertifiedForPersonnelTransfer: false,
        masterWillingIfCraneNotCertified: false,
        maxCraneReachOverShipsSide: '',
        bowThrusterFitted: false,
        nightBerthingAccepted: false,
        cargo: '',
        quantityToTransfer: '',
        fenderSizes: { values: ['', ''] },
        fenderSerialNumbers: { values: ['', ''] },
        vaporHoses: { values: ['', ''] },
        hoseSizes: { values: ['', ''] },
        hoseSerialNumbers: { values: ['', ''] },
        agents: '',
        otherInformation: '',
      },
      receivingShip: {
        locationSTSPosition: '',
        vesselName: '',
        arrivalDisplacement: '',
        arrivalDrafts: '',
        pblCommencementArrivalDrafts: '',
        pblCentreManifoldForwardArrival: '',
        pblCentreManifoldAftArrival: '',
        pblCompletionDepartureDrafts: '',
        maxFreeboard: '',
        minFreeboard: '',
        deadSlowAheadSpeed: '',
        bridgeWingToCentreManifoldDistance: '',
        craneCertifiedForPersonnelTransfer: false,
        masterWillingIfCraneNotCertified: false,
        maxCraneReachOverShipsSide: '',
        bowThrusterFitted: false,
        nightBerthingAccepted: false,
        cargo: '',
        quantityToTransfer: '',
        fenderSizes: { values: ['', ''] },
        fenderSerialNumbers: { values: ['', ''] },
        vaporHoses: { values: ['', ''] },
        hoseSizes: { values: ['', ''] },
        hoseSerialNumbers: { values: ['', ''] },
        agents: '',
        otherInformation: '',
      },
    });
  };

  // Function to reset form completely and clear URL params (for update mode after submission)
  const resetFormToCreateMode = () => {
    setFormData({
      operationRef: '',
      documentInfo: {
        formNo: 'OPS-OFD-009',
        issueDate: new Date().toISOString().split('T')[0],
        approvedBy: 'JS',
      },
      shipToBeLighted: {
        locationSTSPosition: '',
        vesselName: '',
        arrivalDisplacement: '',
        arrivalDrafts: '',
        pblCommencementArrivalDrafts: '',
        pblCentreManifoldForwardArrival: '',
        pblCentreManifoldAftArrival: '',
        pblCompletionDepartureDrafts: '',
        maxFreeboard: '',
        minFreeboard: '',
        deadSlowAheadSpeed: '',
        bridgeWingToCentreManifoldDistance: '',
        craneCertifiedForPersonnelTransfer: false,
        masterWillingIfCraneNotCertified: false,
        maxCraneReachOverShipsSide: '',
        bowThrusterFitted: false,
        nightBerthingAccepted: false,
        cargo: '',
        quantityToTransfer: '',
        fenderSizes: { values: ['', ''] },
        fenderSerialNumbers: { values: ['', ''] },
        vaporHoses: { values: ['', ''] },
        hoseSizes: { values: ['', ''] },
        hoseSerialNumbers: { values: ['', ''] },
        agents: '',
        otherInformation: '',
      },
      receivingShip: {
        locationSTSPosition: '',
        vesselName: '',
        arrivalDisplacement: '',
        arrivalDrafts: '',
        pblCommencementArrivalDrafts: '',
        pblCentreManifoldForwardArrival: '',
        pblCentreManifoldAftArrival: '',
        pblCompletionDepartureDrafts: '',
        maxFreeboard: '',
        minFreeboard: '',
        deadSlowAheadSpeed: '',
        bridgeWingToCentreManifoldDistance: '',
        craneCertifiedForPersonnelTransfer: false,
        masterWillingIfCraneNotCertified: false,
        maxCraneReachOverShipsSide: '',
        bowThrusterFitted: false,
        nightBerthingAccepted: false,
        cargo: '',
        quantityToTransfer: '',
        fenderSizes: { values: ['', ''] },
        fenderSerialNumbers: { values: ['', ''] },
        vaporHoses: { values: ['', ''] },
        hoseSizes: { values: ['', ''] },
        hoseSerialNumbers: { values: ['', ''] },
        agents: '',
        otherInformation: '',
      },
    });
    // Clear update mode
    setIsUpdateMode(false);
    // Clear URL parameters
    router.replace('/OPS-OFD-009');
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
      const res = await fetch(`/api/sts-proxy/ops-ofd-009?operationRef=${encodedRef}`);
      
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
          formNo: (data.documentInfo?.formNo || 'OPS-OFD-009')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-009',
          issueDate: safeParseDate(data.documentInfo?.issueDate) || new Date().toISOString().split('T')[0],
          approvedBy: data.documentInfo?.approvedBy || 'JS',
        },
        shipToBeLighted: {
          locationSTSPosition: data.shipToBeLighted?.locationSTSPosition || '',
          vesselName: data.shipToBeLighted?.vesselName || '',
          arrivalDisplacement: data.shipToBeLighted?.arrivalDisplacement || '',
          arrivalDrafts: data.shipToBeLighted?.arrivalDrafts || '',
          pblCommencementArrivalDrafts: data.shipToBeLighted?.pblCommencementArrivalDrafts || '',
          pblCentreManifoldForwardArrival: data.shipToBeLighted?.pblCentreManifoldForwardArrival || '',
          pblCentreManifoldAftArrival: data.shipToBeLighted?.pblCentreManifoldAftArrival || '',
          pblCompletionDepartureDrafts: data.shipToBeLighted?.pblCompletionDepartureDrafts || '',
          maxFreeboard: data.shipToBeLighted?.maxFreeboard || '',
          minFreeboard: data.shipToBeLighted?.minFreeboard || '',
          deadSlowAheadSpeed: data.shipToBeLighted?.deadSlowAheadSpeed || '',
          bridgeWingToCentreManifoldDistance: data.shipToBeLighted?.bridgeWingToCentreManifoldDistance || '',
          craneCertifiedForPersonnelTransfer: data.shipToBeLighted?.craneCertifiedForPersonnelTransfer || false,
          masterWillingIfCraneNotCertified: data.shipToBeLighted?.masterWillingIfCraneNotCertified || false,
          maxCraneReachOverShipsSide: data.shipToBeLighted?.maxCraneReachOverShipsSide || '',
          bowThrusterFitted: data.shipToBeLighted?.bowThrusterFitted || false,
          nightBerthingAccepted: data.shipToBeLighted?.nightBerthingAccepted || false,
          cargo: data.shipToBeLighted?.cargo || '',
          quantityToTransfer: data.shipToBeLighted?.quantityToTransfer || '',
          fenderSizes: ensureEquipmentSet(data.shipToBeLighted?.fenderSizes),
          fenderSerialNumbers: ensureEquipmentSet(data.shipToBeLighted?.fenderSerialNumbers),
          vaporHoses: ensureEquipmentSet(data.shipToBeLighted?.vaporHoses),
          hoseSizes: ensureEquipmentSet(data.shipToBeLighted?.hoseSizes),
          hoseSerialNumbers: ensureEquipmentSet(data.shipToBeLighted?.hoseSerialNumbers),
          agents: data.shipToBeLighted?.agents || '',
          otherInformation: data.shipToBeLighted?.otherInformation || '',
        },
        receivingShip: {
          locationSTSPosition: data.receivingShip?.locationSTSPosition || '',
          vesselName: data.receivingShip?.vesselName || '',
          arrivalDisplacement: data.receivingShip?.arrivalDisplacement || '',
          arrivalDrafts: data.receivingShip?.arrivalDrafts || '',
          pblCommencementArrivalDrafts: data.receivingShip?.pblCommencementArrivalDrafts || '',
          pblCentreManifoldForwardArrival: data.receivingShip?.pblCentreManifoldForwardArrival || '',
          pblCentreManifoldAftArrival: data.receivingShip?.pblCentreManifoldAftArrival || '',
          pblCompletionDepartureDrafts: data.receivingShip?.pblCompletionDepartureDrafts || '',
          maxFreeboard: data.receivingShip?.maxFreeboard || '',
          minFreeboard: data.receivingShip?.minFreeboard || '',
          deadSlowAheadSpeed: data.receivingShip?.deadSlowAheadSpeed || '',
          bridgeWingToCentreManifoldDistance: data.receivingShip?.bridgeWingToCentreManifoldDistance || '',
          craneCertifiedForPersonnelTransfer: data.receivingShip?.craneCertifiedForPersonnelTransfer || false,
          masterWillingIfCraneNotCertified: data.receivingShip?.masterWillingIfCraneNotCertified || false,
          maxCraneReachOverShipsSide: data.receivingShip?.maxCraneReachOverShipsSide || '',
          bowThrusterFitted: data.receivingShip?.bowThrusterFitted || false,
          nightBerthingAccepted: data.receivingShip?.nightBerthingAccepted || false,
          cargo: data.receivingShip?.cargo || '',
          quantityToTransfer: data.receivingShip?.quantityToTransfer || '',
          fenderSizes: ensureEquipmentSet(data.receivingShip?.fenderSizes),
          fenderSerialNumbers: ensureEquipmentSet(data.receivingShip?.fenderSerialNumbers),
          vaporHoses: ensureEquipmentSet(data.receivingShip?.vaporHoses),
          hoseSizes: ensureEquipmentSet(data.receivingShip?.hoseSizes),
          hoseSerialNumbers: ensureEquipmentSet(data.receivingShip?.hoseSerialNumbers),
          agents: data.receivingShip?.agents || '',
          otherInformation: data.receivingShip?.otherInformation || '',
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

  // Handler for single value fields
  const handleVesselFieldChange = (vesselType, field, value) => {
    setFormData({
      ...formData,
      [vesselType]: {
        ...formData[vesselType],
        [field]: value,
      },
    });
  };

  // Handler for boolean fields
  const handleBooleanChange = (vesselType, field, checked) => {
    setFormData({
      ...formData,
      [vesselType]: {
        ...formData[vesselType],
        [field]: checked,
      },
    });
  };

  // Handler for equipment set fields (multi-value)
  const handleEquipmentSetChange = (vesselType, field, index, value) => {
    const updatedValues = [...formData[vesselType][field].values];
    updatedValues[index] = value;
    setFormData({
      ...formData,
      [vesselType]: {
        ...formData[vesselType],
        [field]: {
          values: updatedValues,
        },
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
          formNo: (formData.documentInfo.formNo || 'OPS-OFD-009')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-009',
          issueDate: formData.documentInfo.issueDate || null,
          approvedBy: formData.documentInfo.approvedBy || 'JS',
        },
        shipToBeLighted: {
          ...formData.shipToBeLighted,
          fenderSizes: formData.shipToBeLighted.fenderSizes || { values: ['', ''] },
          fenderSerialNumbers: formData.shipToBeLighted.fenderSerialNumbers || { values: ['', ''] },
          vaporHoses: formData.shipToBeLighted.vaporHoses || { values: ['', ''] },
          hoseSizes: formData.shipToBeLighted.hoseSizes || { values: ['', ''] },
          hoseSerialNumbers: formData.shipToBeLighted.hoseSerialNumbers || { values: ['', ''] },
        },
        receivingShip: {
          ...formData.receivingShip,
          fenderSizes: formData.receivingShip.fenderSizes || { values: ['', ''] },
          fenderSerialNumbers: formData.receivingShip.fenderSerialNumbers || { values: ['', ''] },
          vaporHoses: formData.receivingShip.vaporHoses || { values: ['', ''] },
          hoseSizes: formData.receivingShip.hoseSizes || { values: ['', ''] },
          hoseSerialNumbers: formData.receivingShip.hoseSerialNumbers || { values: ['', ''] },
        },
        status: 'DRAFT',
      };

      const form = new FormData();
      form.append("data", JSON.stringify(payload));

      // Use PUT for update mode, POST for create mode
      const method = isUpdateMode ? "PUT" : "POST";
      const encodedRef = encodeURIComponent(cleanOperationRef);
      const url = isUpdateMode 
        ? `/api/sts-proxy/ops-ofd-009?operationRef=${encodedRef}`
        : "/api/sts-proxy/ops-ofd-009/create";

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

  // Render input field for vessel
  const renderInput = (vesselType, field, type = 'text') => {
    return (
      <input
        type={type}
        value={formData[vesselType][field]}
        onChange={(e) => handleVesselFieldChange(vesselType, field, e.target.value)}
        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
      />
    );
  };

  // Render checkbox for boolean fields
  const renderCheckbox = (vesselType, field) => {
    return (
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          checked={formData[vesselType][field]}
          onChange={(e) => handleBooleanChange(vesselType, field, e.target.checked)}
          className="w-4 h-4"
        />
      </div>
    );
  };

  // Render equipment set (2 inputs side by side)
  const renderEquipmentSet = (vesselType, field) => {
    return (
      <div className="flex gap-2">
        {formData[vesselType][field].values.map((value, index) => (
          <input
            key={index}
            type="text"
            value={value}
            onChange={(e) => handleEquipmentSetChange(vesselType, field, index, e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
          />
        ))}
      </div>
    );
  };

  // Render textarea
  const renderTextarea = (vesselType, field) => {
    return (
      <textarea
        value={formData[vesselType][field]}
        onChange={(e) => handleVesselFieldChange(vesselType, field, e.target.value)}
        rows={3}
        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
      />
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
              Mooring Master's Job Report
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
              {formData.operationRef && (
                <div><strong>Operation Ref:</strong> {formData.operationRef}</div>
              )}
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle px-4 sm:px-0">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Detail</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Ship to be Lightered (STBL)</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Receiving Ship</th>
                </tr>
              </thead>
              <tbody>
                {/* Location/STS position */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Location/STS position:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'locationSTSPosition')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'locationSTSPosition')}</td>
                </tr>

                {/* Name */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Name:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'vesselName')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'vesselName')}</td>
                </tr>

                {/* Arrival Displacement */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Arrival Displacement:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'arrivalDisplacement')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'arrivalDisplacement')}</td>
                </tr>

                {/* Arrival Drafts */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Arrival Drafts:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'arrivalDrafts')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'arrivalDrafts')}</td>
                </tr>

                {/* PBL AT Commencement of Transfer on arrival drafts */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">PBL AT Commencement of Transfer on arrival drafts:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'pblCommencementArrivalDrafts')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'pblCommencementArrivalDrafts')}</td>
                </tr>

                {/* PBL from Centre of manifold to forward on arrival drafts */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">PBL from Centre of manifold to forward on arrival drafts:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'pblCentreManifoldForwardArrival')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'pblCentreManifoldForwardArrival')}</td>
                </tr>

                {/* PBL from Centre of manifold to aft on arrival drafts */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">PBL from Centre of manifold to aft on arrival drafts:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'pblCentreManifoldAftArrival')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'pblCentreManifoldAftArrival')}</td>
                </tr>

                {/* PBL at completion of transfer on departure drafts */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">PBL at completion of transfer on departure drafts:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'pblCompletionDepartureDrafts')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'pblCompletionDepartureDrafts')}</td>
                </tr>

                {/* Max Freeboard */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Max Freeboard:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'maxFreeboard')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'maxFreeboard')}</td>
                </tr>

                {/* Min Freeboard */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Min Freeboard:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'minFreeboard')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'minFreeboard')}</td>
                </tr>

                {/* Dead Slow Ahead Speed */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Dead Slow Ahead Speed:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'deadSlowAheadSpeed')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'deadSlowAheadSpeed')}</td>
                </tr>

                {/* Distance from Bridge Wing to Centre Manifold */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Distance from Bridge Wing to Centre Manifold:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'bridgeWingToCentreManifoldDistance')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'bridgeWingToCentreManifoldDistance')}</td>
                </tr>

                {/* Is the crane certified for transfer of personnel? */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Is the crane certified for transfer of personnel?:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderCheckbox('shipToBeLighted', 'craneCertifiedForPersonnelTransfer')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderCheckbox('receivingShip', 'craneCertifiedForPersonnelTransfer')}</td>
                </tr>

                {/* If the crane is not certified is the Master of the Vessel willing to use it for Personnel Transfer? */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">If the crane is not certified is the Master of the Vessel willing to use it for Personnel Transfer?:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderCheckbox('shipToBeLighted', 'masterWillingIfCraneNotCertified')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderCheckbox('receivingShip', 'masterWillingIfCraneNotCertified')}</td>
                </tr>

                {/* Maximum Crane reach over the ships side */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Maximum Crane reach over the ships side:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'maxCraneReachOverShipsSide')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'maxCraneReachOverShipsSide')}</td>
                </tr>

                {/* Is the vessel fitted with Bow Thruster */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Is the vessel fitted with Bow Thruster:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderCheckbox('shipToBeLighted', 'bowThrusterFitted')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderCheckbox('receivingShip', 'bowThrusterFitted')}</td>
                </tr>

                {/* Is the Master of the vessel happy to conduct Nighttime berthing? */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Is the Master of the vessel happy to conduct Nighttime berthing?:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderCheckbox('shipToBeLighted', 'nightBerthingAccepted')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderCheckbox('receivingShip', 'nightBerthingAccepted')}</td>
                </tr>

                {/* Cargo */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Cargo:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'cargo')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'cargo')}</td>
                </tr>

                {/* Quantity to be transferred */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Quantity to be transferred:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'quantityToTransfer')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'quantityToTransfer')}</td>
                </tr>

                {/* Fender Size */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Fender Size:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderEquipmentSet('shipToBeLighted', 'fenderSizes')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderEquipmentSet('receivingShip', 'fenderSizes')}</td>
                </tr>

                {/* Fender Serial Number */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Fender Serial Number:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderEquipmentSet('shipToBeLighted', 'fenderSerialNumbers')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderEquipmentSet('receivingShip', 'fenderSerialNumbers')}</td>
                </tr>

                {/* Vapor Hoses */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Vapor Hoses:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderEquipmentSet('shipToBeLighted', 'vaporHoses')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderEquipmentSet('receivingShip', 'vaporHoses')}</td>
                </tr>

                {/* Hose Size */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Hose Size:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderEquipmentSet('shipToBeLighted', 'hoseSizes')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderEquipmentSet('receivingShip', 'hoseSizes')}</td>
                </tr>

                {/* Hose Serial Number */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Hose Serial Number:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderEquipmentSet('shipToBeLighted', 'hoseSerialNumbers')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderEquipmentSet('receivingShip', 'hoseSerialNumbers')}</td>
                </tr>

                {/* Agents */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Agents:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('shipToBeLighted', 'agents')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderInput('receivingShip', 'agents')}</td>
                </tr>

                {/* Other Information */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">Other Information:</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderTextarea('shipToBeLighted', 'otherInformation')}</td>
                  <td className="border border-gray-600 p-2 sm:p-3">{renderTextarea('receivingShip', 'otherInformation')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="mb-4 p-3 sm:p-4 bg-red-900/30 border border-red-600 rounded text-red-300 mt-6 sm:mt-8">
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
        <div className="flex justify-end gap-3 sm:gap-4 mt-6 sm:mt-8">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto"
          >
            {submitting 
              ? (isUpdateMode ? 'Updating...' : 'Submitting...') 
              : (isUpdateMode ? 'Update Report' : 'Submit Report')
            }
          </button>
        </div>
        {submitSuccess && (
          <div className="mt-4 p-3 sm:p-4 bg-green-900/30 border border-green-600 rounded text-green-300 text-xs sm:text-sm">
            {isUpdateMode 
              ? 'Report updated successfully.' 
              : 'Form submitted successfully.'
            }
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

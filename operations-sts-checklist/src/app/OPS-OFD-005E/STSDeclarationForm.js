'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import TimePicker24 from '@/components/TimePicker24';

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

const CHECKLIST_ITEMS = [
    { code: '3A', description: 'Before cargo Transfer' },
    { code: '3B', description: '(Additional for LPG and LNG)' },
    { code: '4A', description: 'Pre Transfer Conference' },
    { code: '4B', description: '(Additional for Vapour Balancing)' },
    { code: '4C', description: '(Additional for Chemicals)' },
    { code: '4D', description: '(Additional for LPG and LNG)' },
    { code: '4E', description: '(Additional for LNG)' },
    { code: '4F', description: 'Pre Transfer Agreement' },
];

export default function STSDeclarationForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    // Trim trailing comma from operationRef if present
    const rawOperationRef = searchParams.get('operationRef');
    const operationRef = rawOperationRef ? rawOperationRef.replace(/,\s*$/, '').trim() : null;
    const mode = searchParams.get('mode'); // 'update' or null
    const constantHeadingShipFileInputRef = useRef(null);
    const manoeuvringShipFileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        operationRef: operationRef || '',
        formNo: 'OPS-OFD-005E',
        revisionNo: '1',
        issueDate: new Date().toISOString().split('T')[0],
        approvedBy: 'JS',
        shipOperationType: '',
        constantHeadingShipName: '',
        manoeuvringShipName: '',
        declarationAccepted: true,
        checklists: CHECKLIST_ITEMS.map(item => ({
            checklistCode: item.code,
            description: item.description,
            selection: '',
        })),
        repetitiveCheckHours: '',
        constantHeadingShip: {
            name: '',
            rank: '',
            signature: '',
            date: '',
            time: '',
        },
        manoeuvringShip: {
            name: '',
            rank: '',
            signature: '',
            date: '',
            time: '',
        },
    });

    const handleChecklistChange = (index, selection) => {
        const updatedChecklists = [...formData.checklists];
        // Toggle: if clicking the same selection, deselect it; otherwise set the new selection
        updatedChecklists[index].selection =
            updatedChecklists[index].selection === selection ? '' : selection;
        setFormData({ ...formData, checklists: updatedChecklists });
    };

    const handleInputChange = (field, value) => {
        setFormData({ ...formData, [field]: value });
    };

    const handleSignatureChange = (shipType, field, value) => {
        setFormData({
            ...formData,
            [shipType]: {
                ...formData[shipType],
                [field]: value,
            },
        });
    };

    const handleSignatureUpload = (shipType, event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                handleSignatureChange(shipType, 'signature', base64String);
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
            formNo: 'OPS-OFD-005E',
            revisionNo: '1',
            issueDate: new Date().toISOString().split('T')[0],
            approvedBy: 'JS',
            shipOperationType: '',
            constantHeadingShipName: '',
            manoeuvringShipName: '',
            declarationAccepted: true,
            checklists: CHECKLIST_ITEMS.map(item => ({
                checklistCode: item.code,
                description: item.description,
                selection: '',
            })),
            repetitiveCheckHours: '',
            constantHeadingShip: {
                name: '',
                rank: '',
                signature: '',
                date: '',
                time: '',
            },
            manoeuvringShip: {
                name: '',
                rank: '',
                signature: '',
                date: '',
                time: '',
            },
        });
        // Reset file inputs
        if (constantHeadingShipFileInputRef.current) {
            constantHeadingShipFileInputRef.current.value = '';
        }
        if (manoeuvringShipFileInputRef.current) {
            manoeuvringShipFileInputRef.current.value = '';
        }
    };

    // Function to reset form completely and clear URL params (for update mode after submission)
    const resetFormToCreateMode = () => {
        setFormData({
            operationRef: '',
            formNo: 'OPS-OFD-005E',
            revisionNo: '1',
            issueDate: new Date().toISOString().split('T')[0],
            approvedBy: 'JS',
            shipOperationType: '',
            constantHeadingShipName: '',
            manoeuvringShipName: '',
            declarationAccepted: true,
            checklists: CHECKLIST_ITEMS.map(item => ({
                checklistCode: item.code,
                description: item.description,
                selection: '',
            })),
            repetitiveCheckHours: '',
            constantHeadingShip: {
                name: '',
                rank: '',
                signature: '',
                date: '',
                time: '',
            },
            manoeuvringShip: {
                name: '',
                rank: '',
                signature: '',
                date: '',
                time: '',
            },
        });
        // Reset file inputs
        if (constantHeadingShipFileInputRef.current) {
            constantHeadingShipFileInputRef.current.value = '';
        }
        if (manoeuvringShipFileInputRef.current) {
            manoeuvringShipFileInputRef.current.value = '';
        }
        // Clear update mode
        setIsUpdateMode(false);
        // Clear URL parameters
        router.replace('/OPS-OFD-005E');
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
            const res = await fetch(`/api/sts-proxy/ops-ofd-005e?operationRef=${encodedRef}`);
            
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
                formNo: (data.formNo || 'OPS-OFD-005E')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-005E',
                revisionNo: data.revisionNo || '1',
                issueDate: safeParseDate(data.issueDate) || new Date().toISOString().split('T')[0],
                approvedBy: data.approvedBy || 'JS',
                shipOperationType: data.shipOperationType || '',
                constantHeadingShipName: data.constantHeadingShipName || '',
                manoeuvringShipName: data.manoeuvringShipName || '',
                declarationAccepted: data.declarationAccepted !== undefined ? data.declarationAccepted : true,
                checklists: data.checklists && Array.isArray(data.checklists) && data.checklists.length > 0
                    ? data.checklists.map((check, index) => ({
                        checklistCode: check.checklistCode || CHECKLIST_ITEMS[index]?.code || '',
                        description: check.description || CHECKLIST_ITEMS[index]?.description || '',
                        selection: check.selection || '',
                    }))
                    : CHECKLIST_ITEMS.map(item => ({
                        checklistCode: item.code,
                        description: item.description,
                        selection: '',
                    })),
                repetitiveCheckHours: data.repetitiveCheckHours || '',
                constantHeadingShip: {
                    name: data.constantHeadingShip?.name || '',
                    rank: data.constantHeadingShip?.rank || '',
                    signature: getSignatureUrl(data.constantHeadingShip?.signature || ''),
                    date: safeParseDate(data.constantHeadingShip?.date) || '',
                    time: data.constantHeadingShip?.time || '',
                },
                manoeuvringShip: {
                    name: data.manoeuvringShip?.name || '',
                    rank: data.manoeuvringShip?.rank || '',
                    signature: getSignatureUrl(data.manoeuvringShip?.signature || ''),
                    date: safeParseDate(data.manoeuvringShip?.date) || '',
                    time: data.manoeuvringShip?.time || '',
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
        
        // Get operationRef from formData or URL params
        let cleanOperationRef = (formData.operationRef || '').replace(/,\s*$/, '').trim();
        if (!cleanOperationRef && operationRef) {
            cleanOperationRef = operationRef;
        }
        if (!cleanOperationRef) {
            const sp = searchParams.get('operationRef');
            if (sp) cleanOperationRef = sp.replace(/,\s*$/, '').trim();
        }
        if (!cleanOperationRef) {
            setSubmitError('Invalid operation reference. Please use a valid link.');
            return;
        }

        if (submitting) return;
        try {
            setSubmitting(true);
            setSubmitError(null);
            setSubmitSuccess(false);

            const payload = {
                operationRef: cleanOperationRef,
                formNo: (formData.formNo || 'OPS-OFD-005E')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-005E',
                revisionNo: formData.revisionNo || '1',
                issueDate: formData.issueDate ? new Date(formData.issueDate) : undefined,
                approvedBy: formData.approvedBy,
                // Set default value for shipOperationType if empty
                shipOperationType: formData.shipOperationType || (formData.constantHeadingShipName ? 'CONSTANT_HEADING_OR_BERTHED' : 'MANOEUVRING_OR_OUTER') || 'CONSTANT_HEADING_OR_BERTHED',
                constantHeadingShipName: formData.constantHeadingShipName || '',
                manoeuvringShipName: formData.manoeuvringShipName || '',
                declarationAccepted: formData.declarationAccepted,
                checklists: formData.checklists.map((item) => ({
                    checklistCode: item.checklistCode,
                    description: item.description,
                    selection: item.selection || 'NOT_APPLICABLE',
                })),
                repetitiveCheckHours: formData.repetitiveCheckHours ? Number(formData.repetitiveCheckHours) : undefined,
                constantHeadingShip: {
                    name: formData.constantHeadingShip.name || '',
                    rank: formData.constantHeadingShip.rank || '',
                    signature: extractBase64(formData.constantHeadingShip.signature || ''),
                    date: formData.constantHeadingShip.date || null,
                    time: formData.constantHeadingShip.time || '',
                },
                manoeuvringShip: {
                    name: formData.manoeuvringShip.name || '',
                    rank: formData.manoeuvringShip.rank || '',
                    signature: extractBase64(formData.manoeuvringShip.signature || ''),
                    date: formData.manoeuvringShip.date || null,
                    time: formData.manoeuvringShip.time || '',
                },
                status: 'DRAFT',
            };

            const form = new FormData();
            form.append("data", JSON.stringify(payload));

            // Use PUT for update mode, POST for create mode
            const method = isUpdateMode ? "PUT" : "POST";
            const encodedRef = encodeURIComponent(cleanOperationRef);
            const url = isUpdateMode 
                ? `/api/sts-proxy/ops-ofd-005e?operationRef=${encodedRef}`
                : "/api/sts-proxy/ops-ofd-005e/create";

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
            <div className="relative z-20 min-h-screen text-white p-8">
                <div className="max-w-7xl mx-auto bg-gray-800/95 rounded-lg shadow-2xl p-8 backdrop-blur-sm">
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
                            Declaration Of STS At Sea
                        </h2>
                        {isUpdateMode && (
                            <div className="mt-2 px-3 sm:px-4 py-1 bg-yellow-600/30 border border-yellow-500 rounded text-yellow-300 text-xs sm:text-sm font-semibold">
                                EDIT MODE
                            </div>
                        )}
                    </div>
                    <div className="bg-gray-700 p-4 rounded min-w-[200px]">
                        <div className="text-sm space-y-1">
                            <div><strong>Form No:</strong> {formData.formNo}</div>
                            <div><strong>Issue Date:</strong> {formData.issueDate}</div>
                            <div><strong>Approved by:</strong> {formData.approvedBy}</div>
                            <div><strong>Operation Ref:</strong> {formData.operationRef || '—'}</div>
                        </div>
                    </div>
                </div>

                {/* Ship Name Input Fields */}
                <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="constantHeadingShipName" className="block text-sm mb-2 font-semibold">
                            Constant Heading Ship or Berthed Ship:
                        </label>
                        <input
                            id="constantHeadingShipName"
                            type="text"
                            value={formData.constantHeadingShipName}
                            onChange={(e) => handleInputChange('constantHeadingShipName', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                            placeholder="Enter ship name"
                        />
                    </div>
                    <div>
                        <label htmlFor="manoeuvringShipName" className="block text-sm mb-2 font-semibold">
                            Manoeuvring Ship or Outer ship:
                        </label>
                        <input
                            id="manoeuvringShipName"
                            type="text"
                            value={formData.manoeuvringShipName}
                            onChange={(e) => handleInputChange('manoeuvringShipName', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                            placeholder="Enter ship name"
                        />
                    </div>
                </div>

                {/* Declaration Section */}
                <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">
                        Declaration for STS operations at Sea
                    </h3>
                    <p className="mb-4">
                        The undersigned have checked and agreed the applicable checklist questions and confirm in the declarations below.
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.declarationAccepted}
                            onChange={(e) => handleInputChange('declarationAccepted', e.target.checked)}
                            className="w-4 h-4"
                        />
                        <span>I agree to the declaration</span>
                    </label>
                </div>

                {/* Checklist Table */}
                <div className="mb-8 overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-600">
                        <thead>
                            <tr className="bg-gray-700">
                                <th className="border border-gray-600 p-3 text-left">Checklist</th>
                                <th className="border border-gray-600 p-3 text-left">Description</th>
                                <th className="border border-gray-600 p-3 text-center">Constant heading Ship or Berthed ship</th>
                                <th className="border border-gray-600 p-3 text-center">Manoeuvring Ship or Outer ship</th>
                                <th className="border border-gray-600 p-3 text-center">Not Applicable</th>
                            </tr>
                        </thead>
                        <tbody>
                            {formData.checklists.map((item, index) => (
                                <tr key={item.checklistCode} className="hover:bg-gray-700">
                                    <td className="border border-gray-600 p-3 font-semibold">
                                        Checklist {item.checklistCode}
                                    </td>
                                    <td className="border border-gray-600 p-3">
                                        {item.description}
                                    </td>
                                    <td className="border border-gray-600 p-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={item.selection === 'CONSTANT_HEADING'}
                                            onChange={() => handleChecklistChange(index, 'CONSTANT_HEADING')}
                                            className="w-4 h-4"
                                        />
                                    </td>
                                    <td className="border border-gray-600 p-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={item.selection === 'MANOEUVRING'}
                                            onChange={() => handleChecklistChange(index, 'MANOEUVRING')}
                                            className="w-4 h-4"
                                        />
                                    </td>
                                    <td className="border border-gray-600 p-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={item.selection === 'NOT_APPLICABLE'}
                                            onChange={() => handleChecklistChange(index, 'NOT_APPLICABLE')}
                                            className="w-4 h-4"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Additional Information */}
                <div className="mb-8 space-y-4 text-sm">
                    <p>
                        In Accordance with the Guidance in the STS transfer Guide, The Entries we have made are correct to the best of our knowledge and that the ships agree to perform the STS operation.
                    </p>
                    <div className="flex items-center gap-2">
                        <span>Repetitive Checks noted in Checklist 5B of the transfer Guide, shall be carried out at intervals of not more than</span>
                        <input
                            type="number"
                            value={formData.repetitiveCheckHours}
                            onChange={(e) => handleInputChange('repetitiveCheckHours', e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded px-3 py-1 w-20 text-white"
                            placeholder="Hours"
                        />
                        <span>Hours.</span>
                    </div>
                    <p>
                        If the status of any item changes, the other ship should be notified immediately.
                    </p>
                </div>

                {/* Signature Section */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                    {/* Constant Heading Ship Signature */}
                    <div className="bg-gray-700 p-6 rounded">
                        <h4 className="font-semibold mb-4 border-b border-gray-600 pb-2">
                            Constant Heading Ship or Berthed Ship
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm mb-1">Name:</label>
                                <input
                                    type="text"
                                    value={formData.constantHeadingShip.name}
                                    onChange={(e) => handleSignatureChange('constantHeadingShip', 'name', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Rank:</label>
                                <input
                                    type="text"
                                    value={formData.constantHeadingShip.rank}
                                    onChange={(e) => handleSignatureChange('constantHeadingShip', 'rank', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Signature:</label>
                                <input
                                    ref={constantHeadingShipFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleSignatureUpload('constantHeadingShip', e)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                                />
                                {formData.constantHeadingShip.signature && (
                                    <div className="mt-2">
                                        <img
                                            src={formData.constantHeadingShip.signature}
                                            alt="Signature preview"
                                            className="max-w-full h-24 border border-gray-600 rounded"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleSignatureChange('constantHeadingShip', 'signature', '')}
                                            className="mt-2 text-sm text-red-400 hover:text-red-300"
                                        >
                                            Remove Signature
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1">Date:</label>
                                    <input
                                        type="date"
                                        value={formData.constantHeadingShip.date}
                                        onChange={(e) => handleSignatureChange('constantHeadingShip', 'date', e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1">Time:</label>
                                    <TimePicker24
                                        value={formData.constantHeadingShip.time}
                                        onChange={(v) => handleSignatureChange('constantHeadingShip', 'time', v)}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Manoeuvring Ship Signature */}
                    <div className="bg-gray-700 p-6 rounded">
                        <h4 className="font-semibold mb-4 border-b border-gray-600 pb-2">
                            Manoeuvring Ship or Outer ship
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm mb-1">Name:</label>
                                <input
                                    type="text"
                                    value={formData.manoeuvringShip.name}
                                    onChange={(e) => handleSignatureChange('manoeuvringShip', 'name', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Rank:</label>
                                <input
                                    type="text"
                                    value={formData.manoeuvringShip.rank}
                                    onChange={(e) => handleSignatureChange('manoeuvringShip', 'rank', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Signature:</label>
                                <input
                                    ref={manoeuvringShipFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleSignatureUpload('manoeuvringShip', e)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                                />
                                {formData.manoeuvringShip.signature && (
                                    <div className="mt-2">
                                        <img
                                            src={formData.manoeuvringShip.signature}
                                            alt="Signature preview"
                                            className="max-w-full h-24 border border-gray-600 rounded"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleSignatureChange('manoeuvringShip', 'signature', '')}
                                            className="mt-2 text-sm text-red-400 hover:text-red-300"
                                        >
                                            Remove Signature
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1">Date:</label>
                                    <input
                                        type="date"
                                        value={formData.manoeuvringShip.date}
                                        onChange={(e) => handleSignatureChange('manoeuvringShip', 'date', e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1">Time:</label>
                                    <TimePicker24
                                        value={formData.manoeuvringShip.time}
                                        onChange={(v) => handleSignatureChange('manoeuvringShip', 'time', v)}
                                        className="w-full"
                                    />
                                </div>
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
                                <p className="text-xs sm:text-sm wrap-break-word">{submitError}</p>
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
                        {(() => {
                            if (submitting) {
                                return isUpdateMode ? 'Updating...' : 'Submitting...';
                            }
                            return isUpdateMode ? 'Update Declaration' : 'Submit Declaration';
                        })()}
                    </button>
                </div>
                {submitSuccess && (
                    <div className="mt-4 p-3 sm:p-4 bg-green-900/30 border border-green-600 rounded text-green-300 text-xs sm:text-sm">
                        {isUpdateMode 
                            ? 'Declaration updated successfully.' 
                            : 'Form submitted successfully.'
                        }
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}


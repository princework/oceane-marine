'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
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
        const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL1 || 'http://localhost:3000';
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
    { code: '7', description: 'Checks Pre Transfer Conference alongside a terminal' },
    { code: '4B', description: '(Additional for Vapour Balancing)' },
    { code: '4C', description: '(Additional for Chemicals)' },
    { code: '4D', description: '(Additional for LPG and LNG)' },
    { code: '4E', description: '(Additional for LNG)' },
    { code: '4F', description: 'Pre Transfer Agreement' },
];

export default function DeclarationSTSTerminal() {
    const searchParams = useSearchParams();
    const router = useRouter();
    // Trim trailing comma from operationRef if present
    const rawOperationRef = searchParams.get('operationRef');
    const operationRef = rawOperationRef ? rawOperationRef.replace(/,\s*$/, '').trim() : null;
    const mode = searchParams.get('mode'); // 'update' or null

    const [formData, setFormData] = useState({
        operationRef: operationRef || '',
        formNo: 'OPS-OFD-005D',
        revisionNo: '1.2',
        issueDate: new Date().toISOString().split('T')[0],
        approvedBy: 'JS',
        page: '1 of 1',
        // Three input sections
        terminalBerthedShip: '',
        outerShip: '',
        terminal: '',
        declarationAccepted: true,
        checklists: CHECKLIST_ITEMS.map(item => ({
            checklistCode: item.code,
            description: item.description,
            selection: '', // Will be 'TERMINAL_BERTHED', 'OUTER_SHIP', 'TERMINAL', or 'NOT_APPLICABLE'
        })),
        repetitiveCheckHours: '',
        // Three signature sections
        terminalBerthedShipSignature: {
            name: '',
            rank: '',
            signature: '',
            date: '',
            time: '',
        },
        outerShipSignature: {
            name: '',
            rank: '',
            signature: '',
            date: '',
            time: '',
        },
        terminalSignature: {
            name: '',
            rank: '',
            signature: '',
            date: '',
            time: '',
        },
    });

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
            formNo: 'OPS-OFD-005D',
            revisionNo: '1.2',
            issueDate: new Date().toISOString().split('T')[0],
            approvedBy: 'JS',
            page: '1 of 1',
            terminalBerthedShip: '',
            outerShip: '',
            terminal: '',
            declarationAccepted: true,
            checklists: CHECKLIST_ITEMS.map(item => ({
                checklistCode: item.code,
                description: item.description,
                selection: '',
            })),
            repetitiveCheckHours: '',
            terminalBerthedShipSignature: {
                name: '',
                rank: '',
                signature: '',
                date: '',
                time: '',
            },
            outerShipSignature: {
                name: '',
                rank: '',
                signature: '',
                date: '',
                time: '',
            },
            terminalSignature: {
                name: '',
                rank: '',
                signature: '',
                date: '',
                time: '',
            },
        });
    };

    // Function to reset form completely and clear URL params (for update mode after submission)
    const resetFormToCreateMode = () => {
        setFormData({
            operationRef: '',
            formNo: 'OPS-OFD-005D',
            revisionNo: '1.2',
            issueDate: new Date().toISOString().split('T')[0],
            approvedBy: 'JS',
            page: '1 of 1',
            terminalBerthedShip: '',
            outerShip: '',
            terminal: '',
            declarationAccepted: true,
            checklists: CHECKLIST_ITEMS.map(item => ({
                checklistCode: item.code,
                description: item.description,
                selection: '',
            })),
            repetitiveCheckHours: '',
            terminalBerthedShipSignature: {
                name: '',
                rank: '',
                signature: '',
                date: '',
                time: '',
            },
            outerShipSignature: {
                name: '',
                rank: '',
                signature: '',
                date: '',
                time: '',
            },
            terminalSignature: {
                name: '',
                rank: '',
                signature: '',
                date: '',
                time: '',
            },
        });
        setIsUpdateMode(false);
        router.replace('/OPS-OFD-005D');
    };

    // Function to fetch existing data for update mode
    const fetchExistingData = async (refNumber) => {
        try {
            setLoadingData(true);
            setSubmitError(null);
            
            const trimmedRef = refNumber?.replace(/,\s*$/, '').trim();
            
            if (!trimmedRef) {
                throw new Error('Operation reference is required');
            }
            
            const encodedRef = encodeURIComponent(trimmedRef);
            const res = await fetch(`/api/sts-proxy/ops-ofd-005d?operationRef=${encodedRef}`);
            
            if (res.status === 404) {
                throw new Error('CHECKLIST_NOT_FOUND');
            }
            
            const contentType = res.headers.get("content-type");
            let responseData;
            
            try {
                if (contentType?.includes("application/json")) {
                    responseData = await res.json();
                } else {
                    const text = await res.text();
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
            
            const data = responseData?.data || responseData;
            
            if (!data) {
                throw new Error('NO_DATA_RECEIVED');
            }
            
            const cleanOperationRef = (data.operationRef || trimmedRef || '')?.replace(/,\s*$/, '').trim();
            
            setFormData({
                operationRef: cleanOperationRef || '',
                formNo: (data.formNo || 'OPS-OFD-005D')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-005D',
                revisionNo: data.revisionNo || '1.2',
                issueDate: safeParseDate(data.issueDate) || new Date().toISOString().split('T')[0],
                approvedBy: data.approvedBy || 'JS',
                page: data.page || '1 of 1',
                terminalBerthedShip: data.terminalBerthedShip || '',
                outerShip: data.outerShip || '',
                terminal: data.terminal || '',
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
                terminalBerthedShipSignature: {
                    name: data.terminalBerthedShipSignature?.name || '',
                    rank: data.terminalBerthedShipSignature?.rank || '',
                    signature: getSignatureUrl(data.terminalBerthedShipSignature?.signature || ''),
                    date: safeParseDate(data.terminalBerthedShipSignature?.date) || '',
                    time: data.terminalBerthedShipSignature?.time || '',
                },
                outerShipSignature: {
                    name: data.outerShipSignature?.name || '',
                    rank: data.outerShipSignature?.rank || '',
                    signature: getSignatureUrl(data.outerShipSignature?.signature || ''),
                    date: safeParseDate(data.outerShipSignature?.date) || '',
                    time: data.outerShipSignature?.time || '',
                },
                terminalSignature: {
                    name: data.terminalSignature?.name || '',
                    rank: data.terminalSignature?.rank || '',
                    signature: getSignatureUrl(data.terminalSignature?.signature || ''),
                    date: safeParseDate(data.terminalSignature?.date) || '',
                    time: data.terminalSignature?.time || '',
                },
            });
        } catch (err) {
            const userFriendlyError = getUserFriendlyError(err);
            setSubmitError(userFriendlyError);
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
        
        if (mode === 'update' && operationRef) {
            setIsUpdateMode(true);
            fetchExistingData(operationRef);
        }
    }, [operationRef, mode]);

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
                formNo: (formData.formNo || 'OPS-OFD-005D')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-005D',
                revisionNo: formData.revisionNo || '1.2',
                issueDate: formData.issueDate ? new Date(formData.issueDate) : undefined,
                approvedBy: formData.approvedBy,
                page: formData.page || '1 of 1',
                terminalBerthedShip: formData.terminalBerthedShip || '',
                outerShip: formData.outerShip || '',
                terminal: formData.terminal || '',
                declarationAccepted: formData.declarationAccepted,
                checklists: formData.checklists.map((item) => ({
                    checklistCode: item.checklistCode,
                    description: item.description,
                    selection: item.selection || 'NOT_APPLICABLE',
                })),
                repetitiveCheckHours: formData.repetitiveCheckHours ? Number(formData.repetitiveCheckHours) : undefined,
                terminalBerthedShipSignature: {
                    name: formData.terminalBerthedShipSignature.name || '',
                    rank: formData.terminalBerthedShipSignature.rank || '',
                    signature: extractBase64(formData.terminalBerthedShipSignature.signature || ''),
                    date: formData.terminalBerthedShipSignature.date || null,
                    time: formData.terminalBerthedShipSignature.time || '',
                },
                outerShipSignature: {
                    name: formData.outerShipSignature.name || '',
                    rank: formData.outerShipSignature.rank || '',
                    signature: extractBase64(formData.outerShipSignature.signature || ''),
                    date: formData.outerShipSignature.date || null,
                    time: formData.outerShipSignature.time || '',
                },
                terminalSignature: {
                    name: formData.terminalSignature.name || '',
                    rank: formData.terminalSignature.rank || '',
                    signature: extractBase64(formData.terminalSignature.signature || ''),
                    date: formData.terminalSignature.date || null,
                    time: formData.terminalSignature.time || '',
                },
                status: 'DRAFT',
            };

            const form = new FormData();
            form.append("data", JSON.stringify(payload));

            const method = isUpdateMode ? "PUT" : "POST";
            const encodedRef = encodeURIComponent(cleanOperationRef);
            const url = isUpdateMode 
                ? `/api/sts-proxy/ops-ofd-005d?operationRef=${encodedRef}`
                : "/api/sts-proxy/ops-ofd-005d/create";

            let res;
            try {
                res = await fetch(url, {
                    method: method,
                    body: form
                });
            } catch (fetchError) {
                if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
                    throw new Error('Network error: Unable to connect to server. Please check your connection.');
                }
                throw fetchError;
            }

            const contentType = res.headers.get("content-type");
            let responseData;
            
            try {
                if (contentType?.includes("application/json")) {
                    responseData = await res.json();
                } else {
                    const text = await res.text();
                    try {
                        responseData = JSON.parse(text);
                    } catch {
                        throw new Error(text || `Server error: ${res.status} ${res.statusText}`);
                    }
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
            const userFriendlyError = getUserFriendlyError(err);
            setSubmitError(userFriendlyError);
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
                            STS Transfer Safety Checklist
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
                            <div><strong>Rev. No:</strong> {formData.revisionNo}</div>
                            <div><strong>Issue Date:</strong> {new Date(formData.issueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                            <div><strong>Approved by:</strong> {formData.approvedBy}</div>
                            <div><strong>Page:</strong> {formData.page}</div>
                            <div><strong>Operation Ref:</strong> {formData.operationRef || '—'}</div>
                        </div>
                    </div>
                </div>

                {/* Three Input Sections */}
                <div className="mb-6 sm:mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="terminalBerthedShip" className="block text-sm mb-1">Terminal Berthed Ship:</label>
                        <input
                            id="terminalBerthedShip"
                            type="text"
                            value={formData.terminalBerthedShip}
                            onChange={(e) => handleInputChange('terminalBerthedShip', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm sm:text-base"
                        />
                    </div>
                    <div>
                        <label htmlFor="outerShip" className="block text-sm mb-1">Outer ship:</label>
                        <input
                            id="outerShip"
                            type="text"
                            value={formData.outerShip}
                            onChange={(e) => handleInputChange('outerShip', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm sm:text-base"
                        />
                    </div>
                    <div>
                        <label htmlFor="terminal" className="block text-sm mb-1">Terminal:</label>
                        <input
                            id="terminal"
                            type="text"
                            value={formData.terminal}
                            onChange={(e) => handleInputChange('terminal', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm sm:text-base"
                        />
                    </div>
                </div>

                {/* Declaration Section */}
                <div className="mb-6 sm:mb-8">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
                        Declaration for STS operations (At port & Terminal)
                    </h3>
                    <p className="mb-4 text-sm sm:text-base">
                        The undersigned have checked and agreed the Applicable checklist questions and confirm in the declarations below.
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.declarationAccepted}
                            onChange={(e) => handleInputChange('declarationAccepted', e.target.checked)}
                            className="w-4 h-4"
                        />
                        <span className="text-sm sm:text-base">I agree to the declaration</span>
                    </label>
                </div>

                {/* Checklist Table */}
                <div className="mb-6 sm:mb-8 overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-600">
                        <thead>
                            <tr className="bg-gray-700">
                                <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Checklist</th>
                                <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Description</th>
                                <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Terminal Berthed ship</th>
                                <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Outer ship</th>
                                <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Terminal</th>
                                <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Not Applicable</th>
                            </tr>
                        </thead>
                        <tbody>
                            {formData.checklists.map((item, index) => (
                                <tr key={item.checklistCode} className="hover:bg-gray-700">
                                    <td className="border border-gray-600 p-2 sm:p-3 font-semibold text-xs sm:text-sm">
                                        Checklist {item.checklistCode}
                                    </td>
                                    <td className="border border-gray-600 p-2 sm:p-3 text-xs sm:text-sm">
                                        {item.description}
                                    </td>
                                    <td className="border border-gray-600 p-2 sm:p-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={item.selection === 'TERMINAL_BERTHED'}
                                            onChange={() => handleChecklistChange(index, 'TERMINAL_BERTHED')}
                                            className="w-4 h-4"
                                        />
                                    </td>
                                    <td className="border border-gray-600 p-2 sm:p-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={item.selection === 'OUTER_SHIP'}
                                            onChange={() => handleChecklistChange(index, 'OUTER_SHIP')}
                                            className="w-4 h-4"
                                        />
                                    </td>
                                    <td className="border border-gray-600 p-2 sm:p-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={item.selection === 'TERMINAL'}
                                            onChange={() => handleChecklistChange(index, 'TERMINAL')}
                                            className="w-4 h-4"
                                        />
                                    </td>
                                    <td className="border border-gray-600 p-2 sm:p-3 text-center">
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

                {/* Post-Checklist Text */}
                <div className="mb-6 sm:mb-8 space-y-3 sm:space-y-4 text-sm sm:text-base">
                    <p>
                        In Accordance with the Guidance in the STS transfer Guide, The Entries we have made are correct to the best of our knowledge and that the ships agree to perform the STS operation.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
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

                {/* Signature Section - Three Columns */}
                <div className="mb-6 sm:mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    {/* Terminal Berthed Ship Signature */}
                    <div className="bg-gray-700 p-4 sm:p-6 rounded">
                        <h4 className="font-semibold mb-4 border-b border-gray-600 pb-2 text-sm sm:text-base">
                            Terminal Berthed Ship
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm mb-1">Name:</label>
                                <input
                                    type="text"
                                    value={formData.terminalBerthedShipSignature.name}
                                    onChange={(e) => handleSignatureChange('terminalBerthedShipSignature', 'name', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Rank:</label>
                                <input
                                    type="text"
                                    value={formData.terminalBerthedShipSignature.rank}
                                    onChange={(e) => handleSignatureChange('terminalBerthedShipSignature', 'rank', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Signature:</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleSignatureUpload('terminalBerthedShipSignature', e)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer text-sm"
                                />
                                {formData.terminalBerthedShipSignature.signature && (
                                    <div className="mt-2">
                                        <img
                                            src={formData.terminalBerthedShipSignature.signature}
                                            alt="Signature preview"
                                            className="max-w-full h-24 border border-gray-600 rounded object-contain bg-gray-700"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleSignatureChange('terminalBerthedShipSignature', 'signature', '')}
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
                                        value={formData.terminalBerthedShipSignature.date}
                                        onChange={(e) => handleSignatureChange('terminalBerthedShipSignature', 'date', e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1">Time:</label>
                                    <TimePicker24
                                        value={formData.terminalBerthedShipSignature.time}
                                        onChange={(v) => handleSignatureChange('terminalBerthedShipSignature', 'time', v)}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Outer Ship Signature */}
                    <div className="bg-gray-700 p-4 sm:p-6 rounded">
                        <h4 className="font-semibold mb-4 border-b border-gray-600 pb-2 text-sm sm:text-base">
                            Outer Ship
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm mb-1">Name:</label>
                                <input
                                    type="text"
                                    value={formData.outerShipSignature.name}
                                    onChange={(e) => handleSignatureChange('outerShipSignature', 'name', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Rank:</label>
                                <input
                                    type="text"
                                    value={formData.outerShipSignature.rank}
                                    onChange={(e) => handleSignatureChange('outerShipSignature', 'rank', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Signature:</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleSignatureUpload('outerShipSignature', e)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer text-sm"
                                />
                                {formData.outerShipSignature.signature && (
                                    <div className="mt-2">
                                        <img
                                            src={formData.outerShipSignature.signature}
                                            alt="Signature preview"
                                            className="max-w-full h-24 border border-gray-600 rounded object-contain bg-gray-700"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleSignatureChange('outerShipSignature', 'signature', '')}
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
                                        value={formData.outerShipSignature.date}
                                        onChange={(e) => handleSignatureChange('outerShipSignature', 'date', e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1">Time:</label>
                                    <TimePicker24
                                        value={formData.outerShipSignature.time}
                                        onChange={(v) => handleSignatureChange('outerShipSignature', 'time', v)}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Terminal Signature */}
                    <div className="bg-gray-700 p-4 sm:p-6 rounded">
                        <h4 className="font-semibold mb-4 border-b border-gray-600 pb-2 text-sm sm:text-base">
                            Terminal
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm mb-1">Name:</label>
                                <input
                                    type="text"
                                    value={formData.terminalSignature.name}
                                    onChange={(e) => handleSignatureChange('terminalSignature', 'name', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Rank:</label>
                                <input
                                    type="text"
                                    value={formData.terminalSignature.rank}
                                    onChange={(e) => handleSignatureChange('terminalSignature', 'rank', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Signature:</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleSignatureUpload('terminalSignature', e)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer text-sm"
                                />
                                {formData.terminalSignature.signature && (
                                    <div className="mt-2">
                                        <img
                                            src={formData.terminalSignature.signature}
                                            alt="Signature preview"
                                            className="max-w-full h-24 border border-gray-600 rounded object-contain bg-gray-700"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleSignatureChange('terminalSignature', 'signature', '')}
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
                                        value={formData.terminalSignature.date}
                                        onChange={(e) => handleSignatureChange('terminalSignature', 'date', e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1">Time:</label>
                                    <TimePicker24
                                        value={formData.terminalSignature.time}
                                        onChange={(v) => handleSignatureChange('terminalSignature', 'time', v)}
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

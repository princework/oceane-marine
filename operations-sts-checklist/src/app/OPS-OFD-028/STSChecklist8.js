'use client';

import { useState, useEffect, useRef } from 'react';
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
        const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
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

export default function STSChecklist8() {
    const searchParams = useSearchParams();
    const router = useRouter();
    // Trim trailing comma from operationRef if present
    const rawOperationRef = searchParams.get('operationRef');
    const operationRef = rawOperationRef ? rawOperationRef.replace(/,\s*$/, '').trim() : null;
    const mode = searchParams.get('mode'); // 'update' or null
    const signatureFileInputRef = useRef(null);
    const stampFileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        operationRef: operationRef || '',
        // Document Info
        documentInfo: {
            formNo: 'OPS-OFD-028',
            revisionNo: '1.2',
            revisionDate: new Date().toISOString().split('T')[0],
            approvedBy: 'JS',
        },
        // Form Data
        jobReference: '',
        masterName: '',
        vesselName: '',
        signedDate: new Date().toISOString().split('T')[0],
        signedTime: '',
        timeZoneLabel: 'LT',
        // Signature Block
        signatureBlock: {
            signatureImage: '',
            stampImage: '',
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
                formNo: 'OPS-OFD-028',
                revisionNo: '1.2',
                revisionDate: new Date().toISOString().split('T')[0],
                approvedBy: 'JS',
            },
            jobReference: '',
            masterName: '',
            vesselName: '',
            signedDate: new Date().toISOString().split('T')[0],
            signedTime: '',
            timeZoneLabel: 'LT',
            signatureBlock: {
                signatureImage: '',
                stampImage: '',
            },
        });
        // Reset file inputs
        if (signatureFileInputRef.current) {
            signatureFileInputRef.current.value = '';
        }
        if (stampFileInputRef.current) {
            stampFileInputRef.current.value = '';
        }
    };

    // Function to reset form completely and clear URL params (for update mode after submission)
    const resetFormToCreateMode = () => {
        setFormData({
            operationRef: '',
            documentInfo: {
                formNo: 'OPS-OFD-028',
                revisionNo: '1.2',
                revisionDate: new Date().toISOString().split('T')[0],
                approvedBy: 'JS',
            },
            jobReference: '',
            masterName: '',
            vesselName: '',
            signedDate: new Date().toISOString().split('T')[0],
            signedTime: '',
            timeZoneLabel: 'LT',
            signatureBlock: {
                signatureImage: '',
                stampImage: '',
            },
        });
        // Reset file inputs
        if (signatureFileInputRef.current) {
            signatureFileInputRef.current.value = '';
        }
        if (stampFileInputRef.current) {
            stampFileInputRef.current.value = '';
        }
        // Clear update mode
        setIsUpdateMode(false);
        // Clear URL parameters
        router.replace('/OPS-OFD-028');
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
            const res = await fetch(`/api/sts-proxy/ops-ofd-028?operationRef=${encodedRef}`);

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
                    formNo: (data.documentInfo?.formNo || 'OPS-OFD-028')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-028',
                    revisionNo: data.documentInfo?.revisionNo || '1.2',
                    revisionDate: safeParseDate(data.documentInfo?.revisionDate) || new Date().toISOString().split('T')[0],
                    approvedBy: data.documentInfo?.approvedBy || 'JS',
                },
                jobReference: data.jobReference || '',
                masterName: data.masterName || '',
                vesselName: data.vesselName || '',
                signedDate: safeParseDate(data.signedDate) || new Date().toISOString().split('T')[0],
                signedTime: data.signedTime || '',
                timeZoneLabel: data.timeZoneLabel || 'LT',
                signatureBlock: {
                    signatureImage: getSignatureUrl(data.signatureBlock?.signatureImage || ''),
                    stampImage: getSignatureUrl(data.signatureBlock?.stampImage || ''),
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

    // Form Data handlers
    const handleFormDataChange = (field, value) => {
        setFormData({
            ...formData,
            [field]: value,
        });
    };

    // Signature handlers
    const handleSignatureChange = (field, value) => {
        setFormData({
            ...formData,
            signatureBlock: {
                ...formData.signatureBlock,
                [field]: value,
            },
        });
    };

    const handleSignatureUpload = (event, field) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                handleSignatureChange(field, base64String);
            };
            reader.readAsDataURL(file);
        }
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

            // Extract base64 data from data URLs if present
            const extractBase64 = (dataUrl) => {
                if (!dataUrl) return '';
                // If it's already a base64 string (starts with data:), extract just the base64 part
                if (dataUrl.startsWith('data:')) {
                    const base64Match = dataUrl.match(/data:image\/[^;]+;base64,(.+)/);
                    return base64Match ? base64Match[1] : dataUrl;
                }
                // If it's a URL path, return as is (backend will handle it)
                return dataUrl;
            };

            const payload = {
                operationRef: cleanOperationRef,
                documentInfo: {
                    formNo: (formData.documentInfo.formNo || 'OPS-OFD-028')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-028',
                    revisionNo: formData.documentInfo.revisionNo || '1.2',
                    revisionDate: formData.documentInfo.revisionDate || null,
                    approvedBy: formData.documentInfo.approvedBy || 'JS',
                },
                jobReference: formData.jobReference || '',
                masterName: formData.masterName || '',
                vesselName: formData.vesselName || '',
                signedDate: formData.signedDate || null,
                signedTime: formData.signedTime || '',
                timeZoneLabel: formData.timeZoneLabel || 'LT',
                signatureBlock: {
                    signatureImage: extractBase64(formData.signatureBlock.signatureImage || ''),
                    stampImage: extractBase64(formData.signatureBlock.stampImage || ''),
                },
                // Add static text content for docx generation
                termsAndConditions: {
                    paragraph1: "All the applicable but not limited to standard indemnity terms and conditions with which OCEANE FENDERS DMCC (\"OFD\") provides STS Transfer Services to any vessel, are prescribed hereunder and master of each vessel by signing a letter for himself and on behalf of Owners, Operators, Ship Managers and Demise Charterers (if any) of the vessel, agree to these T&C for the intended STS Transfer.",
                    paragraph2: "If for operational reasons the standard indemnity terms and conditions is not, or cannot be signed by the Master, then the Master by accepting the STS Transfer Services, nonetheless agrees by conduct to the terms and conditions on behalf of those persons stated in paragraph 1 as fully as if the terms and conditions had been signed.",
                    clause1: "The Master signs for himself and for and on behalf of the Owners, Operators, Ship Managers, and Demise Charterers (if any) of the said vessel, who are all bound by these terms and conditions. OFD is or shall be deemed to be acting on behalf of and for the benefit of all.",
                    clause2: "The Mooring Master will be acting only in an advisory role and therefore does not supersede the Master in the command of the vessel but acts as his adviser so that the management and/or command and/or navigation of the vessel will always remain with the Master and/or crew of the vessel. The Mooring Master will be deemed to be an employee and a servant of those persons stated in paragraph 1. who shall always be liable for the Mooring master's acts, neglect or default in the course of his employment. In all circumstances Master of the concerned vessel shall remain solely responsible on behalf of persons as stated in Para 1.",
                    clause3: "The presence of POAC shall not relieve the master of his responsibility as stated in Para 2 above. Neither OFD nor the POAC or any other person employed or engaged by OFD in connection with the performance of STS Transfer service shall be liable for any loss, detention, delay, mis-delivery, damage, personal injury or death, howsoever, whatsoever, and where so ever caused and of what kind whether or not such loss, detention, delay, mis-delivery, damage, death or personal injury is the result of any act, neglect or default of OFD or its servants or of others for whom it may be responsible.",
                    clause4: "If OFD and/or the Mooring Master should be held liable by a third party for any loss or damage of whatsoever nature or for any loss of life or personal injury to, and or illness of any person, or for any pollution of whatsoever nature, howsoever caused, the Owners, Operators, Ship Managers, and Demise Charterers (if any) shall jointly and severally fully indemnify OFD, POAC and/or the Mooring Master against all costs, charges, claims, expenses, fines and penalties; which OFD, POAC and/or Mooring Master may be liable to pay pursuant to aforesaid third party claims.",
                    clause5: "No liability shall be attached to OFD, POAC or the Mooring Master, if once on-board, the Mooring Master is unable for any reason whatsoever to perform the duties of a Mooring Master.",
                    clause6: "These conditions shall be construed according to English law and any disputes arising with respect to or in connection with this agreement shall be finally decided in London by one arbitrator in accordance with the Rules of Arbitration of the International Chamber of Commerce. The decision of the arbitrator shall be final and without appeal to the courts, and may be entered and enforced in any court of competent jurisdiction.",
                    acknowledgement: "I HEREBY REQUEST THE SERVICES OF OCEANE FENDERS DMCC AND I HEREBY ACKNOWLEDGE RECEIPT OF A COPY OF THE CONDITIONS OF USE OF A MOORING MASTER SUPPLIED BY OCEANE FENDERS DMCC."
                },
                status: 'DRAFT',
            };

            const form = new FormData();
            form.append("data", JSON.stringify(payload));

            // Use PUT for update mode, POST for create mode
            const method = isUpdateMode ? "PUT" : "POST";
            const encodedRef = encodeURIComponent(cleanOperationRef);
            const url = isUpdateMode
                ? `/api/sts-proxy/ops-ofd-028?operationRef=${encodedRef}`
                : "/api/sts-proxy/ops-ofd-028/create";

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
                    <div className="max-w-5xl mx-auto bg-gray-800/95 rounded-lg shadow-2xl p-4 sm:p-6 lg:p-8 backdrop-blur-sm">
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
                <div className="max-w-5xl mx-auto bg-gray-800/95 rounded-lg shadow-2xl p-4 sm:p-6 lg:p-8 backdrop-blur-sm">
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
                            Personnel Transfer Basket Checklist
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
                            <div><strong>Rev Date:</strong> {formData.documentInfo.revisionDate}</div>
                            <div><strong>Approved by:</strong> {formData.documentInfo.approvedBy}</div>
                            {formData.operationRef && (
                                <div><strong>Operation Ref:</strong> {formData.operationRef}</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Job Reference */}
                <div className="mb-4 sm:mb-6">
                    <label htmlFor="job-reference" className="block text-sm mb-1 font-semibold">Job Ref:</label>
                    <input
                        id="job-reference"
                        type="text"
                        value={formData.jobReference}
                        onChange={(e) => handleFormDataChange('jobReference', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
                    />
                </div>

                {/* Standard Indemnity Terms and Conditions */}
                <div className="mb-6 sm:mb-8">
                    <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 underline text-center">STANDARD INDEMNITY TERMS AND CONDITIONS</h2>

                    <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm leading-relaxed">
                        <p>
                            All the applicable but not limited to standard indemnity terms and conditions with which OCEANE FENDERS DMCC ("OFD") provides STS Transfer Services to any vessel, are prescribed hereunder and master of each vessel by signing a letter for himself and on behalf of Owners, Operators, Ship Managers and Demise Charterers (if any) of the vessel, agree to these T&C for the intended STS Transfer.
                        </p>
                        <p>
                            If for operational reasons the standard indemnity terms and conditions is not, or cannot be signed by the Master, then the Master by accepting the STS Transfer Services, nonetheless agrees by conduct to the terms and conditions on behalf of those persons stated in paragraph 1 as fully as if the terms and conditions had been signed.
                        </p>

                        <div className="space-y-2 sm:space-y-3">
                            <p>
                                <span className="font-semibold">1.</span> The Master signs for himself and for and on behalf of the Owners, Operators, Ship Managers, and Demise Charterers (if any) of the said vessel, who are all bound by these terms and conditions. OFD is or shall be deemed to be acting on behalf of and for the benefit of all.
                            </p>

                            <p>
                                <span className="font-semibold">2.</span> The Mooring Master will be acting only in an advisory role and therefore does not supersede the Master in the command of the vessel but acts as his adviser so that the management and/or command and/or navigation of the vessel will always remain with the Master and/or crew of the vessel. The Mooring Master will be deemed to be an employee and a servant of those persons stated in paragraph 1. who shall always be liable for the Mooring master's acts, neglect or default in the course of his employment. In all circumstances Master of the concerned vessel shall remain solely responsible on behalf of persons as stated in Para 1.
                            </p>

                            <p>
                                <span className="font-semibold">3.</span> The presence of POAC shall not relieve the master of his responsibility as stated in Para 2 above. Neither OFD nor the POAC or any other person employed or engaged by OFD in connection with the performance of STS Transfer service shall be liable for any loss, detention, delay, mis-delivery, damage, personal injury or death, howsoever, whatsoever, and where so ever caused and of what kind whether or not such loss, detention, delay, mis-delivery, damage, death or personal injury is the result of any act, neglect or default of OFD or its servants or of others for whom it may be responsible.
                            </p>

                            <p>
                                <span className="font-semibold">4.</span> If OFD and/or the Mooring Master should be held liable by a third party for any loss or damage of whatsoever nature or for any loss of life or personal injury to, and or illness of any person, or for any pollution of whatsoever nature, howsoever caused, the Owners, Operators, Ship Managers, and Demise Charterers (if any) shall jointly and severally fully indemnify OFD, POAC and/or the Mooring Master against all costs, charges, claims, expenses, fines and penalties; which OFD, POAC and/or Mooring Master may be liable to pay pursuant to aforesaid third party claims.
                            </p>

                            <p>
                                <span className="font-semibold">5.</span> No liability shall be attached to OFD, POAC or the Mooring Master, if once on-board, the Mooring Master is unable for any reason whatsoever to perform the duties of a Mooring Master.
                            </p>

                            <p>
                                <span className="font-semibold">6.</span> These conditions shall be construed according to English law and any disputes arising with respect to or in connection with this agreement shall be finally decided in London by one arbitrator in accordance with the Rules of Arbitration of the International Chamber of Commerce. The decision of the arbitrator shall be final and without appeal to the courts, and may be entered and enforced in any court of competent jurisdiction.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Acknowledgement Statement */}
                <div className="mb-6 sm:mb-8 bg-gray-700 p-3 sm:p-4 rounded">
                    <p className="text-xs sm:text-sm font-semibold text-center">
                        I HEREBY REQUEST THE SERVICES OF OCEANE FENDERS DMCC AND I HEREBY ACKNOWLEDGE RECEIPT OF A COPY OF THE CONDITIONS OF USE OF A MOORING MASTER SUPPLIED BY OCEANE FENDERS DMCC.
                    </p>
                </div>

                {/* Signature Section */}
                <div className="mb-6 sm:mb-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                        <div>
                            <label htmlFor="master-name" className="block text-sm mb-1 font-semibold">MASTER:</label>
                            <input
                                id="master-name"
                                type="text"
                                value={formData.masterName}
                                onChange={(e) => handleFormDataChange('masterName', e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
                                placeholder="Master Name"
                            />
                        </div>
                        <div>
                            <label htmlFor="vessel-name" className="block text-sm mb-1 font-semibold">SS/MV:</label>
                            <input
                                id="vessel-name"
                                type="text"
                                value={formData.vesselName}
                                onChange={(e) => handleFormDataChange('vesselName', e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
                                placeholder="Vessel Name"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                        <div>
                            <label htmlFor="signed-date" className="block text-sm mb-1 font-semibold">DATE:</label>
                            <input
                                id="signed-date"
                                type="date"
                                value={formData.signedDate}
                                onChange={(e) => handleFormDataChange('signedDate', e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
                            />
                        </div>
                        <div>
                            <label htmlFor="signed-time" className="block text-sm mb-1 font-semibold">Time (HH:MM):</label>
                            <TimePicker24
                                id="signed-time"
                                value={formData.signedTime}
                                onChange={(v) => handleFormDataChange('signedTime', v)}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label htmlFor="time-zone" className="block text-sm mb-1 font-semibold">Time Zone:</label>
                            <input
                                id="time-zone"
                                type="text"
                                value={formData.timeZoneLabel}
                                onChange={(e) => handleFormDataChange('timeZoneLabel', e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-sm sm:text-base"
                                placeholder="LT"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div>
                            <label htmlFor="signature-upload" className="block text-sm mb-1 font-semibold">Signature:</label>
                            <input
                                ref={signatureFileInputRef}
                                id="signature-upload"
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleSignatureUpload(e, 'signatureImage')}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer text-xs sm:text-sm"
                            />
                            {formData.signatureBlock.signatureImage && (
                                <div className="mt-2">
                                    <img
                                        src={formData.signatureBlock.signatureImage}
                                        alt="Signature preview"
                                        className="max-w-full h-24 sm:h-32 border border-gray-600 rounded bg-white p-2 object-contain"
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
                                        onClick={() => handleSignatureChange('signatureImage', '')}
                                        className="mt-2 text-xs sm:text-sm text-red-400 hover:text-red-300"
                                    >
                                        Remove Signature
                                    </button>
                                </div>
                            )}
                        </div>
                        <div>
                            <label htmlFor="stamp-upload" className="block text-sm mb-1 font-semibold">STAMP:</label>
                            <input
                                ref={stampFileInputRef}
                                id="stamp-upload"
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleSignatureUpload(e, 'stampImage')}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer text-xs sm:text-sm"
                            />
                            {formData.signatureBlock.stampImage && (
                                <div className="mt-2">
                                    <img
                                        src={formData.signatureBlock.stampImage}
                                        alt="Stamp preview"
                                        className="max-w-full h-24 sm:h-32 border border-gray-600 rounded bg-white p-2 object-contain"
                                        onError={(e) => {
                                            // Handle image load errors gracefully
                                            const img = e.target;
                                            img.style.display = 'none';
                                            // Check if error message already exists
                                            if (!img.parentElement.querySelector('.stamp-error')) {
                                                const errorDiv = document.createElement('div');
                                                errorDiv.className = 'stamp-error text-xs text-gray-400 italic p-2 bg-gray-700 rounded';
                                                errorDiv.textContent = 'Stamp image could not be loaded';
                                                img.parentElement.appendChild(errorDiv);
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleSignatureChange('stampImage', '')}
                                        className="mt-2 text-xs sm:text-sm text-red-400 hover:text-red-300"
                                    >
                                        Remove Stamp
                                    </button>
                                </div>
                            )}
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
                            : (isUpdateMode ? 'Update Form' : 'Submit Form')
                        }
                    </button>
                </div>
                {submitSuccess && (
                    <div className="mt-4 p-3 sm:p-4 bg-green-900/30 border border-green-600 rounded text-green-300 text-xs sm:text-sm">
                        {isUpdateMode
                            ? 'Form updated successfully.'
                            : 'Form submitted successfully.'
                        }
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
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

export default function STSStandingOrder() {
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
            formNo: 'OPS-OFD-011',
            issueDate: new Date().toISOString().split('T')[0],
            approvedBy: 'JS',
        },
        // Editable Content
        superintendentSpecificInstructions: '',
        // Signature Block
        signatureBlock: {
            masterName: '',
            vesselName: '',
            signedDate: new Date().toISOString().split('T')[0],
            signedTime: '',
            shipStampImage: '',
        },
    });

    // Handler for editable content
    const handleInstructionsChange = (value) => {
        setFormData({
            ...formData,
            superintendentSpecificInstructions: value,
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

    const handleStampUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                handleSignatureChange('shipStampImage', base64String);
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
                formNo: 'OPS-OFD-011',
                issueDate: new Date().toISOString().split('T')[0],
                approvedBy: 'JS',
            },
            // Editable Content
            superintendentSpecificInstructions: '',
            // Signature Block
            signatureBlock: {
                masterName: '',
                vesselName: '',
                signedDate: new Date().toISOString().split('T')[0],
                signedTime: '',
                shipStampImage: '',
            },
        });
    };

    // Function to reset form completely and clear URL params (for update mode after submission)
    const resetFormToCreateMode = () => {
        resetForm();
        // Clear update mode
        setIsUpdateMode(false);
        // Clear URL parameters
        router.replace('/OPS-OFD-011');
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
            const res = await fetch(`/api/sts-proxy/ops-ofd-011?operationRef=${encodedRef}`);
            
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
                    formNo: (data.documentInfo?.formNo || 'OPS-OFD-011')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-011',
                    issueDate: safeParseDate(data.documentInfo?.issueDate) || new Date().toISOString().split('T')[0],
                    approvedBy: data.documentInfo?.approvedBy || 'JS',
                },
                // Editable Content
                superintendentSpecificInstructions: data.superintendentSpecificInstructions || '',
                // Signature Block
                signatureBlock: {
                    masterName: data.signatureBlock?.masterName || '',
                    vesselName: data.signatureBlock?.vesselName || '',
                    signedDate: safeParseDate(data.signatureBlock?.signedDate) || new Date().toISOString().split('T')[0],
                    signedTime: data.signatureBlock?.signedTime || '',
                    shipStampImage: getSignatureUrl(data.signatureBlock?.shipStampImage || ''),
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
                    formNo: (formData.documentInfo.formNo || 'OPS-OFD-011')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-011',
                    issueDate: formData.documentInfo.issueDate || null,
                    approvedBy: formData.documentInfo.approvedBy || 'JS',
                },
                superintendentSpecificInstructions: formData.superintendentSpecificInstructions || '',
                signatureBlock: {
                    masterName: formData.signatureBlock.masterName || '',
                    vesselName: formData.signatureBlock.vesselName || '',
                    signedDate: formData.signatureBlock.signedDate || null,
                    signedTime: formData.signatureBlock.signedTime || '',
                    shipStampImage: extractBase64(formData.signatureBlock.shipStampImage) || '',
                },
                status: 'DRAFT',
            };

            const form = new FormData();
            form.append("data", JSON.stringify(payload));

            // Use PUT for update mode, POST for create mode
            const method = isUpdateMode ? "PUT" : "POST";
            const encodedRef = encodeURIComponent(cleanOperationRef);
            const url = isUpdateMode 
                ? `/api/sts-proxy/ops-ofd-011?operationRef=${encodedRef}`
                : "/api/sts-proxy/ops-ofd-011/create";

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
                <div className="max-w-5xl mx-auto bg-gray-800/95 rounded-lg shadow-2xl p-8 backdrop-blur-sm">
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
                            STS Superintendent Standing Order
                        </h1>
                    </div>
                    <div className="bg-gray-700 p-4 rounded min-w-[200px]">
                        <div className="text-sm space-y-1">
                            <div><strong>Form No:</strong> {formData.documentInfo.formNo}</div>
                            <div><strong>Issue Date:</strong> {formData.documentInfo.issueDate || ''}</div>
                            <div><strong>Approved by:</strong> {formData.documentInfo.approvedBy}</div>
                            <div className="text-blue-300 mt-2">
                                <strong>Operation Ref:</strong> {formData.operationRef || '—'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Introductory Text */}
                <div className="mb-8 space-y-4 text-sm leading-relaxed">
                    <p>
                        The STS transfer operation is conducted under the advisory control of the STS Superintendent. Throughout the operation each Master always remains responsible for the safety of his own ship, its crew, cargo, and equipment. He should not permit safety to be prejudiced by the actions of others.
                    </p>
                    <p>
                        The following outlines the requirements of the STS Superintendent and indicates the circumstances under which he should be informed.
                    </p>
                </div>

                {/* Environment Section */}
                <div className="mb-6">
                    <h2 className="text-lg font-bold mb-3">Environment</h2>
                    <p className="text-sm font-semibold mb-2">Inform Superintendent if:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm ml-4">
                        <li>Weather forecast indicates adverse conditions.</li>
                        <li>Wind speed is increasing unexpectedly or is consistently gusting above 20kts or as directed by the STS Superintendent.</li>
                        <li>Local weather forecasts indicate an approaching deep low-pressure system or gusting winds.</li>
                        <li>There are electrical storms in the vicinity.</li>
                        <li>Call STS Superintendent if the vessel does not appear to be holding position.</li>
                    </ul>
                </div>

                {/* Communications Section */}
                <div className="mb-6">
                    <h2 className="text-lg font-bold mb-3">Communications</h2>
                    <div className="space-y-2 text-sm">
                        <p>
                            During cargo operations, essential personnel on both ships should have a reliable and common means of communication.
                        </p>
                        <p>
                            During cargo operations, in the event of breakdown of communications on either ship the emergency signal should be sounded and all operations in progress should be suspended immediately- Operation should not be resumed until satisfactory communications have been re-established.
                        </p>
                    </div>
                </div>

                {/* Emergency Situations Section */}
                <div className="mb-6">
                    <h2 className="text-lg font-bold mb-3">Emergency Situations</h2>
                    <div className="space-y-2 text-sm mb-3">
                        <p>
                            The agreed Emergency signal to be used by either ship in the event of an emergency should be clearly understood by personnel on both ships. In the event of an emergency condition arising, both vessels should immediately implement the appropriate contingency plan.
                        </p>
                        <p className="font-semibold">Examples of emergency situations which require suspension of cargo operations, and the calling of the STS Superintendent are:</p>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-sm ml-4">
                        <li>Accidental cargo release</li>
                        <li>Gas accumulation on deck</li>
                        <li>Any leakages at the manifold</li>
                        <li>Onset of adverse weather conditions</li>
                        <li>Electrical storms</li>
                        <li>Ships emergency</li>
                        <li>Safety infringements</li>
                    </ul>
                </div>

                {/* State of readiness for an emergency Section */}
                <div className="mb-6">
                    <h2 className="text-lg font-bold mb-3">State of readiness for an emergency</h2>
                    <p className="text-sm mb-2">The following arrangements should be made on both ships:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm ml-4">
                        <li>Main engines steering gear ready for immediate use.</li>
                        <li>Crew available and systems prepared to drain and disconnect hoses at short notice.</li>
                        <li>Oil spill containment equipment prepared and ready for use.</li>
                        <li>Mooring equipment ready for immediate use and extra mooring lines ready at mooring stations as replacements in case of breakage.</li>
                        <li>Firefighting equipment ready for immediate use.</li>
                    </ul>
                </div>

                {/* Hoses Section */}
                <div className="mb-6">
                    <h2 className="text-lg font-bold mb-3">Hoses</h2>
                    <p className="text-sm font-semibold mb-2">Hoses and their securing arrangement should be inspected during cargo operations. Inform STS Superintendent if:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm ml-4">
                        <li>Hoses connections are leaking.</li>
                        <li>There is excessive movement of the hoses or hose kinking.</li>
                        <li>If there is any doubt about the positioning of the hoses.</li>
                    </ul>
                </div>

                {/* Moorings Section */}
                <div className="mb-6">
                    <h2 className="text-lg font-bold mb-3">Moorings</h2>
                    <p className="text-sm mb-2">Moorings should be inspected frequently and adjusted accordingly. Call STS Superintendent if:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm ml-4">
                        <li>Any moorings fail.</li>
                        <li>the other vessel does not appear to be tending its mooring.</li>
                        <li>Vessels are experiencing increased movement.</li>
                        <li>If there is any doubt about the condition of the moorings.</li>
                    </ul>
                </div>

                {/* Fenders Section */}
                <div className="mb-6">
                    <h2 className="text-lg font-bold mb-3">Fenders</h2>
                    <p className="text-sm mb-2">Fenders must be inspected regularly during the cargo transfer operation. The fender moorings should be tended as required. Inform STS Superintendent if the following is observed:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm ml-4">
                        <li>Damage to fenders, fender moorings or associated equipment.</li>
                        <li>There is excessive movement of fenders.</li>
                        <li>If there is any doubt about the condition or position of the fenders.</li>
                    </ul>
                </div>

                {/* Cargo Operations Section */}
                <div className="mb-6">
                    <h2 className="text-lg font-bold mb-3">Cargo Operations</h2>
                    <ul className="list-disc list-inside space-y-1 text-sm ml-4">
                        <li>Maintain hourly exchange of cargo rate and quantity transferred with another vessel. Inform the STS Superintendent if there is a significant difference in figures.</li>
                        <li>Ensure a crew member is always at the manifold.</li>
                        <li>Call STS Superintendent if there are any changes to or deviations from the cargo transfer plan.</li>
                    </ul>
                </div>

                {/* STS Superintendent Specific Instructions Section */}
                <div className="mb-8">
                    <h2 className="text-lg font-bold mb-3">STS Superintendent Specific Instructions</h2>
                    <textarea
                        value={formData.superintendentSpecificInstructions}
                        onChange={(e) => handleInstructionsChange(e.target.value)}
                        rows={6}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                        placeholder="Enter specific instructions from STS Superintendent..."
                    />
                </div>

                {/* Signature Section */}
                <div className="mb-8 border-t border-gray-700 pt-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="master-name" className="block text-sm mb-1 font-semibold">Master's Name:</label>
                            <input
                                id="master-name"
                                type="text"
                                value={formData.signatureBlock.masterName}
                                onChange={(e) => handleSignatureChange('masterName', e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label htmlFor="vessel-name" className="block text-sm mb-1 font-semibold">SS/MV:</label>
                            <input
                                id="vessel-name"
                                type="text"
                                value={formData.signatureBlock.vesselName}
                                onChange={(e) => handleSignatureChange('vesselName', e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label htmlFor="signed-date" className="block text-sm mb-1 font-semibold">Date (dd/mmm/yyyy):</label>
                            <input
                                id="signed-date"
                                type="date"
                                value={formData.signatureBlock.signedDate}
                                onChange={(e) => handleSignatureChange('signedDate', e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label htmlFor="signed-time" className="block text-sm mb-1 font-semibold">Time (HH:MM):</label>
                            <TimePicker24
                                id="signed-time"
                                value={formData.signatureBlock.signedTime}
                                onChange={(v) => handleSignatureChange('signedTime', v)}
                                className="w-full"
                            />
                        </div>
                        <div className="col-span-2">
                            <label htmlFor="ship-stamp" className="block text-sm mb-1 font-semibold">Ship's stamp:</label>
                            <input
                                id="ship-stamp"
                                type="file"
                                accept="image/*"
                                onChange={handleStampUpload}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                            />
                            {formData.signatureBlock.shipStampImage && (
                                <div className="mt-2">
                                    <img
                                        src={getSignatureUrl(formData.signatureBlock.shipStampImage)}
                                        alt="Ship stamp preview"
                                        className="max-w-full h-32 border border-gray-600 rounded bg-white p-2"
                                        onError={(e) => {
                                            console.error('Error loading image:', e);
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleSignatureChange('shipStampImage', '')}
                                        className="mt-2 text-sm text-red-400 hover:text-red-300"
                                    >
                                        Remove Stamp
                                    </button>
                                </div>
                            )}
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
                        {submitting ? 'Submitting...' : 'Submit Order'}
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


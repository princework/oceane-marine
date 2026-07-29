'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';

// Helper function to convert relative signature URLs to absolute URLs
const getSignatureUrl = (signature) => {
    if (!signature) return '';
    if (signature.startsWith('http://') || signature.startsWith('https://') || signature.startsWith('data:')) {
        return signature;
    }
    if (signature.startsWith('/uploads') || signature.startsWith('/')) {
        const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
        const baseUrl = backendBaseUrl.replace(/\/api\/operations\/sts-checklist\/?$/, '');
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

// 20 Performance criteria from the form
const PERFORMANCE_CRITERIA = [
    { srNo: 1, criteria: "Was pre-operation information adequate and satisfactory" },
    { srNo: 2, criteria: "Was always the POAC professional and courteous?" },
    { srNo: 3, criteria: "Was the PPE worn at appropriate times by POAC?" },
    { srNo: 4, criteria: "Safety awareness of POAC" },
    { srNo: 5, criteria: "Toolbox talks - before rigging of vessel with fenders" },
    { srNo: 6, criteria: "Toolbox talks - before berthing and mooring operations (Including instruction to regularly tend vessel and fender moorings)" },
    { srNo: 7, criteria: "Toolbox talks - before Hose connection" },
    { srNo: 8, criteria: "Toolbox talks – before Cargo transfer (Including hazard precautions, i.e H2S monitors)" },
    { srNo: 9, criteria: "Toolbox talks – before Unmooring operations and vessel separation" },
    { srNo: 10, criteria: "POAC's communication skills with crew" },
    { srNo: 11, criteria: "Suitable positioning of fenders" },
    { srNo: 12, criteria: "Vessel moorings checked by POAC" },
    { srNo: 13, criteria: "Condition of Mooring Equipment" },
    { srNo: 14, criteria: "Navigation warning broadcast by POAC" },
    { srNo: 15, criteria: "Condition of Mooring Equipment" },
    { srNo: 16, criteria: "Operation discussed with vessel Master" },
    { srNo: 17, criteria: "Approach and mooring plan agreed" },
    { srNo: 18, criteria: "Joining of hose string and manifold connection supervised by POAC" },
    { srNo: 19, criteria: "Regular deck rounds during transfer by POAC" },
    { srNo: 20, criteria: "Overall operational rating" },
];

const SCORE_OPTIONS = [
    { label: "Select", value: "" },
    { label: "5 - Excellent", value: "5" },
    { label: "4 - Good", value: "4" },
    { label: "3 - Average", value: "3" },
    { label: "2 - Needs Improvement", value: "2" },
    { label: "1 - Unsatisfactory", value: "1" },
];

// User-friendly error message helper
const getUserFriendlyError = (err) => {
    const errorMessage = err?.message || String(err);
    const errorLower = errorMessage.toLowerCase();

    if (errorLower.includes('fetch') || errorLower.includes('network') || errorLower.includes('connection')) {
        return 'Unable to connect to server. Please check your internet connection and try again.';
    }
    if (errorLower.includes('404') || errorLower.includes('not found')) {
        return 'Form not found. Please verify the operation reference number.';
    }
    if (errorLower.includes('500') || errorLower.includes('internal server error')) {
        return 'Server error occurred. Please try again later.';
    }
    if (errorMessage.length > 100 || errorMessage.includes('http://') || errorMessage.includes('localhost')) {
        return 'An error occurred while processing your request. Please try again.';
    }
    return errorMessage;
};

export default function MasterFeedbackForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const rawOperationRef = searchParams.get('operationRef');
    const operationRef = rawOperationRef ? rawOperationRef.replace(/,\s*$/, '').trim() : null;
    const mode = searchParams.get('mode');

    const [isUpdateMode, setIsUpdateMode] = useState(mode === 'update');
    const [loadingData, setLoadingData] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [signaturePreview, setSignaturePreview] = useState(null);
    const signatureFileRef = useRef(null);

    const [formData, setFormData] = useState({
        operationRef: operationRef || '',
        documentInfo: {
            formNo: 'OPS-OFD-020',
            revisionNo: '1.2',
            issueDate: new Date().toISOString().split('T')[0],
            approvedBy: 'JS',
            page: '1 of 2',
        },
        jobDetails: {
            vesselName: '',
            dateOfOperation: '',
            location: '',
            nameOfPOAC: '',
        },
        performanceItems: PERFORMANCE_CRITERIA.map(c => ({
            srNo: c.srNo,
            criteria: c.criteria,
            score: '',
            comments: '',
        })),
        overallFeedback: '',
        signature: {
            masterName: '',
            stampSignature: '',
            date: '',
        },
        status: 'DRAFT',
    });

    const [existingId, setExistingId] = useState(null);

    // Helper to safely parse date
    const safeParseDate = (dateValue) => {
        if (!dateValue) return '';
        try {
            const date = new Date(dateValue);
            if (Number.isNaN(date.getTime())) return '';
            return date.toISOString().split('T')[0];
        } catch { return ''; }
    };

    // Fetch existing data
    useEffect(() => {
        if (!operationRef) return;
        if (mode === 'update') {
            setIsUpdateMode(true);
            fetchExistingData(operationRef);
        }
    }, [operationRef, mode]);

    const fetchExistingData = async (refNumber) => {
        try {
            setLoadingData(true);
            setSubmitError(null);

            const trimmedRef = refNumber?.replace(/,\s*$/, '').trim();
            if (!trimmedRef) throw new Error('Operation reference is required');

            const encodedRef = encodeURIComponent(trimmedRef);
            const res = await fetch(`/api/sts-proxy/ops-ofd-020?operationRef=${encodedRef}`);

            if (res.status === 404) {
                // No existing data — that's fine for create mode
                setIsUpdateMode(false);
                return;
            }

            const responseData = await res.json();

            if (!res.ok) {
                if (res.status === 404) return;
                throw new Error(responseData?.error || 'Failed to load data');
            }

            if (responseData.success && responseData.data) {
                const d = responseData.data;
                setExistingId(d._id);
                setIsUpdateMode(true);

                const mergedItems = PERFORMANCE_CRITERIA.map(c => {
                    const saved = d.performanceItems?.find(p => p.srNo === c.srNo);
                    return {
                        srNo: c.srNo,
                        criteria: c.criteria,
                        score: saved?.score || '',
                        comments: saved?.comments || '',
                    };
                });

                setFormData({
                    operationRef: d.operationRef || operationRef,
                    documentInfo: {
                        formNo: d.documentInfo?.formNo || 'OPS-OFD-020',
                        revisionNo: d.documentInfo?.revisionNo || '1.2',
                        issueDate: safeParseDate(d.documentInfo?.issueDate) || new Date().toISOString().split('T')[0],
                        approvedBy: d.documentInfo?.approvedBy || 'JS',
                        page: '1 of 2',
                    },
                    jobDetails: {
                        vesselName: d.jobDetails?.vesselName || '',
                        dateOfOperation: safeParseDate(d.jobDetails?.dateOfOperation),
                        location: d.jobDetails?.location || '',
                        nameOfPOAC: d.jobDetails?.nameOfPOAC || '',
                    },
                    performanceItems: mergedItems,
                    overallFeedback: d.overallFeedback || '',
                    signature: {
                        masterName: d.signature?.masterName || '',
                        stampSignature: d.signature?.stampSignature || '',
                        date: safeParseDate(d.signature?.date),
                    },
                    status: d.status || 'DRAFT',
                });

                if (d.signature?.stampSignature) {
                    setSignaturePreview(getSignatureUrl(d.signature.stampSignature));
                }
            }
        } catch (err) {
            console.error('Error loading form:', err);
            setSubmitError(getUserFriendlyError(err));
        } finally {
            setLoadingData(false);
        }
    };

    // Update job details
    const updateJobDetails = (field, value) => {
        setFormData(prev => ({
            ...prev,
            jobDetails: { ...prev.jobDetails, [field]: value },
        }));
    };

    // Update performance item
    const updatePerformanceItem = (srNo, field, value) => {
        setFormData(prev => ({
            ...prev,
            performanceItems: prev.performanceItems.map(item =>
                item.srNo === srNo ? { ...item, [field]: value } : item
            ),
        }));
    };

    // Update signature
    const updateSignature = (field, value) => {
        setFormData(prev => ({
            ...prev,
            signature: { ...prev.signature, [field]: value },
        }));
    };

    // Handle signature file
    const handleSignatureFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setSignaturePreview(reader.result);
            updateSignature('stampSignature', reader.result);
        };
        reader.readAsDataURL(file);
    };

    // Clear signature
    const clearSignature = () => {
        setSignaturePreview(null);
        updateSignature('stampSignature', '');
        if (signatureFileRef.current) signatureFileRef.current.value = '';
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            operationRef: operationRef || '',
            documentInfo: {
                formNo: 'OPS-OFD-020',
                revisionNo: '1.2',
                issueDate: new Date().toISOString().split('T')[0],
                approvedBy: 'JS',
                page: '1 of 2',
            },
            jobDetails: {
                vesselName: '',
                dateOfOperation: '',
                location: '',
                nameOfPOAC: '',
            },
            performanceItems: PERFORMANCE_CRITERIA.map(c => ({
                srNo: c.srNo,
                criteria: c.criteria,
                score: '',
                comments: '',
            })),
            overallFeedback: '',
            signature: {
                masterName: '',
                stampSignature: '',
                date: '',
            },
            status: 'DRAFT',
        });
        setSignaturePreview(null);
        if (signatureFileRef.current) signatureFileRef.current.value = '';
    };

    const resetFormToCreateMode = () => {
        resetForm();
        setIsUpdateMode(false);
        setExistingId(null);
        router.replace('/OPS-OFD-020');
    };

    // Submit form
    const handleSubmit = async () => {
        try {
            setSubmitting(true);
            setSubmitError(null);
            setSubmitSuccess(false);

            const cleanOperationRef = (formData.operationRef || operationRef || '')?.replace(/,\s*$/, '').trim();
            if (!cleanOperationRef) {
                setSubmitError("Operation reference is required.");
                setSubmitting(false);
                return;
            }

            const payload = {
                operationRef: cleanOperationRef,
                documentInfo: {
                    formNo: formData.documentInfo.formNo || 'OPS-OFD-020',
                    revisionNo: formData.documentInfo.revisionNo || '1.2',
                    issueDate: formData.documentInfo.issueDate || null,
                    approvedBy: formData.documentInfo.approvedBy || 'JS',
                },
                jobDetails: {
                    vesselName: formData.jobDetails.vesselName || '',
                    dateOfOperation: formData.jobDetails.dateOfOperation || null,
                    location: formData.jobDetails.location || '',
                    nameOfPOAC: formData.jobDetails.nameOfPOAC || '',
                },
                performanceItems: formData.performanceItems.map(item => ({
                    srNo: item.srNo,
                    criteria: item.criteria || '',
                    score: item.score || '',
                    comments: item.comments || '',
                })),
                overallFeedback: formData.overallFeedback || '',
                signature: {
                    masterName: formData.signature.masterName || '',
                    stampSignature: extractBase64(formData.signature.stampSignature) || '',
                    date: formData.signature.date || null,
                },
                status: 'DRAFT',
            };

            const fd = new FormData();
            fd.append('data', JSON.stringify(payload));

            // Handle signature file
            if (signatureFileRef.current?.files?.[0]) {
                fd.append('signature', signatureFileRef.current.files[0]);
            }

            const method = isUpdateMode ? 'PUT' : 'POST';
            const encodedRef = encodeURIComponent(cleanOperationRef);
            const url = isUpdateMode
                ? `/api/sts-proxy/ops-ofd-020?operationRef=${encodedRef}`
                : '/api/sts-proxy/ops-ofd-020/create';

            const res = await fetch(url, { method, body: fd });
            const responseData = await res.json();

            if (!res.ok) {
                throw new Error(responseData?.error || `Submission failed: ${res.status}`);
            }

            setSubmitSuccess(true);

            if (responseData.data?._id) {
                setExistingId(responseData.data._id);
            }

            if (isUpdateMode) {
                setTimeout(() => resetFormToCreateMode(), 2000);
            } else {
                setTimeout(() => resetForm(), 2000);
            }
        } catch (err) {
            console.error('Submit error:', err);
            setSubmitError(getUserFriendlyError(err));
        } finally {
            setSubmitting(false);
        }
    };

    // Loading state
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
                <div className="relative z-20 min-h-screen text-white p-4 sm:p-8 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-sm sm:text-lg">Loading form data...</p>
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

                {/* Edit Mode Badge */}
                {isUpdateMode && (
                    <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-600 rounded text-yellow-300 text-sm font-semibold">
                        EDIT MODE: You are editing an existing form. Changes will update the existing record.
                    </div>
                )}

                {/* ========== HEADER SECTION ========== */}
                <div className="mb-6 sm:mb-8 border-b border-gray-700 pb-4 sm:pb-6">
                    {/* Desktop (>=768px): Logo | Title | Card in one row */}
                    <div className="hidden md:flex justify-between items-start gap-4">
                        {/* Logo */}
                        <div className="relative w-48 h-20 flex-shrink-0">
                            <Image
                                src="/image/logo.png"
                                alt="OCEANE GROUP - SHIP-TO-SHIP TRANSFER"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>

                        {/* Title */}
                        <div className="flex-1 flex flex-col items-center text-center px-2">
                            <h1 className="text-xl lg:text-2xl font-bold mb-2">
                                AT SEA SHIP TO SHIP TRANSFER
                            </h1>
                            <h2 className="text-lg lg:text-xl font-semibold">
                                Master&apos;s Feedback Form
                            </h2>
                        </div>

                        {/* Document Info Card */}
                        <div className="bg-gray-700 p-4 rounded min-w-[200px]">
                            <div className="text-sm space-y-1">
                                <div><strong>Form No:</strong> {formData.documentInfo.formNo}</div>
                                <div><strong>Rev.No.:</strong> {formData.documentInfo.revisionNo}</div>
                                <div><strong>Issue Date:</strong> {formData.documentInfo.issueDate}</div>
                                <div><strong>Approved by:</strong> {formData.documentInfo.approvedBy}</div>
                                <div><strong>Page:</strong> {formData.documentInfo.page || '1 of 2'}</div>
                                <div className="text-blue-300 mt-2">
                                    <strong>Operation Ref:</strong> {formData.operationRef || '—'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mobile (<768px): stacked vertically — Logo → Title → Card */}
                    <div className="flex flex-col items-center gap-5 md:hidden">
                        {/* 1. Logo */}
                        <div className="w-40 h-16">
                            <img
                                src="/image/logo.png"
                                alt="OCEANE GROUP - SHIP-TO-SHIP TRANSFER"
                                className="w-full h-full object-contain"
                            />
                        </div>

                        {/* 2. Title */}
                        <div className="text-center">
                            <h1 className="text-lg font-bold mb-1">
                                AT SEA SHIP TO SHIP TRANSFER
                            </h1>
                            <h2 className="text-base font-semibold">
                                Master&apos;s Feedback Form
                            </h2>
                        </div>

                        {/* 3. Document Info Card */}
                        <div className="bg-gray-700 p-3 rounded w-full">
                            <div className="text-xs space-y-1">
                                <div><strong>Form No:</strong> {formData.documentInfo.formNo}</div>
                                <div><strong>Rev.No.:</strong> {formData.documentInfo.revisionNo}</div>
                                <div><strong>Issue Date:</strong> {formData.documentInfo.issueDate}</div>
                                <div><strong>Approved by:</strong> {formData.documentInfo.approvedBy}</div>
                                <div><strong>Page:</strong> {formData.documentInfo.page || '1 of 2'}</div>
                                <div className="text-blue-300 mt-2">
                                    <strong>Operation Ref:</strong> {formData.operationRef || '—'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ========== JOB DETAILS ========== */}
                <div className="mb-6 sm:mb-8">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Job Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                            <label className="block text-sm mb-1">Vessel&apos;s Name</label>
                            <input
                                type="text"
                                value={formData.jobDetails.vesselName}
                                onChange={(e) => updateJobDetails('vesselName', e.target.value)}
                                placeholder="Enter vessel name"
                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm mb-1">Date of Operation</label>
                            <input
                                type="date"
                                value={formData.jobDetails.dateOfOperation}
                                onChange={(e) => updateJobDetails('dateOfOperation', e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm mb-1">Location</label>
                            <input
                                type="text"
                                value={formData.jobDetails.location}
                                onChange={(e) => updateJobDetails('location', e.target.value)}
                                placeholder="Enter location"
                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm mb-1">Name of POAC</label>
                            <input
                                type="text"
                                value={formData.jobDetails.nameOfPOAC}
                                onChange={(e) => updateJobDetails('nameOfPOAC', e.target.value)}
                                placeholder="Enter POAC name"
                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                    </div>
                </div>

                {/* ========== INTRO TEXT ========== */}
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-700/50 border border-gray-600 rounded">
                    <p className="text-xs sm:text-sm text-gray-300 italic">
                        We want to serve you better and are committed to continuously improving our client service standards
                        and in order to help us maintain / improve our quality of service, we would be grateful if you could
                        spare a few minutes of your time during the transfer operation, to complete this questionnaire and submit.
                    </p>
                    <p className="text-xs sm:text-sm text-gray-300 font-semibold mt-2 sm:mt-3">
                        Kindly provide rank for each criterion of performance based as per below:
                    </p>
                    <div className="flex flex-wrap gap-3 sm:gap-6 mt-2 text-xs sm:text-sm text-gray-400">
                        <span><strong className="text-green-400">5</strong> = Excellent</span>
                        <span><strong className="text-blue-400">4</strong> = Good</span>
                        <span><strong className="text-yellow-400">3</strong> = Average</span>
                        <span><strong className="text-orange-400">2</strong> = Needs Improvement</span>
                        <span><strong className="text-red-400">1</strong> = Unsatisfactory</span>
                    </div>
                </div>

                {/* ========== PERFORMANCE CRITERIA TABLE ========== */}
                <div className="mb-6 sm:mb-8">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Performance Criteria</h3>
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                        <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                            <table className="w-full border-collapse border border-gray-600 min-w-[640px]">
                                <thead>
                                    <tr className="bg-gray-700">
                                        <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm w-12 sm:w-16">Sr. No.</th>
                                        <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Criteria of performance under review</th>
                                        <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm w-32 sm:w-40">Score</th>
                                        <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm w-40 sm:w-56">Comments<br /><span className="text-[10px] sm:text-xs text-gray-400">(Particularly if performance below 3)</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.performanceItems.map((item) => (
                                        <tr key={item.srNo} className="hover:bg-gray-700">
                                            <td className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">
                                                {item.srNo}
                                            </td>
                                            <td className="border border-gray-600 p-2 sm:p-3 text-xs sm:text-sm">
                                                {item.criteria}
                                            </td>
                                            <td className="border border-gray-600 p-1.5 sm:p-2">
                                                <select
                                                    value={item.score}
                                                    onChange={(e) => updatePerformanceItem(item.srNo, 'score', e.target.value)}
                                                    className="w-full bg-gray-800 border border-gray-600 rounded px-1.5 sm:px-2 py-1 text-white text-xs sm:text-sm"
                                                >
                                                    {SCORE_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="border border-gray-600 p-1.5 sm:p-2">
                                                <input
                                                    type="text"
                                                    value={item.comments}
                                                    onChange={(e) => updatePerformanceItem(item.srNo, 'comments', e.target.value)}
                                                    placeholder="Comments..."
                                                    className="w-full bg-gray-800 border border-gray-600 rounded px-1.5 sm:px-2 py-1 text-white text-xs sm:text-sm"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ========== OVERALL FEEDBACK ========== */}
                <div className="mb-6 sm:mb-8">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Overall Feedback and Suggestion</h3>
                    <textarea
                        value={formData.overallFeedback}
                        onChange={(e) => setFormData(prev => ({ ...prev, overallFeedback: e.target.value }))}
                        placeholder="Enter overall feedback and suggestions..."
                        rows={5}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-xs sm:text-sm resize-none"
                    />
                </div>

                {/* ========== SIGNATURE SECTION ========== */}
                <div className="mb-6 sm:mb-8">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Master&apos;s Signature</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                            <label className="block text-sm mb-1">Master Name</label>
                            <input
                                type="text"
                                value={formData.signature.masterName}
                                onChange={(e) => updateSignature('masterName', e.target.value)}
                                placeholder="Enter master name"
                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm mb-1">Date</label>
                            <input
                                type="date"
                                value={formData.signature.date}
                                onChange={(e) => updateSignature('date', e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                    </div>

                    <div className="mt-4">
                        <label className="block text-sm mb-1">Stamp & Signature</label>
                        <div className="flex items-center gap-4">
                            <input
                                ref={signatureFileRef}
                                type="file"
                                accept="image/*"
                                onChange={handleSignatureFile}
                                className="block text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                            />
                            {signaturePreview && (
                                <button
                                    type="button"
                                    onClick={clearSignature}
                                    className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        {signaturePreview && (
                            <div className="mt-3 p-2 sm:p-3 border border-gray-600 rounded bg-gray-700 inline-block max-w-full">
                                <Image
                                    src={signaturePreview}
                                    alt="Signature Preview"
                                    width={200}
                                    height={80}
                                    className="rounded max-w-full h-auto"
                                    unoptimized
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* ========== STATUS MESSAGES ========== */}
                {submitError && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded text-red-300 text-sm">
                        {submitError}
                    </div>
                )}

                {submitSuccess && (
                    <div className="mb-4 p-3 bg-green-900/30 border border-green-600 rounded text-green-300 text-sm">
                        {isUpdateMode ? 'Form updated successfully!' : 'Form created successfully!'}
                    </div>
                )}

                {/* ========== SUBMIT BUTTON ========== */}
                <div className="mt-4 pt-4 border-t border-gray-700">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={`w-full md:w-auto md:ml-auto md:block px-6 md:px-8 py-3 rounded font-semibold text-sm transition
                            ${submitting
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        {submitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                Saving…
                            </span>
                        ) : isUpdateMode ? 'Update Form' : 'Submit Form'}
                    </button>
                </div>
                </div>
            </div>
        </div>
    );
}

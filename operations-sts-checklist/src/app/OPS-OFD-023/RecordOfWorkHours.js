'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';

// Hour labels for the 24 columns
const HOUR_LABELS = [
    "01:00", "02:00", "03:00", "04:00", "05:00", "06:00",
    "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
    "19:00", "20:00", "21:00", "22:00", "23:00", "23:59"
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

// Helper to generate default work entries for 31 days
const generateDefaultWorkEntries = () => {
    return Array.from({ length: 31 }, (_, i) => ({
        day: i + 1,
        hourSlots: Array(24).fill(false),
        hoursOfRest: 24, // All slots are rest by default
        comments: '',
    }));
};

// Calculate hours of rest (count of false slots = rest hours)
const calculateHoursOfRest = (hourSlots) => {
    return hourSlots.filter(slot => !slot).length;
};

export default function RecordOfWorkHours() {
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
    const [isDragging, setIsDragging] = useState(false);
    const [dragValue, setDragValue] = useState(null);

    const [formData, setFormData] = useState({
        operationRef: operationRef || '',
        documentInfo: {
            formNo: 'OPS-OFD-023',
            revisionNo: '1.0',
            issueDate: new Date().toISOString().split('T')[0],
            approvedBy: 'JS',
            page: '1 of 1',
        },
        headerDetails: {
            stsOperation: '',
            date: '',
            mooringMaster: '',
            remark: '',
        },
        workEntries: generateDefaultWorkEntries(),
        notes: [],
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
            const res = await fetch(`/api/sts-proxy/ops-ofd-023?operationRef=${encodedRef}`, {
                cache: 'no-store',
                headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' },
            });

            if (res.status === 404) {
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

                // Merge saved work entries with default
                const defaultEntries = generateDefaultWorkEntries();
                const mergedEntries = defaultEntries.map(defaultEntry => {
                    const saved = d.workEntries?.find(e => e.day === defaultEntry.day);
                    if (saved) {
                        const slots = saved.hourSlots || Array(24).fill(false);
                        return {
                            day: saved.day,
                            hourSlots: slots,
                            hoursOfRest: calculateHoursOfRest(slots),
                            comments: saved.comments || '',
                        };
                    }
                    return {
                        ...defaultEntry,
                        hoursOfRest: calculateHoursOfRest(defaultEntry.hourSlots),
                    };
                });

                // Parse notes — handle both array and legacy object formats
                let parsedNotes = [];
                if (Array.isArray(d.notes)) {
                    parsedNotes = d.notes;
                } else if (d.notes && typeof d.notes === 'object') {
                    // Legacy { note1: "...", note2: "..." } format
                    parsedNotes = Object.values(d.notes).filter(v => typeof v === 'string' && v.trim() !== '');
                }

                setFormData({
                    operationRef: d.operationRef || operationRef,
                    documentInfo: {
                        formNo: d.documentInfo?.formNo || 'OPS-OFD-023',
                        revisionNo: d.documentInfo?.revisionNo || '1.0',
                        issueDate: safeParseDate(d.documentInfo?.issueDate) || new Date().toISOString().split('T')[0],
                        approvedBy: d.documentInfo?.approvedBy || 'JS',
                        page: '1 of 1',
                    },
                    headerDetails: {
                        stsOperation: d.headerDetails?.stsOperation || '',
                        date: safeParseDate(d.headerDetails?.date),
                        mooringMaster: d.headerDetails?.mooringMaster || '',
                        remark: d.headerDetails?.remark || '',
                    },
                    workEntries: mergedEntries,
                    notes: parsedNotes,
                    status: d.status || 'DRAFT',
                });
            }
        } catch (err) {
            console.error('Error loading form:', err);
            setSubmitError(getUserFriendlyError(err));
        } finally {
            setLoadingData(false);
        }
    };

    // Update header details
    const updateHeaderDetails = (field, value) => {
        setFormData(prev => ({
            ...prev,
            headerDetails: { ...prev.headerDetails, [field]: value },
        }));
    };

    // Toggle a single hour slot
    const toggleHourSlot = useCallback((day, hourIndex) => {
        setFormData(prev => {
            const newEntries = prev.workEntries.map(entry => {
                if (entry.day !== day) return entry;
                const newSlots = [...entry.hourSlots];
                const newValue = dragValue !== null ? dragValue : !newSlots[hourIndex];
                newSlots[hourIndex] = newValue;
                return {
                    ...entry,
                    hourSlots: newSlots,
                    hoursOfRest: calculateHoursOfRest(newSlots),
                };
            });
            return { ...prev, workEntries: newEntries };
        });
    }, [dragValue]);

    // Mouse drag support for painting work hours
    const handleMouseDown = (day, hourIndex) => {
        const entry = formData.workEntries.find(e => e.day === day);
        const currentValue = entry?.hourSlots?.[hourIndex] ?? false;
        setDragValue(!currentValue);
        setIsDragging(true);
        toggleHourSlotDirect(day, hourIndex, !currentValue);
    };

    const handleMouseEnter = (day, hourIndex) => {
        if (isDragging && dragValue !== null) {
            toggleHourSlotDirect(day, hourIndex, dragValue);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragValue(null);
    };

    // Direct toggle (used by drag)
    const toggleHourSlotDirect = (day, hourIndex, value) => {
        setFormData(prev => {
            const newEntries = prev.workEntries.map(entry => {
                if (entry.day !== day) return entry;
                const newSlots = [...entry.hourSlots];
                newSlots[hourIndex] = value;
                return {
                    ...entry,
                    hourSlots: newSlots,
                    hoursOfRest: calculateHoursOfRest(newSlots),
                };
            });
            return { ...prev, workEntries: newEntries };
        });
    };

    // Update comments for a day
    const updateDayComments = (day, value) => {
        setFormData(prev => ({
            ...prev,
            workEntries: prev.workEntries.map(entry =>
                entry.day === day ? { ...entry, comments: value } : entry
            ),
        }));
    };

    // Update a note by index
    const updateNote = (index, value) => {
        setFormData(prev => {
            const newNotes = [...prev.notes];
            newNotes[index] = value;
            return { ...prev, notes: newNotes };
        });
    };

    // Add a new note
    const addNote = () => {
        setFormData(prev => ({
            ...prev,
            notes: [...prev.notes, ''],
        }));
    };

    // Remove a note by index
    const removeNote = (index) => {
        setFormData(prev => ({
            ...prev,
            notes: prev.notes.filter((_, i) => i !== index),
        }));
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            operationRef: operationRef || '',
            documentInfo: {
                formNo: 'OPS-OFD-023',
                revisionNo: '1.0',
                issueDate: new Date().toISOString().split('T')[0],
                approvedBy: 'JS',
                page: '1 of 1',
            },
            headerDetails: {
                stsOperation: '',
                date: '',
                mooringMaster: '',
                remark: '',
            },
            workEntries: generateDefaultWorkEntries(),
            notes: [],
            status: 'DRAFT',
        });
    };

    const resetFormToCreateMode = () => {
        resetForm();
        setIsUpdateMode(false);
        setExistingId(null);
        router.replace('/OPS-OFD-023');
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
                    formNo: formData.documentInfo.formNo || 'OPS-OFD-023',
                    revisionNo: formData.documentInfo.revisionNo || '1.0',
                    issueDate: formData.documentInfo.issueDate || null,
                    approvedBy: formData.documentInfo.approvedBy || 'JS',
                },
                headerDetails: {
                    stsOperation: formData.headerDetails.stsOperation || '',
                    date: formData.headerDetails.date || null,
                    mooringMaster: formData.headerDetails.mooringMaster || '',
                    remark: formData.headerDetails.remark || '',
                },
                workEntries: formData.workEntries.map(entry => ({
                    day: entry.day,
                    hourSlots: entry.hourSlots,
                    hoursOfRest: entry.hoursOfRest,
                    comments: entry.comments || '',
                })),
                notes: formData.notes.filter(n => n.trim() !== ''),
                status: 'DRAFT',
            };

            console.log('[OPS-OFD-023 SUBMIT] Payload:', {
                operationRef: payload.operationRef,
                headerDetails: payload.headerDetails,
                notes: payload.notes,
                notesCount: payload.notes.length,
                workEntriesCount: payload.workEntries.length,
                isUpdateMode,
            });

            const fd = new FormData();
            fd.append('data', JSON.stringify(payload));

            const method = isUpdateMode ? 'PUT' : 'POST';
            const encodedRef = encodeURIComponent(cleanOperationRef);
            const url = isUpdateMode
                ? `/api/sts-proxy/ops-ofd-023?operationRef=${encodedRef}`
                : '/api/sts-proxy/ops-ofd-023/create';

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
                <div className="relative z-20 min-h-screen text-white p-8 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-lg">Loading form data...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen relative"
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
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
            <div className="relative z-20 min-h-screen text-white p-4">
            <div className="max-w-[1600px] mx-auto bg-gray-800 rounded-lg shadow-2xl p-6">

                {/* Edit Mode Badge */}
                {isUpdateMode && (
                    <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-600 rounded text-yellow-300 text-sm font-semibold">
                        EDIT MODE: You are editing an existing form. Changes will update the existing record.
                    </div>
                )}

                {/* ========== HEADER SECTION (like OPS-OFD-005) ========== */}
                <div className="flex justify-between items-start mb-6 border-b border-gray-700 pb-6">
                    {/* Logo */}
                    <div className="relative w-48 h-20">
                        <Image
                            src="/image/logo.png"
                            alt="OCEANE GROUP - SHIP-TO-SHIP TRANSFER"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>

                    {/* Title */}
                    <div className="flex-1 flex flex-col items-center text-center">
                        <h1 className="text-2xl font-bold mb-2">
                            AT SEA SHIP TO SHIP TRANSFER
                        </h1>
                        <h2 className="text-xl font-semibold">
                            Record of Work Hours
                        </h2>
                    </div>

                    {/* Document Info Card */}
                    <div className="bg-gray-700 p-4 rounded min-w-[200px]">
                        <div className="text-sm space-y-1">
                            <div><strong>Form No:</strong> {formData.documentInfo.formNo}</div>
                            <div><strong>Rev.No.:</strong> {formData.documentInfo.revisionNo}</div>
                            <div><strong>Issue Date:</strong> {formData.documentInfo.issueDate}</div>
                            <div><strong>Approved by:</strong> {formData.documentInfo.approvedBy}</div>
                            <div><strong>Page:</strong> {formData.documentInfo.page || '1 of 1'}</div>
                            <div className="text-blue-300 mt-2">
                                <strong>Operation Ref:</strong> {formData.operationRef || '—'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ========== HEADER DETAILS (STS, Date, Moor. Master, Remark) ========== */}
                <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-4">Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm mb-1">STS Operation</label>
                            <input
                                type="text"
                                value={formData.headerDetails.stsOperation}
                                onChange={(e) => updateHeaderDetails('stsOperation', e.target.value)}
                                placeholder="Enter STS operation"
                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm mb-1">Date</label>
                            <input
                                type="date"
                                value={formData.headerDetails.date}
                                onChange={(e) => updateHeaderDetails('date', e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm mb-1">Mooring Master</label>
                            <input
                                type="text"
                                value={formData.headerDetails.mooringMaster}
                                onChange={(e) => updateHeaderDetails('mooringMaster', e.target.value)}
                                placeholder="Enter mooring master name"
                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm mb-1">Remark</label>
                            <input
                                type="text"
                                value={formData.headerDetails.remark}
                                onChange={(e) => updateHeaderDetails('remark', e.target.value)}
                                placeholder="Enter remark"
                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                    </div>
                </div>

                {/* ========== INSTRUCTION ========== */}
                <div className="mb-4 p-3 bg-gray-700/50 border border-gray-600 rounded">
                    <p className="text-sm text-gray-300 font-semibold">
                        PLEASE MARK PERIOD OF WORK ONLY BY CONTINUOUS LINE. REST PERIOD TO BE LEFT BLANK
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        Selected cells = work. Empty cells = rest hours
                    </p>
                </div>

                {/* ========== WORK HOURS GRID ========== */}
                <div className="mb-6 overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-600 text-xs select-none">
                        <thead>
                            {/* Row 1: HOURS header + time labels */}
                            <tr>
                                <th className="border border-gray-600 p-1 bg-gray-700 text-center w-12 sticky left-0 z-10">
                                    HOURS
                                </th>
                                {HOUR_LABELS.map((label) => (
                                    <th
                                        key={label}
                                        className="border border-gray-600 p-1 bg-gray-900 text-center text-white min-w-[36px]"
                                    >
                                        {label}
                                    </th>
                                ))}
                                <th className="border border-gray-600 p-1 bg-gray-700 text-center w-20">
                                    HOURS OF REST
                                </th>
                                <th className="border border-gray-600 p-1 bg-gray-700 text-center min-w-[120px]">
                                    COMMENTS
                                </th>
                            </tr>
                            {/* Row 2: DATE + sub-header */}
                            <tr>
                                <th className="border border-gray-600 p-1 bg-gray-700 text-center sticky left-0 z-10">
                                    DATE
                                </th>
                                {HOUR_LABELS.map((label) => (
                                    <th
                                        key={`sub-${label}`}
                                        className="border border-gray-600 p-1 bg-gray-900"
                                    >
                                    </th>
                                ))}
                                <th className="border border-gray-600 p-1 bg-gray-700 text-center text-red-400 text-[10px]">
                                    IN 24 HOURS
                                </th>
                                <th className="border border-gray-600 p-1 bg-gray-700">
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {formData.workEntries.map((entry) => (
                                <tr key={entry.day} className="hover:bg-gray-750">
                                    {/* Day number */}
                                    <td className="border border-gray-600 p-1 text-center font-bold bg-gray-700 sticky left-0 z-10">
                                        {String(entry.day).padStart(2, '0')}
                                    </td>

                                    {/* 24 hour slot cells */}
                                    {entry.hourSlots.map((isWorking, hourIdx) => (
                                        <td
                                            key={hourIdx}
                                            className={`border border-gray-600 p-0 text-center cursor-pointer transition-colors duration-75 ${isWorking
                                                    ? 'bg-blue-600 hover:bg-blue-500'
                                                    : 'bg-gray-800 hover:bg-gray-600'
                                                }`}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleMouseDown(entry.day, hourIdx);
                                            }}
                                            onMouseEnter={() => handleMouseEnter(entry.day, hourIdx)}
                                            title={`Day ${entry.day} - ${HOUR_LABELS[hourIdx]} : ${isWorking ? 'WORK' : 'REST'}`}
                                        >
                                            <div className="w-full h-6">
                                                {isWorking && (
                                                    <div className="w-full h-full bg-blue-500"></div>
                                                )}
                                            </div>
                                        </td>
                                    ))}

                                    {/* Hours of rest (auto-calculated) */}
                                    <td className="border border-gray-600 p-1 text-center font-semibold bg-gray-700">
                                        {entry.hoursOfRest}
                                    </td>

                                    {/* Comments */}
                                    <td className="border border-gray-600 p-0">
                                        <input
                                            type="text"
                                            value={entry.comments}
                                            onChange={(e) => updateDayComments(entry.day, e.target.value)}
                                            placeholder=""
                                            className="w-full bg-transparent border-0 px-1 py-0.5 text-white text-xs focus:outline-none focus:bg-gray-700"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ========== NOTES SECTION ========== */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">NOTES</h3>
                        <button
                            type="button"
                            onClick={addNote}
                            className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
                        >
                            <span className="text-lg leading-none">+</span> Add More Note
                        </button>
                    </div>
                    {formData.notes.length === 0 && (
                        <p className="text-gray-400 text-sm italic">No notes added yet. Click &quot;Add More Note&quot; to add one.</p>
                    )}
                    <div className="space-y-3">
                        {formData.notes.map((note, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <span className="font-bold text-sm w-8">{String(idx + 1).padStart(2, '0')}</span>
                                <input
                                    type="text"
                                    value={note}
                                    onChange={(e) => updateNote(idx, e.target.value)}
                                    placeholder={`Note ${String(idx + 1).padStart(2, '0')}...`}
                                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeNote(idx)}
                                    className="px-3 py-2 rounded bg-red-600/20 text-red-400 text-sm font-medium hover:bg-red-600/40 transition"
                                    title="Remove note"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
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
                <div className="flex justify-end gap-4 mt-4">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={`px-8 py-3 rounded font-semibold text-sm transition
                            ${submitting
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        {submitting ? (
                            <span className="flex items-center gap-2">
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

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams, usePathname } from "next/navigation";
import { useOperationsLoading } from "@/app/operations/OperationsLoadingContext";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import {
  getSidebarTabs,
  isFormsSubmoduleSidebarActive,
} from "@/app/operations/sts-operations/new/sidebarTabs";
import {
  resolveQhseSignatureImageSrc,
  isResolvableSignatureImage,
} from "@/lib/utils/qhse-signature-url";

const FORM_TITLES = {
  'ops-ofd-001': 'OPS-OFD-001 - Before Operation Commence',
  'ops-ofd-001a': 'OPS-OFD-001A - Ship Standard Questionnaire',
  'ops-ofd-002': 'OPS-OFD-002 - Before Run In & Mooring',
  'ops-ofd-003': 'OPS-OFD-003 - Before Cargo Transfer (3A & 3B)',
  'ops-ofd-004': 'OPS-OFD-004 - Pre-Transfer Agreements (4A-4F)',
  'ops-ofd-005': 'OPS-OFD-005 - During Transfer (5A-5C)',
  'ops-ofd-005b': 'OPS-OFD-005B - Before Disconnection & Unmooring',
  'ops-ofd-005c': 'OPS-OFD-005C - Terminal Transfer Checklist',
  'declaration-of-sea': 'OPS-OFD-005E - Declaration Of STS At Sea',
  'ops-ofd-005e': 'OPS-OFD-005E - Declaration Of STS At Sea',
  'ops-ofd-005d': 'OPS-OFD-005D - Declaration for STS operations (At port & Terminal)',
  'ops-ofd-028': 'OPS-OFD-028 - Personnel Transfer Basket Checklist',
  'ops-ofd-009': 'OPS-OFD-009 - Mooring Master\'s Job Report',
  'ops-ofd-011': 'OPS-OFD-011 - STS Standing Order',
  'ops-ofd-014': 'OPS-OFD-014 - Equipment Checklist',
  'ops-ofd-015': 'OPS-OFD-015 - Hourly Quantity Log',
  'ops-ofd-018': 'OPS-OFD-018 - STS Timesheet',
  'ops-ofd-020': 'OPS-OFD-020 - Master\'s Feedback Form',
  'ops-ofd-023': 'OPS-OFD-023 - Record of Work Hours (Rest Hours CKL)',
  'ops-ofd-029': 'OPS-OFD-029 - Mooring Master Expense Sheet',
};

const API_BASE_URL = '/api/operations/sts-checklist';

const SKIP_FIELDS = ['_id', '__v', 'createdAt', 'updatedAt', 'createdBy'];
const SKIP_HEADER_FIELDS = ['formNo', 'revisionNo', 'revisionDate', 'issueDate', 'approvedBy', 'page', 'status', 'sequenceNumber', 'operationRef'];
const SIGNATURE_KEYS = ['signature', 'signatureImage', 'signatureBlock', 'constantHeadingShip', 'manoeuvringShip'];

const STATUS_COLORS = {
  DRAFT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  SUBMITTED: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  APPROVED: 'bg-green-500/20 text-green-300 border-green-500/40',
  SIGNED: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  ARCHIVED: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
  FINALIZED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
};

/** Stored signature paths (public/signature/…, uploads/…, data URLs, http(s)). */
function isImageValue(value) {
  return isResolvableSignatureImage(value);
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return String(dateString);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateString);
  }
}

function formatDateOnly(dateString) {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return String(dateString);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(dateString);
  }
}

function labelFromKey(key) {
  const label = key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
  if (key === 'signatureBlock') return 'Signature';
  if (key === 'constantHeadingShip') return 'Constant Heading Ship or Berthed Ship';
  if (key === 'manoeuvringShip') return 'Manoeuvring Ship or Outer Ship';
  return label;
}

export default function ViewFormPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const { formPath, id } = params;

  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const [activeTab, setActiveTab] = useState("forms");
  const [expandedModules, setExpandedModules] = useState(new Set(["forms"]));
  const sidebarRef = useRef(null);

  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { setPageLoading } = useOperationsLoading();
  const { isOpsAdmin, canEditForm, canApprove } = useOperationsRole();
  const sidebarTabs = getSidebarTabs(isOpsAdmin);

  useEffect(() => {
    fetchFormData();
  }, [formPath, id]);

  const fetchFormData = async () => {
    try {
      setLoading(true);
      setError(null);
      setPageLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/${formPath}/list`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch form data');
      }

      const result = await response.json();

      if (result.success) {
        const form = result.data.find((f) => String(f._id) === String(id));
        if (form) {
          setFormData(form);
        } else {
          throw new Error('Form not found');
        }
      } else {
        throw new Error(result.error || 'Failed to fetch form data');
      }
    } catch (err) {
      console.error('Error fetching form data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  const renderSignatureImage = (src, alt = 'Signature') => {
    const resolved = resolveQhseSignatureImageSrc(src);
    if (!resolved) return <span className="text-gray-400">N/A</span>;
    return (
      <div className="mt-1">
        <img
          src={resolved}
          alt={alt}
          className="max-w-full max-h-24 border border-gray-600 rounded object-contain bg-white"
          decoding="async"
        />
      </div>
    );
  };

  const isChecklistArray = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return false;
    const first = arr[0];
    return typeof first === 'object' && first !== null && ('description' in first || 'clNumber' in first);
  };

  const renderFormData = (data, depth = 0, parentKey = '') => {
    if (data === null || data === undefined) return <span className="text-gray-400">N/A</span>;

    if (typeof data === 'string') {
      if (isImageValue(data)) return renderSignatureImage(data, 'Signature');
      return <span className="text-white/90">{data}</span>;
    }
    if (typeof data === 'number' || typeof data === 'boolean') {
      return <span className="text-white/90">{String(data)}</span>;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) return <span className="text-gray-400">Empty</span>;
      if (isChecklistArray(data)) {
        const hasCl = data.some((r) => 'clNumber' in r);
        const hasStatus = data.some((r) => 'status' in r);
        const hasRemarks = data.some((r) => r.remarks != null && r.remarks !== '');
        return (
          <div className="overflow-x-auto my-2">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  {hasCl && <th className="border border-gray-600 p-2 text-center w-14">CL</th>}
                  <th className="border border-gray-600 p-2 text-left">Description</th>
                  {hasStatus && <th className="border border-gray-600 p-2 text-center w-24">Status</th>}
                  {hasRemarks && <th className="border border-gray-600 p-2 text-left">Remarks</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-700/50">
                    {hasCl && (
                      <td className="border border-gray-600 p-2 text-center font-semibold">
                        {row.clNumber ?? row.id ?? idx + 1}
                      </td>
                    )}
                    <td className="border border-gray-600 p-2 text-white/90">{row.description ?? '—'}</td>
                    {hasStatus && (
                      <td className="border border-gray-600 p-2 text-center">
                        {row.status ?? '—'}
                      </td>
                    )}
                    {hasRemarks && (
                      <td className="border border-gray-600 p-2 text-white/80">{row.remarks ?? row.userRemark ?? '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      return (
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="ml-4 border-l-2 border-gray-600 pl-4">
              {renderFormData(item, depth + 1, parentKey)}
            </div>
          ))}
        </div>
      );
    }

    if (typeof data === 'object') {
      const isTopLevel = depth === 0;
      const skipSet = new Set([...SKIP_FIELDS, ...(isTopLevel ? SKIP_HEADER_FIELDS : [])]);
      const entries = Object.entries(data).filter(([key]) => !skipSet.has(key));
      if (entries.length === 0) return <span className="text-gray-400">Empty</span>;

      return (
        <div className="space-y-4">
          {entries.map(([key, value]) => {
            const label = labelFromKey(key);
            if (key === 'signatureBlock' && value && typeof value === 'object') {
              const sigSrc =
                value.signature ??
                value.signatureImage ??
                value.mooringMasterSignature;
              const stampSrc = value.stampImage ?? value.shipStampImage;
              const hasSignature =
                value.signature || value.signatureImage || value.mooringMasterSignature;
              const hasStamp = value.stampImage || value.shipStampImage;
              return (
                <div key={key} className="border-b border-gray-600 pb-4">
                  <div className="font-semibold text-gray-300 mb-2">{label}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {value.name != null && (
                      <div><span className="text-gray-400">Name:</span> <span className="text-white/90">{value.name}</span></div>
                    )}
                    {value.masterName != null && (
                      <div><span className="text-gray-400">Master Name:</span> <span className="text-white/90">{value.masterName}</span></div>
                    )}
                    {value.vesselName != null && (
                      <div><span className="text-gray-400">Vessel Name:</span> <span className="text-white/90">{value.vesselName}</span></div>
                    )}
                    {value.rank != null && (
                      <div><span className="text-gray-400">Rank:</span> <span className="text-white/90">{value.rank}</span></div>
                    )}
                    {value.date != null && (
                      <div><span className="text-gray-400">Date:</span> <span className="text-white/90">{formatDateOnly(value.date)}</span></div>
                    )}
                    {value.signedDate != null && (
                      <div><span className="text-gray-400">Signed Date:</span> <span className="text-white/90">{formatDateOnly(value.signedDate)}</span></div>
                    )}
                    {value.signedTime != null && (
                      <div><span className="text-gray-400">Signed Time:</span> <span className="text-white/90">{value.signedTime}</span></div>
                    )}
                    {(hasSignature || hasStamp) && (
                      <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {hasSignature && (
                          <div>
                            <span className="text-gray-400 block mb-1">Signature:</span>
                            {renderSignatureImage(sigSrc, 'Signature')}
                          </div>
                        )}
                        {hasStamp && (
                          <div>
                            <span className="text-gray-400 block mb-1">Stamp:</span>
                            {renderSignatureImage(stampSrc, 'Stamp')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            if ((key === 'constantHeadingShip' || key === 'manoeuvringShip') && value && typeof value === 'object') {
              return (
                <div key={key} className="bg-gray-700/50 p-4 rounded border border-gray-600">
                  <h4 className="font-semibold text-gray-300 mb-3 border-b border-gray-600 pb-2">{label}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {value.name != null && <div><span className="text-gray-400">Name:</span> <span className="text-white/90">{value.name}</span></div>}
                    {value.rank != null && <div><span className="text-gray-400">Rank:</span> <span className="text-white/90">{value.rank}</span></div>}
                    {value.date != null && <div><span className="text-gray-400">Date:</span> <span className="text-white/90">{formatDateOnly(value.date)}</span></div>}
                    {value.time != null && <div><span className="text-gray-400">Time:</span> <span className="text-white/90">{value.time}</span></div>}
                    {value.signature && (
                      <div className="col-span-2">
                        <span className="text-gray-400 block mb-1">Signature:</span>
                        {renderSignatureImage(value.signature)}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            if (typeof value === 'string' && isImageValue(value)) {
              return (
                <div key={key} className="border-b border-gray-600 pb-3">
                  <div className="font-semibold text-gray-300 mb-1">{label}</div>
                  {renderSignatureImage(value)}
                </div>
              );
            }
            return (
              <div key={key} className="border-b border-gray-600 pb-3">
                <div className="font-semibold text-gray-300 mb-1 text-sm">{label}</div>
                <div className="ml-0">{renderFormData(value, depth + 1, key)}</div>
              </div>
            );
          })}
        </div>
      );
    }

    return <span className="text-gray-400">—</span>;
  };

  const getFormHeaderMeta = () => {
    if (!formData) return {};
    const d = formData;
    return {
      formNo: d.formNo ?? d.documentInfo?.formNo ?? '—',
      revisionNo: d.revisionNo ?? d.documentInfo?.revisionNo ?? '—',
      issueDate: d.issueDate ?? d.revisionDate ?? d.documentInfo?.issueDate ?? null,
      approvedBy: d.approvedBy ?? d.documentInfo?.approvedBy ?? '—',
    };
  };

  // OPS-OFD-014 Equipment Checklist: external-form layout (Job Info grid + 3 tables + Remarks + Signature)
  const renderOPSOFD014ViewBody = () => {
    const job = formData?.jobInfo || {};
    const fender = formData?.fenderEquipment || [];
    const hose = formData?.hoseEquipment || [];
    const other = formData?.otherEquipment || [];
    const remarks = formData?.remarks ?? '';
    const signature = formData?.signatureBlock?.mooringMasterSignature;
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Job Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div><div className="text-sm text-gray-400 mb-1">Date</div><div className="text-white/90">{formatDateOnly(job.date)}</div></div>
            <div><div className="text-sm text-gray-400 mb-1">Time</div><div className="text-white/90">{job.time || '—'}</div></div>
            <div><div className="text-sm text-gray-400 mb-1">Mooring Master</div><div className="text-white/90">{job.mooringMasterName || '—'}</div></div>
            <div><div className="text-sm text-gray-400 mb-1">Location</div><div className="text-white/90">{job.location || '—'}</div></div>
          </div>
          <div className="mt-3 flex gap-4">
            <span className="text-sm text-gray-400">Operation Phase:</span>
            <span className="text-white/90">{job.operationPhase === 'AFTER_OPERATION' ? 'After Operation' : 'Before Operation'}</span>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Fender Equipment Checklist</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-3 text-center bg-gray-600">Fender ID #</th>
                  <th className="border border-gray-600 p-3 text-center">End Plates</th>
                  <th className="border border-gray-600 p-3 text-center">B. Shackle</th>
                  <th className="border border-gray-600 p-3 text-center">Swivel</th>
                  <th className="border border-gray-600 p-3 text-center">2nd Shackle</th>
                  <th className="border border-gray-600 p-3 text-center">Mooring Shackle</th>
                  <th className="border border-gray-600 p-3 text-center">Fender Body</th>
                  <th className="border border-gray-600 p-3 text-center">Tires</th>
                  <th className="border border-gray-600 p-3 text-center">Pressure</th>
                </tr>
              </thead>
              <tbody>
                {fender.length === 0 ? (
                  <tr><td colSpan={9} className="border border-gray-600 p-3 text-center text-gray-400">No rows</td></tr>
                ) : fender.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-700/50">
                    <td className="border border-gray-600 p-2 bg-gray-700 text-white/90">{row.fenderId ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.endPlates ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.bShackle ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.swivel ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.secondShackle ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.mooringShackle ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.fenderBody ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.tires ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.pressure ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Hose Equipment Checklist</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-3 text-center bg-gray-600">Hose ID #</th>
                  <th className="border border-gray-600 p-3 text-center">End Flanges</th>
                  <th className="border border-gray-600 p-3 text-center">Body Condition</th>
                  <th className="border border-gray-600 p-3 text-center">Nuts/Bolts</th>
                  <th className="border border-gray-600 p-3 text-center">Markings</th>
                </tr>
              </thead>
              <tbody>
                {hose.length === 0 ? (
                  <tr><td colSpan={5} className="border border-gray-600 p-3 text-center text-gray-400">No rows</td></tr>
                ) : hose.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-700/50">
                    <td className="border border-gray-600 p-2 bg-gray-700 text-white/90">{row.hoseId ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.endFlanges ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.bodyCondition ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.nutsBolts ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.markings ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Other Equipment Checklist</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-3 text-center bg-gray-600">Other Equipment ID #</th>
                  <th className="border border-gray-600 p-3 text-center">Gaskets</th>
                  <th className="border border-gray-600 p-3 text-center">Ropes</th>
                  <th className="border border-gray-600 p-3 text-center">Wires</th>
                  <th className="border border-gray-600 p-3 text-center">Billy Pugh</th>
                  <th className="border border-gray-600 p-3 text-center">Lifting Strops</th>
                </tr>
              </thead>
              <tbody>
                {other.length === 0 ? (
                  <tr><td colSpan={6} className="border border-gray-600 p-3 text-center text-gray-400">No rows</td></tr>
                ) : other.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-700/50">
                    <td className="border border-gray-600 p-2 bg-gray-700 text-white/90">{row.equipmentId ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.gaskets ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.ropes ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.wires ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.billyPugh ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.liftingStrops ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-600 pt-6">
          <div>
            <div className="text-sm font-semibold text-gray-300 mb-2">Signature of Mooring Master</div>
            {signature ? renderSignatureImage(signature, 'Signature of Mooring Master') : <span className="text-gray-400">—</span>}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-300 mb-2">Remarks</div>
            <div className="text-white/90 whitespace-pre-wrap min-h-[6rem]">{remarks || '—'}</div>
          </div>
        </div>
      </div>
    );
  };

  // OPS-OFD-018 Timesheet: external-form layout (Basic Info, Operation Timings, Additional Activity, Weather/Cargo, Final Remarks)
  const renderOPSOFD018ViewBody = () => {
    const basic = formData?.basicInfo || {};
    const opTimings = formData?.operationTimings || [];
    const additional = formData?.additionalActivities || [];
    const weather = formData?.weatherDelay || {};
    const cargo = formData?.cargoInfo || {};
    const finalRemarks = formData?.finalRemarks ?? '';
    
    // Format date properly - handle both Date objects and ISO strings
    const toDateStr = (v) => {
      if (!v) return '—';
      try {
        // If it's already a formatted string (not ISO), return as-is
        if (typeof v === 'string' && !v.includes('T') && !v.includes('Z')) {
          return v;
        }
        // Otherwise, format it as a date
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return String(v);
        return d.toLocaleDateString('en-GB', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        });
      } catch {
        return String(v);
      }
    };
    
    // Format time - extract from date if time field is empty but date has time
    const toTimeStr = (timeValue, dateValue) => {
      // If time value exists, use it
      if (timeValue != null && timeValue !== '') {
        return String(timeValue);
      }
      // Otherwise, try to extract time from date
      if (dateValue) {
        try {
          const d = new Date(dateValue);
          if (!Number.isNaN(d.getTime())) {
            return d.toLocaleTimeString('en-GB', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false
            });
          }
        } catch {
          // Ignore errors
        }
      }
      return '—';
    };
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Basic Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div><div className="text-sm text-gray-400 mb-1">STS Superintendent</div><div className="text-white/90">{basic.stsSuperintendent || '—'}</div></div>
            <div><div className="text-sm text-gray-400 mb-1">Job No.</div><div className="text-white/90">{basic.jobNumber || '—'}</div></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><div className="text-sm text-gray-400 mb-1">Receiving Vessel</div><div className="text-white/90">{basic.receivingVessel || '—'}</div></div>
            <div><div className="text-sm text-gray-400 mb-1">Discharging Vessel</div><div className="text-white/90">{basic.dischargingVessel || '—'}</div></div>
            <div><div className="text-sm text-gray-400 mb-1">Support Craft (Mob/Demob)</div><div className="text-white/90">{basic.supportCraftMobDemob || '—'}</div></div>
            <div><div className="text-sm text-gray-400 mb-1">Location</div><div className="text-white/90">{basic.location || '—'}</div></div>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">STS Operation Timings</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700"><th className="border border-gray-600 p-3 text-left">Activities</th><th colSpan={2} className="border border-gray-600 p-3 text-center">From</th><th colSpan={2} className="border border-gray-600 p-3 text-center">To</th><th className="border border-gray-600 p-3 text-left">Remarks</th></tr>
                <tr className="bg-gray-700"><th className="border border-gray-600 p-2"></th><th className="border border-gray-600 p-2 text-center">Date</th><th className="border border-gray-600 p-2 text-center">Time</th><th className="border border-gray-600 p-2 text-center">Date</th><th className="border border-gray-600 p-2 text-center">Time</th><th className="border border-gray-600 p-2"></th></tr>
              </thead>
              <tbody>
                {opTimings.length === 0 ? <tr><td colSpan={6} className="border border-gray-600 p-3 text-center text-gray-400">No rows</td></tr> : opTimings.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-700/50">
                    <td className="border border-gray-600 p-2 text-white/90 font-medium">{row.activityName ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90 text-center">{toDateStr(row.fromDate)}</td>
                    <td className="border border-gray-600 p-2 text-white/90 text-center">{toTimeStr(row.fromTime, row.fromDate)}</td>
                    <td className="border border-gray-600 p-2 text-white/90 text-center">{toDateStr(row.toDate)}</td>
                    <td className="border border-gray-600 p-2 text-white/90 text-center">{toTimeStr(row.toTime, row.toDate)}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.remarks ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Additional Activity</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700"><th className="border border-gray-600 p-3 text-left">Activities</th><th colSpan={2} className="border border-gray-600 p-3 text-center">From</th><th colSpan={2} className="border border-gray-600 p-3 text-center">To</th><th className="border border-gray-600 p-3 text-left">Remarks</th></tr>
                <tr className="bg-gray-700"><th className="border border-gray-600 p-2"></th><th className="border border-gray-600 p-2 text-center">Date</th><th className="border border-gray-600 p-2 text-center">Time</th><th className="border border-gray-600 p-2 text-center">Date</th><th className="border border-gray-600 p-2 text-center">Time</th><th className="border border-gray-600 p-2"></th></tr>
              </thead>
              <tbody>
                {additional.length === 0 ? <tr><td colSpan={6} className="border border-gray-600 p-3 text-center text-gray-400">No rows</td></tr> : additional.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-700/50">
                    <td className="border border-gray-600 p-2 text-white/90">{row.activityName ?? '—'}</td>
                    <td className="border border-gray-600 p-2 text-white/90 text-center">{toDateStr(row.fromDate)}</td>
                    <td className="border border-gray-600 p-2 text-white/90 text-center">{toTimeStr(row.fromTime, row.fromDate)}</td>
                    <td className="border border-gray-600 p-2 text-white/90 text-center">{toDateStr(row.toDate)}</td>
                    <td className="border border-gray-600 p-2 text-white/90 text-center">{toTimeStr(row.toTime, row.toDate)}</td>
                    <td className="border border-gray-600 p-2 text-white/90">{row.remarks ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Significant Weather Which Caused Delay</h2>
            <div className="space-y-3">
              <div><div className="text-sm text-gray-400 mb-1">Sea</div><div className="text-white/90">{weather.sea ?? '—'}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Swell</div><div className="text-white/90">{weather.swell ?? '—'}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Wind</div><div className="text-white/90">{weather.wind ?? '—'}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Total Exposure Hours</div><div className="text-white/90">{weather.totalExposureHours ?? '—'}</div></div>
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Cargo</h2>
            <div className="space-y-3">
              <div><div className="text-sm text-gray-400 mb-1">Cargo</div><div className="text-white/90">{cargo.cargoName ?? '—'}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Quantity</div><div className="text-white/90">{cargo.cargoQuantity ?? '—'}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Cargo Pumping Time</div><div className="text-white/90">{cargo.cargoPumpingTime ?? '—'}</div></div>
            </div>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Equipment / Operational / Incident / Delays etc, Remarks</h2>
          <div className="text-white/90 whitespace-pre-wrap min-h-[4rem]">{finalRemarks || '—'}</div>
        </div>
      </div>
    );
  };

  const formatDateDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // OPS-OFD-005B Before Disconnection & Unmooring: external-form layout
  const renderOPSOFD005BViewBody = () => {
    const transferInfo = formData?.transferInfo || {};
    const checklist6A = formData?.checklist6A?.checks || [];
    const pipelineConditions = formData?.checklist6A?.pipelineConditions || {};
    const checklist6B = formData?.checklist6B || [];
    const responsiblePersons = formData?.responsiblePersons || {};
    
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Basic Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div><div className="text-sm text-gray-400 mb-1">Constant Heading Ship</div><div className="text-white/90">{transferInfo.constantHeadingShip || '—'}</div></div>
            <div><div className="text-sm text-gray-400 mb-1">Maneuvering Ship</div><div className="text-white/90">{transferInfo.manoeuvringShip || '—'}</div></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div><div className="text-sm text-gray-400 mb-1">Name of Designated POAC</div><div className="text-white/90">{transferInfo.designatedPOACName || '—'}</div></div>
            <div><div className="text-sm text-gray-400 mb-1">Name of STS Superintendent if Different from POAC</div><div className="text-white/90">{transferInfo.stsSuperintendentName || '—'}</div></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><div className="text-sm text-gray-400 mb-1">Date of Transfer</div><div className="text-white/90">{transferInfo.transferDate ? formatDateOnly(transferInfo.transferDate) : '—'}</div></div>
            <div><div className="text-sm text-gray-400 mb-1">Location of Transfer</div><div className="text-white/90">{transferInfo.transferLocation || '—'}</div></div>
          </div>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">CL:6A—CHECKS AFTER TRANSFER BEFORE DISCONNECTION</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-3 text-left">Activities</th>
                  <th className="border border-gray-600 p-3 text-center">Status</th>
                  <th className="border border-gray-600 p-3 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {checklist6A.length === 0 ? (
                  <tr><td colSpan={3} className="border border-gray-600 p-3 text-center text-gray-400">No rows</td></tr>
                ) : checklist6A.map((item, idx) => {
                  const statusYes = item.status?.yes ? "☑" : "☐";
                  const statusNotApplicable = item.status?.notApplicable ? "☑" : "☐";
                  let remarksText = item.remarks || "";
                  
                  // Special handling for item 2 - pipeline conditions
                  if (idx === 1 && item.clNumber === 2) {
                    const pipelineText = [];
                    if (pipelineConditions.purged) pipelineText.push("Purged");
                    if (pipelineConditions.inerted) pipelineText.push("Inerted");
                    if (pipelineConditions.depressurized) pipelineText.push("Depressurized");
                    if (pipelineText.length > 0) {
                      remarksText = pipelineText.join(". ");
                    }
                  }
                  
                  return (
                    <tr key={idx} className="hover:bg-gray-700/50">
                      <td className="border border-gray-600 p-2 text-white/90 font-medium">{item.description ?? '—'}</td>
                      <td className="border border-gray-600 p-2 text-white/90 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span>{statusYes} Yes</span>
                          {statusNotApplicable && <span>{statusNotApplicable} Not applicable</span>}
                        </div>
                      </td>
                      <td className="border border-gray-600 p-2 text-white/90">{remarksText || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">CL:6B—CHECKS AFTER DISCONNECTION BEFORE UNMOORING</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-3 text-left">Activities</th>
                  <th className="border border-gray-600 p-3 text-center">Status</th>
                  <th className="border border-gray-600 p-3 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {checklist6B.length === 0 ? (
                  <tr><td colSpan={3} className="border border-gray-600 p-3 text-center text-gray-400">No rows</td></tr>
                ) : checklist6B.map((item, idx) => {
                  const statusYes = item.status?.yes ? "☑" : "☐";
                  const statusNotApplicable = item.status?.notApplicable ? "☑" : "☐";
                  
                  return (
                    <tr key={idx} className="hover:bg-gray-700/50">
                      <td className="border border-gray-600 p-2 text-white/90 font-medium">{item.description ?? '—'}</td>
                      <td className="border border-gray-600 p-2 text-white/90 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span>{statusYes} Yes</span>
                          {statusNotApplicable && <span>{statusNotApplicable} Not applicable</span>}
                        </div>
                      </td>
                      <td className="border border-gray-600 p-2 text-white/90">{item.remarks || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Responsible Persons</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><div className="text-sm text-gray-400 mb-1">Officer in charge of CHS:</div><div className="text-white/90">Name: {responsiblePersons.chsOfficerName || '—'}</div></div>
            <div><div className="text-sm text-gray-400 mb-1">Officer in charge of MS:</div><div className="text-white/90">Name: {responsiblePersons.msOfficerName || '—'}</div></div>
            <div><div className="text-sm text-gray-400 mb-1">Terminal:</div><div className="text-white/90">Name: {responsiblePersons.terminalName || '—'}</div></div>
            <div><div className="text-sm text-gray-400 mb-1">STS Supdt:</div><div className="text-white/90">Name: {responsiblePersons.stsSuperintendentName || '—'}</div></div>
          </div>
        </div>
      </div>
    );
  };


  if (error && !formData) {
    return (
      <div className="min-h-screen bg-transparent text-white flex">
        <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
          <div className={`mx-auto py-6 sm:py-10 ${isSidebarOpen ? "max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4" : "px-3 sm:px-6"}`}>
            <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
              Error: {error}
            </div>
            <Link
              href={`/operations/sts-operations/new/form-checklist/sts-checklist/${formPath}/list`}
              className="mt-4 inline-block px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
            >
              Back to List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="min-h-screen bg-transparent text-white flex">
        <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
          <div className={`mx-auto py-6 sm:py-10 ${isSidebarOpen ? "max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4" : "px-3 sm:px-6"}`}>
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
              <p className="text-white/60">Form not found</p>
              <Link
                href={`/operations/sts-operations/new/form-checklist/sts-checklist/${formPath}/list`}
                className="mt-4 inline-block px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
              >
                Back to List
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white flex">
      {/* Left Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-full w-[260px] sm:w-[300px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-white/20 shadow-2xl backdrop-blur-md z-50 transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-orange-500/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/30">
                <span className="text-white text-xl">⚡</span>
              </div>
              <h2 className="text-lg font-bold text-white">Operations Modules</h2>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition hover:scale-110"
              aria-label="Close sidebar"
            >
              <span className="text-white text-lg">×</span>
            </button>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto p-4 [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgba(255,255,255,0.2)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent transition-all duration-200">
            <div className="space-y-1.5">
              {sidebarTabs.map((tab) => (
                <div key={tab.key} className="space-y-1">
                  {tab.submodules ? (
                    <>
                      <button
                        onClick={() => {
                          setExpandedModules((prev) => {
                            const newSet = new Set(prev);
                            if (newSet.has(tab.key)) {
                              newSet.delete(tab.key);
                            } else {
                              newSet.add(tab.key);
                            }
                            return newSet;
                          });
                        }}
                        className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                          activeTab === tab.key
                            ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/40 scale-[1.02]"
                            : "text-white/90 hover:bg-white/10 hover:text-white border border-white/5 hover:border-white/10 hover:scale-[1.01]"
                        }`}
                      >
                        <span className="flex-1">{tab.label}</span>
                        <span
                          className={`text-sm transition-transform ${
                            expandedModules.has(tab.key) ? "rotate-90" : ""
                          }`}
                        >
                          ▶
                        </span>
                        {activeTab === tab.key && (
                          <div className="h-2 w-2 rounded-full bg-white animate-pulse"></div>
                        )}
                      </button>
                      {expandedModules.has(tab.key) && (
                        <div className="ml-4 space-y-1 mt-1.5 pl-4 border-l-2 border-orange-500/30">
                          {tab.submodules.map((submodule) => {
                            const isActiveSub = isFormsSubmoduleSidebarActive(
                              pathname,
                              submodule.href
                            );
                            return (
                              <Link
                                key={submodule.key}
                                href={submodule.href}
                                className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border ${
                                  isActiveSub
                                    ? "bg-gradient-to-r from-orange-500/90 to-orange-600/90 text-white border-orange-400 shadow-lg"
                                    : "text-white/80 hover:bg-white/10 hover:text-white border-white/5 hover:border-white/10"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="text-xs">▸</span>
                                  {submodule.label}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={tab.href}
                      className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                        activeTab === tab.key
                          ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/40 scale-[1.02]"
                          : "text-white/90 hover:bg-white/10 hover:text-white border border-white/5 hover:border-white/10 hover:scale-[1.01]"
                      }`}
                    >
                      <span className="flex-1">{tab.label}</span>
                      {activeTab === tab.key && (
                        <div className="h-2 w-2 rounded-full bg-white animate-pulse"></div>
                      )}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-slate-800/50">
            <p className="text-[10px] text-slate-400 text-center">
              Operations Management System
            </p>
          </div>
        </div>
      </div>

      {/* Sidebar Toggle Button */}
      {!isSidebarOpen && (
        <div className="fixed left-4 top-4 z-40 flex items-center gap-2">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 transition border border-orange-400/30 shadow-lg shadow-orange-500/30 hover:scale-110"
            aria-label="Open sidebar"
          >
            <span className="text-white text-xl">☰</span>
          </button>
          <Link
            href="/dashboard"
            className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← Dashboard
          </Link>
        </div>
      )}

      {/* Main Content - Form-style layout like external STS forms */}
      <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
        <div className={`mx-auto py-4 sm:py-6 lg:py-10 space-y-4 sm:space-y-6 ${isSidebarOpen ? "max-w-[95%] pl-2 pr-2 sm:pl-4 sm:pr-4" : "px-3 sm:px-6"}`}>
          <header className={`${isSidebarOpen ? "mt-0" : "mt-8"} mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4`}>
            {/* Left: Dashboard */}
            <Link
              href="/dashboard"
              className="shrink-0 hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
            >
              ← Dashboard
            </Link>

            {/* Center: Heading */}
            <div className="flex-1 flex flex-col items-center text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-sky-300">
                Operations / Forms & Checklist / STS Checklist
              </p>
            </div>
            
            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 w-full sm:w-auto justify-end sm:justify-start">
              <Link
                href={`/operations/sts-operations/new/form-checklist/sts-checklist/${formPath}/list`}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition duration-200 hover:translate-y-[1px]"
              >
                ← Back to List
              </Link>
            </div>
          </header>

          {/* Form card - same style as external Operations-STS-CheckList forms */}
          <div className="max-w-7xl mx-auto bg-gray-800 rounded-lg shadow-2xl p-4 sm:p-6 lg:p-8 text-white">
            {/* Header row: logo area, title, form meta (Form No, Issue Date, Approved by) */}
            <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-6 sm:mb-8 border-b border-gray-700 pb-4 sm:pb-6">
              <div className="w-full lg:w-48 flex items-center justify-start">
                <span className="text-gray-500 text-xs sm:text-sm font-semibold">OCEANE</span>
              </div>
              <div className="flex-1 flex flex-col items-center text-center px-2 sm:px-4">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold mb-2">AT SEA SHIP TO SHIP TRANSFER</h1>
                <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-200">
                  {FORM_TITLES[formPath] || formPath}
                </h2>
                <p className="text-xs text-gray-400 mt-2">View only</p>
              </div>
              <div className="bg-gray-700 p-3 sm:p-4 rounded w-full lg:min-w-[200px] text-xs sm:text-sm space-y-1">
                <div><strong>Form No:</strong> {getFormHeaderMeta().formNo}</div>
                <div><strong>Rev No:</strong> {getFormHeaderMeta().revisionNo}</div>
                <div><strong>Issue Date:</strong> {getFormHeaderMeta().issueDate ? formatDateOnly(getFormHeaderMeta().issueDate) : 'N/A'}</div>
                <div><strong>Approved by:</strong> {getFormHeaderMeta().approvedBy}</div>
              </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-3 mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-gray-700/50 border border-gray-600/50">
              <span className="text-sm font-medium text-gray-400">Status:</span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[formData?.status] || STATUS_COLORS.DRAFT}`}>
                {formData?.status || 'DRAFT'}
              </span>
            </div>

            {/* Form body: OPS-OFD-014 / OPS-OFD-018 / OPS-OFD-005B use external-form layout; others use generic render */}
            <div className="space-y-6">
              {formPath === "ops-ofd-014" ? renderOPSOFD014ViewBody() : formPath === "ops-ofd-018" ? renderOPSOFD018ViewBody() : formPath === "ops-ofd-005b" ? renderOPSOFD005BViewBody() : renderFormData(formData)}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-700">
              <Link
                href={`/operations/sts-operations/new/form-checklist/sts-checklist/${formPath}/list`}
                className="px-4 sm:px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition text-sm font-medium text-center"
              >
                Back to List
              </Link>
              {canApprove && formData?.status !== 'APPROVED' && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Are you sure you want to approve this form?')) return;
                    try {
                      const res = await fetch(`${API_BASE_URL}/${formPath}/${id}/update`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'APPROVED' }),
                      });
                      if (res.ok) {
                        setFormData((prev) => ({ ...prev, status: 'APPROVED' }));
                      } else {
                        const data = await res.json();
                        alert(data.error || 'Failed to approve');
                      }
                    } catch (err) {
                      alert('Failed to approve: ' + err.message);
                    }
                  }}
                  className="px-4 sm:px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition text-sm font-medium text-white text-center"
                >
                  Approve
                </button>
              )}
              {canEditForm && (
                <Link
                  href={`/operations/sts-operations/new/form-checklist/sts-checklist/${formPath}/edit/${id}`}
                  className="px-4 sm:px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg transition text-sm font-medium text-white text-center"
                >
                  Edit Form
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

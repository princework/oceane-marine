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
import OperationsSelectField from "@/app/operations/components/OperationsSelectField";
// OPS-OFD-014 Equipment Checklist row defaults (external-form layout)
const OPS014_FENDER_ROW = { fenderId: "", endPlates: "", bShackle: "", swivel: "", secondShackle: "", mooringShackle: "", fenderBody: "", tires: "", pressure: "" };
const OPS014_HOSE_ROW = { hoseId: "", endFlanges: "", bodyCondition: "", nutsBolts: "", markings: "" };
const OPS014_OTHER_ROW = { equipmentId: "", gaskets: "", ropes: "", wires: "", billyPugh: "", liftingStrops: "" };

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

const STATUS_OPTIONS = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SIGNED', 'ARCHIVED', 'FINALIZED'];
const STATUS_COLORS = {
  DRAFT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  SUBMITTED: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  APPROVED: 'bg-green-500/20 text-green-300 border-green-500/40',
  SIGNED: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  ARCHIVED: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
  FINALIZED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
};

function isImageValue(value) {
  return isResolvableSignatureImage(value);
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

function isChecklistArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  const first = arr[0];
  return typeof first === 'object' && first !== null && ('description' in first || 'clNumber' in first);
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

export default function EditFormPage() {
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
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

  const handleInputChange = (path, value) => {
    setFormData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let current = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!isNaN(key) && Array.isArray(current)) {
          const index = parseInt(key, 10);
          if (!current[index]) {
            current[index] = {};
          }
          current = current[index];
        } else {
          if (!current[key]) {
            current[key] = {};
          }
          current = current[key];
        }
      }
      
      const lastKey = keys[keys.length - 1];
      if (!isNaN(lastKey) && Array.isArray(current)) {
        const index = parseInt(lastKey, 10);
        current[index] = value;
      } else {
        current[lastKey] = value;
      }
      
      return newData;
    });
  };

  const handleSubmit = async (e, overrideStatus) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const formDataToSend = new FormData();
      
      const cleanData = JSON.parse(JSON.stringify(formData));
      delete cleanData._id;
      delete cleanData.__v;
      delete cleanData.createdAt;
      delete cleanData.updatedAt;
      delete cleanData.createdBy;

      if (overrideStatus) {
        cleanData.status = overrideStatus;
      }

      formDataToSend.append('data', JSON.stringify(cleanData));

      const response = await fetch(
        `${API_BASE_URL}/${formPath}/${id}/update`,
        {
          method: 'POST',
          body: formDataToSend,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update form');
      }

      const result = await response.json();
      setSuccess(true);
      
      if (overrideStatus) {
        setFormData((prev) => ({ ...prev, status: overrideStatus }));
      }

      setTimeout(() => {
        router.push(`/operations/sts-operations/new/form-checklist/sts-checklist/${formPath}/view/${id}`);
      }, 1500);
    } catch (err) {
      console.error('Error updating form:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // OPS-OFD-014 Equipment Checklist: add/remove row handlers (external-form layout)
  const handleAddFenderRow = () => {
    setFormData((prev) => ({
      ...prev,
      fenderEquipment: [...(prev.fenderEquipment || []), { ...OPS014_FENDER_ROW }],
    }));
  };
  const handleRemoveFenderRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      fenderEquipment: (prev.fenderEquipment || []).filter((_, i) => i !== index),
    }));
  };
  const handleAddHoseRow = () => {
    setFormData((prev) => ({
      ...prev,
      hoseEquipment: [...(prev.hoseEquipment || []), { ...OPS014_HOSE_ROW }],
    }));
  };
  const handleRemoveHoseRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      hoseEquipment: (prev.hoseEquipment || []).filter((_, i) => i !== index),
    }));
  };
  const handleAddOtherEquipmentRow = () => {
    setFormData((prev) => ({
      ...prev,
      otherEquipment: [...(prev.otherEquipment || []), { ...OPS014_OTHER_ROW }],
    }));
  };
  const handleRemoveOtherEquipmentRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      otherEquipment: (prev.otherEquipment || []).filter((_, i) => i !== index),
    }));
  };

  // OPS-OFD-018 Timesheet: add/remove additional activity row
  const OPS018_ADDITIONAL_ROW = { activityName: "", fromDate: "", fromTime: "", toDate: "", toTime: "", remarks: "" };
  const handleAddAdditionalActivityRow = () => {
    setFormData((prev) => ({
      ...prev,
      additionalActivities: [...(prev.additionalActivities || []), { ...OPS018_ADDITIONAL_ROW }],
    }));
  };
  const handleRemoveAdditionalActivityRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      additionalActivities: (prev.additionalActivities || []).filter((_, i) => i !== index),
    }));
  };

  const renderEditableField = (label, path, value, type = 'text') => {
    const displayPath = path.split('.').pop();
    const displayLabel = label || displayPath.replace(/([A-Z])/g, ' $1').trim();

    if (type === 'date') {
      const dateValue = value ? new Date(value).toISOString().split('T')[0] : '';
      return (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            {displayLabel}
          </label>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => handleInputChange(path, e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm sm:text-base"
          />
        </div>
      );
    }

    if (type === 'textarea') {
      return (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            {displayLabel}
          </label>
          <textarea
            value={value || ''}
            onChange={(e) => handleInputChange(path, e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm sm:text-base"
            rows={4}
          />
        </div>
      );
    }

    if (type === 'select') {
      return (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            {displayLabel}
          </label>
          <OperationsSelectField
            ariaLabel={displayLabel}
            value={value || ""}
            onChange={(v) => handleInputChange(path, v)}
            options={[
              { value: "", label: "Select..." },
              ...[
                "DRAFT",
                "SUBMITTED",
                "APPROVED",
                "SIGNED",
                "ARCHIVED",
                "FINALIZED",
                "PENDING",
                "PAID",
              ].map((status) => ({ value: status, label: status })),
            ]}
            triggerClassName="flex min-h-[2.5rem] w-full items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-2 pr-9 text-left text-sm text-white sm:text-base"
            className="w-full"
          />
        </div>
      );
    }

    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">
          {displayLabel}
        </label>
        <input
          type={type}
          value={value || ''}
          onChange={(e) => handleInputChange(path, e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
        />
      </div>
    );
  };

  const renderEditableChecklistTable = (path, data) => {
    if (!Array.isArray(data) || data.length === 0) return null;
    const hasCl = data.some((r) => typeof r === 'object' && r !== null && ('clNumber' in r || 'id' in r));
    const hasStatus = data.some((r) => typeof r === 'object' && r !== null && 'status' in r);
    const hasRemarks = data.some((r) => typeof r === 'object' && r !== null && ('remarks' in r || 'userRemark' in r));
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
                  <td className="border border-gray-600 p-1">
                    <input
                      type="text"
                      value={row.clNumber ?? row.id ?? ''}
                      onChange={(e) => {
                        const base = path + '.' + idx;
                        handleInputChange(base + '.clNumber', e.target.value);
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-center text-sm"
                    />
                  </td>
                )}
                <td className="border border-gray-600 p-1">
                  <input
                    type="text"
                    value={row.description ?? ''}
                    onChange={(e) => handleInputChange(path + '.' + idx + '.description', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs sm:text-sm"
                  />
                </td>
                {hasStatus && (
                  <td className="border border-gray-600 p-1">
                    <input
                      type="text"
                      value={row.status ?? ''}
                      onChange={(e) => handleInputChange(path + '.' + idx + '.status', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-center text-sm"
                    />
                  </td>
                )}
                {hasRemarks && (
                  <td className="border border-gray-600 p-1">
                    <input
                      type="text"
                      value={row.remarks ?? row.userRemark ?? ''}
                      onChange={(e) => {
                        handleInputChange(path + '.' + idx + '.remarks', e.target.value);
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs sm:text-sm"
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderEditableSignatureBlock = (path, value) => {
    if (!value || typeof value !== 'object') return null;
    return (
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <label className="text-gray-400 block mb-1">Name</label>
          <input
            type="text"
            value={value.name ?? ''}
            onChange={(e) => handleInputChange(path + '.name', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm sm:text-base"
          />
        </div>
        <div>
          <label className="text-gray-400 block mb-1">Rank</label>
          <input
            type="text"
            value={value.rank ?? ''}
            onChange={(e) => handleInputChange(path + '.rank', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm sm:text-base"
          />
        </div>
        <div>
          <label className="text-gray-400 block mb-1">Date</label>
          <input
            type="date"
            value={value.date ? new Date(value.date).toISOString().split('T')[0] : ''}
            onChange={(e) => handleInputChange(path + '.date', e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm sm:text-base"
          />
        </div>
        <div>
          <label className="text-gray-400 block mb-1">Time</label>
          <input
            type="text"
            value={value.time ?? ''}
            onChange={(e) => handleInputChange(path + '.time', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm sm:text-base"
          />
        </div>
      </div>
    );
  };

  const renderEditableObject = (obj, prefix = '', isTopLevel = false, parentLabel = '') => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

    const skipSet = new Set([...SKIP_FIELDS, ...(isTopLevel ? SKIP_HEADER_FIELDS : [])]);
    const visibleKeys = Object.keys(obj).filter((k) => !skipSet.has(k));
    const useParentLabelForSingleKey = parentLabel && visibleKeys.length === 1;

    return Object.entries(obj).map(([key, value]) => {
      if (skipSet.has(key)) return null;

      const path = prefix ? `${prefix}.${key}` : key;
      const label = useParentLabelForSingleKey ? parentLabel : labelFromKey(key);
      const sectionClass = 'border-b border-gray-600 pb-3';
      const labelClass = 'font-semibold text-gray-300 mb-1 text-sm';
      const sectionLabel = parentLabel ? parentLabel : label;

      if (key === 'signatureBlock' && value && typeof value === 'object') {
        return (
          <div key={key} className={sectionClass}>
            <div className={labelClass}>{label}</div>
            <div className="mt-2">{renderEditableSignatureBlock(path, value)}</div>
          </div>
        );
      }
      if ((key === 'constantHeadingShip' || key === 'manoeuvringShip') && value && typeof value === 'object') {
        return (
          <div key={key} className="bg-gray-700/50 p-4 rounded border border-gray-600">
            <h4 className={`${labelClass} border-b border-gray-600 pb-2`}>{label}</h4>
            <div className="mt-3">{renderEditableSignatureBlock(path, value)}</div>
          </div>
        );
      }

      if (value === null || value === undefined) {
        return (
          <div key={key} className={sectionClass}>
            {renderEditableField(label, path, '', 'text')}
          </div>
        );
      }

      if (typeof value === 'string') {
        const isSignature = key === 'signature' || key === 'signatureImage' || key === 'mooringMasterSignature';
        if (isSignature) {
          return (
            <div key={key} className={sectionClass}>
              <div className={labelClass}>{label}</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => handleInputChange(path, reader.result);
                    reader.readAsDataURL(file);
                  }
                }}
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-600 file:text-white hover:file:bg-orange-700 cursor-pointer"
              />
              {value && isImageValue(value) && (
                <div className="mt-2">
                  <img src={resolveQhseSignatureImageSrc(value) || value} alt="Signature" className="max-w-full max-h-24 border border-gray-600 rounded object-contain bg-white" decoding="async" />
                  <button type="button" onClick={() => handleInputChange(path, '')} className="mt-2 text-sm text-red-400 hover:text-red-300">Remove</button>
                </div>
              )}
            </div>
          );
        }
        const isDate = value.match(/^\d{4}-\d{2}-\d{2}/);
        const isLong = value.length > 100;
        return (
          <div key={key} className={sectionClass}>
            {renderEditableField(label, path, value, isDate ? 'date' : isLong ? 'textarea' : 'text')}
          </div>
        );
      }

      if (typeof value === 'number') {
        return (
          <div key={key} className={sectionClass}>
            {renderEditableField(label, path, value, 'number')}
          </div>
        );
      }

      if (typeof value === 'boolean') {
        return (
          <div key={key} className={sectionClass}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => handleInputChange(path, e.target.checked)}
                className="w-4 h-4"
              />
              <span className={`text-sm ${labelClass}`}>{label}</span>
            </label>
          </div>
        );
      }

      if (Array.isArray(value)) {
        if (isChecklistArray(value)) {
          return (
            <div key={key} className={sectionClass}>
              <div className={labelClass}>{label}</div>
              {renderEditableChecklistTable(path, value)}
            </div>
          );
        }
        const arraySectionTitle = sectionLabel + ' (' + value.length + ' items)';
        const itemLabel = (idx) => sectionLabel + ' ' + (idx + 1);
        return (
          <div key={key} className={sectionClass}>
            <div className={labelClass}>{arraySectionTitle}</div>
            <div className="space-y-2 mt-2">
              {value.map((item, index) => (
                <div key={index} className="ml-4 border-l-2 border-gray-600 pl-4">
                  {typeof item === 'object' && item !== null && !Array.isArray(item) ? (
                    <>
                      <div className="text-xs text-gray-400 mb-2 font-semibold">{sectionLabel} {index + 1}</div>
                      {renderEditableObject(item, `${path}.${index}`, false, itemLabel(index))}
                    </>
                  ) : typeof item === 'object' && Array.isArray(item) ? (
                    <div className="text-gray-400 text-sm">Nested arrays not editable</div>
                  ) : (
                    renderEditableField(itemLabel(index), `${path}.${index}`, item, 'text')
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      }

      if (typeof value === 'object') {
        return (
          <div key={key} className={sectionClass}>
            <div className={labelClass}>{label}</div>
            <div className="ml-0 mt-2">{renderEditableObject(value, path, false, label)}</div>
          </div>
        );
      }

      return null;
    }).filter(Boolean);
  };

  // OPS-OFD-014 Equipment Checklist: edit body matching external form (Job Info + 3 tables + add/remove row + Remarks + Signature)
  const renderOPSOFD014EditBody = () => {
    const job = formData?.jobInfo || {};
    const fender = formData?.fenderEquipment || [];
    const hose = formData?.hoseEquipment || [];
    const other = formData?.otherEquipment || [];
    const remarks = formData?.remarks ?? '';
    const signature = formData?.signatureBlock?.mooringMasterSignature;
    const inputClass = 'w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm';
    const inputClassId = 'w-full bg-gray-700 border border-gray-500 rounded px-2 py-1 text-white text-sm';
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Job Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date</label>
              <input type="date" value={job.date ? new Date(job.date).toISOString().split('T')[0] : ''} onChange={(e) => handleInputChange('jobInfo.date', e.target.value ? new Date(e.target.value).toISOString() : '')} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Time</label>
              <input type="text" value={job.time ?? ''} onChange={(e) => handleInputChange('jobInfo.time', e.target.value)} className={inputClass} placeholder="HH:MM" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Mooring Master</label>
              <input type="text" value={job.mooringMasterName ?? ''} onChange={(e) => handleInputChange('jobInfo.mooringMasterName', e.target.value)} className={inputClass} placeholder="Name" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Location</label>
              <input type="text" value={job.location ?? ''} onChange={(e) => handleInputChange('jobInfo.location', e.target.value)} className={inputClass} placeholder="Location" />
            </div>
          </div>
          <div className="mt-3 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <span className="text-sm text-gray-400">Operation Phase</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="operationPhase" value="BEFORE_OPERATION" checked={(job.operationPhase || 'BEFORE_OPERATION') === 'BEFORE_OPERATION'} onChange={(e) => handleInputChange('jobInfo.operationPhase', e.target.value)} className="w-4 h-4" />
              <span className="text-sm">Before Operation</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="operationPhase" value="AFTER_OPERATION" checked={job.operationPhase === 'AFTER_OPERATION'} onChange={(e) => handleInputChange('jobInfo.operationPhase', e.target.value)} className="w-4 h-4" />
              <span className="text-sm">After Operation</span>
            </label>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Fender Equipment Checklist</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm bg-gray-600">Fender ID #</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">End Plates</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">B. Shackle</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Swivel</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">2nd Shackle</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Mooring Shackle</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Fender Body</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Tires</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Pressure</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm w-20">Action</th>
                </tr>
              </thead>
              <tbody>
                {fender.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-700/50">
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.fenderId ?? ''} onChange={(e) => handleInputChange(`fenderEquipment.${index}.fenderId`, e.target.value)} className={inputClassId} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.endPlates ?? ''} onChange={(e) => handleInputChange(`fenderEquipment.${index}.endPlates`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.bShackle ?? ''} onChange={(e) => handleInputChange(`fenderEquipment.${index}.bShackle`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.swivel ?? ''} onChange={(e) => handleInputChange(`fenderEquipment.${index}.swivel`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.secondShackle ?? ''} onChange={(e) => handleInputChange(`fenderEquipment.${index}.secondShackle`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.mooringShackle ?? ''} onChange={(e) => handleInputChange(`fenderEquipment.${index}.mooringShackle`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.fenderBody ?? ''} onChange={(e) => handleInputChange(`fenderEquipment.${index}.fenderBody`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.tires ?? ''} onChange={(e) => handleInputChange(`fenderEquipment.${index}.tires`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.pressure ?? ''} onChange={(e) => handleInputChange(`fenderEquipment.${index}.pressure`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2 text-center">{fender.length > 1 && <button type="button" onClick={() => handleRemoveFenderRow(index)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs whitespace-nowrap">Remove</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={handleAddFenderRow} className="mt-2 px-3 py-2 sm:px-4 bg-green-600 hover:bg-green-700 rounded text-white text-xs sm:text-sm w-full sm:w-auto">+ Add Row</button>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Hose Equipment Checklist</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm bg-gray-600">Hose ID #</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">End Flanges</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Body Condition</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Nuts/Bolts</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Markings</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm w-20">Action</th>
                </tr>
              </thead>
              <tbody>
                {hose.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-700/50">
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.hoseId ?? ''} onChange={(e) => handleInputChange(`hoseEquipment.${index}.hoseId`, e.target.value)} className={inputClassId} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.endFlanges ?? ''} onChange={(e) => handleInputChange(`hoseEquipment.${index}.endFlanges`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.bodyCondition ?? ''} onChange={(e) => handleInputChange(`hoseEquipment.${index}.bodyCondition`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.nutsBolts ?? ''} onChange={(e) => handleInputChange(`hoseEquipment.${index}.nutsBolts`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.markings ?? ''} onChange={(e) => handleInputChange(`hoseEquipment.${index}.markings`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2 text-center">{hose.length > 1 && <button type="button" onClick={() => handleRemoveHoseRow(index)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs whitespace-nowrap">Remove</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={handleAddHoseRow} className="mt-2 px-3 py-2 sm:px-4 bg-green-600 hover:bg-green-700 rounded text-white text-xs sm:text-sm w-full sm:w-auto">+ Add Row</button>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Other Equipment Checklist</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm bg-gray-600">Other Equipment ID #</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Gaskets</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Ropes</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Wires</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Billy Pugh</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Lifting Strops</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm w-20">Action</th>
                </tr>
              </thead>
              <tbody>
                {other.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-700/50">
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.equipmentId ?? ''} onChange={(e) => handleInputChange(`otherEquipment.${index}.equipmentId`, e.target.value)} className={inputClassId} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.gaskets ?? ''} onChange={(e) => handleInputChange(`otherEquipment.${index}.gaskets`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.ropes ?? ''} onChange={(e) => handleInputChange(`otherEquipment.${index}.ropes`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.wires ?? ''} onChange={(e) => handleInputChange(`otherEquipment.${index}.wires`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.billyPugh ?? ''} onChange={(e) => handleInputChange(`otherEquipment.${index}.billyPugh`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.liftingStrops ?? ''} onChange={(e) => handleInputChange(`otherEquipment.${index}.liftingStrops`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-2 text-center">{other.length > 1 && <button type="button" onClick={() => handleRemoveOtherEquipmentRow(index)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs">Remove</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={handleAddOtherEquipmentRow} className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm">+ Add Row</button>
        </div>
        <div className="grid grid-cols-2 gap-6 border-t border-gray-600 pt-6">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Signature of Mooring Master</label>
            <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => handleInputChange('signatureBlock.mooringMasterSignature', reader.result); reader.readAsDataURL(file); } }} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-600 file:text-white hover:file:bg-orange-700 cursor-pointer" />
            {signature && <div className="mt-2"><img src={resolveQhseSignatureImageSrc(signature) || signature} alt="Signature" className="max-w-full max-h-32 border border-gray-600 rounded object-contain bg-white p-2" decoding="async" /><button type="button" onClick={() => handleInputChange('signatureBlock.mooringMasterSignature', '')} className="mt-2 text-sm text-red-400 hover:text-red-300">Remove Signature</button></div>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Remarks</label>
            <textarea value={remarks} onChange={(e) => handleInputChange('remarks', e.target.value)} rows={6} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" placeholder="Enter remarks..." />
          </div>
        </div>
      </div>
    );
  };

  // OPS-OFD-018 Timesheet: edit body matching external form
  const renderOPSOFD018EditBody = () => {
    const basic = formData?.basicInfo || {};
    const opTimings = formData?.operationTimings || [];
    const additional = formData?.additionalActivities || [];
    const weather = formData?.weatherDelay || {};
    const cargo = formData?.cargoInfo || {};
    const finalRemarks = formData?.finalRemarks ?? "";
    const inputClass = "w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm";
    const dateVal = (v) => (v ? new Date(v).toISOString().split("T")[0] : "");
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Basic Info</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="block text-sm text-gray-400 mb-1">STS Superintendent</label><input type="text" value={basic.stsSuperintendent ?? ""} onChange={(e) => handleInputChange("basicInfo.stsSuperintendent", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-sm text-gray-400 mb-1">Job No.</label><input type="text" value={basic.jobNumber ?? ""} onChange={(e) => handleInputChange("basicInfo.jobNumber", e.target.value)} className={inputClass} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm text-gray-400 mb-1">Receiving Vessel</label><input type="text" value={basic.receivingVessel ?? ""} onChange={(e) => handleInputChange("basicInfo.receivingVessel", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-sm text-gray-400 mb-1">Discharging Vessel</label><input type="text" value={basic.dischargingVessel ?? ""} onChange={(e) => handleInputChange("basicInfo.dischargingVessel", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-sm text-gray-400 mb-1">Support Craft (Mob/Demob)</label><input type="text" value={basic.supportCraftMobDemob ?? ""} onChange={(e) => handleInputChange("basicInfo.supportCraftMobDemob", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-sm text-gray-400 mb-1">Location</label><input type="text" value={basic.location ?? ""} onChange={(e) => handleInputChange("basicInfo.location", e.target.value)} className={inputClass} /></div>
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
                {opTimings.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-700/50">
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.activityName ?? ""} onChange={(e) => handleInputChange(`operationTimings.${idx}.activityName`, e.target.value)} className={inputClass} placeholder="Activity" /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="date" value={dateVal(row.fromDate)} onChange={(e) => handleInputChange(`operationTimings.${idx}.fromDate`, e.target.value ? new Date(e.target.value).toISOString() : "")} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="time" value={row.fromTime ?? ""} onChange={(e) => handleInputChange(`operationTimings.${idx}.fromTime`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="date" value={dateVal(row.toDate)} onChange={(e) => handleInputChange(`operationTimings.${idx}.toDate`, e.target.value ? new Date(e.target.value).toISOString() : "")} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="time" value={row.toTime ?? ""} onChange={(e) => handleInputChange(`operationTimings.${idx}.toTime`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.remarks ?? ""} onChange={(e) => handleInputChange(`operationTimings.${idx}.remarks`, e.target.value)} className={inputClass} placeholder="Remarks" /></td>
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
                <tr className="bg-gray-700"><th className="border border-gray-600 p-3 text-left">Activities</th><th colSpan={2} className="border border-gray-600 p-3 text-center">From</th><th colSpan={2} className="border border-gray-600 p-3 text-center">To</th><th className="border border-gray-600 p-3 text-left">Remarks</th><th className="border border-gray-600 p-3 text-center w-20">Action</th></tr>
                <tr className="bg-gray-700"><th className="border border-gray-600 p-2"></th><th className="border border-gray-600 p-2 text-center">Date</th><th className="border border-gray-600 p-2 text-center">Time</th><th className="border border-gray-600 p-2 text-center">Date</th><th className="border border-gray-600 p-2 text-center">Time</th><th className="border border-gray-600 p-2"></th><th className="border border-gray-600 p-2"></th></tr>
              </thead>
              <tbody>
                {additional.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-700/50">
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.activityName ?? ""} onChange={(e) => handleInputChange(`additionalActivities.${idx}.activityName`, e.target.value)} className={inputClass} placeholder="Activity" /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="date" value={dateVal(row.fromDate)} onChange={(e) => handleInputChange(`additionalActivities.${idx}.fromDate`, e.target.value ? new Date(e.target.value).toISOString() : "")} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="time" value={row.fromTime ?? ""} onChange={(e) => handleInputChange(`additionalActivities.${idx}.fromTime`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="date" value={dateVal(row.toDate)} onChange={(e) => handleInputChange(`additionalActivities.${idx}.toDate`, e.target.value ? new Date(e.target.value).toISOString() : "")} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="time" value={row.toTime ?? ""} onChange={(e) => handleInputChange(`additionalActivities.${idx}.toTime`, e.target.value)} className={inputClass} /></td>
                    <td className="border border-gray-600 p-1 sm:p-2"><input type="text" value={row.remarks ?? ""} onChange={(e) => handleInputChange(`additionalActivities.${idx}.remarks`, e.target.value)} className={inputClass} placeholder="Remarks" /></td>
                    <td className="border border-gray-600 p-2 text-center">{additional.length > 1 && <button type="button" onClick={() => handleRemoveAdditionalActivityRow(idx)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs">Remove</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={handleAddAdditionalActivityRow} className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm">+ Add Row</button>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Significant Weather Which Caused Delay</h2>
            <div className="space-y-3">
              <div><label className="block text-sm text-gray-400 mb-1">Sea</label><input type="text" value={weather.sea ?? ""} onChange={(e) => handleInputChange("weatherDelay.sea", e.target.value)} className={inputClass} /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Swell</label><input type="text" value={weather.swell ?? ""} onChange={(e) => handleInputChange("weatherDelay.swell", e.target.value)} className={inputClass} /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Wind</label><input type="text" value={weather.wind ?? ""} onChange={(e) => handleInputChange("weatherDelay.wind", e.target.value)} className={inputClass} /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Total Exposure Hours</label><input type="text" inputMode="decimal" value={weather.totalExposureHours ?? ""} onChange={(e) => {
                const value = e.target.value;
                if (value === "" || /^\d*\.?\d*$/.test(value)) {
                  handleInputChange("weatherDelay.totalExposureHours", value);
                }
              }} onWheel={(e) => e.target.blur()} className={inputClass} /></div>
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Cargo</h2>
            <div className="space-y-3">
              <div><label className="block text-sm text-gray-400 mb-1">Cargo</label><input type="text" value={cargo.cargoName ?? ""} onChange={(e) => handleInputChange("cargoInfo.cargoName", e.target.value)} className={inputClass} /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Quantity</label><input type="text" value={cargo.cargoQuantity ?? ""} onChange={(e) => handleInputChange("cargoInfo.cargoQuantity", e.target.value)} className={inputClass} /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Cargo Pumping Time</label><input type="text" value={cargo.cargoPumpingTime ?? ""} onChange={(e) => handleInputChange("cargoInfo.cargoPumpingTime", e.target.value)} className={inputClass} /></div>
            </div>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Equipment / Operational / Incident / Delays etc, Remarks</h2>
          <textarea value={finalRemarks} onChange={(e) => handleInputChange("finalRemarks", e.target.value)} rows={4} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" placeholder="Enter remarks..." />
        </div>
      </div>
    );
  };

  // OPS-OFD-005B Before Disconnection & Unmooring: external-form edit layout
  const renderOPSOFD005BEditBody = () => {
    const transferInfo = formData?.transferInfo || {};
    const checklist6A = formData?.checklist6A?.checks || [];
    const pipelineConditions = formData?.checklist6A?.pipelineConditions || {};
    const checklist6B = formData?.checklist6B || [];
    const responsiblePersons = formData?.responsiblePersons || {};
    const inputClass = "w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm";
    const dateVal = (v) => (v ? new Date(v).toISOString().split("T")[0] : "");
    
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Basic Info</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="block text-sm text-gray-400 mb-1">Constant Heading Ship</label><input type="text" value={transferInfo.constantHeadingShip ?? ""} onChange={(e) => handleInputChange("transferInfo.constantHeadingShip", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-sm text-gray-400 mb-1">Maneuvering Ship</label><input type="text" value={transferInfo.manoeuvringShip ?? ""} onChange={(e) => handleInputChange("transferInfo.manoeuvringShip", e.target.value)} className={inputClass} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="block text-sm text-gray-400 mb-1">Name of Designated POAC</label><input type="text" value={transferInfo.designatedPOACName ?? ""} onChange={(e) => handleInputChange("transferInfo.designatedPOACName", e.target.value)} className={inputClass} /></div>
            <div><label className="block text-sm text-gray-400 mb-1">Name of STS Superintendent if Different from POAC</label><input type="text" value={transferInfo.stsSuperintendentName ?? ""} onChange={(e) => handleInputChange("transferInfo.stsSuperintendentName", e.target.value)} className={inputClass} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm text-gray-400 mb-1">Date of Transfer</label><input type="date" value={dateVal(transferInfo.transferDate)} onChange={(e) => handleInputChange("transferInfo.transferDate", e.target.value ? new Date(e.target.value).toISOString() : "")} className={inputClass} /></div>
            <div><label className="block text-sm text-gray-400 mb-1">Location of Transfer</label><input type="text" value={transferInfo.transferLocation ?? ""} onChange={(e) => handleInputChange("transferInfo.transferLocation", e.target.value)} className={inputClass} /></div>
          </div>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">CL:6A—CHECKS AFTER TRANSFER BEFORE DISCONNECTION</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Activities</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Status</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {checklist6A.map((item, idx) => {
                  const isItem2 = idx === 1 && item.clNumber === 2;
                  
                  return (
                    <tr key={idx} className="hover:bg-gray-700/50">
                      <td className="border border-gray-600 p-2">
                        <input type="text" value={item.description ?? ""} onChange={(e) => handleInputChange(`checklist6A.checks.${idx}.description`, e.target.value)} className={inputClass} placeholder="Activity description" />
                      </td>
                      <td className="border border-gray-600 p-2">
                        <div className="flex flex-col items-center gap-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={item.status?.yes || false} onChange={(e) => handleInputChange(`checklist6A.checks.${idx}.status.yes`, e.target.checked)} className="w-4 h-4" />
                            <span className="text-sm text-white/90">Yes</span>
                          </label>
                          {isItem2 && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={item.status?.notApplicable || false} onChange={(e) => handleInputChange(`checklist6A.checks.${idx}.status.notApplicable`, e.target.checked)} className="w-4 h-4" />
                              <span className="text-sm text-white/90">Not applicable</span>
                            </label>
                          )}
                        </div>
                      </td>
                      <td className="border border-gray-600 p-2">
                        {isItem2 ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={pipelineConditions.purged || false} onChange={(e) => handleInputChange("checklist6A.pipelineConditions.purged", e.target.checked)} className="w-4 h-4" />
                              <span className="text-sm text-white/90">Purged</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={pipelineConditions.inerted || false} onChange={(e) => handleInputChange("checklist6A.pipelineConditions.inerted", e.target.checked)} className="w-4 h-4" />
                              <span className="text-sm text-white/90">Inerted</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={pipelineConditions.depressurized || false} onChange={(e) => handleInputChange("checklist6A.pipelineConditions.depressurized", e.target.checked)} className="w-4 h-4" />
                              <span className="text-sm text-white/90">Depressurized</span>
                            </div>
                            <input type="text" value={item.remarks ?? ""} onChange={(e) => handleInputChange(`checklist6A.checks.${idx}.remarks`, e.target.value)} className={inputClass} placeholder="Additional remarks" />
                          </div>
                        ) : (
                          <input type="text" value={item.remarks ?? ""} onChange={(e) => handleInputChange(`checklist6A.checks.${idx}.remarks`, e.target.value)} className={inputClass} placeholder="Remarks" />
                        )}
                      </td>
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
                  <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Activities</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-center text-xs sm:text-sm">Status</th>
                  <th className="border border-gray-600 p-2 sm:p-3 text-left text-xs sm:text-sm">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {checklist6B.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-700/50">
                    <td className="border border-gray-600 p-2">
                      <input type="text" value={item.description ?? ""} onChange={(e) => handleInputChange(`checklist6B.${idx}.description`, e.target.value)} className={inputClass} placeholder="Activity description" />
                    </td>
                    <td className="border border-gray-600 p-2">
                      <div className="flex flex-col items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={item.status?.yes || false} onChange={(e) => handleInputChange(`checklist6B.${idx}.status.yes`, e.target.checked)} className="w-4 h-4" />
                          <span className="text-sm text-white/90">Yes</span>
                        </label>
                        {idx === 0 && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={item.status?.notApplicable || false} onChange={(e) => handleInputChange(`checklist6B.${idx}.status.notApplicable`, e.target.checked)} className="w-4 h-4" />
                            <span className="text-sm text-white/90">Not applicable</span>
                          </label>
                        )}
                      </div>
                    </td>
                    <td className="border border-gray-600 p-2">
                      <input type="text" value={item.remarks ?? ""} onChange={(e) => handleInputChange(`checklist6B.${idx}.remarks`, e.target.value)} className={inputClass} placeholder="Remarks" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Responsible Persons</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm text-gray-400 mb-1">Officer in charge of CHS:</label><input type="text" value={responsiblePersons.chsOfficerName ?? ""} onChange={(e) => handleInputChange("responsiblePersons.chsOfficerName", e.target.value)} className={inputClass} placeholder="Name" /></div>
            <div><label className="block text-sm text-gray-400 mb-1">Officer in charge of MS:</label><input type="text" value={responsiblePersons.msOfficerName ?? ""} onChange={(e) => handleInputChange("responsiblePersons.msOfficerName", e.target.value)} className={inputClass} placeholder="Name" /></div>
            <div><label className="block text-sm text-gray-400 mb-1">Terminal:</label><input type="text" value={responsiblePersons.terminalName ?? ""} onChange={(e) => handleInputChange("responsiblePersons.terminalName", e.target.value)} className={inputClass} placeholder="Name" /></div>
            <div><label className="block text-sm text-gray-400 mb-1">STS Supdt:</label><input type="text" value={responsiblePersons.stsSuperintendentName ?? ""} onChange={(e) => handleInputChange("responsiblePersons.stsSuperintendentName", e.target.value)} className={inputClass} placeholder="Name" /></div>
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
    return null;
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

      {/* Main Content - same form-style layout as view page */}
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

          {success && (
            <div className="bg-green-950/40 border border-green-500/40 rounded-xl px-4 py-3 text-green-200 text-sm font-medium">
              Form updated successfully! Redirecting...
            </div>
          )}

          {error && (
            <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
              Error: {error}
            </div>
          )}

          {/* Form card - same style as view page (external form layout) */}
          <form onSubmit={(e) => handleSubmit(e)} className="max-w-7xl mx-auto bg-gray-800 rounded-lg shadow-2xl p-4 sm:p-6 lg:p-8 text-white">
            {!canEditForm && (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">
                You do not have permission to edit this checklist form.
              </div>
            )}
            {/* Status bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-gray-700/50 border border-gray-600/50">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-400">Status:</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[formData?.status] || STATUS_COLORS.DRAFT}`}>
                  {formData?.status || 'DRAFT'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Change to:</label>
                <OperationsSelectField
                  ariaLabel="Change status"
                  value={formData?.status || "DRAFT"}
                  onChange={(v) => handleInputChange("status", v)}
                  options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                  triggerClassName="flex min-h-[2.25rem] min-w-[10rem] items-center justify-between rounded-lg border border-gray-500 bg-gray-700 px-3 py-1.5 pr-8 text-left text-sm text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  className="inline-block min-w-0"
                />
              </div>
            </div>

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
                <p className="text-xs text-gray-400 mt-2">Edit form</p>
              </div>
              <div className="bg-gray-700 p-3 sm:p-4 rounded w-full lg:min-w-[200px] text-xs sm:text-sm space-y-1">
                <div><strong>Form No:</strong> {(formData?.formNo ?? formData?.documentInfo?.formNo) || '—'}</div>
                <div><strong>Rev No:</strong> {(formData?.revisionNo ?? formData?.documentInfo?.revisionNo) || '—'}</div>
                <div><strong>Issue Date:</strong> {formatDateOnly(formData?.issueDate ?? formData?.revisionDate ?? formData?.documentInfo?.issueDate ?? formData?.documentInfo?.revisionDate)}</div>
                <div><strong>Approved by:</strong> {(formData?.approvedBy ?? formData?.documentInfo?.approvedBy) || '—'}</div>
              </div>
            </div>

            {/* Form body: OPS-OFD-014 / OPS-OFD-018 / OPS-OFD-005B use external-form layout; others use generic render */}
            <div className="space-y-6">
              {formPath === 'ops-ofd-014' ? renderOPSOFD014EditBody() : formPath === 'ops-ofd-018' ? renderOPSOFD018EditBody() : formPath === 'ops-ofd-005b' ? renderOPSOFD005BEditBody() : renderEditableObject(formData, '', true)}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-700">
              <Link
                href={`/operations/sts-operations/new/form-checklist/sts-checklist/${formPath}/view/${id}`}
                className="px-4 sm:px-6 py-2.5 bg-gray-600 hover:bg-gray-500 rounded-lg transition text-sm font-medium text-center"
              >
                Cancel
              </Link>
              <div className="flex flex-col sm:flex-row gap-3">
                {canEditForm && formData?.status !== 'DRAFT' && (
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e, 'DRAFT')}
                    className="px-4 sm:px-6 py-2.5 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Revert to Draft'}
                  </button>
                )}
                {canEditForm && (
                  <button
                    type="submit"
                    className="px-4 sm:px-6 py-2.5 bg-orange-500 hover:bg-orange-600 rounded-lg transition text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Update Form'}
                  </button>
                )}
                {canEditForm && formData?.status !== 'SUBMITTED' && (
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e, 'SUBMITTED')}
                    className="px-4 sm:px-6 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg transition text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    disabled={saving}
                  >
                    {saving ? 'Submitting...' : 'Submit Form'}
                  </button>
                )}
                {canApprove && formData?.status !== 'APPROVED' && (
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e, 'APPROVED')}
                    className="px-4 sm:px-6 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg transition text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={saving}
                  >
                    {saving ? 'Approving...' : 'Approve'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import OperationsSelectField from "@/app/operations/components/OperationsSelectField";
import {
  ActionViewIcon,
  ActionEditIcon,
  ActionDeleteIcon,
} from "@/app/components/RecordActionIcons";
import { usePmsRole } from "@/hooks/usePmsRole";

/**
 * MFG / TEST cert chip.
 *
 * Always opens through `/api/.../[id]/certificate/[type]` so the server can:
 * - send the right Content-Type (PDFs render inline instead of downloading as binary)
 * - re-attach the original filename on records whose stored fileUrl lost the extension.
 */
function CertLink({ accessoryId, type, cert, label }) {
  if (!cert?.fileUrl || !accessoryId) return null;
  const href = `/api/pms/equipment-inventory/accessories/${accessoryId}/certificate/${type}`;
  return (
    <a
      href={href}
      download={cert.originalFileName || `${type}-certificate`}
      title={cert.originalFileName || label}
      className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-200 hover:bg-emerald-500/20 transition"
    >
      <svg
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 10-5.656-5.656L5.757 10.586a6 6 0 108.486 8.486L20 13"
        />
      </svg>
      {label}
    </a>
  );
}

function formatDetailDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function escapeCsvCell(value) {
  if (value == null) return "";
  const s = String(value).trim();
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function getAccessoryExportColumns(listCategory) {
  const cols = [
    ...(listCategory === "REGULAR"
      ? [{ label: "Equipment No", getValue: (i) => i?.equipmentNo ?? "" }]
      : []),
    { label: "Equipment Name", getValue: (i) => i?.equipmentName ?? "" },
    { label: "Placed In", getValue: (i) => i?.placedIn ?? "" },
    { label: "Location", getValue: (i) => i?.locationName ?? "" },
    { label: "Category", getValue: (i) => i?.category ?? "" },
    { label: "Status", getValue: (i) => i?.status ?? "" },
    { label: "Purchase Date", getValue: (i) => formatDetailDate(i?.purchaseDate) },
    { label: "Specification", getValue: (i) => i?.specification ?? "" },
    { label: "Put In Use", getValue: (i) => (i?.putInUse ? "Yes" : "No") },
    { label: "Put In Use Date", getValue: (i) => formatDetailDate(i?.putInUseDate) },
    { label: "Remarks", getValue: (i) => i?.remarks ?? "" },
  ];
  if (listCategory === "OCCASIONAL") {
    cols.push(
      {
        label: "Quantity",
        getValue: (i) => (i?.quantity != null ? String(i.quantity) : ""),
      },
      {
        label: "Track Test Schedule",
        getValue: (i) => (i?.occasionalTrackTestSchedule ? "Yes" : "No"),
      },
      {
        label: "Occasional Test Date",
        getValue: (i) => formatDetailDate(i?.occasionalTestDate),
      },
      {
        label: "Next Due Date",
        getValue: (i) => formatDetailDate(i?.occasionalNextDueDate),
      }
    );
  }
  return cols;
}

/** One CSV for the full accessories list for the selected year and tab (Regular / Occasional). */
function downloadAccessoriesInventoryYearCsv(items, year, listCategory) {
  if (!items?.length) return;
  const columns = getAccessoryExportColumns(listCategory);
  const headers = columns.map((c) => c.label);
  const headerLine = headers.map(escapeCsvCell).join(",");
  const lines = items.map((row) =>
    columns.map((c) => escapeCsvCell(c.getValue(row))).join(",")
  );
  const csv = "\uFEFF" + headerLine + "\r\n" + lines.join("\r\n") + "\r\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const kind = listCategory === "OCCASIONAL" ? "Occasional" : "Regular";
  a.download = `Accessories_${kind}_Inventory_${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 2; i < currentYear; i += 1) {
    years.push(i);
  }
  for (let i = currentYear; i <= currentYear + 5; i += 1) {
    years.push(i);
  }
  return years;
}

export default function AccessoriesList({
  listCategory = "REGULAR",
  onListCategoryChange,
  onEditItem,
}) {
  const { canEdit, canDelete, canDownload } = usePmsRole();
  const [accessories, setAccessories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [years, setYears] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [deletingId, setDeletingId] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);

  const showEquipmentNo = listCategory === "REGULAR";

  const setListCategory = (next) => {
    if (typeof onListCategoryChange === "function") {
      onListCategoryChange(next);
    }
  };

  const loadAccessories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = `/api/pms/equipment-inventory/accessories/list?year=${year}&category=${listCategory}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load accessories");
      setAccessories(data.data || []);
    } catch (err) {
      setError(err.message || "Failed to load accessories");
    } finally {
      setLoading(false);
    }
  }, [year, listCategory]);

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const res = await fetch(`/api/pms/equipment-inventory/accessories/list`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.years) && data.years.length > 0) {
          setYears(data.years);
          setYear(data.years[0]);
        }
      } catch {
        // ignore
      }
    };
    fetchYears();
  }, []);

  useEffect(() => {
    loadAccessories();
  }, [loadAccessories]);

  const accessoriesPagination = useOperationsClientPagination(
    accessories,
    `${year}|${listCategory}`
  );
  const {
    paginatedItems: paginatedAccessories,
    ...accessoriesPaginationFooterProps
  } = accessoriesPagination;

  const handleDelete = async (item) => {
    if (!item?._id || !canDelete) return;
    if (
      !confirm(
        `Delete accessory "${item.equipmentName || item.equipmentNo || "record"}"? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingId(item._id);
    setError("");
    try {
      const res = await fetch(
        `/api/pms/equipment-inventory/accessories/${item._id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete accessory");
      }
      await loadAccessories();
    } catch (err) {
      setError(err.message || "Failed to delete accessory");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative z-40 flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3 min-w-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
              Accessories Inventory
            </h2>
            <p className="text-sm text-white/60">
              List View · {listCategory === "OCCASIONAL" ? "Occasional" : "Regular"}
            </p>
          </div>
          {typeof onListCategoryChange === "function" && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setListCategory("REGULAR")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  listCategory === "REGULAR"
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/40"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
                }`}
              >
                Regular
              </button>
              <button
                type="button"
                onClick={() => setListCategory("OCCASIONAL")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  listCategory === "OCCASIONAL"
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/40"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
                }`}
              >
                Occasional
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-xs uppercase tracking-[0.2em] text-slate-200">
              Year
            </span>
            <OperationsSelectField
              variant="pill"
              ariaLabel="Year filter"
              value={String(year)}
              onChange={(v) => setYear(Number(v))}
              options={(years.length ? years : getYears()).map((y) => ({
                value: String(y),
                label: String(y),
              }))}
              className="min-w-0 w-[6.25rem] sm:w-32"
              triggerClassName="ops-select-trigger w-full rounded-full px-3 py-1 text-xs tracking-widest uppercase"
            />
          </div>
          {canDownload && (
            <button
              type="button"
              onClick={() =>
                downloadAccessoriesInventoryYearCsv(accessories, year, listCategory)
              }
              disabled={loading || accessories.length === 0}
              title="Download all rows for this year and tab as one CSV"
              className="text-xs px-3 py-1.5 rounded-lg border border-orange-400/50 text-orange-100 bg-orange-500/10 hover:bg-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              Download full year (CSV)
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="relative z-0 rounded-3xl border border-white/10 bg-[#0b2740]/75 backdrop-blur-[2px] p-4 sm:p-6 shadow-2xl">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-white/60">Loading accessories...</p>
          </div>
        ) : accessories.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-white/60">
              No accessories found for the selected year
              {listCategory === "OCCASIONAL" ? " (occasional)" : " (regular)"}.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto styled-scrollbar">
              <table className="min-w-[520px] w-full text-sm text-left">
                <thead className="text-xs uppercase tracking-wide text-slate-300 border-b border-white/10">
                  <tr>
                    {showEquipmentNo && (
                      <th className="px-4 py-3">Equipment No</th>
                    )}
                    <th className="px-4 py-3">Equipment Name</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Certificates</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedAccessories.map((item) => (
                    <tr key={item._id} className="hover:bg-white/5">
                      {showEquipmentNo && (
                        <td className="px-4 py-3 font-medium text-white">
                          {item.equipmentNo || "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-white/90">
                        {item.equipmentName || "—"}
                      </td>
                      <td className="px-4 py-3 text-white/80 max-w-[140px] truncate" title={item.locationName || ""}>
                        {item.locationName?.trim() ? item.locationName : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                            item.category === "REGULAR"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-purple-500/20 text-purple-300"
                          }`}
                        >
                          {item.category || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                            item.status === "ACTIVE"
                              ? "bg-green-500/20 text-green-300"
                              : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          {item.status || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.manufacturingCertificate?.fileUrl ||
                        item.testCertificate?.fileUrl ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <CertLink
                              accessoryId={item._id}
                              type="manufacturing"
                              cert={item.manufacturingCertificate}
                              label="Mfg"
                            />
                            <CertLink
                              accessoryId={item._id}
                              type="test"
                              cert={item.testCertificate}
                              label="Test"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-white/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <ActionViewIcon
                            onClick={() => setViewingItem(item)}
                            title="View details"
                          />
                          {canEdit && onEditItem && (
                            <ActionEditIcon
                              onClick={() => onEditItem(item)}
                              title="Edit accessory"
                            />
                          )}
                          {canDelete && (
                            <ActionDeleteIcon
                              loading={deletingId === item._id}
                              onClick={() => handleDelete(item)}
                              title="Delete accessory"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <OperationsListPaginationFooter
              {...accessoriesPaginationFooterProps}
              className="overflow-visible"
            />
          </>
        )}
      </div>

      {viewingItem ? (
        <AccessoryViewModal
          item={viewingItem}
          showEquipmentNo={showEquipmentNo}
          onClose={() => setViewingItem(null)}
          onEdit={
            canEdit && onEditItem
              ? () => {
                  const row = viewingItem;
                  setViewingItem(null);
                  onEditItem(row);
                }
              : null
          }
        />
      ) : null}
    </div>
  );
}

function DetailRow({ label, value, full }) {
  const display =
    value == null || value === "" ? (
      <span className="text-white/40">—</span>
    ) : (
      String(value)
    );
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-[11px] uppercase tracking-wider text-white/50">{label}</p>
      <p className="mt-0.5 break-words text-sm text-white/90">{display}</p>
    </div>
  );
}

function AccessoryViewModal({ item, showEquipmentNo, onClose, onEdit }) {
  /* Portal target: avoids ancestor `backdrop-filter` (the inventory card uses `backdrop-blur-[2px]`)
   * which would otherwise become the containing block for this `position: fixed` overlay,
   * trapping it inside the card instead of the viewport. */
  const [portalTarget, setPortalTarget] = useState(null);

  useEffect(() => {
    setPortalTarget(typeof document !== "undefined" ? document.body : null);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!portalTarget) return null;

  const title = item.equipmentName || item.equipmentNo || "Accessory";

  const overlay = (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 sm:p-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Accessory details"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative my-4 w-full max-w-3xl rounded-2xl border border-white/15 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-sky-300">
              Accessory
            </p>
            <h2 className="text-lg font-semibold text-white truncate">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
              >
                Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              title="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white/80 hover:bg-white/15 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 text-sm text-white/90 styled-scrollbar">
          <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="mb-3 border-b border-white/10 pb-2 text-sm font-semibold uppercase tracking-wider text-sky-300">
              Details
            </h3>
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {showEquipmentNo ? (
                <DetailRow label="Equipment No" value={item.equipmentNo} />
              ) : null}
              <DetailRow label="Equipment Name" value={item.equipmentName} />
              <DetailRow label="Category" value={item.category} />
              <DetailRow label="Status" value={item.status} />
              <DetailRow label="Placed In" value={item.placedIn} />
              <DetailRow label="Location" value={item.locationName} />
              <DetailRow label="Purchase Date" value={formatDetailDate(item.purchaseDate)} />
              <DetailRow label="Specification" value={item.specification} full />
              <DetailRow label="Remarks" value={item.remarks} full />
              {item.category === "OCCASIONAL" ? (
                <>
                  <DetailRow label="Quantity" value={item.quantity != null ? String(item.quantity) : ""} />
                  <DetailRow
                    label="Track test schedule"
                    value={item.occasionalTrackTestSchedule ? "Yes" : "No"}
                  />
                  <DetailRow
                    label="Occasional test date"
                    value={formatDetailDate(item.occasionalTestDate)}
                  />
                  <DetailRow
                    label="Next due date"
                    value={formatDetailDate(item.occasionalNextDueDate)}
                  />
                </>
              ) : null}
              <DetailRow label="Put in use" value={item.putInUse ? "Yes" : "No"} />
              <DetailRow label="Put in use date" value={formatDetailDate(item.putInUseDate)} />
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="mb-3 border-b border-white/10 pb-2 text-sm font-semibold uppercase tracking-wider text-sky-300">
              Certificates
            </h3>
            {item.manufacturingCertificate?.fileUrl || item.testCertificate?.fileUrl ? (
              <div className="flex flex-wrap gap-2">
                <CertLink
                  accessoryId={item._id}
                  type="manufacturing"
                  cert={item.manufacturingCertificate}
                  label="Mfg"
                />
                <CertLink
                  accessoryId={item._id}
                  type="test"
                  cert={item.testCertificate}
                  label="Test"
                />
              </div>
            ) : (
              <p className="text-sm text-white/40">No certificates uploaded.</p>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="mb-3 border-b border-white/10 pb-2 text-sm font-semibold uppercase tracking-wider text-sky-300">
              Record
            </h3>
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <DetailRow label="Created" value={formatDetailDate(item.createdAt)} />
              <DetailRow label="Last updated" value={formatDetailDate(item.updatedAt)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, portalTarget);
}

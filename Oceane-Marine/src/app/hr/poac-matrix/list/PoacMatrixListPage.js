"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useHrLoading } from "../../HrLoadingContext";
import { useHrRole } from "@/hooks/useHrRole";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";

/* ── Shared icon button components (matching QHSE style) ── */
const tooltipClass =
  "pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-slate-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap";
const iconClass = "w-5 h-5";

function ViewIconButton({ onClick, title = "View" }) {
  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        className="p-1.5 rounded text-sky-400 hover:text-sky-300 hover:bg-white/10 transition inline-flex"
      >
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>
      <span className={tooltipClass}>{title}</span>
    </span>
  );
}

function EditIconButton({ onClick, title = "Edit" }) {
  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        className="p-1.5 rounded text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition inline-flex"
      >
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <span className={tooltipClass}>{title}</span>
    </span>
  );
}

function DeleteIconButton({ onClick, disabled, loading }) {
  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title="Delete"
        aria-label="Delete"
        className="p-1.5 rounded text-red-300 hover:text-red-200 hover:bg-red-500/10 disabled:opacity-50 transition inline-flex"
      >
        {loading ? (
          <svg className={`${iconClass} animate-spin`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
      </button>
      <span className={tooltipClass}>Delete</span>
    </span>
  );
}

function DownloadIconButton({ onClick, disabled, loading }) {
  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title="Download"
        aria-label="Download"
        className="p-1.5 rounded text-sky-400 hover:text-sky-300 hover:bg-white/10 disabled:opacity-50 transition inline-flex"
      >
        {loading ? (
          <svg className={`${iconClass} animate-spin`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )}
      </button>
      <span className={tooltipClass}>Download</span>
    </span>
  );
}

/** Display visa: new visaEntries[] or legacy visaLocation + visaValidity */
function formatVisaForRow(row) {
  if (Array.isArray(row.visaEntries) && row.visaEntries.length > 0) {
    return row.visaEntries
      .map((e) => {
        const loc = e.location || "";
        const v = e.validity || "";
        return v ? `${loc} (${v})` : loc;
      })
      .filter(Boolean)
      .join("; ");
  }
  const locs = Array.isArray(row.visaLocation) ? row.visaLocation : row.visaLocation ? [row.visaLocation] : [];
  if (locs.length === 0) return "";
  const v = row.visaValidity || "";
  return locs
    .map((loc) => (v ? `${loc} (${v})` : String(loc)))
    .join("; ");
}

function pdfCellValue(row, k) {
  if (k === "visaEntries") return formatVisaForRow(row) || "—";
  const v = row[k];
  return Array.isArray(v) ? (v.length ? v.join(", ") : "—") : (v || "—");
}

/* ── PDF Generator (client-side, landscape) ── */
async function generatePoacMatrixPDF(allRows, providerName) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF("l", "mm", "a4"); // landscape
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const safeProvider = providerName || "POAC";
  const margin = 6;
  const headerHeight = 28;

  // ── Header banner (bordered box with logo + title) ──
  // Dark blue background fill for the header area
  doc.setFillColor(0, 51, 102);
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.6);
  doc.rect(margin, 4, pageWidth - margin * 2, headerHeight, "FD"); // F = fill, D = draw border

  // Vertical divider between logo and title (white line)
  const logoDividerX = 55;
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.line(logoDividerX, 4, logoDividerX, 4 + headerHeight);

  // Logo in left box
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = "/image/image.png";
    });
    const logoWidth = 38;
    const logoHeight = (img.naturalHeight / img.naturalWidth) * logoWidth;
    const logoX = margin + (logoDividerX - margin - logoWidth) / 2;
    const logoY = 4 + (headerHeight - logoHeight) / 2;
    doc.addImage(img, "PNG", logoX, logoY, logoWidth, logoHeight);
  } catch {
    // no logo fallback
  }

  // Title in right box (white text on dark blue background)
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255); // White text
  const titleCenterX = logoDividerX + (pageWidth - margin - logoDividerX) / 2;
  doc.text("POAC Certification Matrix", titleCenterX, 4 + headerHeight / 2 + 3, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Form No: QAF-OFD-046`, titleCenterX, 4 + headerHeight / 2 + 8, { align: "center" });
  doc.setFontSize(20);

  const pdfColumns = PDF_DETAIL_COLUMNS.map((col) => col.label.replace(/ /g, "\n"));
  pdfColumns.unshift("S.N");

  const pdfKeys = PDF_DETAIL_COLUMNS.map((col) => col.key);

  const body = allRows.map((row, idx) => [
    idx + 1,
    ...pdfKeys.map((k) => pdfCellValue(row, k)),
  ]);

  const tableStartY = 4 + headerHeight + 2;

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [pdfColumns],
    body,
    headStyles: {
      fillColor: [230, 126, 34],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 4.5,
      cellPadding: 1,
      halign: "center",
      valign: "middle",
      lineColor: [200, 100, 20],
      lineWidth: 0.4,
    },
    bodyStyles: {
      fontSize: 4.5,
      cellPadding: 1,
      textColor: [30, 30, 30],
      valign: "middle",
      lineColor: [80, 80, 80],
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [252, 235, 215] },
    columnStyles: {
      0: { cellWidth: 6, halign: "center", fontStyle: "bold" },
    },
    theme: "grid",
    styles: { lineColor: [80, 80, 80], lineWidth: 0.3, overflow: "linebreak" },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFillColor(0, 51, 102);
        doc.setDrawColor(0, 51, 102);
        doc.setLineWidth(0.6);
        doc.rect(margin, 4, pageWidth - margin * 2, headerHeight, "FD");
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.3);
        doc.line(logoDividerX, 4, logoDividerX, 4 + headerHeight);
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("POAC Certification Matrix", titleCenterX, 4 + headerHeight / 2 + 3, { align: "center" });
        doc.setFontSize(10);
        doc.text(`Form No: QAF-OFD-046`, titleCenterX, 4 + headerHeight / 2 + 8, { align: "center" });
        doc.setFontSize(20);
      }

      const footerY = pageHeight - 8;
      doc.setDrawColor(230, 126, 34);
      doc.setLineWidth(0.8);
      doc.line(10, footerY - 3, 30, footerY - 3);
      doc.setFontSize(6);
      doc.setTextColor(80, 80, 80);
      doc.setFont("helvetica", "normal");
      doc.text(
        "+971 50 497 4021   |   1201, Fortune Tower, Cluster C, JLT Dubai   |   operations@oceanemarine.com",
        pageWidth / 2,
        footerY,
        { align: "center" }
      );
      doc.text("Dubai | Fujairah | Oman", 10, footerY + 3);
    },
  });

  const safeName = safeProvider.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`POAC_Certification_Matrix_${safeName}.pdf`);
}

/* ── Column headers for the full detail table ── */
const DETAIL_COLUMNS = [
  { key: "stsServiceProvider", label: "STS Service Provider" },
  { key: "poacName", label: "POAC's Name" },
  { key: "validPassport", label: "Valid Passport", fileKey: "validPassportFile" },
  { key: "validPassportExpiry", label: "Passport Expiry" },
  { key: "validMastersCOC", label: "Valid Master's COC", fileKey: "validMastersCOCFile" },
  { key: "validMastersCOCExpiry", label: "COC Expiry" },
  { key: "dangerousCargoEndorsementOil", label: "Dangerous cargo endorsement(Oil)", fileKey: "dangerousCargoEndorsementOilFile" },
  { key: "dangerousCargoEndorsementOilExpiry", label: "DCE Oil Expiry" },
  { key: "dangerousCargoEndorsementChem", label: "Dangerous cargo endorsement(Chem)", fileKey: "dangerousCargoEndorsementChemFile" },
  { key: "dangerousCargoEndorsementChemExpiry", label: "DCE Chem Expiry" },
  { key: "dangerousCargoEndorsementGas", label: "Dangerous cargo endorsements(Gas)", fileKey: "dangerousCargoEndorsementGasFile" },
  { key: "dangerousCargoEndorsementGasExpiry", label: "DCE Gas Expiry" },
  { key: "oilSpillResponseTraining", label: "Oil spill response training", fileKey: "oilSpillResponseTrainingFile" },
  { key: "oilSpillResponseTrainingExpiry", label: "Oil Spill Trg Expiry" },
  { key: "stsSimulatorTraining", label: "STS Simulator training", fileKey: "stsSimulatorTrainingFile" },
  { key: "stsSimulatorTrainingExpiry", label: "STS Trg Expiry" },
  { key: "vesselSizeLimitations", label: "Vessel Size Limitations", fileKey: "vesselSizeLimitationsFile" },
  { key: "vesselSizeLimitationsExpiry", label: "Vessel Size Expiry" },
  { key: "underwayOperations", label: "Underway operations", fileKey: "underwayOperationsFile" },
  { key: "underwayOperationsExpiry", label: "Underway Expiry" },
  { key: "validMedicals", label: "Valid Medicals", fileKey: "validMedicalsFile" },
  { key: "validMedicalsExpiry", label: "Medicals Expiry" },
  { key: "experienceWithOceane", label: "Experience with Oceane" },
  { key: "visaEntries", label: "Visa (location / expiry)" },
  { key: "remarks", label: "Remarks: Locations / etc" },
];

/** PDF export: no expiry columns, no visa column (on-screen list/view unchanged) */
const PDF_DETAIL_COLUMNS = DETAIL_COLUMNS.filter(
  (col) => col.key !== "visaEntries" && !col.key.endsWith("Expiry")
);

/* ── Overall PDF Generator (combines multiple records into one file) ── */
async function generateOverallPoacPDF(allRows) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF("l", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 6;
  const headerHeight = 28;

  // ── Header banner ──
  doc.setFillColor(0, 51, 102);
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.6);
  doc.rect(margin, 4, pageWidth - margin * 2, headerHeight, "FD");

  const logoDividerX = 55;
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.line(logoDividerX, 4, logoDividerX, 4 + headerHeight);

  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = "/image/image.png";
    });
    const logoWidth = 38;
    const logoHeight = (img.naturalHeight / img.naturalWidth) * logoWidth;
    const logoX = margin + (logoDividerX - margin - logoWidth) / 2;
    const logoY = 4 + (headerHeight - logoHeight) / 2;
    doc.addImage(img, "PNG", logoX, logoY, logoWidth, logoHeight);
  } catch {
    // no logo fallback
  }

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  const titleCenterX = logoDividerX + (pageWidth - margin - logoDividerX) / 2;
  doc.text("POAC Certification Matrix - Overall", titleCenterX, 4 + headerHeight / 2 + 3, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Form No: QAF-OFD-046`, titleCenterX, 4 + headerHeight / 2 + 8, { align: "center" });
  doc.setFontSize(20);

  const pdfColumns = PDF_DETAIL_COLUMNS.map((col) => col.label.replace(/ /g, "\n"));
  pdfColumns.unshift("S.N");

  const pdfKeys = PDF_DETAIL_COLUMNS.map((col) => col.key);

  const body = allRows.map((row, idx) => [
    idx + 1,
    ...pdfKeys.map((k) => pdfCellValue(row, k)),
  ]);

  const tableStartY = 4 + headerHeight + 2;

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [pdfColumns],
    body,
    headStyles: {
      fillColor: [230, 126, 34],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 4.5,
      cellPadding: 1,
      halign: "center",
      valign: "middle",
      lineColor: [200, 100, 20],
      lineWidth: 0.4,
    },
    bodyStyles: {
      fontSize: 4.5,
      cellPadding: 1,
      textColor: [30, 30, 30],
      valign: "middle",
      lineColor: [80, 80, 80],
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [252, 235, 215] },
    columnStyles: {
      0: { cellWidth: 6, halign: "center", fontStyle: "bold" },
    },
    theme: "grid",
    styles: { lineColor: [80, 80, 80], lineWidth: 0.3, overflow: "linebreak" },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFillColor(0, 51, 102);
        doc.setDrawColor(0, 51, 102);
        doc.setLineWidth(0.6);
        doc.rect(margin, 4, pageWidth - margin * 2, headerHeight, "FD");
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.3);
        doc.line(logoDividerX, 4, logoDividerX, 4 + headerHeight);
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("POAC Certification Matrix - Overall", titleCenterX, 4 + headerHeight / 2 + 3, { align: "center" });
        doc.setFontSize(10);
        doc.text(`Form No: QAF-OFD-046`, titleCenterX, 4 + headerHeight / 2 + 8, { align: "center" });
        doc.setFontSize(20);
      }
      const footerY = pageHeight - 8;
      doc.setDrawColor(230, 126, 34);
      doc.setLineWidth(0.8);
      doc.line(10, footerY - 3, 30, footerY - 3);
      doc.setFontSize(6);
      doc.setTextColor(80, 80, 80);
      doc.setFont("helvetica", "normal");
      doc.text(
        "+971 50 497 4021   |   1201, Fortune Tower, Cluster C, JLT Dubai   |   operations@oceanemarine.com",
        pageWidth / 2,
        footerY,
        { align: "center" }
      );
      doc.text("Dubai | Fujairah | Oman", 10, footerY + 3);
    },
  });

  doc.save("POAC_Certification_Matrix_Overall.pdf");
}

/* ── Main list component ── */
export default function PoacMatrixListPage({ onRefresh }) {
  const router = useRouter();
  const { setPageLoading } = useHrLoading();
  const { canEdit, canDelete, canDownload } = useHrRole();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [pdfDownloadingId, setPdfDownloadingId] = useState(null);

  // Overall PDF selection
  const [showPdfPanel, setShowPdfPanel] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState(new Set());
  const [downloadingOverall, setDownloadingOverall] = useState(false);

  const poacListPagination = useOperationsClientPagination(records, `${records.length}`);
  const {
    paginatedItems: paginatedRecords,
    page: listPage,
    pageSize: listPageSize,
    ...poacListPaginationFooterProps
  } = poacListPagination;

  useEffect(() => {
    fetchRecords();
    const handleRefresh = () => fetchRecords();
    window.addEventListener("refreshPoacMatrix", handleRefresh);
    return () => window.removeEventListener("refreshPoacMatrix", handleRefresh);
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setPageLoading(true);
      setError("");
      const res = await fetch("/api/hr/poac-matrix/list");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to fetch records");
      setRecords(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  const handleView = (record) => setSelectedRecord(record);
  const closeModal = () => setSelectedRecord(null);

  const handleEdit = (record) => {
    router.push(`/hr/poac-matrix?tab=form&edit=${record._id}`);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this entire record and all its rows?")) return;
    try {
      setDeletingId(id);
      const res = await fetch(`/api/hr/poac-matrix/${id}/delete`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to delete");
      setActionMessage("Record deleted successfully!");
      fetchRecords();
      setTimeout(() => setActionMessage(""), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(""), 5000);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (fileUrl, fileName) => {
    if (!fileUrl) {
      alert("No file attached");
      return;
    }
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error("Failed to download file");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "attachment";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err.message || "Failed to download file");
    }
  };

  /* Get all attachments for a row (supports both new array and legacy single) */
  const getRowAttachments = (row) => {
    if (row.attachments?.length > 0) return row.attachments.filter((a) => a.fileUrl);
    if (row.attachment?.fileUrl) return [row.attachment];
    return [];
  };

  // Download PDF for a specific record
  const handleRecordPDF = async (record) => {
    const rows = record.rows || [];
    if (rows.length === 0) {
      setError("No POAC rows in this record");
      setTimeout(() => setError(""), 4000);
      return;
    }
    try {
      setPdfDownloadingId(record._id);
      const provider = rows[0]?.stsServiceProvider || "POAC";
      await generatePoacMatrixPDF(rows, provider);
    } catch (err) {
      setError(err.message || "PDF download failed");
      setTimeout(() => setError(""), 5000);
    } finally {
      setPdfDownloadingId(null);
    }
  };

  // Overall PDF panel helpers
  const openPdfPanel = () => {
    setShowPdfPanel(true);
    // Select all by default
    setSelectedRecordIds(new Set(records.map((r) => r._id)));
  };

  const closePdfPanel = () => {
    setShowPdfPanel(false);
    setSelectedRecordIds(new Set());
  };

  const toggleRecordSelection = (id) => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllRecords = () => {
    if (selectedRecordIds.size === records.length) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(records.map((r) => r._id)));
    }
  };

  const handleOverallDownload = async () => {
    try {
      setDownloadingOverall(true);
      const selected = records.filter((r) => selectedRecordIds.has(r._id));
      if (selected.length === 0) {
        setError("Please select at least one record");
        return;
      }
      // Combine all rows from selected records into one flat array
      const allRows = [];
      selected.forEach((record) => {
        (record.rows || []).forEach((row) => allRows.push(row));
      });
      if (allRows.length === 0) {
        setError("No POAC rows found in selected records");
        return;
      }
      await generateOverallPoacPDF(allRows);
      closePdfPanel();
    } catch (err) {
      setError(err.message || "PDF download failed");
    } finally {
      setDownloadingOverall(false);
    }
  };

  // Get a summary for each record (first row's STS provider, count of POACs)
  const getRecordSummary = (record) => {
    const rows = record.rows || [];
    const provider = rows[0]?.stsServiceProvider || "—";
    const poacNames = rows.map((r) => r.poacName).filter(Boolean);
    return { provider, poacCount: rows.length, poacNames };
  };

  return (
    <>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl space-y-4">
        {/* Top Row: Extract PDF Button */}
        {records.length > 0 && canDownload && (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={openPdfPanel}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-orange-500/30 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
              </svg>
              Extract Overall PDF
            </button>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
            {error}
          </div>
        )}
        {actionMessage && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-4 py-3 text-emerald-200 text-sm font-medium">
            {actionMessage}
          </div>
        )}

        {/* Table — one row per record */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[280px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/60">No records found</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-200 border-b border-white/10 bg-white/5">
                      <th className="px-4 py-4 font-semibold w-[7%]">S.No</th>
                      <th className="px-4 py-4 font-semibold min-w-[140px] w-[22%]">
                        STS Service Provider
                      </th>
                      <th className="px-4 py-4 font-semibold min-w-[160px] w-[28%]">POAC Name</th>
                      <th className="px-4 py-4 font-semibold text-center w-[12%]">No. of POACs</th>
                      <th className="px-4 py-4 font-semibold text-right w-[31%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map((record, idx) => {
                      const { provider, poacCount, poacNames } = getRecordSummary(record);
                      const rowNum = (listPage - 1) * listPageSize + idx + 1;
                      return (
                        <tr
                          key={record._id}
                          className="border-b border-white/5 hover:bg-white/5 transition"
                        >
                          <td className="px-4 py-4 text-white/70 font-mono">{rowNum}</td>
                          <td className="px-4 py-4 text-white font-medium">{provider}</td>
                          <td className="px-4 py-4 text-white/90 text-sm align-top">
                            {poacNames.length > 0 ? (
                              <span
                                className="line-clamp-3 break-words"
                                title={poacNames.join(", ")}
                              >
                                {poacNames.join(", ")}
                              </span>
                            ) : (
                              <span className="text-white/40">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center justify-center bg-orange-500/20 text-orange-300 text-xs font-bold px-2.5 py-1 rounded-full min-w-[28px]">
                              {poacCount}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <ViewIconButton onClick={() => handleView(record)} />
                              {canEdit && <EditIconButton onClick={() => handleEdit(record)} />}
                              {canDownload && (
                                <DownloadIconButton
                                  onClick={() => handleRecordPDF(record)}
                                  disabled={pdfDownloadingId === record._id}
                                  loading={pdfDownloadingId === record._id}
                                />
                              )}
                              {canDelete && (
                                <DeleteIconButton
                                  onClick={() => handleDelete(record._id)}
                                  disabled={deletingId === record._id}
                                  loading={deletingId === record._id}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <OperationsListPaginationFooter {...poacListPaginationFooterProps} />
            </div>
          )}
      </div>

      {/* ── Overall PDF Selection Modal ── */}
      {showPdfPanel &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={closePdfPanel}
          >
            <div
              className="relative bg-slate-900 rounded-2xl border border-white/20 shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-white/10 px-6 py-5 flex items-center justify-between rounded-t-2xl flex-shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-white">Extract Overall PDF</h3>
                  <p className="text-xs text-white/50 mt-0.5">
                    Select records to include — all rows will be combined into one PDF
                  </p>
                </div>
                <button
                  onClick={closePdfPanel}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {records.length === 0 ? (
                  <p className="text-white/50 text-center py-8 text-sm">No records found</p>
                ) : (
                  <>
                    {/* Select All */}
                    <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition">
                      <input
                        type="checkbox"
                        checked={selectedRecordIds.size === records.length}
                        onChange={toggleAllRecords}
                        className="w-4 h-4 rounded border-white/30 bg-white/10 text-orange-500 focus:ring-orange-500/50 accent-orange-500"
                      />
                      <span className="text-sm font-semibold text-white">
                        Select All
                        <span className="ml-2 text-xs text-white/40 font-normal">
                          ({selectedRecordIds.size}/{records.length})
                        </span>
                      </span>
                    </label>

                    <div className="h-px bg-white/10" />

                    {/* Record list */}
                    {records.map((record) => {
                      const { provider, poacCount } = getRecordSummary(record);
                      const totalRows = record.rows?.length || 0;
                      return (
                        <label
                          key={record._id}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${
                            selectedRecordIds.has(record._id)
                              ? "bg-orange-500/10 border-orange-500/30"
                              : "bg-white/[0.02] border-white/10 hover:bg-white/5"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedRecordIds.has(record._id)}
                            onChange={() => toggleRecordSelection(record._id)}
                            className="w-4 h-4 rounded border-white/30 bg-white/10 text-orange-500 focus:ring-orange-500/50 accent-orange-500"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-white block truncate">
                              {provider}
                            </span>
                            <span className="text-xs text-white/40">
                              {totalRows} POAC{totalRows !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <span className="inline-flex items-center justify-center bg-orange-500/20 text-orange-300 text-xs font-bold px-2.5 py-1 rounded-full min-w-[28px]">
                            {totalRows}
                          </span>
                        </label>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Footer */}
              {records.length > 0 && (
                <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm border-t border-white/10 px-6 py-4 flex items-center justify-between rounded-b-2xl flex-shrink-0">
                  <p className="text-xs text-white/40">
                    {selectedRecordIds.size} of {records.length} selected ·{" "}
                    {records
                      .filter((r) => selectedRecordIds.has(r._id))
                      .reduce((sum, r) => sum + (r.rows?.length || 0), 0)}{" "}
                    total rows
                  </p>
                  <button
                    onClick={handleOverallDownload}
                    disabled={downloadingOverall || selectedRecordIds.size === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingOverall ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                        </svg>
                        Download PDF
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* ── View Modal — full detail table (like Excel) ── */}
      {selectedRecord &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          >
            <div
              className="relative bg-slate-900 rounded-2xl border border-white/20 shadow-2xl w-[95vw] max-w-[1400px] mx-4 max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-white/10 px-6 py-5 flex items-center justify-between rounded-t-2xl flex-shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-white">POAC Certification Matrix Record</h3>
                  <p className="text-sm text-white/50 mt-0.5">
                    {selectedRecord.rows?.length || 0} POAC{(selectedRecord.rows?.length || 0) !== 1 ? "s" : ""} · {selectedRecord.rows?.[0]?.stsServiceProvider || "—"}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body — scrollable table (black scrollbar like HR sidebar) */}
              <div className="sidebar-scrollbar-dark min-h-0 flex-1 overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-800 text-left">
                      <th className="px-3 py-3 text-xs uppercase tracking-wider font-bold text-orange-300 border-b border-white/10 whitespace-nowrap sticky left-0 bg-slate-800 z-20 min-w-[50px]">
                        S.No
                      </th>
                      {DETAIL_COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className="px-3 py-3 text-xs uppercase tracking-wider font-bold text-orange-300 border-b border-white/10 whitespace-nowrap min-w-[120px]"
                        >
                          {col.label}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-xs uppercase tracking-wider font-bold text-orange-300 border-b border-white/10 whitespace-nowrap min-w-[120px] text-center">
                        Files
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedRecord.rows || []).map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className={`border-b border-white/5 hover:bg-white/5 transition ${
                          rowIndex % 2 === 0 ? "bg-white/[0.02]" : ""
                        }`}
                      >
                        <td className="px-3 py-3 text-white/70 font-mono text-center sticky left-0 bg-slate-900/90 z-10 border-r border-white/5">
                          {rowIndex + 1}
                        </td>
                        {DETAIL_COLUMNS.map((col) => {
                          const rawVal = row[col.key];
                          const val =
                            col.key === "visaEntries"
                              ? formatVisaForRow(row) || "—"
                              : Array.isArray(rawVal)
                                ? rawVal.length > 0
                                  ? rawVal.join(", ")
                                  : "—"
                                : rawVal || "—";
                          const isYesNo = ["Yes", "No"].includes(val);
                          const optionFile = col.fileKey ? row[col.fileKey] : null;
                          const hasFile = optionFile?.fileUrl;
                          return (
                            <td key={col.key} className="px-3 py-3 text-white whitespace-nowrap">
                              {isYesNo ? (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`inline-flex items-center justify-center text-xs font-bold px-2 py-0.5 rounded ${
                                      val === "Yes"
                                        ? "bg-emerald-500/20 text-emerald-300"
                                        : "bg-red-500/15 text-red-300"
                                    }`}
                                  >
                                    {val}
                                  </span>
                                  {val === "Yes" && hasFile && canDownload && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const a = document.createElement("a");
                                        a.href = optionFile.fileUrl;
                                        a.download = optionFile.originalFileName || "file";
                                        a.target = "_blank";
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                      }}
                                      title={`Download: ${optionFile.originalFileName || "file"}`}
                                      className="p-0.5 rounded text-sky-400 hover:text-sky-300 hover:bg-white/10 transition inline-flex"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-white/90">{val}</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-center">
                          {(() => {
                            const atts = getRowAttachments(row);
                            if (atts.length === 0) return <span className="text-slate-500 text-xs">—</span>;
                            return (
                              <div className="flex flex-col gap-1 items-center">
                                {atts.map((att, ai) =>
                                  canDownload ? (
                                    <button
                                      key={ai}
                                      type="button"
                                      onClick={() => handleDownload(att.fileUrl, att.originalFileName)}
                                      title={att.originalFileName || "Download"}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-sky-300 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 transition truncate max-w-[160px]"
                                    >
                                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                      </svg>
                                      <span className="truncate">{att.originalFileName || "File"}</span>
                                    </button>
                                  ) : (
                                    <span key={ai} className="text-[10px] text-white/40 truncate max-w-[160px]">
                                      {att.originalFileName || "File"}
                                    </span>
                                  )
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

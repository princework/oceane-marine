"use client";

import Link from "next/link";
import { useState, useEffect, useRef, forwardRef, useMemo } from "react";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import {
  getSidebarTabs,
  isFormsSubmoduleSidebarActive,
} from "@/app/operations/sts-operations/new/sidebarTabs";
import { ActionDownloadIcon } from "@/app/components/RecordActionIcons";
import {
  resolveLinkedFormFilePath,
  resolveChecklistHardcopyPath,
} from "@/lib/utils/sts-linked-form-file";
import { downloadFileFromUrl } from "@/lib/utils/sts-file-download";
import SelectField from "@/app/operations/components/OperationsSelectField";
import StsDocumentationMultiUpload from "../../StsDocumentationMultiUpload";
import {
  EquipmentOptionRow,
  buildStsEquipmentOptions,
  groupEquipmentOptions,
} from "../../stsEquipmentOptions";

const statusTone = {
  DRAFT: {
    dot: "bg-slate-500",
    pill: "bg-slate-500/80 border-slate-400/40 text-slate-100",
    option: "text-slate-100",
  },
  INPROGRESS: {
    dot: "bg-sky-600",
    pill: "bg-sky-500/80 border-sky-400/40 text-sky-100",
    option: "text-sky-100",
  },
  COMPLETED: {
    dot: "bg-emerald-600",
    pill: "bg-emerald-500/80 border-emerald-400/40 text-emerald-100",
    option: "text-emerald-100",
  },
  "Lined Up": {
    dot: "bg-amber-600",
    pill: "bg-amber-500/80 border-amber-400/40 text-amber-100",
    option: "text-amber-100",
  },
  CANCELED: {
    dot: "bg-red-600",
    pill: "bg-red-500/80 border-red-400/40 text-red-100",
    option: "text-red-100",
  },
};

export default function EditOperationPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const [status, setStatus] = useState("INPROGRESS");
  const [showStatusList, setShowStatusList] = useState(false);
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const { canEditForm, isOpsAdmin } = useOperationsRole();
  const sidebarTabs = useMemo(() => getSidebarTabs(isOpsAdmin), [isOpsAdmin]);
  const [activeTab, setActiveTab] = useState("documentation");
  const [expandedModules, setExpandedModules] = useState(new Set());
  const statusRef = useRef(null);
  const sidebarRef = useRef(null);
  const pathname = usePathname();
  const [cargoTypes, setCargoTypes] = useState([]);
  const [stsClients, setStsClients] = useState([]);
  const [stsAgents, setStsAgents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [mooringMasters, setMooringMasters] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(false);
  const [flowDir, setFlowDir] = useState("left");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const formRef = useRef(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const [operationData, setOperationData] = useState(null);
  const cycleFlowDir = () =>
    setFlowDir((d) => {
      if (d === "left") return "right";
      if (d === "right") return "both";
      return "left";
    });

  // Calculate barrels from metric tons (approximate conversion: 1 MT ≈ 7.33 barrels)
  const [quantityMT, setQuantityMT] = useState("");
  const [quantityBarrels, setQuantityBarrels] = useState("");
  const [preStsDocs, setPreStsDocs] = useState({ jpo: "", riskAssessment: "" });
  const [nearMissReports, setNearMissReports] = useState([]);
  const [riskAssessmentFileName, setRiskAssessmentFileName] = useState("");

  /* Auto-fetch Pre-STS docs (JPO, Risk Assessment, Near Miss) when location changes */
  const handleLocationChange = async (locationId) => {
    if (!locationId || locationId === "Select") {
      setPreStsDocs({ jpo: "", riskAssessment: "" });
      setRiskAssessmentFileName("");
      setNearMissReports([]);
      return;
    }
    const loc = locations.find((l) => String(l._id) === String(locationId));
    const locName = loc?.name || "";
    try {
      const params = new URLSearchParams();
      params.set("locationId", locationId);
      if (locName) params.set("locationName", locName);
      const res = await fetch(`/api/operations/sts/pre-sts-docs?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setPreStsDocs({
          jpo: json.data.jpo || "",
          riskAssessment: json.data.riskAssessment || "",
        });
        setRiskAssessmentFileName(json.data.riskAssessmentFileName || "");
        setNearMissReports(json.data.nearMissReports || []);
      }
    } catch (err) {
      console.error("Failed to fetch pre-STS docs:", err);
    }
  };

  useEffect(() => {
    if (quantityMT && !isNaN(parseFloat(quantityMT)) && parseFloat(quantityMT) > 0) {
      const barrels = (parseFloat(quantityMT) * 7.33).toFixed(2);
      setQuantityBarrels(barrels);
    } else {
      setQuantityBarrels("");
    }
  }, [quantityMT]);

  const [linkedForms, setLinkedForms] = useState([]);
  const [linkedOperationDocuments, setLinkedOperationDocuments] = useState([]);
  const [linkedFormsLoading, setLinkedFormsLoading] = useState(false);

  const fetchLinkedForms = async (opRef) => {
    if (!opRef) {
      setLinkedForms([]);
      setLinkedOperationDocuments([]);
      return;
    }
    try {
      setLinkedFormsLoading(true);
      const res = await fetch(`/api/operations/sts/linked-forms?operationRef=${encodeURIComponent(opRef)}`);
      const json = await res.json();
      if (json.success) {
        setLinkedForms(json.data || []);
        setLinkedOperationDocuments(json.documents || []);
      }
    } catch (err) {
      console.error("Failed to fetch linked forms:", err);
    } finally {
      setLinkedFormsLoading(false);
    }
  };

  useEffect(() => {
    setQuantityMT("");
    setQuantityBarrels("");
  }, [formResetKey]);

  const statuses = [
    { key: "INPROGRESS", label: "In progress" },
    { key: "COMPLETED", label: "Completed" },
    { key: "Lined Up", label: "Lined Up" },
    { key: "CANCELED", label: "Canceled" },
  ];

  useEffect(() => {
    const handler = (e) => {
      if (statusRef.current && !statusRef.current.contains(e.target)) {
        setShowStatusList(false);
      }
    };
    if (showStatusList) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showStatusList]);

  // Removed click-outside-to-close behavior - sidebar only closes on "x" button click (like QHSE module)

  // Set active tab based on pathname
  useEffect(() => {
    if (pathname === "/operations/sts-operations/new") {
      setActiveTab("documentation");
    } else if (pathname.startsWith("/operations/sts-operations/new/compatibility")) {
      setActiveTab("compatibility");
      // Don't auto-expand forms when on compatibility page
    } else if (pathname.startsWith("/operations/sts-operations/new/form-checklist")) {
      setActiveTab("forms");
      // Auto-expand forms module only when on form-checklist pages
      setExpandedModules((prev) => new Set([...prev, "forms"]));
    } else if (pathname.startsWith("/operations/sts-operations/new/locations")) {
      setActiveTab("locations");
    } else if (pathname.startsWith("/operations/sts-operations/new/cargos")) {
      setActiveTab("cargos");
    } else if (pathname.startsWith("/operations/sts-operations/new/clients-agents")) {
      setActiveTab("clientsAgents");
    } else if (pathname.startsWith("/operations/sts-operations/new/mooringmaster")) {
      setActiveTab("mooring");
    }
  }, [pathname]);

  // Fetch operation data
  useEffect(() => {
    const fetchOperation = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const response = await fetch(`/api/operations/sts/${id}`);
        const data = await response.json();

        if (data.success && data.data) {
          const op = data.data;
          setOperationData(op);
          setStatus(op.operationStatus || "INPROGRESS");
          setFlowDir(op.flowDirection || "left");
          setQuantityMT(op.quantity?.toString() || "");
          
          // Allow editing even after submission
        } else {
          alert("Operation not found");
          router.push("/operations/sts-operations/new?tab=list");
        }
      } catch (error) {
        console.error("Error fetching operation:", error);
        alert("Failed to load operation");
        router.push("/operations/sts-operations/new?tab=list");
      } finally {
        setLoading(false);
      }
    };

    fetchOperation();
  }, [id, router]);

  // Fetch master data for dynamic dropdowns
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        setLoadingMasters(true);
        const [cargoRes, clientsRes, agentsRes, locationRes, mooringRes, equipmentRes] =
          await Promise.all([
            fetch("/api/master/cargo-type/list"),
            fetch("/api/master/sts-clients/list"),
            fetch("/api/master/sts-agents/list"),
            fetch("/api/master/locations/list"),
            fetch("/api/master/mooring-master/list"),
            // PMS equipment + accessories, tagged with defect / retired state
            fetch("/api/operations/sts/equipment-options"),
          ]);

        const cargoJson = await cargoRes.json();
        const clientsJson = await clientsRes.json();
        const agentsJson = await agentsRes.json();
        const locationJson = await locationRes.json();
        const mooringJson = await mooringRes.json();
        const equipmentJson = await equipmentRes.json();

        setCargoTypes(cargoJson?.cargoTypes || []);
        setStsClients(clientsJson?.clients || []);
        setStsAgents(agentsJson?.agents || []);
        setLocations(locationJson?.locations || []);
        setMooringMasters(mooringJson?.mooringMasters || []);
        setEquipmentList(buildStsEquipmentOptions(equipmentJson));
      } catch (error) {
        console.error("Failed to load masters", error);
      } finally {
        setLoadingMasters(false);
      }
    };

    fetchMasters();
  }, []);

  const clientSelectOptions = useMemo(() => {
    const rows = stsClients.map((c) => ({ label: c.name, value: c.name }));
    const cur = operationData?.client?.trim();
    if (cur && !rows.some((r) => r.value === cur)) {
      return [{ label: `${cur} (not in master list)`, value: cur }, ...rows];
    }
    return [{ label: "Select", value: "" }, ...rows];
  }, [stsClients, operationData?.client]);

  const agentSelectOptions = useMemo(() => {
    const rows = stsAgents.map((a) => ({ label: a.name, value: a.name }));
    const cur = operationData?.agent?.trim();
    if (cur && !rows.some((r) => r.value === cur)) {
      return [{ label: `${cur} (not in master list)`, value: cur }, ...rows];
    }
    return [{ label: "Select", value: "" }, ...rows];
  }, [stsAgents, operationData?.agent]);

  // Populate form fields when operation data and form are ready
  useEffect(() => {
    if (operationData && formRef.current && !loadingMasters) {
      const op = operationData;
      
      // Basic text fields
      if (op.Operation_Ref_No) {
        const refNoInput = formRef.current.querySelector('input[name="Operation_Ref_No"]');
        if (refNoInput) refNoInput.value = op.Operation_Ref_No;
        // Fetch linked checklist/form statuses for this operation ref
        fetchLinkedForms(op.Operation_Ref_No);
      }
      if (op.chs) {
        const chsInput = formRef.current.querySelector('input[name="chs"]');
        if (chsInput) chsInput.value = op.chs;
      }
      if (op.ms) {
        const msInput = formRef.current.querySelector('input[name="ms"]');
        if (msInput) msInput.value = op.ms;
      }
      if (op.remarks) {
        const remarksInput = formRef.current.querySelector('textarea[name="remarks"]');
        if (remarksInput) remarksInput.value = op.remarks;
      }
      if (op.description) {
        const descriptionInput = formRef.current.querySelector('textarea[name="description"]');
        if (descriptionInput) descriptionInput.value = op.description;
      }

      // SelectField values come from defaultValue; still load location-dependent data
      if (op.location) {
        const locId = op.location._id || op.location;
        if (locId) handleLocationChange(locId);
      }

      // Date fields
      if (op.operationStartTime) {
        const startDate = new Date(op.operationStartTime);
        const startStr = startDate.toISOString().slice(0, 16);
        const startInput = formRef.current.querySelector('input[name="operationStartTime"]');
        if (startInput) startInput.value = startStr;
      }
      if (op.operationEndTime) {
        const endDate = new Date(op.operationEndTime);
        const endStr = endDate.toISOString().slice(0, 16);
        const endInput = formRef.current.querySelector('input[name="operationEndTime"]');
        if (endInput) endInput.value = endStr;
      }

      // Equipment checkboxes
      if (op.equipments && Array.isArray(op.equipments)) {
        op.equipments.forEach((eq) => {
          const equipmentId = eq.equipment?._id || eq.equipment;
          if (equipmentId) {
            const checkbox = formRef.current.querySelector(`input[name="equipments"][value="${equipmentId}"]`);
            if (checkbox) checkbox.checked = true;
          }
        });
      }

      // File URL fields (text-based inputs — CHS/MS upload pills & mooringPlan handled via existingFile prop)
      const fileFields = [
        "jpo", "riskAssessment", "DeclarationAtSea",
        "checklist1", "checklist2", "checklist3AB", "checklist4AF", "checklist5AC", "checklist6AB", "checklist7",
        "stsTimesheet", "standingOrder", "stsEquipChecklistPriorOps", "stsEquipChecklistAfterOps",
        "chsFeedback", "msFeedback", "hourlyChecks", "restHoursCKL", "incidentReporting"
      ];

      fileFields.forEach((field) => {
        if (op[field]) {
          const fileInput = formRef.current.querySelector(`input[name="${field}"]`);
          if (fileInput) fileInput.value = op[field];
        }
      });
    }
  }, [operationData, loadingMasters]);

  const handleSubmit = async (e, isSubmit = false) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData(formRef.current);

      // Add status - always DRAFT for draft, keep selected status for submit
      const finalStatus = isSubmit ? status : "DRAFT";
      formData.append("status", finalStatus);
      formData.append("operationStatus", finalStatus);
      
      // Mark as submitted if submit button clicked
      if (isSubmit) {
        formData.append("isSubmitted", "true");
        formData.append("submittedAt", new Date().toISOString());
      }

      // Add flow direction
      formData.append("flowDirection", flowDir);

      // Add quantity from state if available
      if (quantityMT) {
        formData.set("quantity", quantityMT);
      }

      // IDs are now in option values; drop placeholders
      const mooringMasterId = formData.get("mooringMaster");
      if (!mooringMasterId || mooringMasterId === "Select") {
        formData.delete("mooringMaster");
      }

      const locationId = formData.get("location");
      if (!locationId || locationId === "Select") {
        formData.delete("location");
      }

      const cargoId = formData.get("typeOfCargo");
      if (!cargoId || cargoId === "Select") {
        formData.delete("typeOfCargo");
      }

      // Empty/unselected enum fields must not reach the server as "" — Mongoose
      // rejects an empty string against an enum even when the field is optional.
      const operationTypeValue = formData.get("operationType");
      if (!operationTypeValue || operationTypeValue === "Select") {
        formData.delete("operationType");
      }

      // Filter out empty vessel type fields
      const vesselTypeCHS = formData.get("vesselTypeCHS");
      if (!vesselTypeCHS || vesselTypeCHS === "Select" || vesselTypeCHS === "") {
        formData.delete("vesselTypeCHS");
      }

      const vesselTypeMS = formData.get("vesselTypeMS");
      if (!vesselTypeMS || vesselTypeMS === "Select" || vesselTypeMS === "") {
        formData.delete("vesselTypeMS");
      }

      // Equipments multi-select
      const selectedEquipments = formData.getAll("equipments").filter(Boolean);
      formData.delete("equipments");
      selectedEquipments.forEach((id) => formData.append("equipments", id));

      const response = await fetch(`/api/operations/sts/${id}/update`, {
        method: "PUT",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update operation");
      }

      // Show success and redirect
      alert("STS Operation updated successfully!");
      router.push("/operations/sts-operations/new?tab=list");
    } catch (error) {
      console.error("Submission error:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-white/60">Loading operation data...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white flex"
    >
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
                                    ? "bg-white/20 text-white border-orange-400/50 shadow-md"
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
                      className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
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

      {/* Main Content - fixed left margin so content stays in place when sidebar collapses */}
      <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
        <div className={`mx-auto py-8 space-y-6 ${isSidebarOpen ? "max-w-7xl px-6" : "px-6"}`}>
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
              <p className="text-sm uppercase tracking-[0.25em] text-slate-200 font-semibold">
                STS Management System
              </p>
              <h1 className="text-xl sm:text-2xl font-bold">Edit STS Operation</h1>
            </div>
            
            {/* Right: Action Buttons */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => router.push("/operations/sts-operations/new?tab=list")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition hover:scale-110"
                aria-label="Close"
                title="Close without saving"
              >
                <span className="text-white text-xl">×</span>
              </button>
              <div
                className={`hidden items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide md:flex ${
                  statusTone[status]?.pill ||
                  "bg-white/10 border-white/10 text-white"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    statusTone[status]?.dot || "bg-white"
                  }`}
                />
                {statuses.find((s) => s.key === status)?.label || status}
              </div>
            </div>
          </header>

          <form
            ref={formRef}
            onSubmit={(e) => e.preventDefault()}
            className="rounded-3xl border border-white/10 bg-[#0b2740]/90 p-6 backdrop-blur shadow-2xl space-y-6 max-w-6xl mx-auto"
          >
            {!canEditForm && (
              <div className="mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">
                You do not have permission to edit STS operation records.
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-4">
              <StatusDropdown
                status={status}
                onSelect={(val) => {
                  setStatus(val);
                  setShowStatusList(false);
                }}
                show={showStatusList}
                setShow={setShowStatusList}
                statuses={statuses}
                ref={statusRef}
              />
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
                <span className="text-lg">⏱️</span>
                <div className="flex items-center gap-2">
                  <span>Start</span>
                  <input
                    type="datetime-local"
                    name="operationStartTime"
                    required
                    className="w-48 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span>End</span>
                  <input
                    type="datetime-local"
                    name="operationEndTime"
                    className="w-48 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  />
                </div>
              </div>
            </div>

            {/* Top-line details */}
            <div className="grid gap-4 md:grid-cols-3">
              <TextField
                label="Operation Ref No"
                placeholder="Reference number"
                name="Operation_Ref_No"
              />
              <SelectField
                  label="Type of operation"
                  name="typeOfOperation"
                  placeholder="Select type of operation"
                  options={["Ship to Ship", "POAC", "Fender Hire", "Hose hire"]}
                  defaultValue={operationData?.typeOfOperation ?? ""}
                />
              <SelectField
                label="Client"
                name="client"
                loading={loadingMasters}
                options={clientSelectOptions}
                defaultValue={operationData?.client ?? ""}
              />
              <SelectField
                label="Agent"
                name="agent"
                loading={loadingMasters}
                options={agentSelectOptions}
                defaultValue={operationData?.agent ?? ""}
              />
              <SelectField
                label="Mooring Master"
                loading={loadingMasters}
                options={(() => {
                  const currentId = operationData?.mooringMaster
                    ? String(operationData.mooringMaster._id ?? operationData.mooringMaster)
                    : "";
                  // Available masters, plus this operation's own current master
                  // (would otherwise be filtered out as ASSIGNED to itself).
                  const eligible = mooringMasters.filter(
                    (m) => m.availabilityStatus === "AVAILABLE" || String(m._id) === currentId
                  );
                  return [
                    { label: "Select", value: "" },
                    ...eligible.map((m) => ({
                      label: m.poacCompliant
                        ? m.name
                        : `${m.name} — ⚠ ${m.poacIssues?.[0] || "documents incomplete"}`,
                      value: m._id,
                      warn: !m.poacCompliant,
                    })),
                  ];
                })()}
                name="mooringMaster"
                defaultValue={
                  operationData?.mooringMaster
                    ? String(operationData.mooringMaster._id ?? operationData.mooringMaster)
                    : ""
                }
              />
              <SelectField
                label="Location"
                loading={loadingMasters}
                options={[
                  { label: "Select", value: "" },
                  ...locations.map((l) => ({ label: l.name, value: l._id })),
                ]}
                name="location"
                onChange={handleLocationChange}
                defaultValue={
                  operationData?.location
                    ? String(operationData.location._id ?? operationData.location)
                    : ""
                }
              />
              <SelectField
                label="Type of cargo"
                loading={loadingMasters}
                options={[
                  { label: "Select", value: "" },
                  ...cargoTypes.map((c) => ({ label: c.type, value: c._id })),
                ]}
                name="typeOfCargo"
                defaultValue={
                  operationData?.typeOfCargo
                    ? String(operationData.typeOfCargo._id ?? operationData.typeOfCargo)
                    : ""
                }
              />
              <SelectField
                label="Operation Type"
                name="operationType"
                placeholder="Select operation type"
                options={[
                  { label: "Select", value: "" },
                  { label: "underway", value: "underway" },
                  { label: "At Anchor", value: "At Anchor" },
                ]}
                defaultValue={operationData?.operationType ?? ""}
              />
              <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/90">
                  Quantity (MT)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={quantityMT}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty, numbers, and one decimal point
                    if (value === "" || /^\d*\.?\d*$/.test(value)) {
                      setQuantityMT(value);
                    }
                  }}
                  onWheel={(e) => e.target.blur()}
                  placeholder="Enter quantity in metric tons"
                  name="quantity"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/90">
                  Quantity (Barrels)
                </label>
                <input
                  type="text"
                  readOnly
                  value={quantityBarrels || ""}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60 cursor-not-allowed"
                  placeholder="Auto-calculated from MT"
                />
                <p className="text-xs text-white/50 mt-1">
                  Conversion: 1 MT ≈ 7.33 barrels (varies by cargo density)
                </p>
                </div>
              </div>
            </div>

            {/* CHS / MS block */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur-md shadow-inner space-y-6">
              <div className="flex items-center justify-between gap-4 ">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-200 font-bold" title="Mother Ship">
                    CHS
                  </div>
                  
                </div>
                <button
                  type="button"
                  onClick={cycleFlowDir}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/80 hover:bg-white/10 transition"
                  aria-label="Toggle direction"
                  title="Toggle flow direction"
                >
                  <ArrowIcon direction={flowDir} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/15 border border-orange-400/30 flex items-center justify-center text-orange-200 font-bold" title="Daughter Ship">
                    MS
                  </div>
                  
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-sky-400/20 bg-sky-500/5 p-4 space-y-3">
                  <TextField
                    label="CHS"
                    name="chs"
                    placeholder="Enter CHS name"
                  />
                  <SelectField
                    label="Type of Vessel (CHS)"
                    options={[
                      { label: "Select", value: "" },
                      { label: "VLCC", value: "VLCC" },
                      { label: "ULCC", value: "ULCC" },
                      { label: "Suexmax", value: "Suexmax" },
                      { label: "Aframax", value: "Aframax" },
                      { label: "panamax", value: "panamax" },
                      { label: "post-panamax", value: "post-panamax" },
                      { label: "Handysize", value: "Handysize" },
                      { label: "Capezie", value: "Capezie" },
                      { label: "Supramax", value: "Supramax" },
                    ]}
                    name="vesselTypeCHS"
                    defaultValue={operationData?.vesselTypeCHS ?? ""}
                  />
                  <TextField
                    label="LOA (CHS)"
                    name="loaCHS"
                    placeholder="Enter LOA for CHS"
                  />
                  <UploadPill
                    label="SSQ"
                    description="Ship Standard Questionnaire"
                    name="chsSSQ"
                    accent="sky"
                    resetKey={formResetKey}
                    existingFile={operationData?.chsSSQ}
                  />
                  <UploadPill
                    label="Q88"
                    description="Q88 Vessel Data"
                    name="chsQ88"
                    accent="sky"
                    resetKey={formResetKey}
                    existingFile={operationData?.chsQ88}
                  />
                  <UploadPill
                    label="Mooring Arr."
                    description="Mooring Arrangement"
                    name="chsMooringArrangement"
                    accent="sky"
                    resetKey={formResetKey}
                    existingFile={operationData?.chsMooringArrangement}
                  />
                  <UploadPill
                    label="GA Plan"
                    description="General Arrangement Plan"
                    name="chsGAPlan"
                    accent="sky"
                    resetKey={formResetKey}
                    existingFile={operationData?.chsGAPlan}
                  />
                  <UploadPill
                    label="MSDS"
                    description="Material Safety Data Sheet"
                    name="chsMSDS"
                    accent="sky"
                    resetKey={formResetKey}
                    existingFile={operationData?.chsMSDS}
                  />
                  <UploadPill
                    label="Indemnity"
                    description="Indemnity Document"
                    name="chsIndemnity"
                    accent="sky"
                    resetKey={formResetKey}
                    existingFile={operationData?.chsIndemnity}
                  />
                </div>

                <div className="rounded-2xl border border-orange-400/20 bg-orange-500/5 p-4 space-y-3">
                  <TextField
                    label="MS"
                    name="ms"
                    placeholder="Enter MS name"
                  />
                  <SelectField
                    label="Type of Vessel (MS)"
                    options={[
                      { label: "Select", value: "" },
                      { label: "VLCC", value: "VLCC" },
                      { label: "ULCC", value: "ULCC" },
                      { label: "Suexmax", value: "Suexmax" },
                      { label: "Aframax", value: "Aframax" },
                      { label: "panamax", value: "panamax" },
                      { label: "post-panamax", value: "post-panamax" },
                      { label: "Handysize", value: "Handysize" },
                      { label: "Capezie", value: "Capezie" },
                      { label: "Supramax", value: "Supramax" },
                    ]}
                    name="vesselTypeMS"
                    defaultValue={operationData?.vesselTypeMS ?? ""}
                  />
                  <TextField
                    label="LOA (MS)"
                    name="loaMS"
                    placeholder="Enter LOA for MS"
                  />
                  <UploadPill
                    label="SSQ"
                    description="Ship Standard Questionnaire"
                    name="msSSQ"
                    accent="orange"
                    resetKey={formResetKey}
                    existingFile={operationData?.msSSQ}
                  />
                  <UploadPill
                    label="Q88"
                    description="Q88 Vessel Data"
                    name="msQ88"
                    accent="orange"
                    resetKey={formResetKey}
                    existingFile={operationData?.msQ88}
                  />
                  <UploadPill
                    label="Mooring Arr."
                    description="Mooring Arrangement"
                    name="msMooringArrangement"
                    accent="orange"
                    resetKey={formResetKey}
                    existingFile={operationData?.msMooringArrangement}
                  />
                  <UploadPill
                    label="GA Plan"
                    description="General Arrangement Plan"
                    name="msGAPlan"
                    accent="orange"
                    resetKey={formResetKey}
                    existingFile={operationData?.msGAPlan}
                  />
                  <UploadPill
                    label="MSDS"
                    description="Material Safety Data Sheet"
                    name="msMSDS"
                    accent="orange"
                    resetKey={formResetKey}
                    existingFile={operationData?.msMSDS}
                  />
                  <UploadPill
                    label="Indemnity"
                    description="Indemnity Document"
                    name="msIndemnity"
                    accent="orange"
                    resetKey={formResetKey}
                    existingFile={operationData?.msIndemnity}
                  />
                </div>
              </div>
            </div>

            {/* Pre-STS documents */}
            <SectionTitle title="Pre-STS Documents" />
            <div className="grid gap-4 md:grid-cols-3">
              <ActionUpload
                label="Joint Plan Operation"
                name="jpo"
                resetKey={formResetKey}
                defaultValue={operationData?.jpo}
                externalValue={preStsDocs.jpo}
                onClear={() => setPreStsDocs((prev) => ({ ...prev, jpo: "" }))}
              />
              <ActionUpload
                label="Risk Assessment"
                name="riskAssessment"
                resetKey={formResetKey}
                defaultValue={operationData?.riskAssessment}
                externalValue={preStsDocs.riskAssessment}
                downloadFileName={riskAssessmentFileName}
                onClear={() => {
                  setPreStsDocs((prev) => ({ ...prev, riskAssessment: "" }));
                  setRiskAssessmentFileName("");
                }}
              />
              <UploadPill
                label="Mooring Plan"
                description="Upload mooring plan document"
                name="mooringPlan"
                accent="sky"
                resetKey={formResetKey}
                existingFile={operationData?.mooringPlan}
              />
            </div>


            {/* QHSE – Near Miss Reports for this location */}
            {nearMissReports.length > 0 && (
              <>
                <SectionTitle title={`Near Miss / Incident Reports — QHSE (${nearMissReports.length})`} />
                <div className="rounded-2xl border border-red-500/30 bg-red-900/10 p-4 space-y-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                          <th className="py-2 pr-4">Form Code</th>
                          <th className="py-2 pr-4">Job Ref #</th>
                          <th className="py-2 pr-4">Vessel</th>
                          <th className="py-2 pr-4">Date / Time</th>
                          <th className="py-2 pr-4">Type</th>
                          <th className="py-2 pr-4">Area</th>
                          <th className="py-2 pr-4">Observer</th>
                          <th className="py-2 pr-4">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nearMissReports.map((nm) => (
                          <tr key={nm._id} className="border-b border-white/5 hover:bg-white/5 transition">
                            <td className="py-2 pr-4 font-mono text-red-300">{nm.formCode || "—"}</td>
                            <td className="py-2 pr-4 text-sky-300 font-semibold">{nm.JobRefNo || "—"}</td>
                            <td className="py-2 pr-4 text-white/80">{nm.VesselName || "—"}</td>
                            <td className="py-2 pr-4 text-white/70">
                              {nm.timeOfIncident
                                ? new Date(nm.timeOfIncident).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
                                : "—"}
                            </td>
                            <td className="py-2 pr-4">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                nm.TypeOfReporting === "Near Miss" ? "bg-yellow-500/20 text-yellow-300" :
                                nm.TypeOfReporting === "Best Practice" ? "bg-emerald-500/20 text-emerald-300" :
                                "bg-red-500/20 text-red-300"
                              }`}>
                                {nm.TypeOfReporting || "—"}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-white/70 text-xs">{nm.AreaOfNearMiss || "—"}</td>
                            <td className="py-2 pr-4 text-white/70 text-xs">{nm.NameOfObserver || "—"}</td>
                            <td className="py-2 pr-4">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                nm.status === "Reviewed" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                              }`}>
                                {nm.status || "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ═══════════════════════════════════════════
                LINKED FORMS — auto-populated from DB
            ═══════════════════════════════════════════ */}

            {/* Checklists */}
            <SectionTitle title="Checklists" />
            {linkedFormsLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400" />
                Loading linked forms…
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                {linkedForms.filter((f) => f.category === "checklist").map((f) => (
                  <LinkedFormCard key={f.formCode} form={f} operationDocuments={linkedOperationDocuments} />
                ))}
              </div>
            )}

            {/* STS Equipment */}
            <SectionTitle title="STS Equipment" />
            {linkedFormsLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400" />
                Loading…
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                {linkedForms.filter((f) => f.category === "equipment").map((f) => (
                  <LinkedFormCard key={f.formCode} form={f} operationDocuments={linkedOperationDocuments} />
                ))}
              </div>
            )}

            {/* Feedback & Logs */}
            <SectionTitle title="Feedback & Logs" />
            {linkedFormsLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400" />
                Loading…
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                {linkedForms.filter((f) => f.category === "feedback").map((f) => (
                  <LinkedFormCard key={f.formCode} form={f} operationDocuments={linkedOperationDocuments} />
                ))}
                {/* Incident Reporting — no linked form, manual entry */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-orange-300">Incident Reporting</span>
                  </div>
                  <input
                    type="text"
                    name="incidentReporting"
                    defaultValue={operationData?.incidentReporting || ""}
                    placeholder="Enter file URL/path"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                  />
                </div>
              </div>
            )}

            {/* Equipment / Remarks */}
            <SectionTitle title="Equipment & Remarks" />
            <div className="grid gap-6 md:grid-cols-2">
              <MultiSelectDropdown
                label="Equipment Used"
                loading={loadingMasters}
                name="equipments"
                options={equipmentList}
                resetKey={formResetKey}
                initialSelected={operationData?.equipments?.map((eq) => {
                  const eqId = eq.equipment?._id || eq.equipment;
                  return eqId ? String(eqId) : null;
                }).filter(Boolean) || []}
              />
              <TextAreaField
                label="Remarks"
                placeholder="Add remarks..."
                name="remarks"
              />
            </div>
            <TextAreaField
              label="Description"
              placeholder="Other details from the nomination with no field of their own — vessel flag, cargo grade, capacities, requested support, permits, etc."
              name="description"
            />

            <StsDocumentationMultiUpload
              key={`${operationData?._id || "op"}-docs`}
              existingDocuments={operationData?.documents}
            />

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  router.push("/operations/sts-operations/new?tab=list");
                }}
                className="px-6 py-3 rounded-xl border border-white/20 bg-white/5 text-white hover:bg-white/10 transition"
              >
                Cancel
              </button>
              {canEditForm && (
                <>
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e, false)}
                    disabled={submitting}
                    className="px-6 py-3 rounded-xl border border-blue-400/30 bg-blue-500/20 text-blue-300 font-semibold hover:bg-blue-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Saving..." : "Save as Draft"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e, true)}
                    disabled={submitting}
                    className="px-6 py-3 rounded-xl bg-orange-500 text-white font-semibold shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title }) {
  return (
    <div className="flex items-center gap-3">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <div className="flex-1 border-t border-white/10" />
    </div>
  );
}

const StatusDropdown = forwardRef(function StatusDropdown(
  { status, onSelect, show, setShow, statuses },
  ref
) {
  const active = statuses.find((s) => s.key === status);
  const tone = statusTone[status] || {
    dot: "bg-white",
    pill: "bg-white/10 border-white/10 text-white",
    option: "text-white",
  };
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShow((v) => !v)}
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide border hover:bg-white/15 transition ${tone.pill}`}
      >
        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
        {active?.label || status}
        <span className="text-white/80 text-base leading-none">▾</span>
      </button>
      {show && (
        <div className="absolute left-0 top-full z-30 mt-2 w-40 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-xl">
          <div className="p-2 space-y-1">
            {statuses.map((item) => (
              <button
                key={item.key}
                onClick={() => onSelect(item.key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                  item.key === status
                    ? `${
                        statusTone[item.key]?.pill || "bg-white/10 text-white"
                      }`
                    : `${
                        statusTone[item.key]?.option || "text-white"
                      } hover:bg-white/10`
                }`}
              >
                <span
                  className={`mr-2 inline-block h-2 w-2 rounded-full ${
                    statusTone[item.key]?.dot || "bg-white"
                  }`}
                />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

function Label({ children }) {
  return (
    <label className="block text-sm font-semibold text-white/80 mb-2">
      {children}
    </label>
  );
}

function BaseInput({ children }) {
  return (
    <div className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus-within:ring-2 focus-within:ring-orange-500/40 focus-within:border-orange-500/40 transition">
      {children}
    </div>
  );
}

function TextField({ label, placeholder, name, readOnly }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <BaseInput>
        <input
          type="text"
          name={name}
          readOnly={readOnly}
          className={`w-full bg-transparent outline-none ${readOnly ? "cursor-default text-white/90" : ""}`}
          placeholder={placeholder}
          title={readOnly ? "Reference number cannot be changed" : undefined}
        />
      </BaseInput>
    </div>
  );
}

function NumberField({ label, placeholder, name, allowDecimals = true }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <BaseInput>
        <input
          type="text"
          inputMode="decimal"
          name={name}
          className="w-full bg-transparent outline-none"
          placeholder={placeholder}
          onWheel={(e) => e.target.blur()}
          onChange={(e) => {
            const value = e.target.value;
            // Allow empty, numbers, and optionally one decimal point
            const pattern = allowDecimals ? /^\d*\.?\d*$/ : /^\d*$/;
            if (value === "" || pattern.test(value)) {
              e.target.value = value;
            } else {
              e.target.value = e.target.value.slice(0, -1);
            }
          }}
        />
      </BaseInput>
    </div>
  );
}

function DateField({ label, name }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <BaseInput>
        <input
          type="date"
          name={name}
          className="w-full bg-transparent outline-none"
        />
      </BaseInput>
    </div>
  );
}

function FileField({ name, resetKey, defaultValue }) {
  const [fileUrl, setFileUrl] = useState(defaultValue || "");
  const inputRef = useRef(null);

  useEffect(() => {
    if (resetKey === 0 && defaultValue) {
      setFileUrl(defaultValue);
    } else if (resetKey > 0) {
      setFileUrl("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    }
  }, [resetKey, defaultValue]);

  return (
    <div className="w-full text-sm text-white/80">
      <div className="flex items-center gap-2">
      <input
        ref={inputRef}
          type="text"
        name={name}
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="Enter file URL/path"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
        />
        {fileUrl && (
          <ActionDownloadIcon
            onClick={() => fileUrl && downloadFileFromUrl(fileUrl)}
            title="Download file"
            className="!rounded-xl !p-3"
          />
        )}
      </div>
    </div>
  );
}

function UploadPill({ label, description, name, accent = "sky", resetKey, existingFile }) {
  const [fileName, setFileName] = useState("");
  const [existing, setExisting] = useState(existingFile || "");
  const inputRef = useRef(null);

  useEffect(() => {
    if (existingFile) {
      setExisting(existingFile);
    }
  }, [existingFile]);

  useEffect(() => {
    if (resetKey > 0) {
      setFileName("");
      setExisting("");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }, [resetKey]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setExisting(""); // New file replaces existing
    } else {
      setFileName("");
    }
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setFileName("");
    setExisting("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const borderColor =
    accent === "orange"
      ? "border-orange-400/40"
      : "border-sky-400/40";
  const accentBg =
    accent === "orange"
      ? "bg-orange-500/10"
      : "bg-sky-500/10";
  const accentText =
    accent === "orange"
      ? "text-orange-300"
      : "text-sky-300";
  const btnBg =
    accent === "orange"
      ? "bg-orange-500/20 hover:bg-orange-500/30 text-orange-200"
      : "bg-sky-500/20 hover:bg-sky-500/30 text-sky-200";

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label row */}
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold ${accentText}`}>{label}</span>
        {description && (
          <span className="text-xs text-white/40">— {description}</span>
        )}
      </div>

      {/* Hidden input to preserve existing file path when no new file uploaded */}
      {existing && !fileName && (
        <input type="hidden" name={`${name}_existing`} value={existing} />
      )}

      {/* Show existing file if available and no new file chosen */}
      {existing && !fileName ? (
        <div className={`flex flex-wrap items-center gap-2 rounded-xl border ${borderColor} ${accentBg} px-3 py-2`}>
          <span className="text-emerald-300 text-xs">✓</span>
          <span className="min-w-0 flex-1 text-sm text-white/70 truncate">
            {existing.split("/").pop() || "Uploaded file"}
          </span>
          <ActionDownloadIcon
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (existing) downloadFileFromUrl(existing);
            }}
            title="Download file"
            className="!p-1.5 shrink-0"
          />
          <label className={`cursor-pointer shrink-0 rounded-lg px-2 py-1 text-xs font-semibold transition ${btnBg}`}>
            Replace file
            <input
              ref={inputRef}
              type="file"
              name={name}
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
            />
          </label>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-red-400 hover:text-red-300 text-sm font-bold px-1"
            title="Remove file"
          >
            ✕
          </button>
        </div>
      ) : (
        /* Upload area */
        <div className={`flex flex-wrap items-center gap-2 rounded-xl border ${borderColor} ${accentBg} px-3 py-2`}>
          <label
            className={`cursor-pointer shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${btnBg}`}
          >
            Upload file
            <input
              ref={inputRef}
              type="file"
              name={name}
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
            />
          </label>
          <span className="min-w-0 flex-1 text-sm text-white/60 truncate">
            {fileName || "No file chosen"}
          </span>
          {fileName && (
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 text-red-400 hover:text-red-300 text-sm font-bold px-1"
              title="Remove file"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ActionUpload({
  label,
  name,
  resetKey,
  defaultValue,
  externalValue,
  onClear,
  downloadFileName = "",
}) {
  const resolveDownloadLabel = (url) =>
    downloadFileName?.trim() ||
    (url ? url.split("/").pop()?.split("?")[0] : "") ||
    "document";

  const handleDownload = (url) => {
    if (!url) return;
    downloadFileFromUrl(url, resolveDownloadLabel(url));
  };
  const [fileUrl, setFileUrl] = useState("");
  const [isAutoFetched, setIsAutoFetched] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [userDismissed, setUserDismissed] = useState(false);
  const lastExternalRef = useRef("");
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (resetKey > 0) {
      setFileUrl("");
      setIsAutoFetched(false);
      setUploadedFileName("");
      setUserDismissed(false);
      lastExternalRef.current = "";
      if (inputRef.current) inputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      const initial = defaultValue || "";
      setFileUrl(initial);
      setIsAutoFetched(false);
      setUploadedFileName("");
      setUserDismissed(false);
      if (inputRef.current) inputRef.current.value = initial;
    }
  }, [resetKey, defaultValue]);

  useEffect(() => {
    if (externalValue !== undefined && externalValue !== null && externalValue !== "") {
      const changed = externalValue !== lastExternalRef.current;
      lastExternalRef.current = externalValue;
      if (changed) setUserDismissed(false);
      if (!userDismissed || changed) {
        setFileUrl(externalValue);
        setIsAutoFetched(true);
        setUploadedFileName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } else if (externalValue === "") {
      lastExternalRef.current = "";
      if (isAutoFetched) {
        setFileUrl(defaultValue || "");
        setIsAutoFetched(false);
      }
    }
  }, [externalValue, defaultValue, isAutoFetched, userDismissed]);

  const handleDismiss = (e) => {
    e.preventDefault();
    setUserDismissed(true);
    setFileUrl("");
    setIsAutoFetched(false);
    setUploadedFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClear?.();
  };

  const handleRestore = () => {
    const val = lastExternalRef.current || externalValue || defaultValue;
    if (!val) return;
    setUserDismissed(false);
    setFileUrl(val);
    setIsAutoFetched(!!(lastExternalRef.current || externalValue));
    setUploadedFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      setUserDismissed(false);
    }
  };

  const handleClearUpload = (e) => {
    e.preventDefault();
    setUploadedFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const linkedFileAvailable =
    !!(lastExternalRef.current || (externalValue && externalValue !== ""));

  return (
    <div className="flex flex-col gap-2">
      <label className="block text-sm font-medium text-white/90">{label}</label>

      {!uploadedFileName && <input type="hidden" name={name} value={fileUrl} />}

      <input
        ref={fileInputRef}
        type="file"
        name={`${name}File`}
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
        onChange={handleFileUpload}
      />

      {uploadedFileName ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-3">
            <span className="text-sky-300 text-sm truncate">📄 {uploadedFileName}</span>
          </div>
          {fileUrl && (
            <ActionDownloadIcon
              onClick={() => handleDownload(fileUrl)}
              title="Download previous file"
              className="!rounded-xl !p-3"
            />
          )}
          <button
            type="button"
            onClick={handleClearUpload}
            className="px-3 py-3 rounded-xl bg-red-500/20 text-red-300 text-sm font-semibold hover:bg-red-500/30 transition"
            title="Cancel this upload"
          >
            ✕
          </button>
        </div>
      ) : fileUrl ? (
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`flex min-w-[12rem] flex-1 items-center gap-2 rounded-xl border px-4 py-3 ${
              isAutoFetched
                ? "border-emerald-400/30 bg-emerald-500/10"
                : "border-white/10 bg-white/5"
            }`}
          >
            <span
              className={`text-sm font-medium ${isAutoFetched ? "text-emerald-300" : "text-white/80"}`}
            >
              {isAutoFetched ? "✓ File linked from location" : "✓ File attached"}
            </span>
          </div>
          <ActionDownloadIcon
            onClick={() => handleDownload(fileUrl)}
            title="Download file"
            className="!rounded-xl !p-3"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-3 rounded-xl bg-sky-500/20 text-sky-300 text-xs font-semibold hover:bg-sky-500/30 transition whitespace-nowrap"
            title="Replace with a new file from your computer"
          >
            Replace file
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3 py-3 rounded-xl bg-red-500/20 text-red-300 text-sm font-semibold hover:bg-red-500/30 transition"
            title="Remove link"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="Enter file URL/path"
              className="min-w-[10rem] flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 rounded-xl bg-sky-500/20 px-4 py-3 text-xs font-semibold text-sky-200 hover:bg-sky-500/30 transition whitespace-nowrap"
            >
              Upload file
            </button>
            {fileUrl && (
              <ActionDownloadIcon
                onClick={() => fileUrl && downloadFileFromUrl(fileUrl)}
                title="Download file"
                className="!rounded-xl !p-3"
              />
            )}
          </div>
          {userDismissed && linkedFileAvailable && (
            <button
              type="button"
              onClick={handleRestore}
              className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Restore linked file
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LinkedFormCard({ form, operationDocuments = [] }) {
  const { formCode, label, filled, count, docs } = form;
  const latestDoc = docs?.[0];
  const hardcopyPath = resolveChecklistHardcopyPath(operationDocuments, formCode);
  const systemPath =
    filled && latestDoc
      ? resolveLinkedFormFilePath(operationDocuments, formCode, latestDoc._id)
      : null;
  const filePath = systemPath || hardcopyPath;
  const hasHardcopyOnly = Boolean(hardcopyPath && !systemPath);

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        filled
          ? "border-emerald-500/30 bg-emerald-900/10 hover:bg-emerald-900/20"
          : hasHardcopyOnly
            ? "border-amber-500/35 bg-amber-900/10 hover:bg-amber-900/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-orange-300 truncate">{formCode}</p>
          <p className="text-sm font-semibold text-white truncate">{label}</p>
        </div>
        <span
          className={`flex-shrink-0 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
            filled
              ? "bg-emerald-500/20 text-emerald-300"
              : hasHardcopyOnly
                ? "bg-amber-500/20 text-amber-200"
                : "bg-slate-500/20 text-slate-400"
          }`}
        >
          {filled ? `Filled (${count})` : hasHardcopyOnly ? "Hardcopy" : "Pending"}
        </span>
      </div>

      {(filled && latestDoc) || filePath ? (
        <div className="mt-2 space-y-1 text-[11px] text-white/60">
          {filled && latestDoc && (
            <>
              <p>Seq: <span className="text-sky-300 font-mono">{latestDoc.sequenceNumber || "—"}</span></p>
              <p>Status: <span className={
                latestDoc.status === "SUBMITTED" || latestDoc.status === "APPROVED"
                  ? "text-emerald-300" : "text-amber-300"
              }>{latestDoc.status}</span></p>
              <p>Date: {latestDoc.createdAt
                ? new Date(latestDoc.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                : "—"}</p>
            </>
          )}
          {hasHardcopyOnly && (
            <p className="text-amber-200/90">
              Physical hardcopy uploaded — no digital submission yet.
            </p>
          )}
          <p className="mt-1">
            File:{" "}
            <span className={filePath ? "text-emerald-400 font-medium" : "text-white/50"}>
              {filePath ? "Yes" : "No"}
            </span>
          </p>
          {filePath && (
            <button
              type="button"
              onClick={() => downloadFileFromUrl(filePath, `${formCode || "form"}-${(filePath.split("/").pop() || "file")}`)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-orange-400/40 bg-orange-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-orange-200 hover:bg-orange-500/25 transition"
              title="Download file"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FileRow({ label, name, resetKey, defaultValue }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-white/90">{label}</label>
      <FileField name={name} resetKey={resetKey} defaultValue={defaultValue} />
    </div>
  );
}

function TextAreaField({ label, placeholder, name }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <textarea
        name={name}
        rows={4}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
        placeholder={placeholder}
      />
    </div>
  );
}

function MultiSelectDropdown({
  label,
  options = [],
  loading = false,
  name,
  resetKey,
  initialSelected = [],
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(initialSelected || []);

  const toggle = (val) => {
    setSelected((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  // Mixed inventory — group headers keep primary equipment and accessories
  // readable in one list.
  const groupedOptions = groupEquipmentOptions(options);

  const summaryLabel = (() => {
    if (selected.length) {
      const selectedLabels = selected
        .map((val) => options.find((opt) => opt.value === val)?.label)
        .filter(Boolean);
      return selectedLabels.join(", ") || `${selected.length} selected`;
    }
    if (loading) return "Loading...";
    return "Select equipment";
  })();

  useEffect(() => {
    if (resetKey === 0 && initialSelected.length > 0) {
      setSelected(initialSelected);
    } else if (resetKey > 0) {
      setSelected([]);
    }
  }, [resetKey, initialSelected]);

  return (
    <div className="space-y-2 relative">
      <Label>{label}</Label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400/60 transition"
        >
          <span className="truncate">{summaryLabel}</span>
          <svg
            className={`h-4 w-4 text-orange-300 transition ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {open && (
          <div className="absolute z-30 mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur shadow-2xl max-h-64 overflow-y-auto">
            {loading && (
              <div className="px-4 py-3 text-sm text-white/70">Loading...</div>
            )}
            {!loading && !options.length && (
              <div className="px-4 py-3 text-sm text-white/60">
                No equipment found in PMS
              </div>
            )}
            {!loading &&
              groupedOptions.map(({ group, items }) => (
                <div key={group}>
                  {group && (
                    <p className="sticky top-0 bg-slate-900/95 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-300/80">
                      {group}
                    </p>
                  )}
                  {items.map((opt) => (
                    <EquipmentOptionRow
                      key={opt.value}
                      option={opt}
                      checked={selected.includes(opt.value)}
                      onToggle={() => toggle(opt.value)}
                    />
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>
      {/* Hidden inputs for form submission */}
      {selected.map((val) => (
        <input key={val} type="hidden" name={name} value={val} />
      ))}
    </div>
  );
}

function ArrowIcon({ direction = "left" }) {
  if (direction === "both") {
    return (
      <svg
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        viewBox="0 0 200 200"
      >
        <path
          d="M120 40 L60 100 L120 160"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M80 40 L140 100 L80 160"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1="60" y1="100" x2="140" y2="100" strokeLinecap="round" />
      </svg>
    );
  }
  const isLeft = direction === "left";
  return (
    <svg
      className={`h-6 w-6 ${isLeft ? "" : "rotate-180"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="10"
      viewBox="0 0 200 200"
    >
      <path
        d="M120 40 L60 100 L120 160"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="60" y1="100" x2="180" y2="100" strokeLinecap="round" />
    </svg>
  );
}

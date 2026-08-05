"use client";

import Link from "next/link";
import { useState, useEffect, useRef, forwardRef, useCallback, useMemo, useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOperationsSidebar } from "../../OperationsSidebarContext";
import { getExportColumns, buildExportHeaders, buildExportRow } from "./sts-export-columns";
import {
  ActionViewIcon,
  ActionEditIcon,
  ActionDeleteIcon,
  ActionDownloadIcon,
} from "@/app/components/RecordActionIcons";
import {
  resolveLinkedFormFilePath,
  resolveChecklistHardcopyPath,
} from "@/lib/utils/sts-linked-form-file";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import {
  getSidebarTabs,
  isFormsSubmoduleSidebarActive,
} from "@/app/operations/sts-operations/new/sidebarTabs";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import SelectField from "@/app/operations/components/OperationsSelectField";
import StsDocumentationMultiUpload from "./StsDocumentationMultiUpload";
import ImportFromEmailButton from "./ImportFromEmailButton";
import { downloadFileFromUrl } from "@/lib/utils/sts-file-download";
import { readJsonFromResponse } from "@/lib/utils/readJsonFromResponse";
import {
  EquipmentOptionRow,
  buildStsEquipmentOptions,
  groupEquipmentOptions,
} from "./stsEquipmentOptions";

const STS_NEW_OP_DRAFT_STORAGE_KEY = "sts-operation-new-documentation-draft-v2";

function clearStsNewOpDraft(snapshotRef) {
  try {
    sessionStorage.removeItem(STS_NEW_OP_DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (snapshotRef) snapshotRef.current = null;
}

function readStsNewOpDraft() {
  try {
    const raw = sessionStorage.getItem(STS_NEW_OP_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStsNewOpDraft(payload) {
  try {
    sessionStorage.setItem(STS_NEW_OP_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

function collectFormFieldSnapshot(form) {
  const fields = {};
  const equipments = [];
  if (!form) return { fields, equipments };
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === "file") continue;
    if (el.type === "radio" && !el.checked) continue;
    if (el.type === "checkbox") continue;
    if (el.name === "equipments" && el.type === "hidden") {
      equipments.push(String(el.value));
      continue;
    }
    fields[el.name] = el.value;
  }
  return { fields, equipments };
}

const nativeInputValueSetter = typeof window !== "undefined"
  ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  : null;
const nativeSelectValueSetter = typeof window !== "undefined"
  ? Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set
  : null;
const nativeTextareaValueSetter = typeof window !== "undefined"
  ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set
  : null;

function applyFieldsToForm(form, fields, skipNames) {
  if (!form || !fields) return;
  const skip = skipNames || new Set();
  for (const [name, value] of Object.entries(fields)) {
    if (skip.has(name)) continue;
    if (value === undefined || value === null) continue;
    const str = String(value);
    let els;
    try {
      els = form.querySelectorAll(`[name="${CSS.escape(name)}"]`);
    } catch {
      continue;
    }
    els.forEach((el) => {
      if (el.disabled || el.type === "file") return;
      if (el.type === "checkbox") return;
      if (el.name === "equipments" && el.type === "hidden") return;
      if (!("value" in el)) return;
      const setter =
        el instanceof HTMLSelectElement ? nativeSelectValueSetter :
        el instanceof HTMLTextAreaElement ? nativeTextareaValueSetter :
        nativeInputValueSetter;
      if (setter) {
        setter.call(el, str);
      } else {
        el.value = str;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
}

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

function DocumentationPageShell({ children }) {
  return (
    <div className="relative min-h-screen w-full text-white">
      <div className="relative z-10 min-h-screen w-full">{children}</div>
    </div>
  );
}

export default function NewOperationPage() {
  const [status, setStatus] = useState("INPROGRESS");
  const [showStatusList, setShowStatusList] = useState(false);
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const [activeTab, setActiveTab] = useState("documentation");
  const [expandedModules, setExpandedModules] = useState(new Set());
  const statusRef = useRef(null);
  const sidebarRef = useRef(null);
  const pathname = usePathname();
  const { canCreateForm, canEditForm, canDeleteForm, isOpsAdmin } = useOperationsRole();
  const sidebarTabs = useMemo(() => getSidebarTabs(isOpsAdmin), [isOpsAdmin]);
  const [cargoTypes, setCargoTypes] = useState([]);
  const [stsClients, setStsClients] = useState([]);
  const [stsAgents, setStsAgents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [mooringMasters, setMooringMasters] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [flowDir, setFlowDir] = useState("left");
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const draftRestoreDoneRef = useRef(false);
  const allowClientDraftPersistRef = useRef(false);
  const saveDraftTimerRef = useRef(null);
  const autosaveUiHideTimerRef = useRef(null);
  const lastDraftSnapshotRef = useRef(null);
  const persistDraftFnRef = useRef(null);
  const actionUploadDraftUrlsRef = useRef({ jpo: "", riskAssessment: "" });
  /** hidden | saving | saved — local draft autosave indicator (Create tab) */
  const [draftAutosaveUi, setDraftAutosaveUi] = useState("hidden");
  const [equipmentDraftEpoch, setEquipmentDraftEpoch] = useState(0);
  const [restoredEquipmentIds, setRestoredEquipmentIds] = useState([]);
  const [actionUploadDraftEpoch, setActionUploadDraftEpoch] = useState(0);
  const [showSuccessPage, setShowSuccessPage] = useState(false);
  const [createdOperationId, setCreatedOperationId] = useState(null);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeViewTab, setActiveViewTab] = useState(() => {
    return tabParam === "list" ? "list" : "create";
  });

  useEffect(() => {
    if (tabParam === "list") {
      setActiveViewTab("list");
      setShowSuccessPage(false);
    }
  }, [tabParam]);

  const cycleFlowDir = () =>
    setFlowDir((d) => {
      if (d === "left") return "right";
      if (d === "right") return "both";
      return "left";
    });

  // Calculate barrels from metric tons (approximate conversion: 1 MT ≈ 7.33 barrels)
  const [quantityMT, setQuantityMT] = useState("");
  const [quantityBarrels, setQuantityBarrels] = useState("");
  const [operationRef, setOperationRef] = useState("");
  const [generatingRef, setGeneratingRef] = useState(false);
  const [preStsDocs, setPreStsDocs] = useState({ jpo: "", riskAssessment: "" });
  const [nearMissReports, setNearMissReports] = useState([]);
  const [riskAssessmentFileName, setRiskAssessmentFileName] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedOperationType, setSelectedOperationType] = useState("");
  const [selectedMooringMasterId, setSelectedMooringMasterId] = useState("");
  const [selectedTypeOfCargoId, setSelectedTypeOfCargoId] = useState("");
  const [selectedTypeOfOperation, setSelectedTypeOfOperation] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedVesselTypeCHS, setSelectedVesselTypeCHS] = useState("");
  const [selectedVesselTypeMS, setSelectedVesselTypeMS] = useState("");
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState([]);

  const resetStsSelectFields = useCallback(() => {
    setSelectedLocationId("");
    setSelectedOperationType("");
    setSelectedMooringMasterId("");
    setSelectedTypeOfCargoId("");
    setSelectedTypeOfOperation("");
    setSelectedClient("");
    setSelectedAgent("");
    setSelectedVesselTypeCHS("");
    setSelectedVesselTypeMS("");
    setSelectedEquipmentIds([]);
    setPreStsDocs({ jpo: "", riskAssessment: "" });
    setRiskAssessmentFileName("");
    setNearMissReports([]);
  }, []);

  /* Auto-fetch Pre-STS docs (JPO, Risk Assessment, Near Miss) when location changes */
  const handleLocationChange = useCallback(async (locationId) => {
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
  }, [locations]);

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

  // Fetch linked form statuses whenever the operation ref changes
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
    fetchLinkedForms(operationRef);
  }, [operationRef]);

  useEffect(() => {
    setQuantityMT("");
    setQuantityBarrels("");
    setOperationRef("");
  }, [formResetKey]);

  const handleGenerateOperationRef = async () => {
    try {
      setGeneratingRef(true);
      const response = await fetch("/api/operations/sts/generate-ref");
      const data = await response.json();

      if (data.success && data.operationRef) {
        setOperationRef(data.operationRef);
      } else {
        throw new Error(data.error || "Failed to generate operation ref");
      }
    } catch (error) {
      console.error("Error generating operation ref:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setGeneratingRef(false);
    }
  };

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

  const persistStsNewOpDraftNow = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!allowClientDraftPersistRef.current) return;
    if (!formRef.current || activeViewTab !== "create" || showSuccessPage) return;

    const { fields: rawFields, equipments } = collectFormFieldSnapshot(
      formRef.current
    );
    const fields = {
      ...rawFields,
      Operation_Ref_No: operationRef,
      quantity: quantityMT,
      location: selectedLocationId || rawFields.location || "",
      operationType: selectedOperationType || rawFields.operationType || "",
      mooringMaster: selectedMooringMasterId || rawFields.mooringMaster || "",
      typeOfCargo: selectedTypeOfCargoId || rawFields.typeOfCargo || "",
      typeOfOperation: selectedTypeOfOperation || rawFields.typeOfOperation || "",
      client: selectedClient || rawFields.client || "",
      agent: selectedAgent || rawFields.agent || "",
      vesselTypeCHS: selectedVesselTypeCHS || rawFields.vesselTypeCHS || "",
      vesselTypeMS: selectedVesselTypeMS || rawFields.vesselTypeMS || "",
    };
    const hasData =
      (quantityMT && String(quantityMT).trim() !== "") ||
      (operationRef && String(operationRef).trim() !== "") ||
      equipments.length > 0 ||
      Object.keys(fields).some((k) => String(fields[k] ?? "").trim() !== "");

    if (!hasData) {
      clearStsNewOpDraft(lastDraftSnapshotRef);
      if (autosaveUiHideTimerRef.current) {
        clearTimeout(autosaveUiHideTimerRef.current);
        autosaveUiHideTimerRef.current = null;
      }
      setDraftAutosaveUi("hidden");
      return;
    }

    const payload = {
      v: 1,
      ts: Date.now(),
      status,
      flowDir,
      quantityMT,
      operationRef,
      preStsDocs,
      fields,
      equipments:
        selectedEquipmentIds.length > 0 ? selectedEquipmentIds : equipments,
    };
    lastDraftSnapshotRef.current = payload;
    writeStsNewOpDraft(payload);
    setDraftAutosaveUi("saved");
    if (autosaveUiHideTimerRef.current) {
      clearTimeout(autosaveUiHideTimerRef.current);
    }
    autosaveUiHideTimerRef.current = setTimeout(() => {
      autosaveUiHideTimerRef.current = null;
      setDraftAutosaveUi("hidden");
    }, 2800);
  }, [
    activeViewTab,
    showSuccessPage,
    status,
    flowDir,
    quantityMT,
    operationRef,
    preStsDocs,
    selectedLocationId,
    selectedOperationType,
    selectedMooringMasterId,
    selectedTypeOfCargoId,
    selectedTypeOfOperation,
    selectedClient,
    selectedAgent,
    selectedVesselTypeCHS,
    selectedVesselTypeMS,
    selectedEquipmentIds,
  ]);

  useEffect(() => {
    persistDraftFnRef.current = persistStsNewOpDraftNow;
  }, [persistStsNewOpDraftNow]);

  useEffect(() => {
    return () => {
      if (saveDraftTimerRef.current) {
        clearTimeout(saveDraftTimerRef.current);
        saveDraftTimerRef.current = null;
      }
      try {
        persistDraftFnRef.current?.();
      } catch {
        if (lastDraftSnapshotRef.current) {
          writeStsNewOpDraft(lastDraftSnapshotRef.current);
        }
      }
    };
  }, []);

  const scheduleStsNewOpDraftPersist = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!allowClientDraftPersistRef.current) return;
    if (saveDraftTimerRef.current) clearTimeout(saveDraftTimerRef.current);
    saveDraftTimerRef.current = setTimeout(() => {
      saveDraftTimerRef.current = null;
      persistStsNewOpDraftNow();
    }, 650);
  }, [persistStsNewOpDraftNow]);

  useEffect(() => {
    if (loadingMasters || activeViewTab !== "create" || showSuccessPage) return;
    if (draftRestoreDoneRef.current) return;
    draftRestoreDoneRef.current = true;
    allowClientDraftPersistRef.current = false;

    const draft = readStsNewOpDraft();
    if (!draft) {
      allowClientDraftPersistRef.current = true;
      return;
    }

    const skipNames = new Set([
      "Operation_Ref_No",
      "quantity",
      "equipments",
      "jpo",
      "riskAssessment",
    ]);

    (async () => {
      try {
        if (draft.status) setStatus(draft.status);
        if (
          draft.flowDir === "left" ||
          draft.flowDir === "right" ||
          draft.flowDir === "both"
        ) {
          setFlowDir(draft.flowDir);
        }
        const fieldsSnapshot =
          draft.fields && typeof draft.fields === "object" ? draft.fields : {};
        const opResolved =
          String(draft.operationRef ?? "").trim() !== ""
            ? String(draft.operationRef).trim()
            : String(fieldsSnapshot.Operation_Ref_No ?? "").trim();
        const qtyResolved =
          String(draft.quantityMT ?? "").trim() !== ""
            ? String(draft.quantityMT).trim()
            : String(fieldsSnapshot.quantity ?? "").trim();
        setQuantityMT(qtyResolved);
        setOperationRef(opResolved);
        if (draft.preStsDocs && typeof draft.preStsDocs === "object") {
          setPreStsDocs({
            jpo: draft.preStsDocs.jpo || "",
            riskAssessment: draft.preStsDocs.riskAssessment || "",
          });
        }

        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const form = formRef.current;
        if (!form) return;

        const fields = fieldsSnapshot;
        applyFieldsToForm(form, fields, skipNames);

        const locId = fields.location;
        if (locId && locId !== "Select" && String(locId).trim() !== "") {
          setSelectedLocationId(String(locId));
          await handleLocationChange(locId);
        }
        if (fields.operationType && String(fields.operationType).trim() !== "") {
          setSelectedOperationType(String(fields.operationType));
        }
        if (fields.mooringMaster && String(fields.mooringMaster).trim() !== "") {
          setSelectedMooringMasterId(String(fields.mooringMaster));
        }
        if (fields.typeOfCargo && String(fields.typeOfCargo).trim() !== "") {
          setSelectedTypeOfCargoId(String(fields.typeOfCargo));
        }
        if (fields.typeOfOperation && String(fields.typeOfOperation).trim() !== "") {
          setSelectedTypeOfOperation(String(fields.typeOfOperation));
        }
        if (fields.client && String(fields.client).trim() !== "") {
          setSelectedClient(String(fields.client));
        }
        if (fields.agent && String(fields.agent).trim() !== "") {
          setSelectedAgent(String(fields.agent));
        }
        if (fields.vesselTypeCHS && String(fields.vesselTypeCHS).trim() !== "") {
          setSelectedVesselTypeCHS(String(fields.vesselTypeCHS));
        }
        if (fields.vesselTypeMS && String(fields.vesselTypeMS).trim() !== "") {
          setSelectedVesselTypeMS(String(fields.vesselTypeMS));
        }

        setPreStsDocs((prev) => ({
          jpo:
            fields.jpo !== undefined && String(fields.jpo).trim() !== ""
              ? fields.jpo
              : prev.jpo,
          riskAssessment:
            fields.riskAssessment !== undefined &&
            String(fields.riskAssessment).trim() !== ""
              ? fields.riskAssessment
              : prev.riskAssessment,
        }));

        actionUploadDraftUrlsRef.current = {
          jpo: fields.jpo != null ? String(fields.jpo) : "",
          riskAssessment:
            fields.riskAssessment != null ? String(fields.riskAssessment) : "",
        };
        setActionUploadDraftEpoch((e) => e + 1);

        const restoredEq = Array.isArray(draft.equipments) ? draft.equipments : [];
        setRestoredEquipmentIds(restoredEq);
        setSelectedEquipmentIds(restoredEq.map(String));
        setEquipmentDraftEpoch((e) => e + 1);
      } finally {
        allowClientDraftPersistRef.current = true;
        // Do not call persistStsNewOpDraftNow here — React state/DOM for controlled
        // Operation_Ref_No & quantity are not committed yet; persisting would overwrite
        // sessionStorage with empty values.
      }
    })();
  }, [loadingMasters, activeViewTab, showSuccessPage, handleLocationChange]);

  useEffect(() => {
    const form = formRef.current;
    if (!form || activeViewTab !== "create" || showSuccessPage) return;
    const onField = () => scheduleStsNewOpDraftPersist();
    form.addEventListener("input", onField);
    form.addEventListener("change", onField);
    return () => {
      form.removeEventListener("input", onField);
      form.removeEventListener("change", onField);
    };
  }, [activeViewTab, showSuccessPage, scheduleStsNewOpDraftPersist]);

  useEffect(() => {
    scheduleStsNewOpDraftPersist();
  }, [
    status,
    flowDir,
    quantityMT,
    operationRef,
    preStsDocs,
    scheduleStsNewOpDraftPersist,
  ]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "hidden") return;
      if (saveDraftTimerRef.current) {
        clearTimeout(saveDraftTimerRef.current);
        saveDraftTimerRef.current = null;
      }
      persistStsNewOpDraftNow();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [persistStsNewOpDraftNow]);

  useEffect(() => {
    const onPageHide = () => {
      if (saveDraftTimerRef.current) {
        clearTimeout(saveDraftTimerRef.current);
        saveDraftTimerRef.current = null;
      }
      persistStsNewOpDraftNow();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [persistStsNewOpDraftNow]);

  useEffect(() => {
    return () => {
      if (autosaveUiHideTimerRef.current) {
        clearTimeout(autosaveUiHideTimerRef.current);
        autosaveUiHideTimerRef.current = null;
      }
    };
  }, []);

  const flushStsNewOpDraftBeforeLeaveCreate = useCallback(() => {
    if (saveDraftTimerRef.current) {
      clearTimeout(saveDraftTimerRef.current);
      saveDraftTimerRef.current = null;
    }
    persistStsNewOpDraftNow();
  }, [persistStsNewOpDraftNow]);

  const handleSubmit = async (e, isSubmit = false) => {
    e.preventDefault();

    const opRef = String(operationRef || "").trim();
    if (!opRef) {
      alert("Please enter an Operation Ref No or click ⚡ to generate one before saving.");
      return;
    }

    if (isSubmit && !selectedLocationId) {
      alert("Please select a Location before submitting. You can save a draft without it and complete details later.");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData(formRef.current);

      formData.set("Operation_Ref_No", opRef);

      const finalStatus = isSubmit ? status : "DRAFT";
      formData.set("operationStatus", finalStatus);

      if (isSubmit) {
        formData.set("isSubmitted", "true");
        formData.set("submittedAt", new Date().toISOString());
      } else {
        formData.delete("isSubmitted");
        formData.delete("submittedAt");
      }

      formData.set("flowDirection", flowDir);

      if (quantityMT) {
        formData.set("quantity", quantityMT);
      }

      if (selectedLocationId) {
        formData.set("location", selectedLocationId);
      } else {
        formData.delete("location");
      }

      if (selectedOperationType) {
        formData.set("operationType", selectedOperationType);
      } else {
        formData.delete("operationType");
      }

      if (selectedMooringMasterId) {
        formData.set("mooringMaster", selectedMooringMasterId);
      } else {
        formData.delete("mooringMaster");
      }

      if (selectedTypeOfCargoId) {
        formData.set("typeOfCargo", selectedTypeOfCargoId);
      } else {
        formData.delete("typeOfCargo");
      }

      if (selectedTypeOfOperation) {
        formData.set("typeOfOperation", selectedTypeOfOperation);
      } else {
        formData.delete("typeOfOperation");
      }

      if (selectedClient) {
        formData.set("client", selectedClient);
      } else {
        formData.delete("client");
      }

      if (selectedAgent) {
        formData.set("agent", selectedAgent);
      } else {
        formData.delete("agent");
      }

      if (selectedVesselTypeCHS && selectedVesselTypeCHS !== "Select") {
        formData.set("vesselTypeCHS", selectedVesselTypeCHS);
      } else {
        formData.delete("vesselTypeCHS");
      }

      if (selectedVesselTypeMS && selectedVesselTypeMS !== "Select") {
        formData.set("vesselTypeMS", selectedVesselTypeMS);
      } else {
        formData.delete("vesselTypeMS");
      }

      formData.delete("equipments");
      selectedEquipmentIds
        .filter((id) => id && String(id).trim() !== "")
        .forEach((id) => formData.append("equipments", String(id)));

      const response = await fetch("/api/operations/sts/create", {
        method: "POST",
        body: formData,
      });

      const data = await readJsonFromResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Failed to create operation");
      }

      clearStsNewOpDraft(lastDraftSnapshotRef);
      if (saveDraftTimerRef.current) {
        clearTimeout(saveDraftTimerRef.current);
        saveDraftTimerRef.current = null;
      }
      if (autosaveUiHideTimerRef.current) {
        clearTimeout(autosaveUiHideTimerRef.current);
        autosaveUiHideTimerRef.current = null;
      }
      setDraftAutosaveUi("hidden");

      setCreatedOperationId(data.data?._id || data.data?.id);
      setShowSuccessPage(true);
    } catch (error) {
      console.error("Submission error:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Success page component
  if (showSuccessPage) {
    return (
      <DocumentationPageShell>
        <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-6 px-6">
          {/* Big Green Tick */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/50 animate-scale-in">
                <svg
                  className="w-20 h-20 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              {/* Animated rings */}
              <div className="absolute inset-0 w-32 h-32 border-4 border-green-500/30 rounded-full animate-ping"></div>
              <div className="absolute inset-0 w-32 h-32 border-4 border-green-500/20 rounded-full animate-pulse"></div>
            </div>
          </div>
          
          {/* Success Message */}
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">New Operation Created</h2>
            <p className="text-lg text-white/80">Your STS operation has been successfully created!</p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              onClick={() => {
                clearStsNewOpDraft(lastDraftSnapshotRef);
                if (saveDraftTimerRef.current) {
                  clearTimeout(saveDraftTimerRef.current);
                  saveDraftTimerRef.current = null;
                }
                if (autosaveUiHideTimerRef.current) {
                  clearTimeout(autosaveUiHideTimerRef.current);
                  autosaveUiHideTimerRef.current = null;
                }
                setDraftAutosaveUi("hidden");
                setShowSuccessPage(false);
                formRef.current?.reset();
                setStatus("INPROGRESS");
                setFlowDir("left");
                resetStsSelectFields();
                setFormResetKey((k) => k + 1);
              }}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition"
            >
              Create Another
            </button>
            <Link
              href="/operations/sts-operations/new?tab=list"
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-xl text-white font-medium transition shadow-lg shadow-orange-500/30"
            >
              View All Operations
            </Link>
          </div>
        </div>
        </div>
      </DocumentationPageShell>
    );
  }

  return (
    <DocumentationPageShell>
    <div className="flex min-h-screen w-full">
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
         <div className={`mx-auto py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6 ${isSidebarOpen ? "max-w-7xl px-3 sm:px-4 md:px-6" : "px-3 sm:px-4 md:px-6"}`}>
           <header className={`${isSidebarOpen ? 'mt-0' : 'mt-8'} mb-2 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4`}>
            {/* Left: Dashboard */}
            <Link
              href="/dashboard"
              className="shrink-0 hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
            >
              ← Dashboard
            </Link>

            {/* Center: Heading */}
            <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
              <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-slate-200 font-semibold">
                STS Management System
              </p>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold">STS Operation Documentation</h1>
            </div>
            
            {/* Right: Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 flex-shrink-0 self-end sm:self-auto">
              {activeViewTab === "create" && !showSuccessPage && draftAutosaveUi !== "hidden" && (
                <div
                  className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-900/60 px-2.5 py-1.5 text-[11px] sm:text-xs text-slate-200 shadow-sm backdrop-blur-sm"
                  role="status"
                  aria-live="polite"
                >
                  {draftAutosaveUi === "saving" ? (
                    <>
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin"
                        aria-hidden
                      />
                      <span className="whitespace-nowrap">Saving draft…</span>
                    </>
                  ) : (
                    <>
                      <span className="text-emerald-400" aria-hidden>
                        ✓
                      </span>
                      <span className="whitespace-nowrap max-w-[200px] sm:max-w-none">
                        All changes saved (this browser)
                      </span>
                    </>
                  )}
                </div>
              )}
              <div className="inline-flex rounded-lg sm:rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveViewTab("create")}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition ${
                    activeViewTab === "create"
                      ? "bg-orange-500 text-white"
                      : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  {canCreateForm ? "Create" : "View Form"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    flushStsNewOpDraftBeforeLeaveCreate();
                    setActiveViewTab("list");
                  }}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition ${
                    activeViewTab === "list"
                      ? "bg-orange-500 text-white"
                      : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  List
                </button>
              </div>
            
            </div>
          </header>

          {/* Tab Content */}
          {activeViewTab === "create" && (
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-6xl mx-auto"
          >
            {!canCreateForm && (
              <div className="mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">
                You do not have permission to create STS operation records.
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-b border-white/10 pb-3 sm:pb-4">
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
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-200">
                <span className="text-base sm:text-lg">⏱️</span>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span>Start</span>
                  <input
                    type="datetime-local"
                    name="operationStartTime"
                    required
                    className="w-36 sm:w-48 rounded-lg sm:rounded-xl border border-white/10 bg-white/5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  />
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span>End</span>
                  <input
                    type="datetime-local"
                    name="operationEndTime"
                    className="w-36 sm:w-48 rounded-lg sm:rounded-xl border border-white/10 bg-white/5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  />
                </div>
              </div>
            </div>

            {/* Top-line details */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/90">
                  Operation Ref No
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    name="Operation_Ref_No"
                    value={operationRef}
                    onChange={(e) => setOperationRef(e.target.value)}
                    placeholder="Enter manually or click ⚡ to generate"
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none focus:ring-1 focus:ring-orange-400/40 focus:border-orange-400/30"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateOperationRef}
                    disabled={generatingRef}
                    className="px-3 py-3 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 text-orange-300 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    title="Generate Operation Ref Number"
                  >
                    {generatingRef ? (
                      <span className="inline-block w-4 h-4 border-2 border-orange-300 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      "⚡"
                    )}
                  </button>
                </div>
              </div>
              <SelectField
                  label="Type of operation"
                  name="typeOfOperation"
                  resetKey={formResetKey}
                  placeholder="Select type of operation"
                  value={selectedTypeOfOperation}
                  onChange={setSelectedTypeOfOperation}
                  options={["Ship to Ship", "POAC", "Fender Hire", "Hose hire"]}
                />
              <SelectField
                label="Client"
                name="client"
                resetKey={formResetKey}
                placeholder="Select client"
                loading={loadingMasters}
                value={selectedClient}
                onChange={setSelectedClient}
                options={stsClients.map((c) => ({
                  label: c.name,
                  value: c.name,
                }))}
              />
              <SelectField
                label="Agent"
                name="agent"
                resetKey={formResetKey}
                placeholder="Select agent"
                loading={loadingMasters}
                value={selectedAgent}
                onChange={setSelectedAgent}
                options={stsAgents.map((a) => ({
                  label: a.name,
                  value: a.name,
                }))}
              />
              <SelectField
                label="Mooring Master"
                loading={loadingMasters}
                resetKey={formResetKey}
                options={[
                  { label: "Select", value: "" },
                  ...mooringMasters
                    .filter((m) => m.availabilityStatus === "AVAILABLE")
                    .map((m) => ({
                      label: m.poacCompliant
                        ? m.name
                        : `${m.name} — ⚠ ${m.poacIssues?.[0] || "documents incomplete"}`,
                      value: m._id,
                      warn: !m.poacCompliant,
                    })),
                ]}
                name="mooringMaster"
                value={selectedMooringMasterId}
                onChange={setSelectedMooringMasterId}
              />
              <SelectField
                label="Location"
                loading={loadingMasters}
                resetKey={formResetKey}
                options={[
                  { label: "Select", value: "" },
                  ...locations.map((l) => ({ label: l.name, value: l._id })),
                ]}
                name="location"
                value={selectedLocationId}
                onChange={(locationId) => {
                  setSelectedLocationId(locationId || "");
                  handleLocationChange(locationId);
                }}
              />
              <SelectField
                label="Type of cargo"
                loading={loadingMasters}
                resetKey={formResetKey}
                options={[
                  { label: "Select", value: "" },
                  ...cargoTypes.map((c) => ({ label: c.type, value: c._id })),
                ]}
                name="typeOfCargo"
                value={selectedTypeOfCargoId}
                onChange={setSelectedTypeOfCargoId}
              />
              <SelectField
                label="Operation Type"
                name="operationType"
                resetKey={formResetKey}
                placeholder="Select operation type (optional for draft)"
                value={selectedOperationType}
                onChange={setSelectedOperationType}
                options={[
                  { label: "Select", value: "" },
                  { label: "underway", value: "underway" },
                  { label: "At Anchor", value: "At Anchor" },
                ]}
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
            <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
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
                    resetKey={formResetKey}
                    value={selectedVesselTypeCHS}
                    onChange={setSelectedVesselTypeCHS}
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
                  />
                  <UploadPill
                    label="Q88"
                    description="Q88 Vessel Data"
                    name="chsQ88"
                    accent="sky"
                    resetKey={formResetKey}
                  />
                  <UploadPill
                    label="Mooring Arr."
                    description="Mooring Arrangement"
                    name="chsMooringArrangement"
                    accent="sky"
                    resetKey={formResetKey}
                  />
                  <UploadPill
                    label="GA Plan"
                    description="General Arrangement Plan"
                    name="chsGAPlan"
                    accent="sky"
                    resetKey={formResetKey}
                  />
                  <UploadPill
                    label="MSDS"
                    description="Material Safety Data Sheet"
                    name="chsMSDS"
                    accent="sky"
                    resetKey={formResetKey}
                  />
                  <UploadPill
                    label="Indemnity"
                    description="Indemnity Document"
                    name="chsIndemnity"
                    accent="sky"
                    resetKey={formResetKey}
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
                    resetKey={formResetKey}
                    value={selectedVesselTypeMS}
                    onChange={setSelectedVesselTypeMS}
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
                  />
                  <UploadPill
                    label="Q88"
                    description="Q88 Vessel Data"
                    name="msQ88"
                    accent="orange"
                    resetKey={formResetKey}
                  />
                  <UploadPill
                    label="Mooring Arr."
                    description="Mooring Arrangement"
                    name="msMooringArrangement"
                    accent="orange"
                    resetKey={formResetKey}
                  />
                  <UploadPill
                    label="GA Plan"
                    description="General Arrangement Plan"
                    name="msGAPlan"
                    accent="orange"
                    resetKey={formResetKey}
                  />
                  <UploadPill
                    label="MSDS"
                    description="Material Safety Data Sheet"
                    name="msMSDS"
                    accent="orange"
                    resetKey={formResetKey}
                  />
                  <UploadPill
                    label="Indemnity"
                    description="Indemnity Document"
                    name="msIndemnity"
                    accent="orange"
                    resetKey={formResetKey}
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
                externalValue={preStsDocs.jpo}
                onClear={() => setPreStsDocs((prev) => ({ ...prev, jpo: "" }))}
                draftRestoreEpoch={actionUploadDraftEpoch}
                draftInitialUrl={actionUploadDraftUrlsRef.current.jpo}
              />
              <ActionUpload
                label="Risk Assessment"
                name="riskAssessment"
                resetKey={formResetKey}
                externalValue={preStsDocs.riskAssessment}
                downloadFileName={riskAssessmentFileName}
                onClear={() => {
                  setPreStsDocs((prev) => ({ ...prev, riskAssessment: "" }));
                  setRiskAssessmentFileName("");
                }}
                draftRestoreEpoch={actionUploadDraftEpoch}
                draftInitialUrl={actionUploadDraftUrlsRef.current.riskAssessment}
              />
              <UploadPill
                label="Mooring Plan"
                description="Upload mooring plan document"
                name="mooringPlan"
                accent="sky"
                resetKey={formResetKey}
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
                    placeholder="Enter file URL/path"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                  />
                </div>
              </div>
            )}

            {/* No-operation-ref notice */}
            {!operationRef && !linkedFormsLoading && linkedForms.length === 0 && (
              <p className="text-sm text-slate-500 italic">
                Enter or generate an Operation Ref to see linked form statuses.
              </p>
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
                equipmentDraftEpoch={equipmentDraftEpoch}
                restoredEquipmentIds={restoredEquipmentIds}
                selectedIds={selectedEquipmentIds}
                onChange={setSelectedEquipmentIds}
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

            <StsDocumentationMultiUpload key={formResetKey} />

            {/* Submit Buttons */}
            {canCreateForm ? (
            <div className="flex justify-end gap-4 pt-6 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  clearStsNewOpDraft(lastDraftSnapshotRef);
                  if (saveDraftTimerRef.current) {
                    clearTimeout(saveDraftTimerRef.current);
                    saveDraftTimerRef.current = null;
                  }
                  if (autosaveUiHideTimerRef.current) {
                    clearTimeout(autosaveUiHideTimerRef.current);
                    autosaveUiHideTimerRef.current = null;
                  }
                  setDraftAutosaveUi("hidden");
                  formRef.current?.reset();
                  setStatus("INPROGRESS");
                  setFlowDir("left");
                  setOperationRef("");
                  resetStsSelectFields();
                  setFormResetKey((k) => k + 1);
                }}
                className="px-6 py-3 rounded-xl border border-white/20 bg-white/5 text-white hover:bg-white/10 transition"
              >
                Reset
              </button>
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
            </div>
            ) : (
            <div className="pt-6 border-t border-white/10">
              <p className="text-center text-white/50 text-sm">You have view-only access to this form.</p>
            </div>
            )}
          </form>
          )}

          {activeViewTab === "list" && <OperationsListComponent />}
        </div>
      </div>
    </div>
    </DocumentationPageShell>
  );
}

const STS_LIST_MONTH_OPTIONS = [
  { value: "1", label: "Jan" },
  { value: "2", label: "Feb" },
  { value: "3", label: "Mar" },
  { value: "4", label: "Apr" },
  { value: "5", label: "May" },
  { value: "6", label: "Jun" },
  { value: "7", label: "Jul" },
  { value: "8", label: "Aug" },
  { value: "9", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

const STS_LIST_QUARTER_OPTIONS = [
  { value: "1", label: "Q1 (Jan–Mar)" },
  { value: "2", label: "Q2 (Apr–Jun)" },
  { value: "3", label: "Q3 (Jul–Sep)" },
  { value: "4", label: "Q4 (Oct–Dec)" },
];

const STS_LIST_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "INPROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "Lined Up", label: "Lined Up" },
  { value: "CANCELED", label: "Canceled" },
];

/** Custom dropdown so the menu matches trigger width (native select popups ignore width on mobile). */
function StsListFilterSelect({
  filterKey,
  openFilterKey,
  setOpenFilterKey,
  label,
  fieldId,
  value,
  onChange,
  options,
}) {
  const open = openFilterKey === filterKey;
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpenFilterKey(null);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpenFilterKey(null);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpenFilterKey]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "—";

  return (
    <div
      ref={rootRef}
      className="flex min-w-0 w-full flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2"
    >
      <label
        id={`${fieldId}-caption`}
        htmlFor={fieldId}
        className="shrink-0 text-sm text-white/70 whitespace-nowrap"
      >
        {label}
      </label>
      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          id={fieldId}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpenFilterKey(open ? null : filterKey)}
          className="theme-select flex min-h-[2.5rem] w-full min-w-0 items-center justify-between gap-2 rounded-full py-2 pl-3 pr-10 text-left text-xs tracking-widest uppercase"
        >
          <span className="min-w-0 truncate">{selectedLabel}</span>
        </button>
        {open && (
          <ul
            className="ops-select-list-scroll absolute left-0 right-0 top-full z-[200] mt-1 max-h-60 overflow-y-auto overflow-x-hidden rounded-xl border border-white/10 bg-[#0b2740] py-1 shadow-xl"
            role="listbox"
            aria-labelledby={`${fieldId}-caption`}
          >
            {options.map((opt) => (
              <li key={opt.value === "" ? "__all" : opt.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === opt.value}
                  className={`w-full max-w-full truncate px-3 py-2 text-left text-xs tracking-widest uppercase hover:bg-[#1b3d5c] ${
                    value === opt.value ? "bg-[#1b3d5c]/90 text-white" : "text-slate-200"
                  }`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpenFilterKey(null);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// List Component with Filters
function OperationsListComponent() {
  const [operations, setOperations] = useState([]);
  const [allOperations, setAllOperations] = useState([]); // Store all operations for year calculation
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredOperations, setFilteredOperations] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [quarterFilter, setQuarterFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const router = useRouter();
  const { canCreateForm, canEditForm, canDeleteForm } = useOperationsRole();
  const yearFieldId = useId();
  const statusFieldId = useId();
  const monthFieldId = useId();
  const quarterFieldId = useId();
  const [openFilterKey, setOpenFilterKey] = useState(null);

  // Fetch all operations once on mount to calculate available years
  useEffect(() => {
    const fetchAllOperations = async () => {
      try {
        const response = await fetch(`/api/operations/sts/list`);
        const data = await response.json();
        if (data.success) {
          setAllOperations(data.data || []);
        }
      } catch (error) {
        console.error("Error fetching all operations:", error);
      }
    };
    fetchAllOperations();
  }, []);

  useEffect(() => {
    fetchOperations();
  }, [statusFilter, yearFilter, monthFilter, quarterFilter]);

  useEffect(() => {
    let filtered = operations;

    // Only apply search query client-side (status and year are handled by API)
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((op) => {
        const opRef = op.Operation_Ref_No?.toLowerCase() || "";
        const type = op.typeOfOperation?.toLowerCase() || "";
        const location = op.location?.name?.toLowerCase() || "";
        const client = op.client?.toLowerCase() || "";
        const mooringMaster = op.mooringMaster?.name?.toLowerCase() || "";
        const chs = op.chs?.toLowerCase() || "";
        const ms = op.ms?.toLowerCase() || "";
        return (
          opRef.includes(query) ||
          type.includes(query) ||
          location.includes(query) ||
          client.includes(query) ||
          mooringMaster.includes(query) ||
          chs.includes(query) ||
          ms.includes(query)
        );
      });
    }

    setFilteredOperations(filtered);
  }, [searchQuery, operations]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, yearFilter, monthFilter, quarterFilter]);

  useEffect(() => {
    setOpenFilterKey(null);
  }, [statusFilter, yearFilter, monthFilter, quarterFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredOperations.length / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [filteredOperations.length, pageSize, page]);

  const totalFiltered = filteredOperations.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, totalFiltered);
  const paginatedOperations = filteredOperations.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const fetchOperations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (yearFilter) params.append("year", yearFilter);
      if (monthFilter) params.append("month", monthFilter);
      if (quarterFilter) params.append("quarter", quarterFilter);
      
      const response = await fetch(`/api/operations/sts/list?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setOperations(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching operations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this operation?")) {
      return;
    }

    try {
      const response = await fetch(`/api/operations/sts/${id}/delete`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        fetchOperations();
      } else {
        alert(data.error || "Failed to delete operation");
      }
    } catch (error) {
      console.error("Error deleting operation:", error);
      alert("Failed to delete operation");
    }
  };

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateBarrels = (mt) => {
    if (!mt || isNaN(mt)) return "—";
    return (mt * 7.33).toFixed(2);
  };

  const downloadExcel = () => {
    const columns = getExportColumns();
    const headers = buildExportHeaders(columns);
    const escapeCsv = (val) => {
      const s = val == null ? "" : String(val);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows = filteredOperations.map((op) => buildExportRow(op, columns));
    const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `STS-Operations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get unique years from all operations (not filtered ones)
  const availableYears = Array.from(
    new Set(
      allOperations
        .map((op) => {
          if (!op.operationStartTime) return null;
          return new Date(op.operationStartTime).getFullYear();
        })
        .filter((year) => year !== null)
    )
  ).sort((a, b) => b - a);

  const yearFilterOptions = useMemo(
    () => [
      { value: "", label: "All" },
      ...availableYears.map((y) => ({ value: String(y), label: String(y) })),
    ],
    [availableYears]
  );

  const monthFilterOptions = useMemo(
    () => [{ value: "", label: "All" }, ...STS_LIST_MONTH_OPTIONS],
    []
  );

  const quarterFilterOptions = useMemo(
    () => [{ value: "", label: "All" }, ...STS_LIST_QUARTER_OPTIONS],
    []
  );

  const hasActiveListFilters =
    Boolean(searchQuery.trim()) ||
    Boolean(statusFilter) ||
    Boolean(yearFilter) ||
    Boolean(monthFilter) ||
    Boolean(quarterFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center gap-2 sm:gap-4">
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            placeholder="Search by Ref No, Type, Location, Client, Mooring Master, CHS, MS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pl-10 text-sm text-white placeholder:text-white/50 focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/40 transition outline-none"
          />
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-white/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canCreateForm && <ImportFromEmailButton />}
          <ActionDownloadIcon
            onClick={downloadExcel}
            disabled={filteredOperations.length === 0}
            title="Download Excel"
            className="!rounded-xl !p-2.5"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5">
        <div className="grid grid-cols-1 gap-3 border-b border-white/10 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <StsListFilterSelect
            filterKey="year"
            openFilterKey={openFilterKey}
            setOpenFilterKey={setOpenFilterKey}
            label="Year"
            fieldId={yearFieldId}
            value={yearFilter}
            onChange={setYearFilter}
            options={yearFilterOptions}
          />
          <StsListFilterSelect
            filterKey="status"
            openFilterKey={openFilterKey}
            setOpenFilterKey={setOpenFilterKey}
            label="Status"
            fieldId={statusFieldId}
            value={statusFilter}
            onChange={setStatusFilter}
            options={STS_LIST_STATUS_OPTIONS}
          />
          <StsListFilterSelect
            filterKey="month"
            openFilterKey={openFilterKey}
            setOpenFilterKey={setOpenFilterKey}
            label="Month"
            fieldId={monthFieldId}
            value={monthFilter}
            onChange={(v) => {
              setMonthFilter(v);
              if (v) setQuarterFilter("");
            }}
            options={monthFilterOptions}
          />
          <StsListFilterSelect
            filterKey="quarter"
            openFilterKey={openFilterKey}
            setOpenFilterKey={setOpenFilterKey}
            label="Quarter"
            fieldId={quarterFieldId}
            value={quarterFilter}
            onChange={(v) => {
              setQuarterFilter(v);
              if (v) setMonthFilter("");
            }}
            options={quarterFilterOptions}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-white/60">Loading operations...</p>
          </div>
        ) : filteredOperations.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-white/60">
              {hasActiveListFilters
                ? "No operations found matching your filters."
                : "No operations found."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[700px] w-full">
                <thead className="border-b border-white/10 bg-white/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-white/90 uppercase">
                      Operation Ref No
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-white/90 uppercase">
                      Type of Operation
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-white/90 uppercase">
                      Location
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-white/90 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-white/90 uppercase">
                      VSL Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-white/90 uppercase">
                      Client
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-white/90 uppercase">
                      Mooring Master
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-white/90 uppercase">
                      Barrels
                    </th>
                    <th className="w-32 px-6 py-4 text-center text-xs font-semibold tracking-wider text-white/90 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {paginatedOperations.map((op) => (
                    <tr key={op._id} className="transition hover:bg-white/5">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white/90 font-mono">
                            {op.Operation_Ref_No || "—"}
                          </span>
                          {op.emailImport?.messageId && (
                            <span
                              title={`Imported from email — ${op.emailImport.subject || "no subject"}`}
                              className="shrink-0 rounded-full border border-sky-400/30 bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300"
                            >
                              ✉ Imported
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-white/90">{op.typeOfOperation || "—"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-white/90">{op.location?.name || "—"}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            statusTone[op.operationStatus]?.pill || "bg-white/10 text-white"
                          }`}
                        >
                          {op.operationStatus || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-white/90">{op.chs || op.ms || "—"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-white/90">{op.client || "—"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-white/90">{op.mooringMaster?.name || "—"}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-white/90">{calculateBarrels(op.quantity)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex justify-center gap-2">
                          <ActionViewIcon
                            onClick={() => router.push(`/operations/sts-operations/new/view/${op._id}`)}
                            title="View operation"
                          />
                          {canEditForm && (
                            <ActionEditIcon
                              onClick={() => router.push(`/operations/sts-operations/new/edit/${op._id}`)}
                              title="Edit operation"
                            />
                          )}
                          {canDeleteForm && (
                            <ActionDeleteIcon onClick={() => handleDelete(op._id)} title="Delete operation" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <OperationsListPaginationFooter
              totalFiltered={totalFiltered}
              page={safePage}
              setPage={setPage}
              totalPages={totalPages}
              pageStart={pageStart}
              pageEnd={pageEnd}
              pageSize={pageSize}
              setPageSize={setPageSize}
            />
          </>
        )}
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

function TextField({ label, placeholder, name }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <BaseInput>
        <input
          type="text"
          name={name}
          className="w-full bg-transparent outline-none"
          placeholder={placeholder}
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

function FileField({ name, resetKey }) {
  const [fileUrl, setFileUrl] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    setFileUrl("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [resetKey]);

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

function UploadPill({ label, description, name, accent = "sky", resetKey }) {
  const [fileName, setFileName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    setFileName("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [resetKey]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setFileName(file ? file.name : "");
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setFileName("");
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

      {/* Upload area */}
      <div className={`flex items-center gap-2 rounded-xl border ${borderColor} ${accentBg} px-3 py-2`}>
        <label
          className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${btnBg}`}
        >
          Choose File
          <input
            ref={inputRef}
            type="file"
            name={name}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
          />
        </label>
        <span className="flex-1 text-sm text-white/60 truncate">
          {fileName || "No file chosen"}
        </span>
        {fileName && (
          <button
            type="button"
            onClick={handleClear}
            className="text-red-400 hover:text-red-300 text-sm font-bold px-1"
            title="Remove file"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function ActionUpload({
  label,
  name,
  resetKey,
  externalValue,
  onClear,
  draftRestoreEpoch = 0,
  draftInitialUrl = "",
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
    setFileUrl("");
    setIsAutoFetched(false);
    setUploadedFileName("");
    setUserDismissed(false);
    lastExternalRef.current = "";
    if (inputRef.current) inputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [resetKey]);

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
        setFileUrl("");
        setIsAutoFetched(false);
      }
    }
  }, [externalValue]);

  useEffect(() => {
    if (draftRestoreEpoch <= 0) return;
    const next = draftInitialUrl ?? "";
    setFileUrl(next);
    setIsAutoFetched(false);
    setUploadedFileName("");
    setUserDismissed(false);
    if (inputRef.current) inputRef.current.value = next;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [draftRestoreEpoch, draftInitialUrl]);

  const handleDismiss = (e) => {
    e.preventDefault();
    setUserDismissed(true);
    setFileUrl("");
    setIsAutoFetched(false);
    setUploadedFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRestore = () => {
    const val = lastExternalRef.current || externalValue;
    if (!val) return;
    setUserDismissed(false);
    setFileUrl(val);
    setIsAutoFetched(true);
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

      {!uploadedFileName && (
        <input type="hidden" name={name} value={fileUrl} />
      )}

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
            <span className={`text-sm font-medium ${isAutoFetched ? "text-emerald-300" : "text-white/80"}`}>
              ✓ File attached
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

function FileRow({ label, name, resetKey }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-white/90">{label}</label>
      <FileField name={name} resetKey={resetKey} />
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
  equipmentDraftEpoch = 0,
  restoredEquipmentIds = [],
  selectedIds,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const isControlled = selectedIds !== undefined;
  const [internalSelected, setInternalSelected] = useState([]);
  const selected = isControlled ? selectedIds : internalSelected;

  const setSelected = (next) => {
    const resolved = typeof next === "function" ? next(selected) : next;
    if (isControlled) {
      onChange?.(resolved);
    } else {
      setInternalSelected(resolved);
    }
  };

  const toggle = (val) => {
    const strVal = String(val);
    setSelected((prev) =>
      prev.includes(strVal) ? prev.filter((v) => v !== strVal) : [...prev, strVal]
    );
  };

  // Mixed inventory — group headers keep primary equipment and accessories
  // readable in one list.
  const groupedOptions = groupEquipmentOptions(options);

  const summaryLabel = (() => {
    if (selected.length) {
      const selectedLabels = selected
        .map((val) => options.find((opt) => String(opt.value) === String(val))?.label)
        .filter(Boolean);
      return selectedLabels.join(", ") || `${selected.length} selected`;
    }
    if (loading) return "Loading...";
    return "Select equipment";
  })();

  useEffect(() => {
    if (isControlled) return;
    setInternalSelected([]);
  }, [resetKey, isControlled]);

  useEffect(() => {
    if (equipmentDraftEpoch > 0) {
      const restored = restoredEquipmentIds.map(String);
      if (isControlled) {
        onChange?.(restored);
      } else {
        setInternalSelected(restored);
      }
    }
  }, [equipmentDraftEpoch, restoredEquipmentIds, isControlled, onChange]);

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
                      checked={selected.includes(String(opt.value))}
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
        <input key={val} type="hidden" name={name} value={String(val)} />
      ))}
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

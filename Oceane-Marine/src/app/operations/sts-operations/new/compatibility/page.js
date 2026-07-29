"use client";

import Link from "next/link";
import { useState, useEffect, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { computeAll } from "./calculations";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import { getSidebarTabs } from "@/app/operations/sts-operations/new/sidebarTabs";
import OperationsSelectField from "@/app/operations/components/OperationsSelectField";

const emptyShip = () => ({
  name: "",
  DWT: "",
  Beam: "",
  DISP: "",
  Draft: "",
  MaxFreeboard: "",
  MinFreeboard: "",
  ManifoldToRail: "",
});

/** STS ops that can be tied to compatibility (matches common workflow before / during transfer). */
const COMPATIBILITY_STS_STATUSES = ["INPROGRESS", "Lined Up"];

function CompatibilityPageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("edit");
  const sectionParam = searchParams?.get("section"); // "hose" | "fender"
  const [calcSection, setCalcSection] = useState(sectionParam === "fender" ? "fender" : "hose");
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const { canCreateCompatibility, canEditCompatibility, isOpsAdmin } = useOperationsRole();
  const sidebarTabs = getSidebarTabs(isOpsAdmin);
  const [activeTab, setActiveTab] = useState("compatibility");
  const [expandedModules, setExpandedModules] = useState(new Set());
  const sidebarRef = useRef(null);

  const [operationNumber, setOperationNumber] = useState("");
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [inProgressOps, setInProgressOps] = useState([]);
  const [opsLoading, setOpsLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [locationId, setLocationId] = useState("");
  const [locationName, setLocationName] = useState("");
  const [STBL, setSTBL] = useState(emptyShip());
  const [SS, setSS] = useState(emptyShip());
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const messageTopRef = useRef(null);
  const inProgressOpsRef = useRef(inProgressOps);
  inProgressOpsRef.current = inProgressOps;

  /* Fetch latest STS operations for the dropdown (same searchable UI as other ops selects). */
  useEffect(() => {
    setOpsLoading(true);
    fetch("/api/operations/sts/list")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const eligible = data.data.filter((op) =>
            COMPATIBILITY_STS_STATUSES.includes(op.operationStatus)
          );
          setInProgressOps(eligible);
        }
      })
      .catch(() => {})
      .finally(() => setOpsLoading(false));
  }, []);

  /* Editing: ensure the saved operation appears even if status is e.g. COMPLETED */
  useEffect(() => {
    if (!selectedOperationId) return;
    const id = String(selectedOperationId);
    if (inProgressOpsRef.current.some((o) => String(o._id) === id)) return;
    let cancelled = false;
    fetch(`/api/operations/sts/${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.success || !data.data) return;
        const row = data.data;
        setInProgressOps((prev) => {
          if (prev.some((o) => String(o._id) === String(row._id))) return prev;
          return [...prev, row];
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedOperationId]);

  /* When user selects an operation from dropdown, auto-fill fields */
  const handleOperationSelect = (opId) => {
    setSelectedOperationId(opId);
    if (!opId) {
      setOperationNumber("");
      return;
    }
    const op = inProgressOps.find((o) => String(o._id) === String(opId));
    if (!op) return;
    setOperationNumber(op.Operation_Ref_No || "");
    // Auto-fill year from operationStartTime
    if (op.operationStartTime) {
      setYear(new Date(op.operationStartTime).getFullYear());
    }
    // Auto-fill location
    if (op.location) {
      const locId = typeof op.location === "object" ? op.location._id : op.location;
      const locName = typeof op.location === "object" ? op.location.name : "";
      setLocationId(String(locId || ""));
      setLocationName(locName || "");
    }
    // Auto-fill CHS name (STBL) and MS name (SS)
    if (op.chs) {
      setSTBL((prev) => ({ ...prev, name: op.chs }));
    }
    if (op.ms) {
      setSS((prev) => ({ ...prev, name: op.ms }));
    }
  };

  useEffect(() => {
    if (editId) {
      setLoading(true);
      fetch(`/api/operations/compatibility/${editId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            const d = data.data;
            setOperationNumber(d.operationNumber || "");
            setSelectedOperationId(d.operationRef || "");
            setYear(d.year ?? new Date().getFullYear());
            setLocationId(d.location?.locationId?.toString() || "");
            setLocationName(d.location?.name || "");
            setSTBL({
              name: d.STBL?.name ?? "",
              DWT: d.STBL?.DWT ?? "",
              Beam: d.STBL?.Beam ?? "",
              DISP: d.STBL?.DISP ?? "",
              Draft: d.STBL?.Draft ?? "",
              MaxFreeboard: d.STBL?.MaxFreeboard ?? "",
              MinFreeboard: d.STBL?.MinFreeboard ?? "",
              ManifoldToRail: d.STBL?.ManifoldToRail ?? "",
            });
            setSS({
              name: d.SS?.name ?? "",
              DWT: d.SS?.DWT ?? "",
              Beam: d.SS?.Beam ?? "",
              DISP: d.SS?.DISP ?? "",
              Draft: d.SS?.Draft ?? "",
              MaxFreeboard: d.SS?.MaxFreeboard ?? "",
              MinFreeboard: d.SS?.MinFreeboard ?? "",
              ManifoldToRail: d.SS?.ManifoldToRail ?? "",
            });
            if (d.results) setResults(d.results);
          } else setError("Failed to load operation");
        })
        .catch(() => setError("Failed to load operation"))
        .finally(() => setLoading(false));
    } else {
      setResults(null);
    }
  }, [editId]);

  useEffect(() => {
    setCalcSection(sectionParam === "fender" ? "fender" : "hose");
  }, [sectionParam]);

  useEffect(() => {
    if (pathname === "/operations/sts-operations/new") setActiveTab("documentation");
    else if (pathname.startsWith("/operations/sts-operations/new/compatibility")) setActiveTab("compatibility");
    else if (pathname.startsWith("/operations/sts-operations/new/form-checklist")) {
      setActiveTab("forms");
      setExpandedModules((prev) => new Set([...prev, "forms"]));
    } else if (pathname.startsWith("/operations/sts-operations/new/locations")) setActiveTab("locations");
    else if (pathname.startsWith("/operations/sts-operations/new/cargos")) setActiveTab("cargos");
    else if (pathname.startsWith("/operations/sts-operations/new/clients-agents")) setActiveTab("clientsAgents");
    else if (pathname.startsWith("/operations/sts-operations/new/mooringmaster")) setActiveTab("mooring");
  }, [pathname]);

  const handleShipChange = (ship, setShip, field, value) => {
    setShip((prev) => ({ ...prev, [field]: value }));
  };

  const handleCalculate = () => {
    setError("");
    setSuccess("");
    const parseNum = (v) => (typeof v === "number" && Number.isFinite(v)) ? v : Number(String(v).replace(/,/g, "")) || 0;
    const stblNum = {
      ...STBL,
      DWT: parseNum(STBL.DWT),
      Beam: parseNum(STBL.Beam),
      DISP: parseNum(STBL.DISP),
      Draft: parseNum(STBL.Draft),
      MaxFreeboard: parseNum(STBL.MaxFreeboard),
      MinFreeboard: parseNum(STBL.MinFreeboard),
      ManifoldToRail: parseNum(STBL.ManifoldToRail),
    };
    const ssNum = {
      ...SS,
      DWT: parseNum(SS.DWT),
      Beam: parseNum(SS.Beam),
      DISP: parseNum(SS.DISP),
      Draft: parseNum(SS.Draft),
      MaxFreeboard: parseNum(SS.MaxFreeboard),
      MinFreeboard: parseNum(SS.MinFreeboard),
      ManifoldToRail: parseNum(SS.ManifoldToRail),
    };
    const computed = computeAll(stblNum, ssNum);
    setResults(computed);
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");
    if (!operationNumber?.trim()) {
      setError("Operation number is required");
      return;
    }
    if (!year) {
      setError("Year is required");
      return;
    }
    setSaving(true);
    const payload = {
      operationRef: selectedOperationId || null,
      operationNumber: operationNumber.trim(),
      year: Number(year),
      locationId: locationId || null,
      locationName: locationName || "",
      section: calcSection,
      STBL: {
        name: STBL.name,
        DWT: Number(STBL.DWT) || 0,
        Beam: Number(STBL.Beam) || 0,
        DISP: Number(STBL.DISP) || 0,
        Draft: Number(STBL.Draft) || 0,
        MaxFreeboard: Number(STBL.MaxFreeboard) || 0,
        MinFreeboard: Number(STBL.MinFreeboard) || 0,
        ManifoldToRail: Number(STBL.ManifoldToRail) || 0,
      },
      SS: {
        name: SS.name,
        DWT: Number(SS.DWT) || 0,
        Beam: Number(SS.Beam) || 0,
        DISP: Number(SS.DISP) || 0,
        Draft: Number(SS.Draft) || 0,
        MaxFreeboard: Number(SS.MaxFreeboard) || 0,
        MinFreeboard: Number(SS.MinFreeboard) || 0,
        ManifoldToRail: Number(SS.ManifoldToRail) || 0,
      },
    };
    try {
      const url = editId
        ? `/api/operations/compatibility/${editId}`
        : "/api/operations/compatibility/create";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setError("");
      setSuccess(editId ? "Operation updated." : "Operation saved.");
      setResults(data.data?.results || results);
      messageTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (!editId) setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
      setSuccess("");
      messageTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none transition-colors tabular-nums box-border";
  /** Matches grid inputs visually; custom select uses flex+chevron so avoid min-h-[44px]+py-3 stacking. */
  const operationSelectTriggerClass =
    "w-full min-h-[38px] rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none transition-colors tabular-nums box-border";
  const inputNumberClass = inputClass;
  const labelClass = "block text-sm font-medium text-white/90 mb-1.5 shrink-0";
  const fieldWrapClass = "flex flex-col min-h-[72px] shrink-0";

  const handleNumericChange = (ship, setShip, field, value) => {
    // Allow empty, numbers, and one decimal point
    if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
      handleShipChange(ship, setShip, field, value);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex">
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-full w-[260px] sm:w-[300px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-white/20 shadow-2xl backdrop-blur-md z-50 transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-orange-500/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/30">
                <span className="text-white text-xl">⚡</span>
              </div>
              <h2 className="text-lg font-bold text-white">Operations Modules</h2>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition" aria-label="Close sidebar">
              <span className="text-white text-lg">×</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1.5">
              {sidebarTabs.map((tab) => (
                <div key={tab.key} className="space-y-1">
                  {tab.submodules ? (
                    <>
                      <button
                        onClick={() => {
                          setExpandedModules((prev) => {
                            const next = new Set(prev);
                            if (next.has(tab.key)) next.delete(tab.key);
                            else next.add(tab.key);
                            return next;
                          });
                        }}
                        className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all ${
                          activeTab === tab.key ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white" : "text-white/90 hover:bg-white/10"
                        }`}
                      >
                        <span className="flex-1">{tab.label}</span>
                        <span className={`text-sm ${expandedModules.has(tab.key) ? "rotate-90" : ""}`}>▶</span>
                      </button>
                      {expandedModules.has(tab.key) && (
                        <div className="ml-4 space-y-1 mt-1.5 pl-4 border-l-2 border-orange-500/30">
                          {tab.submodules.map((sub) => (
                            <Link key={sub.key} href={sub.href} className="block w-full text-left px-4 py-2.5 rounded-lg text-sm text-white/80 hover:bg-white/10">
                              {sub.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={tab.href}
                      className={`block px-4 py-3 rounded-xl text-base font-medium ${
                        activeTab === tab.key ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white" : "text-white/90 hover:bg-white/10"
                      }`}
                    >
                      {tab.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 border-t border-white/10 bg-slate-800/50">
            <p className="text-[10px] text-slate-400 text-center">Operations Management System</p>
          </div>
        </div>
      </div>

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

      <div className={`flex-1 min-w-0 pr-4 overflow-auto transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
        <div className={`w-full mx-auto py-3 sm:py-5 space-y-3 sm:space-y-4 ${isSidebarOpen ? "max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4" : "px-3 sm:px-6"}`} id="compatibility-top">
          <header className={`${isSidebarOpen ? "mt-0" : "mt-8"} mb-2 flex w-full flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4`}>
            {/* Left: Dashboard */}
            <Link
              href="/dashboard"
              className="shrink-0 hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
            >
              ← Dashboard
            </Link>

            {/* Center: Heading */}
            <div className="flex w-full flex-col items-center text-center sm:w-auto sm:flex-1">
              <p className="text-sm uppercase tracking-[0.25em] text-sky-300">Compatibility</p>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Hose & Fender Calculation</h1>
            </div>
            
            {/* Right: Action Buttons */}
            <div className="flex w-full shrink-0 justify-center sm:w-auto sm:justify-end">
              <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                <Link
                  href={editId ? `/operations/sts-operations/new/compatibility?edit=${editId}&section=hose` : "/operations/sts-operations/new/compatibility?section=hose"}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${calcSection === "hose" ? "bg-orange-500 text-white" : "text-white/90 hover:bg-white/10"}`}
                >
                  Hose Calculation
                </Link>
                <Link
                  href={editId ? `/operations/sts-operations/new/compatibility?edit=${editId}&section=fender` : "/operations/sts-operations/new/compatibility?section=fender"}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${calcSection === "fender" ? "bg-orange-500 text-white" : "text-white/90 hover:bg-white/10"}`}
                >
                  Fender Calculation
                </Link>
                <Link
                  href="/operations/sts-operations/new/compatibility/list"
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-white/90 hover:bg-white/10 transition sm:px-4 sm:py-2 sm:text-sm"
                >
                  List
                </Link>
              </div>
            </div>
          </header>

          {!(editId ? canEditCompatibility : canCreateCompatibility) && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm mb-4">
              You do not have permission to {editId ? "edit" : "create"} compatibility records.
            </div>
          )}

          {/* Message at top – user is scrolled here on save */}
          <div ref={messageTopRef}>
            {error && (
              <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100 mb-4" role="alert">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 mb-4" role="alert">
                {success}
              </div>
            )}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-white/60">Loading operation...</div>
          ) : (
            <div className="space-y-6">
              {/* Operation info - shared (z-30: dropdown panel extends below card; backdrop-blur stacks above later siblings without this) */}
              <div className="relative z-30 overflow-visible rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-xl">
                <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3 mb-4">Operation</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className={fieldWrapClass}>
                    <label className={labelClass}>Operation number *</label>
                    <OperationsSelectField
                      ariaLabel="Operation number"
                      value={selectedOperationId}
                      onChange={(v) => handleOperationSelect(v)}
                      options={[
                        {
                          value: "",
                          label: opsLoading ? "Loading operations..." : "Select operation",
                        },
                        ...inProgressOps.map((op) => ({
                          value: String(op._id),
                          label: op.Operation_Ref_No?.trim() || String(op._id),
                        })),
                      ]}
                      triggerClassName={operationSelectTriggerClass}
                      disabled={opsLoading}
                      loading={opsLoading}
                      className="w-full"
                    />
                  </div>
                  <div className={fieldWrapClass}>
                    <label className={labelClass}>Year *</label>
                    <input
                      type="number"
                      value={year || ""}
                      readOnly
                      placeholder="Auto-filled from operation"
                      className={`${inputNumberClass} cursor-not-allowed opacity-70`}
                    />
                  </div>
                  <div className={fieldWrapClass}>
                    <label className={labelClass}>Location</label>
                    <input
                      type="text"
                      value={locationName}
                      readOnly
                      placeholder="Auto-filled from operation"
                      className={`${inputClass} cursor-not-allowed opacity-70`}
                    />
                  </div>
                </div>
              </div>

              {/* Hose Calculation - separate section */}
              {calcSection === "hose" && (
                <>
                  <p className="text-xs text-white/60">Freeboard and manifold to rail in meters (m).</p>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-xl">
                    <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3 mb-4">CHS</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { key: "name", label: "Name", unit: "" },
                        { key: "MaxFreeboard", label: "Max Freeboard", unit: "m" },
                        { key: "MinFreeboard", label: "Min Freeboard", unit: "m" },
                        { key: "ManifoldToRail", label: "Distance Manifold to Ship Rail", unit: "m" },
                      ].map(({ key, label, unit }) => (
                        <div key={key} className={fieldWrapClass}>
                          <label className={labelClass}>{label}{unit ? ` (${unit})` : ""}</label>
                          <input
                            type="text"
                            inputMode={key === "name" ? "text" : "decimal"}
                            value={STBL[key] ?? ""}
                            onChange={(e) => {
                              if (key === "name") {
                                handleShipChange(STBL, setSTBL, key, e.target.value);
                              } else {
                                handleNumericChange(STBL, setSTBL, key, e.target.value);
                              }
                            }}
                            onWheel={(e) => e.target.blur()}
                            placeholder={key === "name" ? "Ship name" : "0"}
                            className={key === "name" ? inputClass : inputNumberClass}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-xl">
                    <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3 mb-4">MS</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { key: "name", label: "Name", unit: "" },
                        { key: "MaxFreeboard", label: "Max Freeboard", unit: "m" },
                        { key: "MinFreeboard", label: "Min Freeboard", unit: "m" },
                        { key: "ManifoldToRail", label: "Distance Manifold to Ship Rail", unit: "m" },
                      ].map(({ key, label, unit }) => (
                        <div key={key} className={fieldWrapClass}>
                          <label className={labelClass}>{label}{unit ? ` (${unit})` : ""}</label>
                          <input
                            type="text"
                            inputMode={key === "name" ? "text" : "decimal"}
                            value={SS[key] ?? ""}
                            onChange={(e) => {
                              if (key === "name") {
                                handleShipChange(SS, setSS, key, e.target.value);
                              } else {
                                handleNumericChange(SS, setSS, key, e.target.value);
                              }
                            }}
                            onWheel={(e) => e.target.blur()}
                            placeholder={key === "name" ? "Ship name" : "0"}
                            className={key === "name" ? inputClass : inputNumberClass}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <button type="button" onClick={handleCalculate} className="rounded-xl bg-sky-500 hover:bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition">
                      Calculate Hose
                    </button>
                  </div>
                  {results?.hose && (
                    <div className="rounded-2xl border border-white/10 overflow-hidden shadow-xl" style={{ backgroundColor: "#2C4257" }}>
                      <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3 mb-0 px-6 pt-6">Hose calculation result</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-white/10" style={{ backgroundColor: "#23374D" }}>
                              <th className="text-left py-3 px-4 text-xs font-semibold text-white/90 uppercase tracking-wider">Field</th>
                              <th className="text-left py-3 px-4 text-xs font-semibold text-white/90 uppercase tracking-wider">Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10">
                            {[
                              { label: "Max Freeboard (m)", value: results.hose.MaxFreeboard ?? "—", main: false },
                              { label: "Min Freeboard (m)", value: results.hose.MinFreeboard ?? "—", main: false },
                              { label: "Difference of Freeboard (m)", value: results.hose.FreeboardDiff ?? "—", main: false },
                              { label: "Point A (m)", value: results.hose.PointA != null ? `${results.hose.PointA} m` : "—", main: false },
                              { label: "Point B (m)", value: results.hose.PointB != null ? `${results.hose.PointB} m` : "—", main: false },
                              { label: "Point C (m)", value: results.hose.PointC != null ? `${results.hose.PointC} m` : "—", main: false },
                              { label: "Hose length required (m)", value: results.hose.HoseCal != null ? `${results.hose.HoseCal} m` : "—", main: true },
                            ].map((row, i) => (
                              <tr
                                key={i}
                                className="hover:opacity-90 transition-opacity"
                                style={{
                                  backgroundColor: row.main ? "#1e4d5c" : (i % 2 === 0 ? "#2C4257" : "#23374D"),
                                  borderLeft: row.main ? "4px solid #0ea5e9" : undefined,
                                }}
                              >
                                <td className="py-3 px-4 text-sm text-white/90">{row.label}</td>
                                <td className={`py-3 px-4 text-white ${row.main ? "text-base font-bold" : "text-sm font-semibold"}`}>{row.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-6 pb-6 mt-4 flex justify-end">
                        <Link
                          href={editId ? `/operations/sts-operations/new/compatibility?edit=${editId}&section=hose` : "/operations/sts-operations/new/compatibility?section=hose"}
                          className="text-sm font-medium text-orange-400 hover:text-orange-300 transition"
                        >
                          Edit inputs →
                        </Link>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Fender Calculation - separate section */}
              {calcSection === "fender" && (
                <>
                  <p className="text-xs text-white/60">DWT and DISP in MT; Beam and Draft in meters (m).</p>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-xl">
                    <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3 mb-4">CHS</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { key: "name", label: "Name", unit: "" },
                        { key: "DWT", label: "DWT", unit: "MT" },
                        { key: "Beam", label: "Beam", unit: "m" },
                        { key: "DISP", label: "DISP (Displacement)", unit: "MT" },
                        { key: "Draft", label: "Draft", unit: "m" },
                      ].map(({ key, label, unit }) => (
                        <div key={key} className={fieldWrapClass}>
                          <label className={labelClass}>{label}{unit ? ` (${unit})` : ""}</label>
                          <input
                            type="text"
                            inputMode={key === "name" ? "text" : "decimal"}
                            value={STBL[key] ?? ""}
                            onChange={(e) => {
                              if (key === "name") {
                                handleShipChange(STBL, setSTBL, key, e.target.value);
                              } else {
                                handleNumericChange(STBL, setSTBL, key, e.target.value);
                              }
                            }}
                            onWheel={(e) => e.target.blur()}
                            placeholder={key === "name" ? "Ship name" : "0"}
                            className={key === "name" ? inputClass : inputNumberClass}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-xl">
                    <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3 mb-4">MS</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { key: "name", label: "Name", unit: "" },
                        { key: "DWT", label: "DWT", unit: "MT" },
                        { key: "Beam", label: "Beam", unit: "m" },
                        { key: "DISP", label: "DISP (Displacement)", unit: "MT" },
                        { key: "Draft", label: "Draft", unit: "m" },
                      ].map(({ key, label, unit }) => (
                        <div key={key} className={fieldWrapClass}>
                          <label className={labelClass}>{label}{unit ? ` (${unit})` : ""}</label>
                          <input
                            type="text"
                            inputMode={key === "name" ? "text" : "decimal"}
                            value={SS[key] ?? ""}
                            onChange={(e) => {
                              if (key === "name") {
                                handleShipChange(SS, setSS, key, e.target.value);
                              } else {
                                handleNumericChange(SS, setSS, key, e.target.value);
                              }
                            }}
                            onWheel={(e) => e.target.blur()}
                            placeholder={key === "name" ? "Ship name" : "0"}
                            className={key === "name" ? inputClass : inputNumberClass}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <button type="button" onClick={handleCalculate} className="rounded-xl bg-sky-500 hover:bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition">
                      Calculate Fender
                    </button>
                  </div>
                  {results?.fender && (
                    <div className="rounded-2xl border border-white/10 overflow-hidden shadow-xl" style={{ backgroundColor: "#2C4257" }}>
                      <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3 mb-0 px-6 pt-6">Fender calculation result</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-white/10" style={{ backgroundColor: "#23374D" }}>
                              <th className="text-left py-3 px-4 text-xs font-semibold text-white/90 uppercase tracking-wider">Field</th>
                              <th className="text-left py-3 px-4 text-xs font-semibold text-white/90 uppercase tracking-wider">Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10">
                            {[
                              { label: "Equivalent Displacement Coefficient (EDC) (MT)", value: results.fender.EDC ?? "—", highlight: false },
                              { label: "STBL Mass Coefficient", value: results.fender.STBLMassCoeff ?? "—", highlight: false },
                              { label: "SS Mass Coefficient", value: results.fender.SSMassCoeff ?? "—", highlight: false },
                              { label: "Combined Virtual Displacement (CVD) (MT)", value: results.fender.CVD ?? "—", highlight: false },
                              { label: "Virtual Displacement STBL (MT)", value: results.fender.VirtDispSTBL ?? "—", highlight: false },
                              { label: "Virtual Displacement SS (MT)", value: results.fender.VirtDispSS ?? "—", highlight: false },
                              { label: "Energy Coefficient Calm", value: results.fender.EnergyCoeff_Calm ?? "—", highlight: false },
                              { label: "Energy Coefficient Moderate", value: results.fender.EnergyCoeff_Moderate ?? "—", highlight: false },
                              { label: "Energy Coefficient Rough", value: results.fender.EnergyCoeff_Rough ?? "—", highlight: false },
                              { label: "Fender selection – Calm", value: results.fender.Fenderselect_Calm ?? "—", highlight: true, color: "calm" },
                              { label: "Fender selection – Moderate", value: results.fender.Fenderselect_Moderate ?? "—", highlight: true, color: "moderate" },
                              { label: "Fender selection – Rough", value: results.fender.Fenderselect_Rough ?? "—", highlight: true, color: "rough" },
                            ].map((row, i) => {
                              const highlightStyle = row.highlight && row.color
                                ? {
                                    backgroundColor: row.color === "calm" ? "rgba(34, 197, 94, 0.45)" : row.color === "moderate" ? "rgba(234, 179, 8, 0.5)" : "rgba(236, 72, 153, 0.45)",
                                    borderLeft: `4px solid ${row.color === "calm" ? "#22c55e" : row.color === "moderate" ? "#eab308" : "#ec4899"}`,
                                  }
                                : { backgroundColor: i % 2 === 0 ? "#2C4257" : "#23374D" };
                              return (
                                <tr key={i} className="hover:opacity-90 transition-opacity" style={highlightStyle}>
                                  <td className="py-3 px-4 text-sm text-white/90">{row.label}</td>
                                  <td className={`py-3 px-4 text-white ${row.highlight ? "text-base font-bold" : "text-sm font-semibold"}`}>{row.value}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-6 pb-6 mt-4 flex justify-end">
                        <Link
                          href={editId ? `/operations/sts-operations/new/compatibility?edit=${editId}&section=fender` : "/operations/sts-operations/new/compatibility?section=fender"}
                          className="text-sm font-medium text-orange-400 hover:text-orange-300 transition"
                        >
                          Edit inputs →
                        </Link>
                      </div>
                    </div>
                  )}
                </>
              )}

              {(editId ? canEditCompatibility : canCreateCompatibility) && (
              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-6 py-3 text-sm font-semibold text-white transition"
                >
                  {saving ? "Saving..." : editId ? "Update" : "Save"}
                </button>
              </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CompatibilityPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-transparent text-white flex items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-8 py-6 text-white/70">Loading...</div>
      </div>
    }>
      <CompatibilityPageContent />
    </Suspense>
  );
}

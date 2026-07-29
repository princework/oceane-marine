"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import { getSidebarTabs } from "@/app/operations/sts-operations/new/sidebarTabs";
import { useOperationsRole } from "@/hooks/useOperationsRole";

const labelClass = "block text-sm font-medium text-white/90 mb-1.5";
const valueClass = "rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90";

function ValueCell({ value }) {
  return <div className={valueClass}>{value ?? "—"}</div>;
}

export default function CompatibilityViewPage() {
  const params = useParams();
  const id = params?.id;
  const pathname = usePathname();
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const { isOpsAdmin } = useOperationsRole();
  const sidebarTabs = getSidebarTabs(isOpsAdmin);
  const [activeTab, setActiveTab] = useState("compatibility");
  const [expandedModules, setExpandedModules] = useState(new Set());
  const sidebarRef = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState("");
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  async function downloadFile(format) {
    if (!id) return;
    const isPdf = format === "pdf";
    const setLoading = isPdf ? setDownloadingPdf : setDownloadingDocx;
    setLoading(true);
    try {
      const url = isPdf
        ? `/api/operations/compatibility/${id}/download/pdf`
        : `/api/operations/compatibility/${id}/download`;
      const res = await fetch(url);
      if (!res.ok) {
        let msg = isPdf ? "Failed to download PDF" : "Failed to download document";
        try {
          const d = await res.json();
          msg = d.error || msg;
        } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const fallbackExt = isPdf ? "pdf" : "docx";
      const fileName = match
        ? match[1]
        : `Compatibility-${data?.operationNumber || id}.${fallbackExt}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    fetch(`/api/operations/compatibility/${id}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) setData(res.data);
        else setError(res.error || "Failed to load");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (pathname === "/operations/sts-operations/new") setActiveTab("documentation");
    else if (pathname?.startsWith("/operations/sts-operations/new/compatibility")) setActiveTab("compatibility");
    else if (pathname?.startsWith("/operations/sts-operations/new/form-checklist")) {
      setActiveTab("forms");
      setExpandedModules((prev) => new Set([...prev, "forms"]));
    } else if (pathname?.startsWith("/operations/sts-operations/new/locations")) setActiveTab("locations");
    else if (pathname?.startsWith("/operations/sts-operations/new/cargos")) setActiveTab("cargos");
    else if (pathname?.startsWith("/operations/sts-operations/new/clients-agents")) setActiveTab("clientsAgents");
    else if (pathname?.startsWith("/operations/sts-operations/new/mooringmaster")) setActiveTab("mooring");
  }, [pathname]);

  if (!id) {
    return (
      <div className="min-h-screen bg-transparent text-white flex items-center justify-center">
        <p className="text-white/60">Invalid operation.</p>
        <Link href="/operations/sts-operations/new/compatibility/list" className="ml-4 text-sky-400 hover:underline">Back to list</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white flex">
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
                        onClick={() => setExpandedModules((prev) => {
                          const next = new Set(prev);
                          if (next.has(tab.key)) next.delete(tab.key);
                          else next.add(tab.key);
                          return next;
                        })}
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
        <button onClick={() => setIsSidebarOpen(true)} className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600" aria-label="Open sidebar">
          <span className="text-white text-xl">☰</span>
        </button>
      )}

      <div className={`flex-1 min-w-0 pr-4 overflow-auto transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
        <div className={`w-full mx-auto py-6 sm:py-10 space-y-4 sm:space-y-6 ${isSidebarOpen ? "max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4" : "px-3 sm:px-6"}`}>
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-sky-300">Compatibility</p>
              <h1 className="text-xl sm:text-2xl font-bold text-white">View operation</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/operations/sts-operations/new/compatibility/list" className="px-4 py-2 rounded-xl border border-white/20 text-sm font-medium text-white/90 hover:bg-white/10 transition">
                ← Back to list
              </Link>
              <button
                type="button"
                onClick={() => downloadFile("docx")}
                disabled={downloadingDocx || downloadingPdf || loading || !data}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/25 text-sm font-semibold text-sky-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingDocx ? "Preparing…" : "Word"}
              </button>
              <button
                type="button"
                onClick={() => downloadFile("pdf")}
                disabled={downloadingDocx || downloadingPdf || loading || !data}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-400/40 bg-rose-500/15 hover:bg-rose-500/25 text-sm font-semibold text-rose-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingPdf ? "Preparing…" : "PDF"}
              </button>
              <Link href={`/operations/sts-operations/new/compatibility?edit=${id}`} className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-semibold text-white transition">
                Edit
              </Link>
            </div>
          </header>

          {error && (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-white/60">Loading...</div>
          ) : data ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3 mb-4">Operation</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className={labelClass}>Operation number</label>
                    <ValueCell value={data.operationNumber} />
                  </div>
                  <div>
                    <label className={labelClass}>Year</label>
                    <ValueCell value={data.year} />
                  </div>
                  <div>
                    <label className={labelClass}>Location</label>
                    <ValueCell value={data.location?.name} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3 mb-4">STBL</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {["name", "DWT", "Beam", "DISP", "Draft", "MaxFreeboard", "MinFreeboard", "ManifoldToRail"].map((key) => (
                    <div key={key}>
                      <label className={labelClass}>{key}</label>
                      <ValueCell value={data.STBL?.[key]} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3 mb-4">SS</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {["name", "DWT", "Beam", "DISP", "Draft", "MaxFreeboard", "MinFreeboard", "ManifoldToRail"].map((key) => (
                    <div key={key}>
                      <label className={labelClass}>{key}</label>
                      <ValueCell value={data.SS?.[key]} />
                    </div>
                  ))}
                </div>
              </div>

              {data.results?.hose && (
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
                          { label: "Max Freeboard (m)", value: data.results.hose.MaxFreeboard ?? "—", main: false },
                          { label: "Min Freeboard (m)", value: data.results.hose.MinFreeboard ?? "—", main: false },
                          { label: "Difference of Freeboard (m)", value: data.results.hose.FreeboardDiff ?? "—", main: false },
                          { label: "Point A (m)", value: data.results.hose.PointA != null ? `${data.results.hose.PointA} m` : "—", main: false },
                          { label: "Point B (m)", value: data.results.hose.PointB != null ? `${data.results.hose.PointB} m` : "—", main: false },
                          { label: "Point C (m)", value: data.results.hose.PointC != null ? `${data.results.hose.PointC} m` : "—", main: false },
                          { label: "Hose length required (m)", value: data.results.hose.HoseCal != null ? `${data.results.hose.HoseCal} m` : "—", main: true },
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
                </div>
              )}

              {data.results?.fender && (
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
                          { label: "Equivalent Displacement Coefficient (EDC) (MT)", value: data.results.fender.EDC ?? "—", highlight: false },
                          { label: "STBL Mass Coefficient", value: data.results.fender.STBLMassCoeff ?? "—", highlight: false },
                          { label: "SS Mass Coefficient", value: data.results.fender.SSMassCoeff ?? "—", highlight: false },
                          { label: "Combined Virtual Displacement (CVD) (MT)", value: data.results.fender.CVD ?? "—", highlight: false },
                          { label: "Virtual Displacement STBL (MT)", value: data.results.fender.VirtDispSTBL ?? "—", highlight: false },
                          { label: "Virtual Displacement SS (MT)", value: data.results.fender.VirtDispSS ?? "—", highlight: false },
                          { label: "Energy Coefficient Calm", value: data.results.fender.EnergyCoeff_Calm ?? "—", highlight: false },
                          { label: "Energy Coefficient Moderate", value: data.results.fender.EnergyCoeff_Moderate ?? "—", highlight: false },
                          { label: "Energy Coefficient Rough", value: data.results.fender.EnergyCoeff_Rough ?? "—", highlight: false },
                          { label: "Fender selection – Calm", value: data.results.fender.Fenderselect_Calm ?? "—", highlight: true, color: "calm" },
                          { label: "Fender selection – Moderate", value: data.results.fender.Fenderselect_Moderate ?? "—", highlight: true, color: "moderate" },
                          { label: "Fender selection – Rough", value: data.results.fender.Fenderselect_Rough ?? "—", highlight: true, color: "rough" },
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
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

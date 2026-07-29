"use client";

import { useEffect, useState } from "react";
import { usePmsRole } from "@/hooks/usePmsRole";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import OperationsSelectField from "@/app/operations/components/OperationsSelectField";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Inventory placement options match Equipment schema (placedInOffice/Base/Bay). */
const LOCATION_OPTIONS = [
  { value: "ALL", label: "All locations" },
  { value: "OFFICE", label: "Office" },
  { value: "BASE", label: "Base" },
  { value: "BAY", label: "Bay" },
];

const MONTH_OPTIONS = [
  { value: "ALL", label: "All months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export default function EquipmentTesting() {
  const { canCreate } = usePmsRole();
  const canPlan = canCreate;

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState("ALL");
  const [location, setLocation] = useState("ALL");
  const [equipments, setEquipments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // per-row plannedOn & tester
  const [rowInputs, setRowInputs] = useState({});
  const [savingRow, setSavingRow] = useState(null);
  const [rowSuccess, setRowSuccess] = useState(null);

  const loadEquipments = async (selectedYear) => {
    if (!selectedYear) return;
    setLoading(true);
    setError(null);
    setRowSuccess(null);
    try {
      const res = await fetch(
        `/api/pms/equipment-testing/list?year=${encodeURIComponent(
          selectedYear
        )}`
      );

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        throw new Error("Server returned invalid response");
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load equipments");
      }

      const rows = data.data || [];
      setEquipments(rows);

      // initialise empty inputs per row
      const initialInputs = {};
      rows.forEach((eq) => {
        initialInputs[eq._id] = {
          plannedOn: "",
          tester: "",
        };
      });
      setRowInputs(initialInputs);
    } catch (err) {
      console.error("Load equipments error:", err);
      setEquipments([]);
      setError(err.message || "Failed to load equipments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEquipments(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  /** Apply month + location filters client-side (year is already fetched server-side). */
  const filteredEquipments = equipments.filter((eq) => {
    if (month !== "ALL") {
      const m = eq.nextTestDate ? new Date(eq.nextTestDate).getMonth() + 1 : null;
      if (m !== Number(month)) return false;
    }
    if (location !== "ALL") {
      const matches =
        (location === "OFFICE" && eq.placedInOffice) ||
        (location === "BASE" && eq.placedInBase) ||
        (location === "BAY" && eq.placedInBay);
      if (!matches) return false;
    }
    return true;
  });

  const testingPagination = useOperationsClientPagination(
    filteredEquipments,
    `${year}|${month}|${location}|${filteredEquipments.length}`
  );
  const {
    paginatedItems: paginatedEquipments,
    ...testingPaginationFooterProps
  } = testingPagination;

  const handleInputChange = (equipmentId, field, value) => {
    setRowInputs((prev) => ({
      ...prev,
      [equipmentId]: {
        ...(prev[equipmentId] || { plannedOn: "", tester: "" }),
        [field]: value,
      },
    }));
  };

  const handlePlanTest = async (equipment) => {
    if (!canPlan) return;
    const input = rowInputs[equipment._id] || {
      plannedOn: "",
      tester: "",
    };

    if (!input.plannedOn || !input.tester) {
      setError("Please fill Planned On and Tester for the selected row.");
      return;
    }

    setSavingRow(equipment._id);
    setError(null);
    setRowSuccess(null);

    try {
      const res = await fetch("/api/pms/equipment-testing/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          equipmentId: equipment._id,
          plannedOn: input.plannedOn,
          tester: input.tester,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create test plan");
      }

      const label =
        equipment.serialCode?.trim() || equipment.equipmentCode || "equipment";
      setRowSuccess(
        `Test plan created for ${label} (${equipment.equipmentType || "—"}).`
      );

      // clear inputs for that row
      setRowInputs((prev) => ({
        ...prev,
        [equipment._id]: {
          plannedOn: "",
          tester: "",
        },
      }));

      // Reload equipment data to show the newly planned test
      await loadEquipments(year);
    } catch (err) {
      console.error("Create test plan error:", err);
      setError(err.message || "Failed to create test plan");
    } finally {
      setSavingRow(null);
    }
  };

  const yearOptions = [];
  for (let y = currentYear - 2; y <= currentYear + 3; y += 1) {
    yearOptions.push(y);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-sky-300">
          PMS / Equipment Testing
        </p>
        <h2 className="text-xl font-bold text-white mt-1">Equipment Testing</h2>
        <p className="text-xs text-slate-200 mt-1">
          Plan annual tests for active equipment. Select a year to see items
          coming due, then enter planned dates and testers.
        </p>
      </div>

      {!canPlan && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">
          You do not have permission to plan or save equipment tests.
        </div>
      )}

      {/* Filters — z-40 so open menus paint above the inventory card (backdrop-blur stacking) */}
      <div className="relative z-40 rounded-3xl border border-white/10 bg-[#0b2740]/70 backdrop-blur-[2px] px-4 py-3 shadow-xl">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-xs text-slate-300">Select Year</span>
            <OperationsSelectField
              variant="pill"
              ariaLabel="Select year"
              value={String(year)}
              onChange={(v) => setYear(Number(v))}
              options={yearOptions.map((y) => ({
                value: String(y),
                label: String(y),
              }))}
              className="min-w-0 w-[6.25rem] sm:w-28"
              triggerClassName="ops-select-trigger w-full rounded-lg px-3 py-1.5 text-xs"
            />
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-xs text-slate-300">Month</span>
            <OperationsSelectField
              variant="pill"
              ariaLabel="Filter by month"
              value={month}
              onChange={(v) => setMonth(v)}
              options={MONTH_OPTIONS}
              className="min-w-0 w-[8rem] sm:w-36"
              triggerClassName="ops-select-trigger w-full rounded-lg px-3 py-1.5 text-xs"
            />
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-xs text-slate-300">Location</span>
            <OperationsSelectField
              variant="pill"
              ariaLabel="Filter by location"
              value={location}
              onChange={(v) => setLocation(v)}
              options={LOCATION_OPTIONS}
              className="min-w-0 w-[8rem] sm:w-36"
              triggerClassName="ops-select-trigger w-full rounded-lg px-3 py-1.5 text-xs"
            />
          </div>

          <button
            type="button"
            onClick={() => loadEquipments(year)}
            disabled={loading}
            className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-sky-400/40 text-sky-200 hover:bg-sky-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {(error || rowSuccess) && (
        <div>
          {error && (
            <div className="mb-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
              {error}
            </div>
          )}
          {rowSuccess && (
            <div className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-xs text-emerald-100">
              {rowSuccess}
            </div>
          )}
        </div>
      )}

      {/* Table — z-0 stays below filter strip while filter is open */}
      <div className="relative z-0 rounded-3xl border border-white/10 bg-[#0b2740]/75 backdrop-blur-[2px] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">
            Equipment inventory
          </h3>
          <p className="text-[11px] text-slate-400">
            Last updated :{" "}
            <span className="text-slate-200">
              {new Date().toLocaleDateString("en-GB")}
            </span>
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-auto styled-scrollbar">
          <table className="w-full text-xs min-w-[1000px]">
            <thead>
              <tr className="text-left text-slate-100 border-b border-white/10 bg-white/10">
                <th className="px-4 py-3 font-semibold text-sm">
                  Equipment Type
                </th>
                <th className="px-4 py-3 font-semibold text-sm">
                  Serial Code
                </th>
                <th className="px-4 py-3 font-semibold text-sm">
                  Equipment Number
                </th>
                <th className="px-4 py-3 font-semibold text-sm">
                  Last test date
                </th>
                <th className="px-4 py-3 font-semibold text-sm">
                  Next test date
                </th>
                <th className="px-4 py-3 font-semibold text-sm">Planned on</th>
                <th className="px-4 py-3 font-semibold text-sm">Planned tester</th>
                <th className="px-4 py-3 font-semibold text-right text-sm">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipments.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    {equipments.length === 0
                      ? `No equipment found for ${year}. Try a different year.`
                      : "No equipment matches the selected filters."}
                  </td>
                </tr>
              )}

              {paginatedEquipments.map((eq) => {
                const input = rowInputs[eq._id] || {
                  plannedOn: "",
                  tester: "",
                };
                
                // Use planned test data if available, otherwise use input
                const hasPlannedTest = !!eq.plannedTest;
                
                return (
                  <tr
                    key={eq._id}
                    className="border-t border-white/5 hover:bg-white/5 transition"
                  >
                    <td className="px-4 py-4 text-sm font-semibold text-white">
                      {eq.equipmentType || "—"}
                    </td>
                    <td className="px-4 py-4 text-sm font-mono text-slate-100">
                      {eq.serialCode || "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-100">
                      {eq.equipmentCode || "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-100">
                      {formatDate(eq.lastTestDate)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-100">
                      {formatDate(eq.nextTestDate)}
                    </td>
                    <td className="px-4 py-4">
                      {hasPlannedTest ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-emerald-300 font-medium">
                            {formatDate(eq.plannedTest.plannedOn)}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Planned
                          </span>
                        </div>
                      ) : (
                        <input
                          type="date"
                          value={input.plannedOn}
                          onChange={(e) =>
                            handleInputChange(eq._id, "plannedOn", e.target.value)
                          }
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                        />
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {hasPlannedTest ? (
                        <span className="text-xs text-emerald-300 font-medium">
                          {eq.plannedTest.tester}
                        </span>
                      ) : (
                        <input
                          type="text"
                          placeholder="Tester name"
                          value={input.tester}
                          disabled={!canPlan}
                          onChange={(e) =>
                            handleInputChange(eq._id, "tester", e.target.value)
                          }
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50 disabled:opacity-50"
                        />
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {hasPlannedTest ? (
                        <span className="text-xs text-slate-400 italic">Already planned</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePlanTest(eq)}
                          disabled={!canPlan || savingRow === eq._id}
                          className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-1.5 text-[11px] font-semibold text-white shadow shadow-emerald-500/40 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
                        >
                          {savingRow === eq._id ? "Saving..." : "Plan test"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <OperationsListPaginationFooter
          {...testingPaginationFooterProps}
          className="overflow-visible"
        />
      </div>
    </div>
  );
}

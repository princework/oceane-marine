"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

/* ================================================================
   COLOUR PALETTES
   ================================================================ */
const DONUT_COLORS = [
  "#06b6d4", // cyan
  "#f472b6", // pink
  "#a78bfa", // purple
  "#fb923c", // orange
  "#34d399", // emerald
  "#facc15", // yellow
  "#60a5fa", // blue
  "#f87171", // red
  "#4ade80", // green
  "#e879f9", // fuchsia
];

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export default function PmsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pms/dashboard/stats");
      const json = await res.json();
      if (res.status === 401) {
        throw new Error(json.error || "Please sign in to view the PMS dashboard.");
      }
      if (res.status === 403) {
        throw new Error(json.error || "You do not have permission to view PMS statistics.");
      }
      if (!json.success) throw new Error(json.error || "Failed to load stats");
      setData(json.data);
    } catch (err) {
      console.error("PMS Dashboard error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <DashboardSkeleton />;
  if (error)
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  if (!data) return null;

  /* ---------- Chart data ---------- */
  const typeLabels = Object.keys(data.equipmentByType || {});
  const typeValues = Object.values(data.equipmentByType || {});

  const donutData = {
    labels: typeLabels,
    datasets: [
      {
        data: typeValues,
        backgroundColor: DONUT_COLORS.slice(0, typeLabels.length),
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };

  const donutOptions = {
    cutout: "60%",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#f8fafc",
        bodyColor: "#cbd5e1",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.parsed}`,
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* ==================== STAT CARDS ==================== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Total Equipment"
          value={data.totalEquipment}
          gradient="from-cyan-900/40 via-cyan-800/30 to-sky-900/40"
          accent="text-cyan-300"
        />
        <StatCard
          label="Active"
          value={data.activeEquipment}
          gradient="from-emerald-900/40 via-emerald-800/30 to-teal-900/40"
          accent="text-emerald-300"
        />
        <StatCard
          label="In Use"
          value={data.inUseEquipment}
          gradient="from-orange-900/40 via-orange-800/30 to-red-900/40"
          accent="text-orange-300"
        />
        <StatCard
          label="Upcoming Tests"
          value={data.upcomingTestDue}
          gradient="from-blue-900/40 via-blue-800/30 to-indigo-900/40"
          accent="text-blue-300"
        />
        <StatCard
          label="Overdue"
          value={data.overdue}
          gradient="from-red-900/40 via-red-800/30 to-rose-900/40"
          accent="text-red-300"
        />
      </div>

      {/* ==================== MIDDLE ROW: Spare + Donut + In Use ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Usage of Spare */}
        <div className="lg:col-span-3">
          <SpareUsageTable spares={data.spares || []} />
        </div>

        {/* Donut Chart */}
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-[2px] shadow-2xl p-6 h-full flex flex-col">
            <h3 className="text-sm font-semibold text-white/80 mb-4">
              Equipment Distribution
            </h3>
            <div className="flex-1 relative min-h-[260px]">
              {typeLabels.length > 0 ? (
                <Doughnut data={donutData} options={donutOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-white/40 text-sm">
                  No equipment data
                </div>
              )}
            </div>
            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3 justify-center">
              {typeLabels.map((label, i) => (
                <span
                  key={label}
                  className="flex items-center gap-1.5 text-xs text-white/70"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{
                      backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length],
                    }}
                  />
                  {label}{" "}
                  <span className="text-white/40">({typeValues[i]})</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Equipment currently in Use */}
        <div className="lg:col-span-5">
          <EquipmentInUseTable items={data.equipmentInUse || []} />
        </div>
      </div>

      {/* ==================== WAREHOUSE MOVEMENT ==================== */}
      <WarehouseMovementTracker movements={data.warehouseMovements || []} />

      {/* ==================== EQUIPMENT BY LOCATION ==================== */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-[2px] shadow-2xl p-6">
        <h3 className="text-sm font-semibold text-white/80 mb-4">
          Equipment by Location
        </h3>
        {Object.keys(data.equipmentByLocation || {}).length > 0 ? (
          <div className="overflow-x-auto max-h-48 overflow-y-auto styled-scrollbar">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-slate-800">
                <tr className="text-white/50 border-b border-white/10">
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 px-3 text-center">Primary</th>
                  <th className="py-2 px-3 text-center">Secondary</th>
                  <th className="py-2 pl-3 text-center">Hoses</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.equipmentByLocation).map(
                  ([loc, vals]) => (
                    <tr
                      key={loc}
                      className="border-b border-white/5 hover:bg-white/5 transition"
                    >
                      <td className="py-2 pr-3 text-white/80 font-medium">
                        {formatLocation(loc)}
                      </td>
                      <td className="py-2 px-3 text-center text-cyan-300">
                        {vals.primaryFenders}
                      </td>
                      <td className="py-2 px-3 text-center text-purple-300">
                        {vals.secondaryFenders}
                      </td>
                      <td className="py-2 pl-3 text-center text-orange-300">
                        {vals.hoses}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-white/40 text-sm">No location data available</p>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   SUB-COMPONENTS
   ================================================================ */

function StatCard({ label, value, gradient, accent }) {
  return (
    <div
      className={`rounded-2xl border border-white/15 bg-gradient-to-br ${gradient} backdrop-blur-[2px] shadow-2xl p-5 hover:shadow-lg transition-all hover:scale-[1.03] cursor-default`}
    >
      <h3 className={`text-xs font-semibold ${accent} uppercase tracking-wider mb-2`}>
        {label}
      </h3>
      <p className="text-2xl sm:text-3xl font-bold text-white">{value ?? 0}</p>
    </div>
  );
}


/* ---------- Usage of Spare Table ---------- */
function SpareUsageTable({ spares }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-[2px] shadow-2xl h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-800/60 to-sky-900/60 rounded-t-2xl px-5 py-3 border-b border-white/10">
        <h3 className="text-sm font-bold text-cyan-100 tracking-wide">
          Usage of Spare
        </h3>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto styled-scrollbar">
        {spares.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cyan-400/20 bg-cyan-950/30">
                <th className="text-left px-5 py-2.5 text-cyan-200/80 font-semibold text-xs">
                  Item
                </th>
                <th className="text-center px-5 py-2.5 text-cyan-200/80 font-semibold text-xs">
                  Qty
                </th>
              </tr>
            </thead>
            <tbody>
              {spares.map((s, i) => (
                <tr
                  key={s._id || i}
                  className="border-b border-white/5 hover:bg-white/5 transition"
                >
                  <td className="px-5 py-3 text-white/90 font-medium">
                    {s.equipmentName}
                  </td>
                  <td className="px-5 py-3 text-center text-white font-bold">
                    {s.quantity ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center py-10 text-white/40 text-sm">
            No spare data available
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Equipment currently in Use ---------- */
function EquipmentInUseTable({ items }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-[2px] shadow-2xl h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600/70 to-orange-700/70 rounded-t-2xl px-5 py-3 border-b border-white/10">
        <h3 className="text-sm font-bold text-orange-50 tracking-wide">
          Equipment Currently In Use
        </h3>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[340px] styled-scrollbar">
        {items.length > 0 ? (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-orange-950/50 z-10">
              <tr className="border-b border-orange-400/20">
                <th className="text-left px-4 py-2.5 text-orange-200/80 font-semibold whitespace-nowrap">
                  Date
                </th>
                <th className="text-left px-4 py-2.5 text-orange-200/80 font-semibold whitespace-nowrap">
                  Ops
                </th>
                <th className="text-left px-4 py-2.5 text-orange-200/80 font-semibold whitespace-nowrap">
                  Equipment
                </th>
                <th className="text-left px-4 py-2.5 text-orange-200/80 font-semibold whitespace-nowrap">
                  Type
                </th>
                <th className="text-left px-4 py-2.5 text-orange-200/80 font-semibold whitespace-nowrap">
                  Location
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr
                  key={i}
                  className="border-b border-white/5 hover:bg-white/5 transition"
                >
                  <td className="px-4 py-2.5 text-white/70 whitespace-nowrap">
                    {item.date
                      ? new Date(item.date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 text-[10px] font-semibold">
                      {item.operationRef || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-white/90 font-medium whitespace-nowrap">
                    {item.equipmentName}
                  </td>
                  <td className="px-4 py-2.5 text-white/60 whitespace-nowrap">
                    {item.equipmentType}
                  </td>
                  <td className="px-4 py-2.5 text-white/60 whitespace-nowrap">
                    {item.location}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center py-10 text-white/40 text-sm">
            No equipment currently in use
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Current Warehouse Movement ---------- */
function WarehouseMovementTracker({ movements }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-[2px] shadow-2xl p-6">
      <h3 className="text-sm font-semibold text-white/80 mb-5">
        Current Warehouse Movement
      </h3>

      {movements.length > 0 ? (
        <div className="space-y-6">
          {movements.map((m) => (
            <MovementRow key={m._id} movement={m} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-10 text-white/40 text-sm">
          No active movements
        </div>
      )}
    </div>
  );
}

function MovementRow({ movement }) {
  const from = formatLocation(movement.fromLocation);
  const stop = movement.stopover ? formatLocation(movement.stopover) : null;
  const to = formatLocation(movement.toLocation);

  // Build ordered waypoints
  const waypoints = [{ label: from, type: "from" }];
  if (stop) waypoints.push({ label: stop, type: "stop" });
  waypoints.push({ label: to, type: "to" });

  // Calculate truck progress based on startDate & estimatedEndDate
  const calcProgress = () => {
    const start = movement.startDate ? new Date(movement.startDate).getTime() : null;
    const end = movement.estimatedEndDate ? new Date(movement.estimatedEndDate).getTime() : null;
    if (!start || !end || end <= start) return 50; // fallback to midway if no dates
    const now = Date.now();
    if (now <= start) return 0;
    if (now >= end) return 100;
    return ((now - start) / (end - start)) * 100;
  };
  const progress = Math.min(100, Math.max(0, calcProgress()));
  // Map 0-100 progress to 2%-95% CSS left (keep truck within the track bounds)
  const truckLeft = 2 + (progress / 100) * 93;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition">
      {/* Equipment info row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs font-semibold text-white/80">
          {movement.equipment}
        </span>
        {movement.equipmentType && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 font-medium">
            {movement.equipmentType}
          </span>
        )}
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/20">
          {movement.nos} unit{movement.nos > 1 ? "s" : ""}
        </span>
        <div className="ml-auto flex flex-col items-end gap-0.5">
          {movement.startDate && (
            <span className="text-[9px] text-white/25 font-medium">
              Start: {new Date(movement.startDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
          {movement.estimatedEndDate && (
            <span className={`text-[10px] font-semibold ${
              new Date(movement.estimatedEndDate).getTime() < Date.now()
                ? "text-red-400"
                : "text-emerald-400/70"
            }`}>
              ETA: {new Date(movement.estimatedEndDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Track visualization */}
      <div className="relative mx-4">
        {/* Background track line */}
        <div className="absolute top-[9px] left-[10px] right-[10px] h-[2px] bg-slate-600/50">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(148,163,184,0.35) 5px, rgba(148,163,184,0.35) 10px)",
            }}
          />
        </div>

        {/* Waypoints row */}
        <div className="relative flex items-start justify-between">
          {waypoints.map((wp, i) => {
            const isFrom = wp.type === "from";
            const isStop = wp.type === "stop";
            const dotSize = isFrom ? "w-[18px] h-[18px]" : "w-[14px] h-[14px]";
            const dotColor = isFrom
              ? "bg-red-500 border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
              : isStop
              ? "bg-amber-400 border-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.4)]"
              : "bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]";
            const topOffset = isFrom ? "" : "mt-[2px]";

            return (
              <div key={i} className="flex flex-col items-center z-[1]" style={{ minWidth: 70 }}>
                <div className={`${dotSize} ${dotColor} ${topOffset} rounded-full border-2`} />
                <span className="text-[11px] text-white/70 font-medium mt-2 text-center whitespace-nowrap">
                  {wp.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Truck on the track — position synced with real dates */}
        <div
          className="absolute z-10 pointer-events-none transition-all duration-1000"
          style={{ left: `${truckLeft}%`, top: "-2px" }}
        >
          <span className="text-sm" style={{ transform: "scaleX(-1)", display: "inline-block" }}>
            🚛
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Dashboard Skeleton ---------- */
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 bg-white/5 h-24"
          />
        ))}
      </div>
      {/* Middle row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/5 h-72" />
        <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 h-72" />
        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-white/5 h-72" />
      </div>
      {/* Movement skeleton */}
      <div className="rounded-2xl border border-white/10 bg-white/5 h-40" />
    </div>
  );
}

/* ================================================================
   HELPERS
   ================================================================ */
function formatLocation(loc) {
  if (!loc) return "—";
  return loc
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bLpg\b/g, "LPG");
}

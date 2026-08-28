"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  DashboardHorizontalBarChart,
  DashboardStackedBarChart,
} from "./charts/DashboardChartPrimitives";

/* chart.js — lazy-loaded so main bundle stays small */
const DoughnutChart = dynamic(
  () =>
    Promise.all([
      import("react-chartjs-2"),
      import("chart.js/auto")
    ]).then(([reactChartJs2]) => {
      // Chart.js/auto automatically registers all components including ArcElement
      return { default: reactChartJs2.Doughnut };
    }),
  { ssr: false, loading: () => <ChartPlaceholder /> }
);

/* ================================================================
   COLOUR PALETTES
   ================================================================ */
const DONUT_COLORS = [
  "#06b6d4",
  "#f472b6",
  "#a78bfa",
  "#fb923c",
  "#34d399",
  "#facc15",
  "#60a5fa",
  "#f87171",
  "#4ade80",
  "#e879f9",
];

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export default function PMSCharts({ refreshKey }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pms/dashboard/stats");
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (!data.success)
        throw new Error(data.error || "Failed to fetch PMS statistics");
      if (!data.data) throw new Error("No data received from API");
      setStats(data.data);
    } catch (err) {
      console.error("PMS Dashboard Fetch Error:", err);
      setError(err.message || "Failed to load PMS statistics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshKey]);

  /* ---------- Early returns ---------- */
  if (error) {
    return (
      <div className="space-y-6">
        <SectionHeader />
        <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
          Error: {error}
        </div>
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <SectionHeader />
        <DashboardSkeleton />
      </div>
    );
  }

  /* ---------- Chart data ---------- */
  const typeLabels = Object.keys(stats.equipmentByType || {});
  const typeValues = Object.values(stats.equipmentByType || {});

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
        callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed}` },
      },
    },
  };

  /* ---------- Retirement chart data ---------- */
  const retirementData = Object.entries(stats.retirement || {}).map(
    ([type, count]) => ({ type, count })
  );

  /* ---------- Stacked bar chart data by location ---------- */
  const locKeys = Object.keys(stats.equipmentByLocation || {});
  const stackedChartData = locKeys.map((loc) => {
    const d = stats.equipmentByLocation[loc] || {};
    return {
      location: formatLocation(loc),
      primaryFenders: d.primaryFenders || 0,
      secondaryFenders: d.secondaryFenders || 0,
      hoses: d.hoses || 0,
      total: (d.primaryFenders || 0) + (d.secondaryFenders || 0) + (d.hoses || 0),
    };
  });

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <SectionHeader />

      {/* ==================== ROW 1 — STAT CARDS ==================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard
          label="Total Equipment"
          value={stats.totalEquipment}
          gradient="from-cyan-900/40 via-cyan-800/30 to-sky-900/40"
          accent="text-cyan-300"
        />
        <StatCard
          label="Active"
          value={stats.activeEquipment}
          gradient="from-emerald-900/40 via-emerald-800/30 to-teal-900/40"
          accent="text-emerald-300"
        />
        <StatCard
          label="In Use"
          value={stats.inUseEquipment}
          gradient="from-orange-900/40 via-orange-800/30 to-red-900/40"
          accent="text-orange-300"
        />
        <StatCard
          label="Certifications"
          value={stats.totalCertificates}
          gradient="from-violet-900/40 via-violet-800/30 to-purple-900/40"
          accent="text-violet-300"
        />
        <StatCard
          label="Upcoming Tests"
          value={stats.upcomingTestDue}
          gradient="from-blue-900/40 via-blue-800/30 to-indigo-900/40"
          accent="text-blue-300"
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          gradient="from-red-900/40 via-red-800/30 to-rose-900/40"
          accent="text-red-300"
        />
      </div>

      {/* ==================== ROW 2 — HOSES / FENDERS ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        {/* Total Hoses */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-teal-900/40 via-teal-800/30 to-cyan-900/40 backdrop-blur-md shadow-2xl p-4 md:p-6 hover:shadow-teal-500/20 transition-all hover:scale-[1.02] md:hover:scale-105">
          <h3 className="text-xs md:text-sm font-semibold text-teal-300 mb-3 md:mb-4">
            Total number of Hoses
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-[10px] md:text-xs text-slate-300">Total Hoses</span>
            <span className="text-xl md:text-2xl font-bold text-white">
              {stats.hoses?.total ?? 0}
            </span>
          </div>
        </div>

        {/* Total Fenders */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-indigo-900/40 via-indigo-800/30 to-purple-900/40 backdrop-blur-md shadow-2xl p-4 md:p-6 hover:shadow-indigo-500/20 transition-all hover:scale-[1.02] md:hover:scale-105">
          <h3 className="text-xs md:text-sm font-semibold text-indigo-300 mb-3 md:mb-4">
            Total Number of Fenders
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] md:text-xs text-slate-300">Primary Fenders</span>
              <span className="text-lg md:text-xl font-bold text-white">
                {stats.fenders?.primary ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] md:text-xs text-slate-300">Secondary Fenders</span>
              <span className="text-lg md:text-xl font-bold text-white">
                {stats.fenders?.secondary ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== ROW 3 — SPARE / DONUT / IN USE ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 md:gap-4 lg:gap-6">
        {/* Usage of Spare */}
        <div className="md:col-span-1 lg:col-span-3">
          <SpareUsageTable spares={stats.spares || []} />
        </div>

        {/* Donut Chart */}
        <div className="md:col-span-1 lg:col-span-4">
          <div className="rounded-xl md:rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 h-full flex flex-col">
            <h3 className="text-xs sm:text-sm font-semibold text-white/80 mb-3 md:mb-4">
              Total accessories
            </h3>
            <div className="flex-1 relative min-h-[180px] sm:min-h-[200px] md:min-h-[260px]">
              {typeLabels.length > 0 ? (
                <DoughnutChart data={donutData} options={donutOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-white/40 text-xs sm:text-sm">
                  No equipment data
                </div>
              )}
            </div>
            {/* Legend */}
            <div className="mt-3 md:mt-4 flex flex-wrap gap-2 sm:gap-3 justify-center">
              {typeLabels.map((label, i) => (
                <span
                  key={label}
                  className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-white/70"
                >
                  <span
                    className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full inline-block flex-shrink-0"
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
        <div className="md:col-span-2 lg:col-span-5 min-h-0">
          <EquipmentInUseTable items={stats.equipmentInUse || []} />
        </div>
      </div>

      {/* ==================== ROW 4 — WAREHOUSE MOVEMENTS ==================== */}
      <WarehouseMovementTracker movements={stats.warehouseMovements || []} />

      {/* ==================== ROW 5 — RETIREMENT + STACKED BAR (BY LOCATION) ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
        {/* Retirement of equipment */}
        <div className="lg:col-span-1 rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6">
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">
            Retirement of equipment
          </h2>
          <div className="space-y-4">
            {retirementData.length > 0 ? (
              <DashboardHorizontalBarChart
                labels={retirementData.map((d) => d.type)}
                data={retirementData.map((d) => d.count)}
                colors={["#f97316", "#eab308", "#3b82f6", "#8b5cf6"]}
                unitLabel="units"
              />
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                No retired equipment
              </div>
            )}
          </div>
        </div>

        {/* Stacked Bar Chart — Equipment by Location */}
        <div className="lg:col-span-2 rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 overflow-hidden">
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-2 sm:mb-3 md:mb-4">
            Equipment by Location
          </h2>
          {stackedChartData.length > 0 ? (
            <DashboardStackedBarChart
              labels={stackedChartData.map((d) => d.location)}
              series={[
                { label: "P.Fender", data: stackedChartData.map((d) => d.primaryFenders), color: "#22d3ee" },
                { label: "S.Fender", data: stackedChartData.map((d) => d.secondaryFenders), color: "#4ade80" },
                { label: "P.O.Hose", data: stackedChartData.map((d) => d.hoses), color: "#c084fc" },
              ]}
              unitLabel="units"
              className="h-48 sm:h-64 md:h-80"
            />
          ) : (
            <div className="flex items-center justify-center h-48 sm:h-64 md:h-80 text-white/40 text-sm">
              No location data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   SUB-COMPONENTS
   ================================================================ */

function SectionHeader() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-white">PMS</h2>
      <p className="text-sm text-slate-300">Planned Maintenance System</p>
    </div>
  );
}

function StatCard({ label, value, gradient, accent }) {
  return (
    <div
      className={`rounded-xl md:rounded-2xl border border-white/15 bg-gradient-to-br ${gradient} backdrop-blur-md shadow-2xl p-3 md:p-5 hover:shadow-lg transition-all hover:scale-[1.02] md:hover:scale-[1.03] cursor-default`}
    >
      <h3
        className={`text-[10px] md:text-xs font-semibold ${accent} uppercase tracking-wider mb-1 md:mb-2`}
      >
        {label}
      </h3>
      <p className="text-2xl md:text-3xl font-bold text-white">{value ?? 0}</p>
    </div>
  );
}


/* ---------- Usage of Spare Table ---------- */
function SpareUsageTable({ spares }) {
  return (
    <div className="rounded-xl md:rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-md shadow-2xl h-full flex flex-col">
      <div className="bg-gradient-to-r from-cyan-800/60 to-sky-900/60 rounded-t-xl md:rounded-t-2xl px-3 md:px-5 py-2 md:py-3 border-b border-white/10">
        <h3 className="text-xs md:text-sm font-bold text-cyan-100 tracking-wide">
          Usage of Spare
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto styled-scrollbar">
        {spares.length > 0 ? (
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="border-b border-cyan-400/20 bg-cyan-950/30">
                <th className="text-left px-3 md:px-5 py-2 md:py-2.5 text-cyan-200/80 font-semibold text-[10px] md:text-xs">
                  Item
                </th>
                <th className="text-center px-3 md:px-5 py-2 md:py-2.5 text-cyan-200/80 font-semibold text-[10px] md:text-xs">
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
                  <td className="px-3 md:px-5 py-2 md:py-3 text-white/90 font-medium text-xs md:text-sm">
                    {s.equipmentName}
                  </td>
                  <td className="px-3 md:px-5 py-2 md:py-3 text-center text-white font-bold text-xs md:text-sm">
                    {s.quantity ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center py-8 md:py-10 text-white/40 text-xs md:text-sm">
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
    <div className="rounded-xl md:rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-md shadow-2xl h-full flex flex-col">
      <div className="bg-gradient-to-r from-orange-600/70 to-orange-700/70 rounded-t-xl md:rounded-t-2xl px-3 md:px-5 py-2 md:py-3 border-b border-white/10">
        <h3 className="text-xs md:text-sm font-bold text-orange-50 tracking-wide">
          Equipment Currently In Use
        </h3>
      </div>
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto styled-scrollbar">
        {items.length > 0 ? (
          <table className="w-full text-[10px] md:text-xs min-w-[500px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-orange-400/20">
                <th className="text-left px-2 md:px-4 py-1.5 md:py-2.5 text-orange-200/80 font-semibold whitespace-nowrap bg-slate-900">
                  Date
                </th>
                <th className="text-left px-2 md:px-4 py-1.5 md:py-2.5 text-orange-200/80 font-semibold whitespace-nowrap bg-slate-900">
                  Ops
                </th>
                <th className="text-left px-2 md:px-4 py-1.5 md:py-2.5 text-orange-200/80 font-semibold whitespace-nowrap bg-slate-900">
                  Equipment
                </th>
                <th className="text-left px-2 md:px-4 py-1.5 md:py-2.5 text-orange-200/80 font-semibold whitespace-nowrap bg-slate-900">
                  Type
                </th>
                <th className="text-left px-2 md:px-4 py-1.5 md:py-2.5 text-orange-200/80 font-semibold whitespace-nowrap bg-slate-900">
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
                  <td className="px-2 md:px-4 py-1.5 md:py-2.5 text-white/70 whitespace-nowrap">
                    {item.date
                      ? new Date(item.date).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                        })
                      : "—"}
                  </td>
                  <td className="px-2 md:px-4 py-1.5 md:py-2.5 whitespace-nowrap">
                    <span className="inline-block px-1.5 md:px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 text-[9px] md:text-[10px] font-semibold">
                      {item.operationRef || "—"}
                    </span>
                  </td>
                  <td className="px-2 md:px-4 py-1.5 md:py-2.5 text-white/90 font-medium whitespace-nowrap">
                    {item.equipmentName}
                  </td>
                  <td className="px-2 md:px-4 py-1.5 md:py-2.5 text-white/60 whitespace-nowrap">
                    {item.equipmentType}
                  </td>
                  <td className="px-2 md:px-4 py-1.5 md:py-2.5 text-white/60 whitespace-nowrap">
                    {item.location}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center py-8 md:py-10 text-white/40 text-xs md:text-sm">
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
    <div className="rounded-xl md:rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6">
      <h3 className="text-xs md:text-sm font-semibold text-white/80 mb-3 sm:mb-4 md:mb-5">
        Current Warehouse Movement
      </h3>
      {movements.length > 0 ? (
        <div className="space-y-4 md:space-y-6">
          {movements.map((m) => (
            <MovementRow key={m._id} movement={m} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-8 md:py-10 text-white/40 text-xs md:text-sm">
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
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 hover:bg-white/[0.05] transition">
      {/* Equipment info row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] sm:text-xs font-semibold text-white/80">
            {movement.equipment}
          </span>
          {movement.equipmentType && (
            <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 font-medium">
              {movement.equipmentType}
            </span>
          )}
          <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/20">
            {movement.nos} unit{movement.nos > 1 ? "s" : ""}
          </span>
        </div>
        <div className="sm:ml-auto flex sm:flex-col items-start sm:items-end gap-1 sm:gap-0.5">
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
            <span className={`text-[9px] sm:text-[10px] font-semibold ${
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
      <div className="relative mx-1 sm:mx-4 overflow-x-auto">
        <div className="min-w-[240px]">
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
              const dotSize = isFrom ? "w-[14px] h-[14px] sm:w-[18px] sm:h-[18px]" : "w-[12px] h-[12px] sm:w-[14px] sm:h-[14px]";
              const dotColor = isFrom
                ? "bg-red-500 border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                : isStop
                ? "bg-amber-400 border-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                : "bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]";
              const topOffset = isFrom ? "" : "mt-[2px]";

              return (
                <div key={i} className="flex flex-col items-center z-[1] min-w-[50px] sm:min-w-[70px]">
                  <div className={`${dotSize} ${dotColor} ${topOffset} rounded-full border-2`} />
                  <span className="text-[9px] sm:text-[11px] text-white/70 font-medium mt-1.5 sm:mt-2 text-center break-words max-w-[60px] sm:max-w-none sm:whitespace-nowrap">
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
            <span className="text-xs sm:text-sm" style={{ transform: "scaleX(-1)", display: "inline-block" }}>
              🚛
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Skeleton ---------- */
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 bg-white/5 h-24"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 bg-white/5 h-32"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/5 h-72" />
        <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 h-72" />
        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-white/5 h-72" />
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 h-40" />
    </div>
  );
}

function ChartPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full min-h-[260px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
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

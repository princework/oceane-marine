"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const ROUTES = {
  kpi: "/qhse/kpi/list",
  dueDiligence: "/qhse/due-diligence-subconstructor/due-diligence-questionnaire/questionnaire-list-admin",
  nearMiss: "/qhse/near-miss",
  baseAudits: "/qhse/forms-checklist/base-audit/list",
  bestPractice: "/qhse/best-practice/create",
};

// Generate years: current year and 5 years back
function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear; i >= currentYear - 5; i--) {
    years.push(i);
  }
  return years;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function QHSECharts() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [stats, setStats] = useState({
    kpi: { completed: 0 },
    dueDiligence: { completed: 0, pending: 0, total: 0 },
    nearMiss: { total: 0, pendingReview: 0, reviewed: 0 },
  });
  const [nearMissQuarterly, setNearMissQuarterly] = useState({
    Q1: 0,
    Q2: 0,
    Q3: 0,
    Q4: 0,
  });
  const [baseAudits, setBaseAudits] = useState({
    locations: {
      Dubai: 0,
      Fujairah: 0,
      Khorfakkan: 0,
      Sohar: 0,
      Mombasa: 0,
      "Tanjung Bruas": 0,
    },
    total: 0,
  });
  // Mooring Masters Feedback by quarter (from KPI quarterly API)
  const [mooringMastersQuarterly, setMooringMastersQuarterly] = useState({
    Q1: 0,
    Q2: 0,
    Q3: 0,
    Q4: 0,
  });
  // Best Practices donut: segments from API (by quarter), with colors
  const BEST_PRACTICE_COLORS = [
    "rgba(251, 146, 60, 0.9)",
    "rgba(139, 92, 246, 0.9)",
    "rgba(59, 130, 246, 0.9)",
    "rgba(239, 68, 68, 0.9)",
  ];
  const [bestPracticesByQuarter, setBestPracticesByQuarter] = useState({
    Q1: 0,
    Q2: 0,
    Q3: 0,
    Q4: 0,
  });
  const [bestPracticesTotal, setBestPracticesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("year", selectedYear.toString());
      if (selectedMonth) {
        params.append("month", selectedMonth.toString());
      }

      // Fetch all dashboard data from backend
      const [statsRes, quarterlyRes, baseAuditsRes, kpiQuarterlyRes, bestPracticesRes] = await Promise.all([
        fetch(`/api/qhse/dashboard/stats?${params.toString()}`),
        fetch(`/api/qhse/dashboard/near-miss-quarterly?year=${selectedYear}`),
        fetch(`/api/qhse/dashboard/base-audits?year=${selectedYear}`),
        fetch(`/api/qhse/dashboard/kpi-quarterly?year=${selectedYear}`),
        fetch(`/api/qhse/dashboard/best-practices-stats?year=${selectedYear}`),
      ]);

      const statsData = await statsRes.json();
      const quarterlyData = await quarterlyRes.json();
      const baseAuditsData = await baseAuditsRes.json();
      const kpiQuarterlyData = await kpiQuarterlyRes.json();
      const bestPracticesData = await bestPracticesRes.json();

      if (!statsRes.ok || !statsData.success) {
        throw new Error(statsData.error || "Failed to fetch statistics");
      }

      setStats(statsData.data);

      if (quarterlyData.success) {
        setNearMissQuarterly(quarterlyData.data);
      }

      if (baseAuditsData.success) {
        setBaseAudits(baseAuditsData.data);
      }

      if (kpiQuarterlyData.success && kpiQuarterlyData.data) {
        setMooringMastersQuarterly(kpiQuarterlyData.data);
      }

      if (bestPracticesData.success && bestPracticesData.data) {
        setBestPracticesByQuarter(bestPracticesData.data.byQuarter || { Q1: 0, Q2: 0, Q3: 0, Q4: 0 });
        setBestPracticesTotal(bestPracticesData.data.total ?? 0);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth]);

  // Refetch when user returns to this tab/window so new data is reflected
  useEffect(() => {
    const onFocus = () => fetchStats();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth]);

  const handleYearChange = (year) => {
    setSelectedYear(Number(year));
    setSelectedMonth(null);
  };

  const handleMonthChange = (month) => {
    setSelectedMonth(month === "all" ? null : Number(month));
  };

  // Chart data
  const barChartData = {
    labels: ["Q1", "Q2", "Q3", "Q4"],
    datasets: [
      {
        label: "Near Miss Reports",
        data: [
          nearMissQuarterly.Q1,
          nearMissQuarterly.Q2,
          nearMissQuarterly.Q3,
          nearMissQuarterly.Q4,
        ],
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };

  const doughnutChartData = {
    labels: ["Completed", "Pending", "In Progress"],
    datasets: [
      {
        data: [
          stats.dueDiligence.completed,
          stats.dueDiligence.pending,
          stats.dueDiligence.total -
            stats.dueDiligence.completed -
            stats.dueDiligence.pending,
        ],
        backgroundColor: [
          "rgba(251, 146, 60, 0.8)",
          "rgba(139, 92, 246, 0.8)",
          "rgba(59, 130, 246, 0.8)",
          "rgba(239, 68, 68, 0.8)",
        ],
        borderColor: [
          "rgba(251, 146, 60, 1)",
          "rgba(139, 92, 246, 1)",
          "rgba(59, 130, 246, 1)",
          "rgba(239, 68, 68, 1)",
        ],
        borderWidth: 2,
      },
    ],
  };

  const lineChartData = {
    labels: [
      "Dubai",
      "Fujairah",
      "Khorfakkan",
      "Sohar",
      "Mombasa",
      "Tanjung Bruas",
    ],
    datasets: [
      {
        label: "Base Audits",
        data: [
          baseAudits.locations.Dubai || 0,
          baseAudits.locations.Fujairah || 0,
          baseAudits.locations.Khorfakkan || 0,
          baseAudits.locations.Sohar || 0,
          baseAudits.locations.Mombasa || 0,
          baseAudits.locations["Tanjung Bruas"] || 0,
        ],
        borderColor: "rgba(59, 130, 246, 1)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 6,
        pointBackgroundColor: "rgba(59, 130, 246, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
      },
    ],
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-base sm:text-xl font-semibold text-white">QHSE Dashboard</h2>
          <p className="text-xs sm:text-sm text-slate-300">
            QHSE module statistics and overview.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <label className="text-xs sm:text-sm font-semibold text-slate-200">
              Year:
            </label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              {getYears().map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <label className="text-xs sm:text-sm font-semibold text-slate-200">
              Month:
            </label>
            <select
              value={selectedMonth || "all"}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="all">All Months</option>
              {MONTHS.map((month, index) => (
                <option key={index + 1} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      ) : (
        <>
          {/* Key Metrics Cards - clickable, route to modules */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {/* KPI Completed Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => router.push(ROUTES.kpi)}
              onKeyDown={(e) => e.key === "Enter" && router.push(ROUTES.kpi)}
              className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-indigo-900/40 backdrop-blur-md shadow-2xl p-4 md:p-6 hover:shadow-purple-500/20 transition-all hover:scale-[1.02] md:hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border border-purple-400/30">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-purple-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-[10px] sm:text-xs uppercase tracking-wider text-purple-300 mb-1 sm:mb-2">
                KPI Completed
              </h3>
              <p className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {stats.kpi.completed}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-300">
                {selectedMonth
                  ? `${MONTHS[selectedMonth - 1]} ${selectedYear}`
                  : `Year ${selectedYear}`}
              </p>
            </div>

            {/* Due Diligence Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => router.push(ROUTES.dueDiligence)}
              onKeyDown={(e) => e.key === "Enter" && router.push(ROUTES.dueDiligence)}
              className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-emerald-900/40 via-teal-800/30 to-cyan-900/40 backdrop-blur-md shadow-2xl p-4 md:p-6 hover:shadow-emerald-500/20 transition-all hover:scale-[1.02] md:hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border border-emerald-400/30">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-[10px] sm:text-xs uppercase tracking-wider text-emerald-300 mb-1 sm:mb-2">
                Due Diligence
              </h3>
              <p className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {stats.dueDiligence.completed}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-300">
                Pending: {stats.dueDiligence.pending}
              </p>
            </div>

            {/* Near Miss Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => router.push(ROUTES.nearMiss)}
              onKeyDown={(e) => e.key === "Enter" && router.push(ROUTES.nearMiss)}
              className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-amber-900/40 via-yellow-800/30 to-orange-900/40 backdrop-blur-md shadow-2xl p-4 md:p-6 hover:shadow-amber-500/20 transition-all hover:scale-[1.02] md:hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-amber-400/30">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-[10px] sm:text-xs uppercase tracking-wider text-amber-300 mb-1 sm:mb-2">
                Near Miss Raised
              </h3>
              <p className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {stats.nearMiss.total}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-300">
                Pending Review: {stats.nearMiss.pendingReview}
              </p>
            </div>

          </div>

          {/* Charts Section */}
          {/* First Row - Near Miss and Due Diligence - charts clickable */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6 mt-4 md:mt-6">
            {/* Bar Chart - Near Miss by Quarter */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => router.push(ROUTES.nearMiss)}
              onKeyDown={(e) => e.key === "Enter" && router.push(ROUTES.nearMiss)}
              className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 cursor-pointer hover:border-sky-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            >
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">
                Near Miss Reports (Quarter-wise)
              </h2>
              <div className="h-48 sm:h-64 md:h-80 flex items-end justify-around gap-1 sm:gap-2 px-2 sm:px-4">
                {barChartData.labels.map((label, idx) => {
                  const value = barChartData.datasets[0].data[idx];
                  const maxValue = Math.max(...barChartData.datasets[0].data, 1);
                  // Calculate height: if value > 0, show proportional height, otherwise show minimum 4px
                  const height = value > 0 
                    ? Math.max((value / maxValue) * 100, 8) 
                    : 2;
                  return (
                    <div
                      key={label}
                      className="flex-1 flex flex-col items-center gap-2"
                    >
                      <div className="w-full relative" style={{ height: "100%" }}>
                        <div
                          className={`w-full rounded-t-lg relative transition-all ${
                            value > 0 
                              ? "bg-gradient-to-t from-blue-500 to-blue-400" 
                              : "bg-white/10"
                          }`}
                          style={{ 
                            height: `${height}%`, 
                            minHeight: value > 0 ? "8px" : "2px" 
                          }}
                        >
                          {value > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-600 to-blue-500 rounded-t-lg h-full shadow-lg shadow-blue-500/30"></div>
                          )}
                        </div>
                        <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-white whitespace-nowrap">
                          {value}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-300">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Doughnut Chart - Due Diligence Status */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => router.push(ROUTES.dueDiligence)}
              onKeyDown={(e) => e.key === "Enter" && router.push(ROUTES.dueDiligence)}
              className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 cursor-pointer hover:border-sky-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            >
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">
                Due Diligence Status
              </h2>
              <div className="h-64 sm:h-72 md:h-80 flex flex-col items-center justify-center gap-3 md:gap-4">
                <div className="relative w-48 h-48 sm:w-60 sm:h-60 md:w-72 md:h-72">
                  <svg
                    viewBox="0 0 100 100"
                    className="transform -rotate-90 w-full h-full"
                  >
                    {(() => {
                      const total = doughnutChartData.datasets[0].data.reduce(
                        (a, b) => a + b,
                        0
                      );
                      let currentAngle = 0;
                      return doughnutChartData.datasets[0].data.map(
                        (value, idx) => {
                          const percentage =
                            total > 0 ? (value / total) * 100 : 0;
                          const angle = (percentage / 100) * 360;
                          const startAngle = currentAngle;
                          currentAngle += angle;
                          const endAngle = currentAngle;
                          const largeArcFlag = angle > 180 ? 1 : 0;
                          const x1 =
                            50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                          const y1 =
                            50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                          const x2 =
                            50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                          const y2 =
                            50 + 40 * Math.sin((endAngle * Math.PI) / 180);
                          const colors = [
                            "#fb923c",
                            "#8b5cf6",
                            "#3b82f6",
                            "#ef4444",
                          ];
                          return (
                            <path
                              key={idx}
                              d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                              fill={colors[idx] || "#6b7280"}
                              stroke="rgba(0, 0, 0, 0.3)"
                              strokeWidth="1"
                            />
                          );
                        }
                      );
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
                        {doughnutChartData.datasets[0].data.reduce(
                          (a, b) => a + b,
                          0
                        )}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-300">Total</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
                  {doughnutChartData.labels.map((label, idx) => {
                    const value = doughnutChartData.datasets[0].data[idx];
                    const colors = ["#fb923c", "#8b5cf6", "#3b82f6", "#ef4444"];
                    return (
                      <div key={label} className="flex items-center gap-1.5 sm:gap-2">
                        <div
                          className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: colors[idx] || "#6b7280",
                          }}
                        ></div>
                        <span className="text-[10px] sm:text-xs text-slate-300">
                          {label}: {value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* Second Row - Mooring Masters Feedback & Best Practices */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6 mt-4 md:mt-6">
            {/* Bar Chart - Mooring Masters Feedback (Q-1 to Q-4) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => router.push(ROUTES.kpi)}
              onKeyDown={(e) => e.key === "Enter" && router.push(ROUTES.kpi)}
              className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 cursor-pointer hover:border-sky-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            >
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">Mooring Masters Feedback</h2>
              <div className="h-48 sm:h-64 md:h-80 flex items-end justify-around gap-1 sm:gap-2 px-2 sm:px-4">
                {["Q-1", "Q-2", "Q-3", "Q-4"].map((label, idx) => {
                  const value = [mooringMastersQuarterly.Q1, mooringMastersQuarterly.Q2, mooringMastersQuarterly.Q3, mooringMastersQuarterly.Q4][idx];
                  const maxValue = Math.max(mooringMastersQuarterly.Q1, mooringMastersQuarterly.Q2, mooringMastersQuarterly.Q3, mooringMastersQuarterly.Q4, 1);
                  const height = value > 0 ? Math.max((value / maxValue) * 100, 8) : 2;
                  return (
                    <div key={label} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full relative" style={{ height: "100%" }}>
                        <div
                          className={`w-full rounded-t-lg relative transition-all ${value > 0 ? "bg-gradient-to-t from-cyan-500 to-cyan-400" : "bg-white/10"}`}
                          style={{ height: `${height}%`, minHeight: value > 0 ? "8px" : "2px" }}
                        >
                          {value > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-600 to-cyan-500 rounded-t-lg h-full shadow-lg shadow-cyan-500/30" />
                          )}
                        </div>
                        <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-white whitespace-nowrap">{value}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-300">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Donut Chart - Best Practices (from API: by quarter) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => router.push(ROUTES.bestPractice)}
              onKeyDown={(e) => e.key === "Enter" && router.push(ROUTES.bestPractice)}
              className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 cursor-pointer hover:border-sky-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            >
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">Best Practices</h2>
              <div className="h-64 sm:h-72 md:h-80 flex flex-col items-center justify-center gap-3 md:gap-4">
                <div className="relative w-48 h-48 sm:w-60 sm:h-60 md:w-72 md:h-72">
                  <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                    {(() => {
                      const q = bestPracticesByQuarter;
                      const values = [q.Q1, q.Q2, q.Q3, q.Q4];
                      const totalVal = values.reduce((a, b) => a + b, 0);
                      let currentAngle = 0;
                      return values.map((value, idx) => {
                        const percentage = totalVal > 0 ? (value / totalVal) * 100 : 0;
                        const angle = (percentage / 100) * 360;
                        const startAngle = currentAngle;
                        currentAngle += angle;
                        const endAngle = currentAngle;
                        const largeArcFlag = angle > 180 ? 1 : 0;
                        const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                        const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                        const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                        const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
                        return (
                          <path
                            key={idx}
                            d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                            fill={BEST_PRACTICE_COLORS[idx] || "#6b7280"}
                            stroke="rgba(0, 0, 0, 0.3)"
                            strokeWidth="1"
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{bestPracticesTotal}</p>
                      <p className="text-xs sm:text-sm text-slate-300">Total</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
                  {["Q1", "Q2", "Q3", "Q4"].map((label, idx) => {
                    const value = [bestPracticesByQuarter.Q1, bestPracticesByQuarter.Q2, bestPracticesByQuarter.Q3, bestPracticesByQuarter.Q4][idx];
                    const pct = bestPracticesTotal > 0 ? ((value / bestPracticesTotal) * 100).toFixed(1) : "0";
                    return (
                      <div key={label} className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: BEST_PRACTICE_COLORS[idx] }} />
                        <span className="text-[10px] sm:text-xs text-slate-300">{label}: {value} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Third Row - Base Audits Full Width */}
          <div className="mt-4 md:mt-6">
            {/* Line Chart - Base Audits */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => router.push(ROUTES.baseAudits)}
              onKeyDown={(e) => e.key === "Enter" && router.push(ROUTES.baseAudits)}
              className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 cursor-pointer hover:border-sky-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-6">
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-white">Base Audits</h2>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-blue-500"></div>
                  <span className="text-[10px] sm:text-xs text-slate-300">By Location</span>
                </div>
              </div>
              <div className="h-56 sm:h-72 md:h-96 relative pb-4 sm:pb-8 pt-2">
                <svg viewBox="0 0 1000 350" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(59, 130, 246, 0.4)" />
                      <stop offset="50%" stopColor="rgba(59, 130, 246, 0.2)" />
                      <stop offset="100%" stopColor="rgba(59, 130, 246, 0.05)" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {/* Grid lines */}
                  {[0, 1, 2, 3, 4, 5].map((i) => {
                    const y = 40 + (i * 50);
                    return (
                      <line
                        key={i}
                        x1="80"
                        y1={y}
                        x2="920"
                        y2={y}
                        stroke="rgba(255, 255, 255, 0.05)"
                        strokeWidth="1"
                      />
                    );
                  })}
                  
                  {/* Background fill area */}
                  {(() => {
                    const data = lineChartData.datasets[0].data;
                    const maxValue = Math.max(...data, 1);
                    const chartHeight = 250;
                    const chartTop = 40;
                    const points = data.map((value, idx) => {
                      const x = 80 + (idx / (data.length - 1)) * 840;
                      const y = chartTop + chartHeight - (value / maxValue) * chartHeight;
                      return `${x},${y}`;
                    }).join(" ");
                    const bottomY = chartTop + chartHeight;
                    return (
                      <polygon
                        points={`80,${bottomY} ${points} 920,${bottomY}`}
                        fill="url(#lineGradient)"
                      />
                    );
                  })()}
                  
                  {/* Line */}
                  <polyline
                    points={lineChartData.datasets[0].data.map((value, idx) => {
                      const maxValue = Math.max(...lineChartData.datasets[0].data, 1);
                      const chartHeight = 250;
                      const chartTop = 40;
                      const x = 80 + (idx / (lineChartData.datasets[0].data.length - 1)) * 840;
                      const y = chartTop + chartHeight - (value / maxValue) * chartHeight;
                      return `${x},${y}`;
                    }).join(" ")}
                    fill="none"
                    stroke="rgba(59, 130, 246, 1)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow)"
                  />
                  
                  {/* Data points */}
                  {lineChartData.datasets[0].data.map((value, idx) => {
                    const maxValue = Math.max(...lineChartData.datasets[0].data, 1);
                    const chartHeight = 250;
                    const chartTop = 40;
                    const x = 80 + (idx / (lineChartData.datasets[0].data.length - 1)) * 840;
                    const y = chartTop + chartHeight - (value / maxValue) * chartHeight;
                    return (
                      <g key={idx}>
                        <circle
                          cx={x}
                          cy={y}
                          r="9"
                          fill="rgba(59, 130, 246, 1)"
                          stroke="#fff"
                          strokeWidth="3"
                          className="drop-shadow-lg"
                        />
                        <circle
                          cx={x}
                          cy={y}
                          r="5"
                          fill="#fff"
                        />
                        <text
                          x={x}
                          y={y - 25}
                          textAnchor="middle"
                          fill="rgba(255, 255, 255, 0.95)"
                          fontSize="15"
                          fontWeight="700"
                          className="drop-shadow-md"
                        >
                          {value}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* X-axis labels */}
                  {lineChartData.labels.map((label, idx) => {
                    const x = 80 + (idx / (lineChartData.labels.length - 1)) * 840;
                    return (
                      <g key={label}>
                        <text
                          x={x}
                          y="320"
                          textAnchor="middle"
                          fill="rgba(255, 255, 255, 0.8)"
                          fontSize="13"
                          fontWeight="600"
                          className="uppercase tracking-wide"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

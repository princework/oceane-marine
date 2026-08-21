"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DashboardBarChart,
  DashboardDoughnutChart,
  DashboardLineChart,
} from "./charts/DashboardChartPrimitives";

const ROUTES = {
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
      const [statsRes, quarterlyRes, baseAuditsRes, bestPracticesRes] = await Promise.all([
        fetch(`/api/qhse/dashboard/stats?${params.toString()}`),
        fetch(`/api/qhse/dashboard/near-miss-quarterly?year=${selectedYear}`),
        fetch(`/api/qhse/dashboard/base-audits?year=${selectedYear}`),
        fetch(`/api/qhse/dashboard/best-practices-stats?year=${selectedYear}`),
      ]);

      const statsData = await statsRes.json();
      const quarterlyData = await quarterlyRes.json();
      const baseAuditsData = await baseAuditsRes.json();
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
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
              <DashboardBarChart
                labels={barChartData.labels}
                data={barChartData.datasets[0].data}
                color="#3b82f6"
                hoverColor="#60a5fa"
                unitLabel="reports"
                className="h-48 sm:h-64 md:h-80"
              />
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
              <DashboardDoughnutChart
                labels={doughnutChartData.labels}
                data={doughnutChartData.datasets[0].data}
                colors={["#fb923c", "#8b5cf6", "#3b82f6", "#ef4444"]}
                className="h-64 sm:h-72 md:h-80"
              />
            </div>

          </div>

          {/* Second Row - Best Practices */}
          <div className="grid grid-cols-1 gap-3 md:gap-6 mt-4 md:mt-6">
            {/* Donut Chart - Best Practices (from API: by quarter) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => router.push(ROUTES.bestPractice)}
              onKeyDown={(e) => e.key === "Enter" && router.push(ROUTES.bestPractice)}
              className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 cursor-pointer hover:border-sky-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            >
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">Best Practices</h2>
              <DashboardDoughnutChart
                labels={["Q1", "Q2", "Q3", "Q4"]}
                data={[
                  bestPracticesByQuarter.Q1,
                  bestPracticesByQuarter.Q2,
                  bestPracticesByQuarter.Q3,
                  bestPracticesByQuarter.Q4,
                ]}
                colors={BEST_PRACTICE_COLORS}
                className="h-64 sm:h-72 md:h-80"
              />
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
              <DashboardLineChart
                labels={lineChartData.labels}
                data={lineChartData.datasets[0].data}
                color="#3b82f6"
                className="h-56 sm:h-72 md:h-96"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

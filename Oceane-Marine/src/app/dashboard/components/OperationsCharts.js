"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import OperationsMap from "./OperationsMap";
import WeatherMonitoring from "./WeatherMonitoring";

/* chart.js — lazy-loaded so main bundle stays small (same pattern as PMSCharts) */
const BarChart = dynamic(
  () =>
    Promise.all([import("react-chartjs-2"), import("chart.js/auto")]).then(
      ([reactChartJs2]) => ({ default: reactChartJs2.Bar })
    ),
  { ssr: false, loading: () => <ChartLoadingSpinner /> }
);

function ChartLoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400" />
    </div>
  );
}

/** Draws the count above each bar — chart.js has no built-in data-label support. */
const barValueLabelsPlugin = {
  id: "barValueLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        if (value === undefined || value === null) return;
        ctx.save();
        ctx.fillStyle = "#f8fafc";
        ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(String(value), bar.x, bar.y - 6);
        ctx.restore();
      });
    });
  },
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

// Format number with Lakh, Million, Billion, and Trillion conversion
function formatNumber(num) {
  if (num >= 1000000000000) {
    // Convert to trillions
    const trillions = num / 1000000000000;
    return `${trillions.toFixed(1).replace(/\.0$/, "")}T`;
  } else if (num >= 1000000000) {
    // Convert to billions
    const billions = num / 1000000000;
    return `${billions.toFixed(1).replace(/\.0$/, "")}B`;
  } else if (num >= 1000000) {
    // Convert to millions
    const millions = num / 1000000;
    return `${millions.toFixed(1).replace(/\.0$/, "")}M`;
  } else if (num >= 100000) {
    // Convert to lakhs
    const lakhs = num / 100000;
    const lakhsInt = Math.floor(lakhs);
    const remainder = lakhs - lakhsInt;
    
    if (remainder === 0) {
      return `${lakhsInt} Lakh`;
    } else {
      // Show decimal if needed (e.g., 1.5 Lakh)
      return `${lakhs.toFixed(1).replace(/\.0$/, "")} Lakh`;
    }
  } else {
    // Show as is with comma formatting
    return num.toLocaleString();
  }
}

export default function OperationsCharts() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const [stats, setStats] = useState({
    totalOperations: 0,
    statusCount: { COMPLETED: 0, CANCELED: 0, INPROGRESS: 0, PENDING: 0 },
    locationWise: {},
    totalBarrels: 0,
    mostUsedMooringMaster: [],
    cargoTypes: {},
    loaRanges: {},
    clientsData: [],
  });
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

      const res = await fetch(`/api/operations/dashboard/stats?${params.toString()}`);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch operations statistics");
      }

      if (data.data) {
        setStats(data.data);
      } else {
        throw new Error("No data received from API");
      }
    } catch (err) {
      console.error("Operations Dashboard Fetch Error:", err);
      setError(err.message || "Failed to load operations statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth]);

  const handleYearChange = (year) => {
    setSelectedYear(Number(year));
    setSelectedMonth(null);
  };

  const handleMonthChange = (month) => {
    setSelectedMonth(month === "all" ? null : Number(month));
  };

  // Location data for chart
  const locationData = Object.entries(stats.locationWise || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Cargo types data
  const cargoData = Object.entries(stats.cargoTypes || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Operations</h2>
          <p className="text-sm text-slate-300">Overview of STS operations</p>
        </div>
        <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
          Error: {error}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Operations</h2>
          <p className="text-sm text-slate-300">Overview of STS operations</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-base sm:text-xl font-semibold text-white">Operations</h2>
          <p className="text-xs sm:text-sm text-slate-300">Overview of STS operations</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <label className="text-xs sm:text-sm font-semibold text-slate-200">Year:</label>
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
            <label className="text-xs sm:text-sm font-semibold text-slate-200">Month:</label>
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

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
        {/* Overall STS Operations */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-orange-900/40 via-orange-800/30 to-red-900/40 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 hover:shadow-orange-500/20 transition-all hover:scale-[1.02] md:hover:scale-105">
          <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold text-orange-300 mb-1 sm:mb-2">Overall STS Operations</h3>
          <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{stats.totalOperations}</p>
        </div>

        {/* Total Barrels */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-emerald-900/40 via-emerald-800/30 to-teal-900/40 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 hover:shadow-emerald-500/20 transition-all hover:scale-[1.02] md:hover:scale-105">
          <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold text-emerald-300 mb-1 sm:mb-2">Total Barrels Transferred</h3>
          <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{formatNumber(stats.totalBarrels)}</p>
        </div>

        {/* Completed */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-green-900/40 via-green-800/30 to-emerald-900/40 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 hover:shadow-green-500/20 transition-all hover:scale-[1.02] md:hover:scale-105">
          <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold text-green-300 mb-1 sm:mb-2">Completed</h3>
          <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{stats.statusCount.COMPLETED}</p>
        </div>

        {/* In Progress */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-blue-900/40 via-blue-800/30 to-cyan-900/40 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 hover:shadow-blue-500/20 transition-all hover:scale-[1.02] md:hover:scale-105">
          <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold text-blue-300 mb-1 sm:mb-2">In Progress</h3>
          <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{stats.statusCount.INPROGRESS}</p>
        </div>

        {/* Pending */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-yellow-900/40 via-yellow-800/30 to-amber-900/40 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 hover:shadow-yellow-500/20 transition-all hover:scale-[1.02] md:hover:scale-105">
          <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold text-yellow-300 mb-1 sm:mb-2">Pending</h3>
          <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{stats.statusCount.PENDING}</p>
        </div>

        {/* Cancelled */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-red-900/40 via-red-800/30 to-rose-900/40 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 hover:shadow-red-500/20 transition-all hover:scale-[1.02] md:hover:scale-105">
          <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold text-red-300 mb-1 sm:mb-2">Cancelled</h3>
          <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{stats.statusCount.CANCELED}</p>
        </div>
      </div>

      {/* Operations Map */}
      <OperationsMap year={selectedYear} month={selectedMonth} />

      {/* Weather Monitoring */}
      <WeatherMonitoring />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
        {/* Location-wise Operations */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6">
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">Location-wise Operations</h2>
          <div className="h-48 sm:h-56 md:h-64 flex items-end justify-around gap-1 sm:gap-2 px-1 sm:px-2">
            {locationData.length > 0 ? (
              locationData.slice(0, 6).map((item) => {
                const maxValue = Math.max(...locationData.map((d) => d.count), 1);
                const height = (item.count / maxValue) * 100;
                return (
                  <div key={item.name} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-white/10 rounded-t relative"
                      style={{ height: `${height}%`, minHeight: "4px" }}
                    >
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t"></div>
                      <span className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-[10px] sm:text-xs font-semibold text-white whitespace-nowrap">
                        {item.count}
                      </span>
                    </div>
                    <span className="text-[8px] sm:text-[10px] font-semibold text-slate-300 text-center leading-tight break-words">
                      {item.name.length > 8 ? item.name.substring(0, 8) : item.name}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs sm:text-sm w-full">No location data</div>
            )}
          </div>
        </div>

        {/* Most Used Mooring Master */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6">
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">Most Used Mooring Master</h2>
          <div className="space-y-3">
            {stats.mostUsedMooringMaster.length > 0 ? (
              stats.mostUsedMooringMaster.slice(0, 5).map((item, idx) => {
                const maxCount = Math.max(...stats.mostUsedMooringMaster.map((d) => d.count), 1);
                const width = (item.count / maxCount) * 100;
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">{item.name}</span>
                      <span className="text-xs font-bold text-white">{item.count}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-4 relative overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${width}%`,
                          backgroundColor: idx === 0 ? "#f97316" : idx === 1 ? "#eab308" : "#3b82f6",
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">No mooring master data</div>
            )}
          </div>
        </div>

        {/* Cargo Types */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6">
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">Types of Cargos Transferred</h2>
          <div className="space-y-3">
            {cargoData.length > 0 ? (
              cargoData.map((item, idx) => {
                const maxCount = Math.max(...cargoData.map((d) => d.count), 1);
                const width = (item.count / maxCount) * 100;
                const colors = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">{item.name}</span>
                      <span className="text-xs font-bold text-white">{item.count}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-4 relative overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${width}%`,
                          backgroundColor: colors[idx % colors.length],
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">No cargo type data</div>
            )}
          </div>
        </div>

        {/* Clients-wise Operations */}
        <ClientsOperationsChart clientsData={stats.clientsData} />
      </div>

      {/* LOA Range - Note: Data not available in current schema */}
      {Object.keys(stats.loaRanges || {}).length > 0 && (
        <LoaRangeChart loaRanges={stats.loaRanges} />
      )}
    </div>
  );
}

/* ---------- Clients-wise Operations ---------- */
function ClientsOperationsChart({ clientsData = [] }) {
  const topClients = clientsData.slice(0, 8);
  const totalOps = clientsData.reduce((sum, c) => sum + c.count, 0);
  const maxValue = Math.max(...topClients.map((c) => c.count), 1);

  const data = {
    labels: topClients.map((c) => c.name),
    datasets: [
      {
        data: topClients.map((c) => c.count),
        backgroundColor: "#a78bfa",
        hoverBackgroundColor: "#c4b5fd",
        borderRadius: 6,
        maxBarThickness: 56,
        categoryPercentage: 0.6,
        barPercentage: 0.9,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 20 } },
    scales: {
      x: {
        grid: { display: false },
        border: { color: "rgba(255,255,255,0.1)" },
        ticks: { color: "#cbd5e1", font: { size: 11, weight: "600" } },
      },
      y: {
        beginAtZero: true,
        suggestedMax: maxValue < 5 ? 5 : undefined,
        border: { display: false },
        grid: { color: "rgba(255,255,255,0.06)" },
        ticks: { color: "#94a3b8", precision: 0, font: { size: 11 } },
      },
    },
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
        displayColors: false,
        callbacks: {
          label: (ctx) => `${ctx.parsed.y} operation${ctx.parsed.y === 1 ? "" : "s"}`,
        },
      },
    },
  };

  return (
    <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-3 md:mb-4">
        <div>
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-white">Clients-wise Operations</h2>
          {clientsData.length > 0 && (
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              {totalOps} operation{totalOps === 1 ? "" : "s"} across {clientsData.length} client
              {clientsData.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
        {topClients.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
            <span className="text-[10px] sm:text-xs text-slate-300 font-medium">Operations</span>
          </div>
        )}
      </div>
      <div className="h-48 sm:h-56 md:h-64">
        {topClients.length > 0 ? (
          <BarChart data={data} options={options} plugins={[barValueLabelsPlugin]} />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            No client data
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- LOA Range of Vessels ---------- */
function LoaRangeChart({ loaRanges = {} }) {
  const ranges = Object.keys(loaRanges);
  const counts = Object.values(loaRanges);
  const totalVessels = counts.reduce((sum, c) => sum + c, 0);
  const maxValue = Math.max(...counts, 1);

  const data = {
    labels: ranges,
    datasets: [
      {
        data: counts,
        backgroundColor: "#22d3ee",
        hoverBackgroundColor: "#67e8f9",
        borderRadius: 6,
        maxBarThickness: 56,
        categoryPercentage: 0.65,
        barPercentage: 0.9,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 20 } },
    scales: {
      x: {
        grid: { display: false },
        border: { color: "rgba(255,255,255,0.1)" },
        ticks: { color: "#cbd5e1", font: { size: 11, weight: "600" } },
      },
      y: {
        beginAtZero: true,
        suggestedMax: maxValue < 5 ? 5 : undefined,
        border: { display: false },
        grid: { color: "rgba(255,255,255,0.06)" },
        ticks: { color: "#94a3b8", precision: 0, font: { size: 11 } },
      },
    },
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
        displayColors: false,
        callbacks: {
          title: (items) => `LOA ${items[0].label} m`,
          label: (ctx) => `${ctx.parsed.y} vessel${ctx.parsed.y === 1 ? "" : "s"}`,
        },
      },
    },
  };

  return (
    <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-3 md:mb-4">
        <div>
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-white">LOA Range of Vessels</h2>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            {totalVessels > 0
              ? `${totalVessels} vessel${totalVessels === 1 ? "" : "s"} by length overall`
              : "No vessel LOA recorded yet"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-[10px] sm:text-xs text-slate-300 font-medium">Vessels</span>
        </div>
      </div>
      <div className="h-48 sm:h-56 md:h-64">
        <BarChart data={data} options={options} plugins={[barValueLabelsPlugin]} />
      </div>
    </div>
  );
}

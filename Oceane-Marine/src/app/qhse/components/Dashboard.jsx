"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useState, useEffect } from "react";
import Link from "next/link";

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
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function QhseDashboard() {
  const { setPageLoading } = useQhseLoading();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(null); // null = all months
  const [stats, setStats] = useState({
    totalRaised: 0,
    pendingReview: 0,
    reviewed: 0,
    monthlyBreakdown: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setPageLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("year", selectedYear.toString());
      if (selectedMonth) {
        params.append("month", selectedMonth.toString());
      }

      const res = await fetch(
        `/api/qhse/dashboard/near-miss-stats?${params.toString()}`
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch statistics");
      }

      setStats(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth]);

  const handleYearChange = (year) => {
    setSelectedYear(Number(year));
    setSelectedMonth(null); // Reset month when year changes
  };

  const handleMonthChange = (month) => {
    setSelectedMonth(month === "all" ? null : Number(month));
  };

  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-6 sm:py-10 space-y-4 sm:space-y-8">
        {/* Header */}
        <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
          <Link
            href="/dashboard"
            className="flex-shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← Dashboard
          </Link>
          <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
            <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
              QHSE Dashboard
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Near Miss Statistics</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Track and monitor near miss reports and reviews
            </p>
          </div>
        </header>

        {/* Filters */}
        <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-200">Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {getYears().map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-200">Month:</label>
            <select
              value={selectedMonth || "all"}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
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

        {error && (
          <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-lg text-slate-300">Loading statistics...</div>
          </div>
        ) : (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Raised Card */}
              <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-6 hover:shadow-sky-500/20 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-400/30">
                    <svg
                      className="w-8 h-8 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <Link
                    href="/qhse/near-miss"
                    className="text-xs text-sky-300 hover:text-sky-200 transition"
                  >
                    View All →
                  </Link>
                </div>
                <h3 className="text-sm uppercase tracking-wider text-slate-400 mb-2">
                  Total Raised
                </h3>
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1">
                  {stats.totalRaised}
                </p>
                <p className="text-xs text-slate-300">
                  Near miss reports in{" "}
                  {selectedMonth
                    ? `${MONTHS[selectedMonth - 1]} ${selectedYear}`
                    : selectedYear}
                </p>
              </div>

              {/* Pending Review Card */}
              <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-6 hover:shadow-amber-500/20 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-400/30">
                    <svg
                      className="w-8 h-8 text-amber-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <Link
                    href="/qhse/near-miss"
                    className="text-xs text-amber-300 hover:text-amber-200 transition"
                  >
                    Review Now →
                  </Link>
                </div>
                <h3 className="text-sm uppercase tracking-wider text-slate-400 mb-2">
                  Pending Review
                </h3>
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1">
                  {stats.pendingReview}
                </p>
                <p className="text-xs text-slate-300">
                  {stats.totalRaised > 0
                    ? `${Math.round((stats.pendingReview / stats.totalRaised) * 100)}% of total`
                    : "No reports"}
                </p>
              </div>

              {/* Reviewed Card */}
              <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-6 hover:shadow-emerald-500/20 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30">
                    <svg
                      className="w-8 h-8 text-emerald-400"
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
                  <Link
                    href="/qhse/near-miss"
                    className="text-xs text-emerald-300 hover:text-emerald-200 transition"
                  >
                    View Reviewed →
                  </Link>
                </div>
                <h3 className="text-sm uppercase tracking-wider text-slate-400 mb-2">
                  Reviewed
                </h3>
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1">
                  {stats.reviewed}
                </p>
                <p className="text-xs text-slate-300">
                  {stats.totalRaised > 0
                    ? `${Math.round((stats.reviewed / stats.totalRaised) * 100)}% of total`
                    : "No reports"}
                </p>
              </div>
            </div>

            {/* Monthly Breakdown Chart */}
            {stats.monthlyBreakdown && !selectedMonth && (
              <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-6">
                  Monthly Breakdown - {selectedYear}
                </h2>
                <div className="space-y-4">
                  {stats.monthlyBreakdown.map((month) => (
                    <div key={month.month} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">
                          {month.monthName}
                        </span>
                        <span className="text-xs text-slate-400">
                          Total: {month.total} | Pending: {month.pending} |
                          Reviewed: {month.reviewed}
                        </span>
                      </div>
                      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full flex">
                          {month.total > 0 && (
                            <>
                              <div
                                className="bg-amber-500/60"
                                style={{
                                  width: `${(month.pending / month.total) * 100}%`,
                                }}
                              />
                              <div
                                className="bg-emerald-500/60"
                                style={{
                                  width: `${(month.reviewed / month.total) * 100}%`,
                                }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DashboardBarChart,
  DashboardHorizontalBarChart,
} from "./charts/DashboardChartPrimitives";

export default function HrCharts() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hr/dashboard/stats");
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch HR statistics");
      setStats(data.data);
    } catch (err) {
      console.error("HR Dashboard Fetch Error:", err);
      setError(err.message || "Failed to load HR statistics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (error) {
  return (
      <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">HR</h2>
          <p className="text-sm text-slate-300">Human Resources Overview</p>
        </div>
        <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
          Error: {error}
        </div>
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-base sm:text-xl font-semibold text-white">HR</h2>
          <p className="text-xs sm:text-sm text-slate-300">Human Resources Overview</p>
        </div>
        <HrDashboardSkeleton />
      </div>
    );
  }

  /* ── Chart helpers ── */
  const certLocationData = Object.entries(stats.certsByLocation || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const certTypeData = Object.entries(stats.certsByType || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const cidLocationData = Object.entries(stats.cidByLocation || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const oilMajorStatusData = Object.entries(stats.oilMajorsByStatus || {})
    .map(([name, count]) => ({ name, count }))
    .filter((d) => d.count > 0);

  const totalOverdue = (stats.certsOverdue || 0) + (stats.cidOverdue || 0);
  const totalExpiringSoon = (stats.certsExpiringSoon || 0) + (stats.cidExpiringSoon || 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-base sm:text-xl font-semibold text-white">HR</h2>
          <p className="text-xs sm:text-sm text-slate-300">Human Resources Overview</p>
        </div>
      </div>

      {/* ── Key Metrics Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
        {/* Statutory Certificates */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => router.push("/hr/statutory-certificates?tab=list")}
          onKeyDown={(e) => e.key === "Enter" && router.push("/hr/statutory-certificates?tab=list")}
          className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-cyan-900/40 via-cyan-800/30 to-blue-900/40 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 hover:shadow-cyan-500/20 transition-all hover:scale-[1.02] md:hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        >
          <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold text-cyan-300 mb-1 sm:mb-2">
            Statutory Certificates
          </h3>
          <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
            {stats.totalCerts}
          </p>
        </div>

        {/* Oil Majors */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => router.push("/hr/oil-majors?tab=list")}
          onKeyDown={(e) => e.key === "Enter" && router.push("/hr/oil-majors?tab=list")}
          className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-indigo-900/40 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 hover:shadow-purple-500/20 transition-all hover:scale-[1.02] md:hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        >
          <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold text-purple-300 mb-1 sm:mb-2">
            Oil Majors
          </h3>
          <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
            {stats.totalOilMajors}
          </p>
        </div>

        {/* POAC Personnel */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => router.push("/hr/poac-matrix?tab=list")}
          onKeyDown={(e) => e.key === "Enter" && router.push("/hr/poac-matrix?tab=list")}
          className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-emerald-900/40 via-emerald-800/30 to-teal-900/40 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 hover:shadow-emerald-500/20 transition-all hover:scale-[1.02] md:hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold text-emerald-300 mb-1 sm:mb-2">
            POAC Personnel
          </h3>
          <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
            {stats.totalPoacPersonnel}
          </p>
        </div>

        {/* CID Records */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => router.push("/hr/cid?tab=list")}
          onKeyDown={(e) => e.key === "Enter" && router.push("/hr/cid?tab=list")}
          className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-orange-900/40 via-orange-800/30 to-red-900/40 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 hover:shadow-orange-500/20 transition-all hover:scale-[1.02] md:hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/50"
        >
          <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold text-orange-300 mb-1 sm:mb-2">
            CID Records
          </h3>
          <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
            {stats.totalCid}
          </p>
        </div>

        {/* Expiring Soon */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-yellow-900/40 via-yellow-800/30 to-amber-900/40 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 hover:shadow-yellow-500/20 transition-all hover:scale-[1.02] md:hover:scale-105">
          <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold text-yellow-300 mb-1 sm:mb-2">
            Expiring Soon
          </h3>
          <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
            {totalExpiringSoon}
          </p>
        </div>

        {/* Overdue */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-red-900/40 via-red-800/30 to-rose-900/40 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6 hover:shadow-red-500/20 transition-all hover:scale-[1.02] md:hover:scale-105">
          <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold text-red-300 mb-1 sm:mb-2">
            Overdue
          </h3>
          <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
            {totalOverdue}
          </p>
        </div>
      </div>

      {/* ── Charts Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">

        {/* Certificates by Location - Bar Chart */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6">
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">
            Certificates by Location
          </h2>
          {certLocationData.length > 0 ? (
            <DashboardBarChart
              labels={certLocationData.slice(0, 8).map((d) => d.name)}
              data={certLocationData.slice(0, 8).map((d) => d.count)}
              color="#22d3ee"
              hoverColor="#67e8f9"
              unitLabel="certificates"
              className="h-48 sm:h-56 md:h-64"
            />
          ) : (
            <div className="flex items-center justify-center h-48 sm:h-56 md:h-64 text-slate-400 text-xs sm:text-sm">
              No certificate data
            </div>
          )}
        </div>

        {/* Oil Majors by Status - Horizontal bars */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6">
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">
            Oil Majors by Status
          </h2>
          {oilMajorStatusData.length > 0 ? (
            <DashboardHorizontalBarChart
              labels={oilMajorStatusData.map((d) => d.name)}
              data={oilMajorStatusData.map((d) => d.count)}
              colors={["#10b981", "#f59e0b", "#8b5cf6"]}
            />
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">No oil major data</div>
          )}
        </div>

        {/* Certificates by Type - Horizontal bars */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6">
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">
            Certificates by Type
          </h2>
          {certTypeData.length > 0 ? (
            <DashboardHorizontalBarChart
              labels={certTypeData.slice(0, 8).map((d) => d.name)}
              data={certTypeData.slice(0, 8).map((d) => d.count)}
              colors={["#06b6d4", "#f472b6", "#a78bfa", "#fb923c", "#34d399", "#facc15", "#60a5fa", "#f87171"]}
            />
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">No certificate type data</div>
          )}
        </div>

        {/* CID by Location - Bar Chart */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6">
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">
            CID by Location
          </h2>
          {cidLocationData.length > 0 ? (
            <DashboardBarChart
              labels={cidLocationData.slice(0, 8).map((d) => d.name)}
              data={cidLocationData.slice(0, 8).map((d) => d.count)}
              color="#fb923c"
              hoverColor="#fdba74"
              unitLabel="CIDs"
              className="h-48 sm:h-56 md:h-64"
            />
          ) : (
            <div className="flex items-center justify-center h-48 sm:h-56 md:h-64 text-slate-400 text-xs sm:text-sm">
              No CID location data
            </div>
          )}
        </div>
      </div>

      {/* ── Tables Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">

        {/* Upcoming Renewals */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6">
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">
            Upcoming Renewals
            {totalExpiringSoon > 0 && (
              <span className="ml-2 text-xs font-medium text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
                {totalExpiringSoon} due
              </span>
            )}
          </h2>
          {stats.upcomingRenewals && stats.upcomingRenewals.length > 0 ? (
            <div className="overflow-x-auto max-h-56 overflow-y-auto styled-scrollbar">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="text-white/50 border-b border-white/10">
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Location</th>
                    <th className="py-2 pl-3 text-right">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.upcomingRenewals.map((item, idx) => {
                    const days = Math.ceil(
                      (new Date(item.validity) - new Date()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <tr
                        key={idx}
                        className="border-b border-white/5 hover:bg-white/5 transition"
                      >
                        <td className="py-2 pr-3 text-white/60 font-medium whitespace-nowrap">
                          {item.type === "Statutory Certificate" ? (
                            <span className="inline-flex items-center gap-1 text-cyan-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                              Cert
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-orange-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                              CID
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-white/80 truncate max-w-[150px]">
                          {item.name}
                        </td>
                        <td className="py-2 px-3 text-white/60">{item.location}</td>
                        <td className="py-2 pl-3 text-right">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              days <= 7
                                ? "bg-red-500/20 text-red-300"
                                : days <= 15
                                ? "bg-yellow-500/20 text-yellow-300"
                                : "bg-green-500/20 text-green-300"
                            }`}
                          >
                            {days}d
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-white/40 text-sm py-6 text-center">
              No upcoming renewals
            </p>
          )}
        </div>

        {/* Overdue Items */}
        <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6">
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">
            Overdue Items
            {totalOverdue > 0 && (
              <span className="ml-2 text-xs font-medium text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
                {totalOverdue} overdue
              </span>
            )}
          </h2>
          {stats.overdueItems && stats.overdueItems.length > 0 ? (
            <div className="overflow-x-auto max-h-56 overflow-y-auto styled-scrollbar">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="text-white/50 border-b border-white/10">
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Location</th>
                    <th className="py-2 pl-3 text-right">Expired</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.overdueItems.map((item, idx) => {
                    const daysAgo = Math.ceil(
                      (new Date() - new Date(item.validity)) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <tr
                        key={idx}
                        className="border-b border-white/5 hover:bg-white/5 transition"
                      >
                        <td className="py-2 pr-3 text-white/60 font-medium whitespace-nowrap">
                          {item.type === "Statutory Certificate" ? (
                            <span className="inline-flex items-center gap-1 text-cyan-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                              Cert
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-orange-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                              CID
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-white/80 truncate max-w-[150px]">
                          {item.name}
                        </td>
                        <td className="py-2 px-3 text-white/60">{item.location}</td>
                        <td className="py-2 pl-3 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-300">
                            {daysAgo}d ago
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-white/40 text-sm py-6 text-center">
              No overdue items
            </p>
          )}
        </div>
      </div>

      {/* ── POAC Summary ── */}
      <div className="rounded-xl md:rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 md:p-6">
        <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 md:mb-4">
          POAC Certification Matrix Summary
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-emerald-300 mb-1">
              Total Entries
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-white">{stats.totalPoacEntries}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-purple-300 mb-1">
              Total Personnel
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-white">{stats.totalPoacPersonnel}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-orange-300 mb-1">
              STS Providers
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-white">{stats.uniqueProviders}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HrDashboardSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6 animate-pulse" aria-busy="true" aria-label="Loading HR dashboard">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl md:rounded-2xl border border-white/10 bg-white/5 h-20 sm:h-24 md:h-28"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl md:rounded-2xl border border-white/10 bg-white/5 h-48 sm:h-56 md:h-64"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
        <div className="rounded-xl md:rounded-2xl border border-white/10 bg-white/5 h-48" />
        <div className="rounded-xl md:rounded-2xl border border-white/10 bg-white/5 h-48" />
      </div>
      <div className="rounded-xl md:rounded-2xl border border-white/10 bg-white/5 h-36 md:h-40" />
    </div>
  );
}

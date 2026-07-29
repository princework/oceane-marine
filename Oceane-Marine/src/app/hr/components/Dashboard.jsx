"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useHrLoading } from "../HrLoadingContext";

export default function HrDashboard() {
  const [stats, setStats] = useState({
    totalStatutoryCertificates: 0,
    totalOilMajors: 0,
    totalPoacMatrix: 0,
    totalCid: 0,
  });
  const [loading, setLoading] = useState(true);
  const { setPageLoading } = useHrLoading();

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setPageLoading(true);
      try {
        // TODO: Replace with actual API calls
        setStats({
          totalStatutoryCertificates: 0,
          totalOilMajors: 0,
          totalPoacMatrix: 0,
          totalCid: 0,
        });
      } catch (err) {
        console.error("Failed to fetch HR stats:", err);
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    };

    fetchStats();
  }, [setPageLoading]);

  const modules = [
    {
      key: "statutory-certificates",
      label: "Statutory Certificates",
      href: "/hr/statutory-certificates",
      count: stats.totalStatutoryCertificates,
      description: "Manage statutory certificates and compliance documents",
    },
    {
      key: "oil-majors",
      label: "Oil Majors",
      href: "/hr/oil-majors",
      count: stats.totalOilMajors,
      description: "Oil majors documentation and records",
    },
    {
      key: "poac-matrix",
      label: "POAC Matrix",
      href: "/hr/poac-matrix",
      count: stats.totalPoacMatrix,
      description: "POAC competency matrix management",
    },
    {
      key: "cid",
      label: "CID",
      href: "/hr/cid",
      count: stats.totalCid,
      description: "CID records and documentation",
    },
  ];

  if (loading) {
    return <div className="min-h-[400px]" aria-hidden />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {modules.map((module) => (
          <Link
            key={module.key}
            href={module.href}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 p-6 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-orange-500/50 hover:shadow-orange-500/20"
          >
            <div className="relative z-10">
              <h3 className="text-lg font-semibold text-white mb-2">
                {module.label}
              </h3>
              <p className="text-sm text-white/60 mb-4">
                {module.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-2xl sm:text-3xl font-bold text-orange-500">
                  {module.count}
                </span>
                <span className="text-white/40 group-hover:text-orange-500 transition-colors">
                  →
                </span>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-orange-500/0 group-hover:from-orange-500/5 group-hover:to-orange-500/10 transition-all duration-300" />
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((module) => (
            <Link
              key={module.key}
              href={module.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-orange-500/50 transition-all duration-200"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{module.label}</p>
              </div>
              <span className="text-orange-500">→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import OilMajorsFormPage from "./form/OilMajorsFormPage";
import OilMajorsListPage from "./list/OilMajorsListPage";
import HrSidebarWrapper from "../components/HrSidebarWrapper";
import { useHrSidebar } from "../HrSidebarContext";
import { useHrLoading } from "../HrLoadingContext";

function OilMajorsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const editParam = searchParams.get("edit");
  const [activeTab, setActiveTab] = useState("form");
  const { contentClassName, isSidebarOpen } = useHrSidebar();
  const { setPageLoading } = useHrLoading();

  useEffect(() => {
    if (tabParam === "list") {
      setActiveTab("list");
    } else if (editParam) {
      setPageLoading(true);
      setActiveTab("form");
    }
  }, [tabParam, editParam, setPageLoading]);

  return (
    <div className="min-h-screen bg-transparent text-white flex">
      <HrSidebarWrapper />
      <div
        className={`flex-1 min-w-0 overflow-auto transition-all duration-300 ${
          isSidebarOpen
            ? "ml-0 md:ml-72"
            : "mx-auto max-w-7xl"
        }`}
      >
        <div className="w-full mx-auto py-4 sm:py-6 md:py-10 space-y-4 sm:space-y-6 px-3 sm:px-4">
          <header
            className={`${isSidebarOpen ? "mt-0" : "mt-8 md:mt-0"} mb-2 flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4`}
          >
            <Link
              href="/dashboard"
              className="shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
            >
              ← Dashboard
            </Link>

            <div className="flex-1 min-w-0 flex flex-col items-center text-center w-full md:w-auto">
              <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
                HR / Oil Majors
              </p>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Oil Majors</h1>
            </div>

            <div className="flex justify-center md:justify-end shrink-0">
              <div className="inline-flex rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveTab("form")}
                  className={`px-4 py-2 text-sm font-semibold transition ${
                    activeTab === "form"
                      ? "text-white bg-orange-500 hover:bg-orange-600"
                      : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  Form
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("list")}
                  className={`px-4 py-2 text-sm font-semibold transition ${
                    activeTab === "list"
                      ? "text-white bg-orange-500 hover:bg-orange-600"
                      : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  List
                </button>
              </div>
            </div>
          </header>

          {/* Content */}
          {activeTab === "form" && (
            <OilMajorsFormPage
              onSuccess={() => {
                setActiveTab("list");
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new Event("refreshOilMajors"));
                }
              }}
            />
          )}
          {activeTab === "list" && (
            <OilMajorsListPage onRefresh={() => setActiveTab("list")} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function OilMajorsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-transparent text-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      }
    >
      <OilMajorsContent />
    </Suspense>
  );
}

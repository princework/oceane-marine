"use client";

import PropTypes from "prop-types";
import OperationsCharts from "./OperationsCharts";
import PMSCharts from "./PMSCharts";
import QHSECharts from "./QHSECharts";
import HrCharts from "./HrCharts";
const DashboardTabs = ({ activeTab, onTabChange }) => {
  const tabs = [
    { key: "operations", label: "Operations" },
    { key: "pms", label: "PMS" },
    { key: "qhse", label: "QHSE" },
    { key: "hr", label: "HR" },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Mobile tab bar */}
      <div className="md:hidden overflow-x-auto -mx-1 px-1 scrollbar-none">
        <div className="flex gap-2 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                  : "bg-white/5 text-white hover:bg-white/15"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-900/40 p-3 sm:p-4 md:p-6 shadow-xl backdrop-blur-md overflow-hidden">
        {activeTab === "operations" && <OperationsCharts />}
        {activeTab === "pms" && <PMSCharts />}
        {activeTab === "qhse" && <QHSECharts />}
        {activeTab === "hr" && <HrCharts />}
      </div>
    </div>
  );
};

DashboardTabs.propTypes = {
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
};

export default DashboardTabs;

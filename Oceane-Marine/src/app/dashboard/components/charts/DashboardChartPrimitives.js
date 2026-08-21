"use client";

import dynamic from "next/dynamic";

/* chart.js — lazy-loaded so the main bundle stays small (same pattern used across the dashboard) */
const Bar = dynamic(
  () =>
    Promise.all([import("react-chartjs-2"), import("chart.js/auto")]).then(
      ([reactChartJs2]) => ({ default: reactChartJs2.Bar })
    ),
  { ssr: false, loading: () => <ChartLoadingSpinner /> }
);

const Doughnut = dynamic(
  () =>
    Promise.all([import("react-chartjs-2"), import("chart.js/auto")]).then(
      ([reactChartJs2]) => ({ default: reactChartJs2.Doughnut })
    ),
  { ssr: false, loading: () => <ChartLoadingSpinner /> }
);

const Line = dynamic(
  () =>
    Promise.all([import("react-chartjs-2"), import("chart.js/auto")]).then(
      ([reactChartJs2]) => ({ default: reactChartJs2.Line })
    ),
  { ssr: false, loading: () => <ChartLoadingSpinner /> }
);

export function ChartLoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full min-h-[160px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400" />
    </div>
  );
}

const TOOLTIP_BASE = {
  backgroundColor: "#0f172a",
  titleColor: "#f8fafc",
  bodyColor: "#cbd5e1",
  borderColor: "rgba(255,255,255,0.1)",
  borderWidth: 1,
  padding: 10,
  cornerRadius: 8,
  displayColors: false,
};

/** Draws the count above (vertical) or beside (horizontal) each bar — chart.js has no built-in data-label support. */
function barValueLabelsPlugin(horizontal) {
  return {
    id: `barValueLabels-${horizontal ? "h" : "v"}`,
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
          if (horizontal) {
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(String(value), bar.x + 8, bar.y);
          } else {
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(String(value), bar.x, bar.y - 6);
          }
          ctx.restore();
        });
      });
    },
  };
}

/**
 * A single-series vertical bar chart — client/location/category counts ranked by magnitude.
 * @param {{labels: string[], data: number[], color: string, hoverColor?: string, unitLabel?: string, className?: string}} props
 */
export function DashboardBarChart({
  labels,
  data,
  color,
  hoverColor,
  unitLabel = "",
  className = "h-48 sm:h-56 md:h-64",
}) {
  const maxValue = Math.max(...data, 1);
  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: color,
        hoverBackgroundColor: hoverColor || color,
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
        ...TOOLTIP_BASE,
        callbacks: {
          label: (ctx) => `${ctx.parsed.y} ${unitLabel}`.trim(),
        },
      },
    },
  };

  return (
    <div className={className}>
      <Bar data={chartData} options={options} plugins={[barValueLabelsPlugin(false)]} />
    </div>
  );
}

/**
 * A ranked horizontal bar chart — each bar can carry its own color (replaces a
 * hand-rolled "progress bar list" with a real, tooltip-enabled chart).
 * @param {{labels: string[], data: number[], colors: string[], unitLabel?: string, className?: string}} props
 */
export function DashboardHorizontalBarChart({
  labels,
  data,
  colors,
  unitLabel = "",
  className = "",
}) {
  const maxValue = Math.max(...data, 1);
  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: labels.map((_, i) => colors[i % colors.length]),
        borderRadius: 6,
        maxBarThickness: 22,
        categoryPercentage: 0.7,
        barPercentage: 0.85,
      },
    ],
  };

  const options = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 36 } },
    scales: {
      x: {
        beginAtZero: true,
        suggestedMax: maxValue < 5 ? 5 : undefined,
        border: { display: false },
        grid: { color: "rgba(255,255,255,0.06)" },
        ticks: { color: "#94a3b8", precision: 0, font: { size: 11 } },
      },
      y: {
        grid: { display: false },
        border: { color: "rgba(255,255,255,0.1)" },
        ticks: { color: "#cbd5e1", font: { size: 11, weight: "600" } },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_BASE,
        callbacks: {
          label: (ctx) => `${ctx.parsed.x} ${unitLabel}`.trim(),
        },
      },
    },
  };

  // Chart's own natural height scales with row count so bars stay a consistent thickness.
  const height = Math.max(labels.length * 34 + 16, 120);

  return (
    <div className={className} style={{ height }}>
      <Bar data={chartData} options={options} plugins={[barValueLabelsPlugin(true)]} />
    </div>
  );
}

/**
 * A doughnut chart with a center total figure and a swatch legend beneath it —
 * replaces hand-computed SVG arc-path math with real chart.js (tooltips, animation, for free).
 * @param {{labels: string[], data: number[], colors: string[], centerCaption?: string, className?: string}} props
 */
export function DashboardDoughnutChart({
  labels,
  data,
  colors,
  centerCaption = "Total",
  className = "h-56 sm:h-64 md:h-72",
}) {
  const total = data.reduce((a, b) => a + b, 0);
  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: "#0f172a",
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };

  const options = {
    cutout: "68%",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_BASE,
        callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed}` },
      },
    },
  };

  return (
    <div className="flex flex-col items-center gap-3 md:gap-4">
      <div className={`relative w-full ${className}`}>
        {total > 0 ? (
          <>
            <Doughnut data={chartData} options={options} />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{total}</p>
                <p className="text-xs sm:text-sm text-slate-300">{centerCaption}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No data
          </div>
        )}
      </div>
      {total > 0 && (
        <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
          {labels.map((label, idx) => (
            <div key={label} className="flex items-center gap-1.5 sm:gap-2">
              <span
                className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0 inline-block"
                style={{ backgroundColor: colors[idx % colors.length] }}
              />
              <span className="text-[10px] sm:text-xs text-slate-300">
                {label}: {data[idx]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A smooth-curve line chart with a soft gradient fill under the line —
 * replaces a hand-computed SVG polyline with a real, tooltip-enabled chart.
 * @param {{labels: string[], data: number[], color?: string, className?: string}} props
 */
export function DashboardLineChart({
  labels,
  data,
  color = "#3b82f6",
  className = "h-56 sm:h-72 md:h-96",
}) {
  const chartData = {
    labels,
    datasets: [
      {
        data,
        borderColor: color,
        backgroundColor: (ctx) => {
          const { chart } = ctx;
          const { chartArea } = chart;
          if (!chartArea) return "transparent";
          const gradient = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, `${color}66`);
          gradient.addColorStop(1, `${color}03`);
          return gradient;
        },
        borderWidth: 2.5,
        pointBackgroundColor: color,
        pointBorderColor: "#0f172a",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
      },
    ],
  };

  const maxValue = Math.max(...data, 1);
  const options = {
    responsive: true,
    maintainAspectRatio: false,
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
      tooltip: TOOLTIP_BASE,
    },
  };

  return (
    <div className={className}>
      <Line data={chartData} options={options} />
    </div>
  );
}

/**
 * A stacked vertical bar chart — several series (e.g. equipment kinds) summed per
 * category (e.g. location). Each segment is tooltipped individually; the legend
 * doubles as a shared caption above the chart.
 * @param {{labels: string[], series: {label: string, data: number[], color: string}[], unitLabel?: string, className?: string}} props
 */
export function DashboardStackedBarChart({
  labels,
  series,
  unitLabel = "",
  className = "h-48 sm:h-64 md:h-80",
}) {
  const chartData = {
    labels,
    datasets: series.map((s) => ({
      label: s.label,
      data: s.data,
      backgroundColor: s.color,
      hoverBackgroundColor: s.color,
      maxBarThickness: 56,
      categoryPercentage: 0.6,
      barPercentage: 0.9,
    })),
  };

  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + (s.data[i] || 0), 0));
  const maxTotal = Math.max(...totals, 1);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 24 } },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        border: { color: "rgba(255,255,255,0.1)" },
        ticks: { color: "#cbd5e1", font: { size: 10, weight: "600" } },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        suggestedMax: maxTotal < 5 ? 5 : undefined,
        border: { display: false },
        grid: { color: "rgba(255,255,255,0.06)" },
        ticks: { color: "#94a3b8", precision: 0, font: { size: 11 } },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_BASE,
        displayColors: true,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} ${unitLabel}`.trimEnd(),
        },
      },
    },
  };

  /** Draws the category total above the top of each stacked bar. */
  const stackTotalsPlugin = {
    id: "stackTotalLabels",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const lastDatasetIndex = chart.data.datasets.length - 1;
      const meta = chart.getDatasetMeta(lastDatasetIndex);
      meta.data.forEach((bar, index) => {
        const total = totals[index];
        if (!total) return;
        // Find the topmost (smallest y) pixel across all stacked segments for this category.
        let topY = bar.y;
        for (let d = 0; d < chart.data.datasets.length; d++) {
          const point = chart.getDatasetMeta(d).data[index];
          if (point && point.y < topY) topY = point.y;
        }
        ctx.save();
        ctx.fillStyle = "#f8fafc";
        ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(String(total), bar.x, topY - 6);
        ctx.restore();
      });
    },
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[10px] sm:text-xs text-slate-300">{s.label}</span>
          </div>
        ))}
      </div>
      <div className={className}>
        <Bar data={chartData} options={options} plugins={[stackTotalsPlugin]} />
      </div>
    </div>
  );
}

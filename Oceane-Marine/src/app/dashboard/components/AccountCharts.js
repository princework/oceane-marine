export default function AccountCharts() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Accounts</h2>
        <p className="text-sm text-slate-300">
          Placeholder for accounts insights and graphs.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <PlaceholderCard title="Invoices" value="—" tone="sky" />
        <PlaceholderCard title="Purchase Orders" value="—" tone="orange" />
        <PlaceholderCard title="Payables" value="—" tone="emerald" />
      </div>
      <div className="rounded-2xl border border-white/5 bg-white/5 p-5">
        <p className="text-sm text-slate-200">
          Accounts charts will appear here once data is connected.
        </p>
      </div>
    </div>
  );
}

function PlaceholderCard({ title, value, tone = "sky" }) {
  const toneClasses = {
    orange:
      "bg-gradient-to-br from-orange-500/25 via-orange-500/10 to-orange-500/5 text-orange-50 border-orange-400/40 shadow-orange-500/20",
    sky: "bg-gradient-to-br from-sky-500/25 via-sky-500/10 to-sky-500/5 text-sky-50 border-sky-400/40 shadow-sky-500/20",
    emerald:
      "bg-gradient-to-br from-emerald-500/25 via-emerald-500/10 to-emerald-500/5 text-emerald-50 border-emerald-400/40 shadow-emerald-500/20",
  };

  return (
    <div
      className={`rounded-2xl border ${toneClasses[tone]} px-4 py-5 backdrop-blur shadow-lg`}
    >
      <p className="text-sm uppercase tracking-wide">{title}</p>
      <p className="text-2xl sm:text-3xl font-bold">{value}</p>
    </div>
  );
}

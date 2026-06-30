export default function MetricCard({ label, value, delta, deltaPositive, sub, icon }) {
  return (
    <div className="bg-white border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-text-secondary">{label}</p>
        {icon && <div className="opacity-70">{icon}</div>}
      </div>
      <p className="text-3xl font-semibold text-text-primary">{value}</p>
      {delta !== undefined && (
        <p className={`text-xs mt-1 ${deltaPositive ? 'text-success' : 'text-danger'}`}>
          {deltaPositive ? '+' : ''}{delta}
        </p>
      )}
      {sub && <p className="text-xs text-text-tertiary mt-1">{sub}</p>}
    </div>
  )
}

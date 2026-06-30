export default function Select({ label, error, className = '', children, ...props }) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-text-primary">{label}</label>
      )}
      <select
        className={`w-full h-9 px-3 rounded-lg border text-sm text-text-primary bg-white
          focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
          transition-colors cursor-pointer
          ${error ? 'border-danger' : 'border-border'}
          ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

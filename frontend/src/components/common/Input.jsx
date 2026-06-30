export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-text-primary">{label}</label>
      )}
      <input
        className={`w-full h-9 px-3 rounded-lg border text-sm text-text-primary bg-white
          placeholder:text-text-tertiary transition-colors
          focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
          ${error ? 'border-danger' : 'border-border'}
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

const variants = {
  success: 'bg-green-50 text-success',
  danger:  'bg-red-50 text-danger',
  warning: 'bg-amber-50 text-warning',
  neutral: 'bg-gray-100 text-text-secondary',
  accent:  'bg-accent-light text-accent',
}

export default function Badge({ children, variant = 'neutral', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}

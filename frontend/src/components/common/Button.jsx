const variants = {
  primary:   'bg-accent text-white hover:bg-violet-700',
  secondary: 'bg-white border border-border text-text-primary hover:bg-gray-50',
  danger:    'bg-white border border-danger text-danger hover:bg-red-50',
}

export default function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-medium transition-colors ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

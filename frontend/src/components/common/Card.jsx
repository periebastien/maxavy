export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white border border-border rounded-xl p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/admin/plans', label: 'Plans' },
  { to: '/admin/accounts', label: 'Comptes' },
  { to: '/admin/modules', label: 'Modules' },
]

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-6">
          <span className="font-semibold text-[#7C5CFC]">Super Admin</span>
          <nav className="flex gap-4">
            {TABS.map(t => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `text-sm py-1 border-b-2 transition-colors ${
                    isActive ? 'border-[#7C5CFC] text-[#7C5CFC] font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
      {children}
    </div>
  )
}

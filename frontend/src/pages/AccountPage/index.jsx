import AppLayout from '../../components/layout/AppLayout'
import ProfileSection from '../../components/account/ProfileSection'
import SecuritySection from '../../components/account/SecuritySection'
import BusinessesSection from '../../components/account/BusinessesSection'

function Section({ title, description, children }) {
  return (
    <div className="bg-white border border-border rounded-xl">
      <div className="px-6 py-4 border-b border-border">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export default function AccountPage() {
  return (
    <AppLayout title="Mon compte">
      <div className="max-w-2xl space-y-6">
        <ProfileSection Section={Section} />
        <SecuritySection Section={Section} />
        <BusinessesSection Section={Section} />
      </div>
    </AppLayout>
  )
}

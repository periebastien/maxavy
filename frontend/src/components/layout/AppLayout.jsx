import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useAuth } from '../../contexts/AuthContext'

export default function AppLayout({ children, title, actions }) {
  const { user } = useAuth()

  return (
    <div className="flex min-h-screen bg-bg-page">
      <Sidebar user={user} />
      <div className="ml-60 flex-1 flex flex-col">
        <TopBar title={title} actions={actions} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

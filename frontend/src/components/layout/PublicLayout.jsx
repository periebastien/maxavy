import { Link } from 'react-router-dom'

export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      <header className="bg-white border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 bg-accent rounded-xl">
              <span className="text-white font-bold text-base">G</span>
            </span>
            <span className="font-bold text-text-primary">GMB Manager</span>
          </Link>
          <Link
            to="/login"
            className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Se connecter
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-white border-t border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-tertiary">
          <span>© {new Date().getFullYear()} GMB Manager — édité par MAKEMERANK LIMITED</span>
          <nav className="flex gap-4">
            <Link to="/confidentialite" className="hover:text-text-secondary">Politique de confidentialité</Link>
            <Link to="/cgu" className="hover:text-text-secondary">Conditions d'utilisation</Link>
            <Link to="/mentions-legales" className="hover:text-text-secondary">Mentions légales</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

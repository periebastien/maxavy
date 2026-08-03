import { Link } from 'react-router-dom'
import { Star, LayoutGrid, MapPin, Users } from 'lucide-react'
import PublicLayout from '../components/layout/PublicLayout'

const FEATURES = [
  {
    icon: Star,
    title: 'Collecte d\'avis Google',
    text: 'Invitations par email et QR code sur le point de vente pour obtenir plus d\'avis, avec le consentement de vos clients.',
  },
  {
    icon: LayoutGrid,
    title: 'Widgets d\'avis',
    text: 'Affichez vos avis Google sur votre site : badge de note ou carrousel, personnalisables sans compétence technique.',
  },
  {
    icon: MapPin,
    title: 'Positionnement local',
    text: 'Carte de visibilité de votre fiche sur vos mots-clés, quartier par quartier, avec suivi dans le temps.',
  },
  {
    icon: Users,
    title: 'Veille concurrentielle',
    text: 'Suivez le rythme d\'avis et le positionnement de vos concurrents directs, mois par mois.',
  },
]

export default function HomePage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-14 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary leading-tight">
          Pilotez votre e-réputation Google
        </h1>
        <p className="text-text-secondary mt-4 max-w-2xl mx-auto">
          Avis clients, widgets, positionnement local et veille concurrentielle :
          GMB Manager centralise la gestion de vos fiches Google Business Profile.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/login"
            className="bg-accent text-white font-medium px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            Se connecter
          </Link>
          <a
            href="mailto:contact@makemerank.net"
            className="text-sm text-text-secondary hover:text-text-primary"
          >
            Accès réservé à nos clients — nous contacter
          </a>
        </div>
      </section>

      {/* Fonctionnalités */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-white border border-border rounded-xl p-6">
              <div className="inline-flex items-center justify-center w-9 h-9 bg-accent/10 text-accent rounded-lg mb-3">
                <f.icon size={18} />
              </div>
              <h2 className="font-semibold text-text-primary">{f.title}</h2>
              <p className="text-sm text-text-secondary mt-1.5">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 text-center">
        <div className="bg-white border border-border rounded-xl p-8">
          <h2 className="font-semibold text-text-primary">Une question ?</h2>
          <p className="text-sm text-text-secondary mt-1.5">
            GMB Manager est proposé par l'agence Makemerank à ses clients.
          </p>
          <a
            href="mailto:contact@makemerank.net"
            className="inline-block mt-4 text-accent font-medium text-sm hover:underline"
          >
            contact@makemerank.net
          </a>
        </div>
      </section>
    </PublicLayout>
  )
}

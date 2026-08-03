import { Link } from 'react-router-dom'
import {
  Star, LayoutGrid, MapPin, Users,
  Pencil, MessageSquareReply, BarChart3, Building2,
} from 'lucide-react'
import PublicLayout from '../components/layout/PublicLayout'

const GOOGLE_API_FEATURES = [
  {
    icon: Pencil,
    title: 'Édition des fiches',
    text: 'Modifiez les fiches d\'établissement de vos clients depuis une interface unique : horaires, coordonnées, description, attributs, photos.',
  },
  {
    icon: MessageSquareReply,
    title: 'Réponse aux avis',
    text: 'Consultez et répondez aux avis de toutes vos fiches depuis la même interface, sans passer par Google fiche par fiche.',
  },
  {
    icon: BarChart3,
    title: 'Statistiques & mots-clés',
    text: 'Statistiques de performance et mots-clés de recherche de chaque fiche, réunis dans un tableau de bord.',
  },
  {
    icon: Building2,
    title: 'Multi-établissements',
    text: 'Pensé pour les agences : pilotez les fiches de plusieurs clients, avec des rôles d\'équipe et une vérification que chaque compte Google connecté gère bien ses fiches.',
  },
]

const OTHER_FEATURES = [
  {
    icon: Star,
    title: 'Collecte d\'avis Google',
    text: 'Invitations par email, SMS et QR code sur le point de vente — envoyées à tous vos clients, sans filtrage ni incitation, conformément aux règles Google.',
  },
  {
    icon: LayoutGrid,
    title: 'Widgets d\'avis',
    text: 'Affichez les avis publics de votre fiche sur votre site : badge de note ou carrousel, personnalisables sans compétence technique.',
  },
  {
    icon: MapPin,
    title: 'Positionnement local',
    text: 'Carte de visibilité de votre fiche sur vos mots-clés, quartier par quartier, à partir de données publiques de recherche locale.',
  },
  {
    icon: Users,
    title: 'Veille concurrentielle',
    text: 'Suivez le rythme d\'avis publics et le positionnement de vos concurrents directs, mois par mois.',
  },
]

function FeatureGrid({ features }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {features.map(f => (
        <div key={f.title} className="bg-white border border-border rounded-xl p-6">
          <div className="inline-flex items-center justify-center w-9 h-9 bg-accent/10 text-accent rounded-lg mb-3">
            <f.icon size={18} />
          </div>
          <h3 className="font-semibold text-text-primary">{f.title}</h3>
          <p className="text-sm text-text-secondary mt-1.5">{f.text}</p>
        </div>
      ))}
    </div>
  )
}

export default function HomePage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary leading-tight">
          Pilotez vos fiches Google Business Profile
        </h1>
        <p className="text-text-secondary mt-4 max-w-2xl mx-auto">
          Édition des fiches, réponse aux avis, statistiques, collecte d'avis et
          positionnement local : GMB Manager centralise la gestion des fiches de
          tous vos établissements — et de ceux de vos clients.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/login"
            className="bg-accent text-white font-medium px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            Se connecter
          </Link>
        </div>
      </section>

      {/* Accès réservé */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-12">
        <div className="bg-accent-light border border-accent/20 rounded-xl px-6 py-4 text-sm text-text-primary text-center leading-relaxed">
          L'accès à GMB Manager est actuellement réservé aux clients de l'agence Makemerank.
          La création de compte s'effectue dans le cadre de la relation commerciale avec l'agence.
        </div>
      </section>

      {/* Fonctionnalités reposant sur les API Google Business Profile */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-14">
        <div className="text-center mb-6">
          <span className="inline-block text-xs font-medium text-accent bg-accent/10 rounded-full px-3 py-1 mb-3">
            Via les API Google Business Profile
          </span>
          <h2 className="text-xl font-bold text-text-primary">
            Gérez toutes vos fiches depuis une interface unique
          </h2>
          <p className="text-sm text-text-secondary mt-2 max-w-2xl mx-auto">
            En connectant votre compte Google (OAuth), GMB Manager agit uniquement sur les
            fiches dont vous êtes propriétaire ou gestionnaire.
          </p>
        </div>
        <FeatureGrid features={GOOGLE_API_FEATURES} />
      </section>

      {/* Fonctionnalités indépendantes des API Google */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div className="text-center mb-6">
          <span className="inline-block text-xs font-medium text-text-secondary bg-border/60 rounded-full px-3 py-1 mb-3">
            Indépendant des API Google
          </span>
          <h2 className="text-xl font-bold text-text-primary">
            Développez et valorisez votre e-réputation
          </h2>
          <p className="text-sm text-text-secondary mt-2 max-w-2xl mx-auto">
            Ces fonctionnalités s'appuient sur vos données clients (importées avec leur
            consentement) et sur des données publiques de recherche locale.
          </p>
        </div>
        <FeatureGrid features={OTHER_FEATURES} />
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

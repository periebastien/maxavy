import PublicLayout from '../components/layout/PublicLayout'

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-text-primary mb-2">{title}</h2>
      <div className="text-sm text-text-secondary space-y-2 leading-relaxed">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Conditions d'utilisation</h1>
        <p className="text-xs text-text-tertiary mb-8">Dernière mise à jour : 10 juillet 2026</p>

        <Section title="1. Objet">
          <p>
            Les présentes conditions régissent l'utilisation du service SaaS <strong>GMB Manager</strong>{' '}
            (gmbmanager.ai), édité par <strong>MAKEMERANK LIMITED</strong>, société de droit irlandais
            (n° 686482), C/O Pod 2, The Old Station House, 15a Main Street, Blackrock, Dublin,
            A94T8P8, Irlande. Le service est réservé aux clients de l'agence Makemerank et à leurs
            équipes ; l'ouverture d'un compte s'effectue dans le cadre de la relation commerciale
            avec l'agence. L'utilisation du service vaut acceptation des présentes conditions.
          </p>
        </Section>

        <Section title="2. Compte et accès">
          <p>
            Les identifiants de connexion sont personnels et confidentiels. L'utilisateur est
            responsable des actions effectuées depuis son compte et s'engage à informer
            MAKEMERANK LIMITED sans délai de toute utilisation non autorisée. Le titulaire d'un
            compte peut inviter des membres de son équipe et leur attribuer des rôles ; il reste
            responsable des accès qu'il accorde.
          </p>
        </Section>

        <Section title="3. Description du service">
          <p>
            GMB Manager fournit des outils de gestion de l'e-réputation : collecte d'avis Google
            (invitations email/SMS, QR code), affichage d'avis sur site via widgets, suivi du
            positionnement local, veille des avis de la concurrence et statistiques de fiches
            Google Business Profile.
          </p>
          <p>
            Le service s'appuie sur des sources et services tiers (notamment Google et des
            fournisseurs de données de recherche). MAKEMERANK LIMITED ne garantit ni l'exactitude,
            ni l'exhaustivité, ni la disponibilité des données issues de ces tiers, et ne saurait
            être tenue responsable d'une modification ou interruption de leurs API.
          </p>
        </Section>

        <Section title="4. Abonnements et crédits">
          <p>
            L'accès au service est fourni selon le plan souscrit auprès de l'agence. Certaines
            actions (envoi d'invitations, rapports de positionnement) consomment des crédits,
            inclus dans le plan ou achetés en packs. Les crédits sont utilisables uniquement dans
            le service, non transférables et non remboursables. Les paiements sont traités par
            Stripe ; aucune donnée bancaire n'est stockée par le service.
          </p>
        </Section>

        <Section title="5. Obligations de l'utilisateur">
          <p>L'utilisateur s'engage à :</p>
          <p>• recueillir le consentement de ses propres clients avant de leur adresser une invitation à laisser un avis, et n'importer que des données qu'il est en droit de traiter (conformément au RGPD) ;</p>
          <p>• ne pas solliciter ou publier de faux avis, ni utiliser le service d'une manière contraire aux règles de Google relatives aux avis ;</p>
          <p>• ne pas tenter de perturber le fonctionnement du service, d'y accéder sans autorisation ou de l'utiliser à des fins illicites.</p>
          <p>
            En cas de manquement grave, MAKEMERANK LIMITED peut suspendre ou clôturer le compte
            après notification.
          </p>
        </Section>

        <Section title="6. Disponibilité et responsabilité">
          <p>
            Le service est fourni « en l'état ». MAKEMERANK LIMITED s'efforce d'assurer une
            disponibilité continue mais ne garantit pas l'absence d'interruptions (maintenance,
            incident, dépendance tierce). La responsabilité de MAKEMERANK LIMITED, toutes causes
            confondues, est limitée au montant des sommes effectivement versées par le client au
            titre du service au cours des douze (12) derniers mois. Elle ne saurait couvrir les
            dommages indirects (perte de chiffre d'affaires, d'image ou de données tierces).
          </p>
        </Section>

        <Section title="7. Propriété intellectuelle">
          <p>
            Le service, son interface et son code restent la propriété exclusive de MAKEMERANK
            LIMITED. L'utilisateur bénéficie d'un droit d'utilisation personnel, non exclusif et
            non cessible, pendant la durée de son abonnement. Toute reproduction, revente ou
            rétro-ingénierie est interdite. Les données importées par l'utilisateur restent sa
            propriété. Google, Google Maps et Google Business Profile sont des marques de Google
            LLC ; GMB Manager est un service indépendant, non affilié à Google.
          </p>
        </Section>

        <Section title="8. Résiliation">
          <p>
            Chaque partie peut mettre fin au service dans les conditions prévues au contrat
            commercial conclu avec l'agence. À la clôture du compte, l'utilisateur peut demander
            l'export de ses données ; celles-ci sont ensuite supprimées dans les conditions
            décrites dans la <a className="text-accent hover:underline" href="/confidentialite">politique de confidentialité</a>.
          </p>
        </Section>

        <Section title="9. Droit applicable">
          <p>
            Les présentes conditions sont régies par le droit irlandais. En cas de litige, les
            parties rechercheront d'abord une solution amiable ; à défaut, les tribunaux de Dublin
            seront compétents, sous réserve des dispositions impératives protectrices applicables
            au client.
          </p>
          <p>
            Contact :{' '}
            <a className="text-accent hover:underline" href="mailto:contact@makemerank.net">contact@makemerank.net</a>.
          </p>
        </Section>
      </div>
    </PublicLayout>
  )
}

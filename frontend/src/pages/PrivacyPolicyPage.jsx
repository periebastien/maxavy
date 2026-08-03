import PublicLayout from '../components/layout/PublicLayout'

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-text-primary mb-2">{title}</h2>
      <div className="text-sm text-text-secondary space-y-2 leading-relaxed">{children}</div>
    </section>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Politique de confidentialité</h1>
        <p className="text-xs text-text-tertiary mb-8">Dernière mise à jour : 10 juillet 2026</p>

        <Section title="1. Qui sommes-nous">
          <p>
            GMB Manager (gmbmanager.ai) est un service de gestion de l'e-réputation et des fiches
            Google Business Profile, édité par <strong>MAKEMERANK LIMITED</strong>, société de droit
            irlandais (n° d'enregistrement 686482), C/O Pod 2, The Old Station House, 15a Main
            Street, Blackrock, Dublin, A94T8P8, Irlande.
          </p>
          <p>
            Contact pour toute question relative aux données personnelles :{' '}
            <a className="text-accent hover:underline" href="mailto:contact@makemerank.net">contact@makemerank.net</a>.
          </p>
        </Section>

        <Section title="2. Données que nous collectons">
          <p><strong>Données de compte</strong> : nom, prénom, adresse email, mot de passe (haché), ou identifiant Google en cas de connexion via Google Sign-In.</p>
          <p>
            <strong>Données clients importées par nos utilisateurs</strong> : nom, adresse email et
            numéro de téléphone des clients finaux, importés par nos utilisateurs pour l'envoi
            d'invitations à laisser un avis. Ces données sont <strong>chiffrées (AES-256-GCM)</strong> en
            base de données et ne sont utilisées que pour cette finalité. L'envoi d'invitations est
            conditionné au consentement recueilli par l'utilisateur auprès de son client.
          </p>
          <p><strong>Données publiques</strong> : avis publics des fiches Google (nôtres et de fiches concurrentes), résultats de recherche locale publics.</p>
          <p><strong>Données de facturation</strong> : gérées par notre prestataire de paiement Stripe ; nous ne stockons aucun numéro de carte bancaire.</p>
        </Section>

        <Section title="3. Données Google (Google Business Profile)">
          <p>
            Lorsque vous connectez votre compte Google, GMB Manager accède aux données de vos
            fiches Google Business Profile via les API Google (autorisation OAuth, portée{' '}
            <code>business.manage</code>) : informations de la fiche, statistiques de performance
            (impressions, mots-clés de recherche, actions) et avis.
          </p>
          <p>
            Ces données sont utilisées <strong>uniquement</strong> pour vous les afficher dans votre
            tableau de bord et produire vos rapports. Elles ne sont <strong>jamais vendues, jamais
            transmises à des tiers</strong>, et ne servent à aucune publicité.
          </p>
          <p>
            L'utilisation des données reçues des API Google respecte la{' '}
            <a
              className="text-accent hover:underline"
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , y compris ses exigences de « Limited Use » (usage limité).
          </p>
          <p>
            Vos jetons d'accès Google sont chiffrés (AES-256-GCM). Vous pouvez révoquer l'accès à
            tout moment depuis votre compte Google (
            <a
              className="text-accent hover:underline"
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
            >
              myaccount.google.com/permissions
            </a>
            ) ou en nous contactant.
          </p>
        </Section>

        <Section title="4. Finalités et bases légales">
          <p>• Fourniture du service (tableau de bord, rapports, widgets) — exécution du contrat.</p>
          <p>• Envoi d'invitations à laisser un avis — consentement du client final, recueilli par notre utilisateur.</p>
          <p>• Facturation et gestion du compte — exécution du contrat et obligations légales.</p>
          <p>• Emails transactionnels (notifications de service) — intérêt légitime.</p>
        </Section>

        <Section title="5. Sous-traitants et destinataires">
          <p>Les données sont hébergées et traitées par les prestataires suivants :</p>
          <p>• <strong>OVH</strong> (France) — hébergement des serveurs et de la base de données.</p>
          <p>• <strong>Brevo</strong> (France) — envoi des emails d'invitation et de notification.</p>
          <p>• <strong>Stripe</strong> — paiements et facturation.</p>
          <p>• <strong>DataForSEO</strong> — collecte de données publiques de recherche locale (aucune donnée personnelle de nos utilisateurs ne lui est transmise).</p>
          <p>• <strong>Google</strong> — API Google Business Profile, Google Sign-In, Google Maps.</p>
          <p>Aucune donnée n'est vendue ni transmise à des tiers à des fins publicitaires.</p>
        </Section>

        <Section title="6. Durées de conservation">
          <p>
            Les données de compte et les données importées sont conservées pendant la durée de la
            relation contractuelle, puis supprimées dans un délai maximum de 12 mois après la
            clôture du compte. Les données de facturation sont conservées selon les obligations
            légales en vigueur. Vous pouvez demander la suppression anticipée de vos données à tout
            moment (voir section 7).
          </p>
        </Section>

        <Section title="7. Vos droits">
          <p>
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification,
            d'effacement, de limitation, d'opposition et de portabilité sur vos données
            personnelles. Pour exercer ces droits, écrivez à{' '}
            <a className="text-accent hover:underline" href="mailto:contact@makemerank.net">contact@makemerank.net</a>.
            Vous pouvez également introduire une réclamation auprès de l'autorité de contrôle
            compétente (en France : la CNIL).
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            GMB Manager n'utilise que des cookies et stockages techniques strictement nécessaires
            au fonctionnement du service (session de connexion). Aucun cookie publicitaire ni
            traceur tiers n'est utilisé.
          </p>
        </Section>

        <Section title="9. Modifications">
          <p>
            Cette politique peut être mise à jour ; la date en haut de page fait foi. En cas de
            changement substantiel, les utilisateurs seront informés par email ou via le service.
          </p>
        </Section>
      </div>
    </PublicLayout>
  )
}

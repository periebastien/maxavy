import PublicLayout from '../components/layout/PublicLayout'

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-text-primary mb-2">{title}</h2>
      <div className="text-sm text-text-secondary space-y-2 leading-relaxed">{children}</div>
    </section>
  )
}

export default function LegalNoticePage() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-bold text-text-primary mb-8">Mentions légales</h1>

        <Section title="Éditeur du site">
          <p>
            Le site gmbmanager.ai et le service GMB Manager sont édités par{' '}
            <strong>MAKEMERANK LIMITED</strong>, société de droit irlandais enregistrée sous le
            numéro 686482, dont le siège social est situé C/O Pod 2, The Old Station House, 15a
            Main Street, Blackrock, Dublin, A94T8P8, Irlande.
          </p>
          <p>
            Email :{' '}
            <a className="text-accent hover:underline" href="mailto:contact@makemerank.net">contact@makemerank.net</a>
            {' '}· Téléphone : +33 6 52 65 68 22
          </p>
          <p>Directeur de la publication : le représentant légal de MAKEMERANK LIMITED.</p>
        </Section>

        <Section title="Hébergement">
          <p>
            Le site est hébergé par <strong>OVH SAS</strong>, 2 rue Kellermann, 59100 Roubaix,
            France — <span className="whitespace-nowrap">+33 9 72 10 10 07</span> — www.ovhcloud.com.
          </p>
        </Section>

        <Section title="Propriété intellectuelle">
          <p>
            L'ensemble des éléments du site (textes, interface, logo, code) est la propriété de
            MAKEMERANK LIMITED, sauf mention contraire. Toute reproduction non autorisée est
            interdite. Google, Google Maps et Google Business Profile sont des marques de Google
            LLC ; GMB Manager est un service indépendant, non affilié à Google.
          </p>
        </Section>

        <Section title="Données personnelles">
          <p>
            Le traitement des données personnelles est décrit dans notre{' '}
            <a className="text-accent hover:underline" href="/confidentialite">politique de confidentialité</a>.
          </p>
        </Section>
      </div>
    </PublicLayout>
  )
}

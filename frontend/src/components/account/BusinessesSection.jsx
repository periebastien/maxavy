import Badge from '../common/Badge'
import EntityAvatar from '../common/EntityAvatar'
import { faviconUrl } from '../../lib/favicon'
import { useBusiness } from '../../contexts/BusinessContext'

const ROLE_LABELS = { owner: 'Propriétaire', admin: 'Administrateur', editor: 'Éditeur', viewer: 'Lecteur' }
const ROLE_VARIANTS = { owner: 'accent', admin: 'success', editor: 'neutral', viewer: 'neutral' }

export default function BusinessesSection({ Section }) {
  const { businesses } = useBusiness()

  return (
    <Section title="Mes entreprises" description="Entreprises auxquelles vous avez accès.">
      {businesses.length === 0 ? (
        <p className="text-sm text-text-secondary">Aucune entreprise associée à votre compte.</p>
      ) : (
        <div className="divide-y divide-border -mt-2">
          {businesses.map(b => (
            <div key={b.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <EntityAvatar name={b.name} src={faviconUrl(b.website_url)} size={32} />
                <p className="text-sm font-medium text-text-primary truncate">{b.name}</p>
              </div>
              <Badge variant={ROLE_VARIANTS[b.my_role] || 'neutral'}>
                {ROLE_LABELS[b.my_role] || b.my_role || 'Membre'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

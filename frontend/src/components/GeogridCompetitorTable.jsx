import { useState } from 'react'
import { Star } from 'lucide-react'
import { rankSurface } from '../lib/rank-palette'

const NOT_RANKED = 21 // avg_position imputé quand jamais classé dans la profondeur mesurée (cf. backend)

// Tableau triable « ma fiche + concurrents » (§8/§9) — tri par défaut sur le mieux positionné (position
// moyenne croissante, ATRP = rang donc plus bas = mieux). La cellule « Position moyenne » est colorée
// selon la charte de rang partagée (lib/rank-palette, mêmes couleurs que la heatmap). Pleine largeur,
// colonnes proportionnelles (table-fixed). `competitors` = liste déjà fusionnée (tous les concurrents suivis).
export default function GeogridCompetitorTable({ scan, competitors, onRowClick, selectedId }) {
  const [sortDir, setSortDir] = useState('asc')
  const rows = [
    { id: 'fiche', placeId: null, name: 'Ma fiche', isFiche: true, avgPosition: scan.atrp != null ? Number(scan.atrp) : null, top3: scan.points_top3, top10: scan.points_top10, top20: scan.points_top20 },
    ...competitors.map(c => ({
      id: c.id || c.place_id, placeId: c.place_id || null, name: c.name || c.place_id, isFiche: false,
      avgPosition: c.avg_position != null ? Number(c.avg_position) : null,
      top3: c.points_top3, top10: c.points_top10, top20: c.points_top20,
    })),
  ].sort((a, b) => {
    const av = a.avgPosition ?? 999, bv = b.avgPosition ?? 999
    return sortDir === 'asc' ? av - bv : bv - av
  })

  // Rang servant à colorer la cellule : une position ≥ 21 = « non classé » → couleur dédiée (null).
  const colorRank = v => (v == null || v >= NOT_RANKED ? null : v)

  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col style={{ width: '34%' }} />
          <col style={{ width: '19%' }} />
          <col style={{ width: '15.66%' }} />
          <col style={{ width: '15.66%' }} />
          <col style={{ width: '15.66%' }} />
        </colgroup>
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium text-text-secondary">
            <th className="px-5 py-3">Fiche</th>
            <th className="px-3 py-3 cursor-pointer select-none hover:text-text-primary transition-colors"
              onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))}>
              Position moyenne {sortDir === 'asc' ? '↑' : '↓'}
            </th>
            <th className="px-3 py-3">Top 3</th>
            <th className="px-3 py-3">Top 10</th>
            <th className="px-3 py-3">Top 20</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(r => {
            const isSelected = onRowClick && selectedId !== undefined && (r.isFiche ? null : r.placeId) === selectedId
            const rowBg = isSelected ? 'bg-accent-light' : (r.isFiche ? 'bg-accent-light/40' : '')
            return (
              <tr key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`${rowBg} ${onRowClick ? 'cursor-pointer hover:bg-bg-page transition-colors' : ''}`}>
                <td className="px-5 py-3 font-medium text-text-primary break-words">
                  {r.isFiche ? (
                    <span className="inline-flex items-center gap-1.5"><Star size={13} className="text-accent fill-accent shrink-0" /> {r.name}</span>
                  ) : r.name}
                </td>
                <td className="px-3 py-3 font-medium" style={rankSurface(colorRank(r.avgPosition)) || undefined}>
                  {r.avgPosition != null ? r.avgPosition : '—'}
                </td>
                <td className="px-3 py-3 text-text-secondary">{r.top3 ?? '—'}</td>
                <td className="px-3 py-3 text-text-secondary">{r.top10 ?? '—'}</td>
                <td className="px-3 py-3 text-text-secondary">{r.top20 ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

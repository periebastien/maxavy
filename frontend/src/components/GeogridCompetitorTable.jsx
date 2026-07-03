import { useState } from 'react'
import { Star } from 'lucide-react'

// Tableau triable « ma fiche + concurrents » (§8.2/§9) — tri par défaut sur le mieux positionné (position
// moyenne croissante, ATRP = rang donc plus bas = mieux). Un seul clic sur l'en-tête inverse le tri.
export default function GeogridCompetitorTable({ scan, competitors }) {
  const [sortDir, setSortDir] = useState('asc')
  const rows = [
    { id: 'fiche', name: 'Ma fiche', isFiche: true, avgPosition: scan.atrp, top3: scan.points_top3, top10: scan.points_top10, top20: scan.points_top20 },
    ...competitors.map(c => ({
      id: c.id || c.place_id, name: c.name || c.place_id, isFiche: false,
      avgPosition: c.avg_position != null ? Number(c.avg_position) : null,
      top3: c.points_top3, top10: c.points_top10, top20: c.points_top20,
    })),
  ].sort((a, b) => {
    const av = a.avgPosition ?? 999, bv = b.avgPosition ?? 999
    return sortDir === 'asc' ? av - bv : bv - av
  })

  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
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
          {rows.map(r => (
            <tr key={r.id} className={r.isFiche ? 'bg-accent-light/40' : ''}>
              <td className="px-5 py-3 font-medium text-text-primary">
                {r.isFiche ? (
                  <span className="inline-flex items-center gap-1.5"><Star size={13} className="text-accent fill-accent" /> {r.name}</span>
                ) : r.name}
              </td>
              <td className="px-3 py-3 text-text-primary">{r.avgPosition ?? '—'}</td>
              <td className="px-3 py-3 text-text-secondary">{r.top3 ?? '—'}</td>
              <td className="px-3 py-3 text-text-secondary">{r.top10 ?? '—'}</td>
              <td className="px-3 py-3 text-text-secondary">{r.top20 ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

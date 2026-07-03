import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Loader2 } from 'lucide-react'
import { RANGE_PRESETS, GRANULARITIES, AGG_MODES } from '../lib/geogrid-trend'

// Palette cyclique pour les lignes des graphes multi-séries (mots-clés en Suivi, concurrents en G10).
export const LINE_COLORS = ['#7C5CFC', '#1D9E75', '#E8833B', '#3B82F6', '#E24B4A', '#0EA5A5', '#D946A8', '#84931D']

// Réglages de courbe (§4.2) — partagés entre Suivi (vue globale + vue par mot-clé) et Concurrents (G10).
export function TrendControls({ rangePreset, setRangePreset, granularity, setGranularity, aggMode, setAggMode, loading }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select value={rangePreset} onChange={e => setRangePreset(e.target.value)}
        className="h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
        {RANGE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      <select value={granularity} onChange={e => setGranularity(e.target.value)}
        className="h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
        {GRANULARITIES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
      </select>
      <select value={aggMode} onChange={e => setAggMode(e.target.value)}
        className="h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
        {AGG_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      {loading && <Loader2 size={15} className="animate-spin text-accent" />}
    </div>
  )
}

// data : sortie de mergeSeriesForChart. lines : [{ key, color, label? }] — 1 par série affichée. `key` sert
// de dataKey/clé React (doit être unique — ex. place_id) ; `label` (optionnel, défaut = key) est le nom
// affiché dans la légende/l'infobulle. Les deux sont dissociés car deux concurrents peuvent avoir le même
// nom affiché (franchises) sans jamais partager le même `key`.
// onDayClick(payload) : appelé au clic sur un point du graphe ; payload = ligne cliquée (contient .key et
// .label du bucket) → la page mappe .key vers un rapport pour piloter la carte. height : hauteur en px.
export function TrendChart({ data, lines, yReversed = true, yLabel = 'Position', height = 320, onDayClick }) {
  if (!data.length) return <p className="text-sm text-text-tertiary text-center py-10">Pas encore assez de données pour tracer une courbe.</p>
  const handleClick = onDayClick
    ? e => { const p = e?.activePayload?.[0]?.payload; if (p) onDayClick(p) }
    : undefined
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        onClick={handleClick} style={onDayClick ? { cursor: 'pointer' } : undefined}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEEEF2" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6B6B78' }} />
        <YAxis reversed={yReversed} allowDecimals={false} tick={{ fontSize: 12, fill: '#6B6B78' }}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6B6B78' } }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {lines.map(l => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.label || l.key} stroke={l.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

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

// data : sortie de mergeSeriesForChart. lines : [{ key, color }] — 1 par série affichée.
export function TrendChart({ data, lines }) {
  if (!data.length) return <p className="text-sm text-text-tertiary text-center py-10">Pas encore assez de données pour tracer une courbe.</p>
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEEEF2" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6B6B78' }} />
        <YAxis reversed allowDecimals={false} tick={{ fontSize: 12, fill: '#6B6B78' }}
          label={{ value: 'Position', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6B6B78' } }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {lines.map(l => (
          <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

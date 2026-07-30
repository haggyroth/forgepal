import { useState } from 'react'
import type { FarmingRoute as Route, RouteStop } from '@/lib/route'
import { hasRoute, routedMaterialCount } from '@/lib/route'
import { Section } from './Section'

/** Regions shown before collapsing the tail — the top few are the trip worth making. */
const STOPS_SHOWN = 4

/**
 * Where to go, derived from the requisition.
 *
 * The inverse of the Requisition panel: that one answers "what do I need", this
 * one answers "where do I go". Regions are ordered by how much of the list they
 * cover, so the first stop is the most productive trip.
 */
export function FarmingRoute({ route }: { route: Route }) {
  const [expanded, setExpanded] = useState(false)
  if (!hasRoute(route)) return null

  const visible = expanded ? route.stops : route.stops.slice(0, STOPS_SHOWN)
  const hidden = route.stops.length - visible.length

  return (
    <Section
      id="farming-route"
      title="Farming route"
      aside={
        route.stops.length > 0
          ? `${routedMaterialCount(route)} across ${route.stops.length} regions`
          : undefined
      }
    >

      {route.stops.length > 0 ? (
        <ul className="space-y-3">
          {visible.map((stop) => (
            <Stop key={stop.region} stop={stop} />
          ))}
        </ul>
      ) : null}

      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 font-mono text-[0.7rem] text-iron-600 transition-colors hover:text-ember-400"
        >
          show {hidden} more region{hidden === 1 ? '' : 's'}
        </button>
      ) : null}

      {route.gathered.length > 0 ? (
        <p className="mt-4 border-t border-iron-800 pt-3 font-mono text-[0.7rem] leading-relaxed text-iron-600">
          <span className="text-verdigris-400">Gather anywhere:</span>{' '}
          {route.gathered.map((g) => `${g.name} ×${g.required}`).join(', ')}
        </p>
      ) : null}

      {route.unroutable.length > 0 ? (
        <div className="mt-3 border-t border-iron-800 pt-3">
          <p className="font-mono text-[0.7rem] leading-relaxed text-iron-600">
            {/* Bosses, humans and legendaries have no wild habitat, so there is
                no region to send you to — say why rather than omitting them. */}
            <span className="text-ember-400">No wild spawn:</span>{' '}
            {route.unroutable
              .map((u) => `${u.name} ×${u.required} (${u.sources.slice(0, 2).join(', ')})`)
              .join('; ')}
          </p>
        </div>
      ) : null}
    </Section>
  )
}

function Stop({ stop }: { stop: RouteStop }) {
  return (
    <li className="rounded-sm border border-iron-800 bg-iron-950/40 px-3 py-2">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold tracking-wide text-iron-100">
          {stop.region}
        </span>
        {stop.nightOnly ? (
          <span className="shrink-0 rounded-sm border border-blueprint-500/30 px-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-blueprint-400">
            night
          </span>
        ) : null}
        <span className="shrink-0 font-mono text-[0.68rem] text-iron-600">
          {stop.materials.length} item{stop.materials.length === 1 ? '' : 's'} ·{' '}
          {stop.palCount} pal{stop.palCount === 1 ? '' : 's'}
        </span>
      </div>

      <ul className="space-y-0.5">
        {stop.materials.map((material) => (
          <li key={material.itemId} className="flex items-baseline gap-2">
            <span className="shrink-0 font-mono text-[0.78rem] tabular-nums text-ember-400">
              ×{material.required.toLocaleString()}
            </span>
            <span className="shrink-0 font-mono text-[0.78rem] text-iron-100">
              {material.name}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-[0.68rem] text-iron-400">
              {material.pals
                .map((p) => `${p.name}${p.dayNight === 'night' ? ' (night)' : ''}`)
                .join(', ')}
            </span>
          </li>
        ))}
      </ul>
    </li>
  )
}

import type { TechRequirements } from '@/lib/tech'
import { Panel, SectionHeading } from './ui'

/**
 * What the build needs before it can be built: the stations involved, the
 * technology level gating it, and anything currently out of reach.
 *
 * Stations are the useful half — knowing a Refined Ingot needs an Improved
 * Furnace is only actionable next to the fact the furnace unlocks at Tech 34
 * and wants a Kindling Pal on it.
 */
export function Requirements({ tech }: { tech: TechRequirements }) {
  if (tech.stations.length === 0 && tech.highestLevel === null) return null

  return (
    <Panel>
      <SectionHeading
        aside={tech.highestLevel !== null ? `needs Tech ${tech.highestLevel}` : undefined}
      >
        Requirements
      </SectionHeading>

      {tech.lockedItems.length > 0 ? (
        <p
          role="status"
          className="mb-3 rounded-sm border border-ember-700/40 bg-ember-700/10 px-3 py-2 font-mono text-[0.7rem] leading-relaxed text-ember-400"
        >
          Not unlocked at your level: {tech.lockedItems.join(', ')}
        </p>
      ) : null}

      {tech.needsAncientTech ? (
        <p className="mb-3 font-mono text-[0.7rem] text-iron-400">
          Includes Ancient Technology — unlocked with Ancient Technology Points from bosses.
        </p>
      ) : null}

      {tech.stations.length > 0 ? (
        <ul className="space-y-px">
          {tech.stations.map((station) => (
            <li
              key={station.id}
              className="flex items-baseline gap-3 px-2 py-1.5 odd:bg-iron-950/30"
            >
              <span
                className={`min-w-0 flex-1 truncate font-mono text-sm ${
                  station.locked ? 'text-iron-400' : 'text-iron-100'
                }`}
              >
                {station.locked ? (
                  <span aria-hidden className="mr-1.5 text-ember-500">
                    ⚠
                  </span>
                ) : null}
                {station.name}
              </span>

              {station.workSuitability ? (
                <span className="hidden shrink-0 font-mono text-[0.68rem] text-verdigris-400/70 sm:inline">
                  {station.workSuitability}
                </span>
              ) : null}

              <span className="w-14 shrink-0 text-right font-mono text-[0.72rem] tnum text-blueprint-400">
                {station.techLevel !== null ? `Tech ${station.techLevel}` : '—'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {tech.highestLevel !== null && tech.drivenBy ? (
        <p className="mt-3 font-mono text-[0.68rem] text-iron-600">
          Gated by {tech.drivenBy} at Technology {tech.highestLevel}.
        </p>
      ) : null}
    </Panel>
  )
}

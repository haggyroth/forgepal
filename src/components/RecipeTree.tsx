import { useState } from 'react'
import { buildTree, type GameIndex, type RecipeNode } from '@/lib/calculator'
import type { ItemId } from '@/types/game'
import { Section } from './Section'

/**
 * Per-item recipe breakdown.
 *
 * Branch quantities here are per-branch and unbatched, so they will not always
 * match the Requisition — that panel aggregates and batches across the whole
 * build list. This explains structure; the Requisition is what you go shopping
 * with. The note in the header says so rather than leaving it to be discovered.
 */
export function RecipeTree({
  quantities,
  index,
}: {
  quantities: ReadonlyMap<ItemId, number>
  index: GameIndex
}) {
  const rows = [...quantities].filter(([, quantity]) => quantity > 0)
  if (rows.length === 0) return null

  return (
    <Section id="breakdown" title="Breakdown" aside="per branch" defaultOpen={false}>
      <div className="space-y-4">
        {rows.map(([itemId, quantity]) => {
          const tree = buildTree(itemId, quantity, index)
          if (!tree) return null
          return <TreeRoot key={itemId} node={tree} />
        })}
      </div>
    </Section>
  )
}

function TreeRoot({ node }: { node: RecipeNode }) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children.length > 0

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!hasChildren}
        className="flex w-full items-baseline gap-2 text-left disabled:cursor-default"
      >
        <span aria-hidden className="w-2 font-mono text-xs text-iron-600">
          {hasChildren ? (open ? '−' : '+') : ''}
        </span>
        <span className="font-display text-sm font-semibold tracking-wide text-iron-100">
          {node.name}
        </span>
        <span className="font-mono text-sm tnum text-ember-400">×{node.quantity}</span>
        {node.stationName ? (
          <span className="truncate font-mono text-[0.68rem] text-blueprint-400/70">
            {node.stationName}
          </span>
        ) : null}
      </button>

      {open && hasChildren ? (
        <ul className="mt-1 ml-[0.3rem] border-l border-iron-800 pl-3">
          {node.children.map((child) => (
            <TreeBranch key={child.itemId} node={child} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function TreeBranch({ node }: { node: RecipeNode }) {
  const hasChildren = node.children.length > 0

  return (
    <li className="relative py-0.5">
      {/* Elbow connector joining this row to the parent's vertical rule. */}
      <span
        aria-hidden
        className="absolute -left-3 top-[0.85rem] h-px w-2 bg-iron-800"
      />
      <div className="flex items-baseline gap-2">
        <span
          className={`min-w-0 truncate font-mono text-[0.8rem] ${
            hasChildren ? 'text-iron-100' : 'text-iron-400'
          }`}
        >
          {node.name}
        </span>
        <span className="font-mono text-[0.8rem] tnum text-iron-300">×{node.quantity}</span>
        {node.truncated ? (
          <span className="font-mono text-[0.65rem] text-iron-700">(seen above)</span>
        ) : null}
      </div>

      {hasChildren ? (
        <ul className="ml-0 border-l border-iron-800 pl-3">
          {node.children.map((child) => (
            <TreeBranch key={child.itemId} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

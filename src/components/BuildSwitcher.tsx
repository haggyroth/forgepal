import { useEffect, useRef, useState } from 'react'
import type { Build } from '@/lib/builds'
import { MAX_BUILDS } from '@/lib/builds'

/**
 * Switch, rename, add, duplicate, and delete named builds.
 *
 * Sits inside the Build list rather than in the page header: the name belongs
 * with the thing it names, and renaming is something you do while looking at
 * the contents.
 */
export function BuildSwitcher({
  builds,
  activeId,
  name,
  onSelect,
  onCreate,
  onDuplicate,
  onRename,
  onDelete,
}: {
  builds: readonly Build[]
  activeId: string
  name: string
  onSelect: (id: string) => void
  onCreate: () => void
  onDuplicate: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) input.current?.select()
  }, [editing])

  // A pending "delete?" must not carry over to whatever you switch to.
  useEffect(() => setConfirmingDelete(false), [activeId])

  const commit = () => {
    onRename(draft)
    setEditing(false)
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {editing ? (
        <input
          ref={input}
          value={draft}
          aria-label="Build name"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') {
              setDraft(name)
              setEditing(false)
            }
          }}
          className="min-w-0 flex-1 rounded-sm border border-ember-700 bg-iron-950/60 px-2 py-1 font-mono text-sm text-iron-100 focus:outline-none"
        />
      ) : (
        <select
          value={activeId}
          aria-label="Active build"
          onChange={(event) => onSelect(event.target.value)}
          className="min-w-0 flex-1 rounded-sm border border-iron-700 bg-iron-950/60 px-2 py-1 font-mono text-sm text-iron-100 focus:border-ember-700"
        >
          {builds.map((build) => (
            <option key={build.id} value={build.id}>
              {build.name}
              {build.quantities.size > 0 ? ` (${build.quantities.size})` : ''}
            </option>
          ))}
        </select>
      )}

      <Action
        onClick={() => {
          setDraft(name)
          setEditing(true)
        }}
        disabled={editing}
      >
        rename
      </Action>
      <Action onClick={onCreate} disabled={builds.length >= MAX_BUILDS}>
        new
      </Action>
      <Action onClick={onDuplicate} disabled={builds.length >= MAX_BUILDS}>
        duplicate
      </Action>

      {/* Two-step, because deleting a build the user spent time assembling is
          not something a stray click should be able to do. */}
      {confirmingDelete ? (
        <Action
          onClick={() => {
            onDelete()
            setConfirmingDelete(false)
          }}
          danger
        >
          really delete?
        </Action>
      ) : (
        <Action onClick={() => setConfirmingDelete(true)}>delete</Action>
      )}
    </div>
  )
}

function Action({
  onClick,
  children,
  disabled = false,
  danger = false,
}: {
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 rounded-sm border px-2 py-1 font-mono text-[0.7rem] transition-colors disabled:cursor-not-allowed disabled:border-iron-800 disabled:text-iron-700 ${
        danger
          ? 'border-ember-700 text-ember-400 hover:bg-ember-700/15'
          : 'border-iron-700 text-iron-400 hover:border-ember-700 hover:text-ember-400'
      }`}
    >
      {children}
    </button>
  )
}

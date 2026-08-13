import { describe, expect, it } from 'vitest'
import { datasetStamp } from './meta'
import { gameData } from '.'

/**
 * The footer stamp is a projection of `game-data.json`'s `meta`, duplicated into
 * its own file so the shell can render the game version without pulling the
 * whole item catalogue into the initial chunk.
 *
 * Duplication earns a tripwire. If the importer ever writes one and not the
 * other, the footer starts quoting a version the dataset no longer describes —
 * which is worse than no provenance at all, because it looks authoritative.
 *
 * This is the same pattern as the `comboKey` / `nearestInPool` agreement test:
 * where a fact is deliberately reachable from two places, assert the two places
 * still say the same thing.
 */
describe('the committed dataset stamp', () => {
  it('agrees with the dataset it describes', () => {
    expect(datasetStamp).toEqual({
      gameVersion: gameData.meta.gameVersion,
      updated: gameData.meta.updated,
    })
  })

  it('carries no importedAt', () => {
    // Omitted on purpose: the shell never shows it, and including it would make
    // this file churn on every import and open a weekly refresh PR for nothing.
    expect(datasetStamp).not.toHaveProperty('importedAt')
  })
})

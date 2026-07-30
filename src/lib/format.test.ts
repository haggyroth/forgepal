import { describe, expect, it } from 'vitest'
import { formatHours } from './format'

describe('formatHours', () => {
  it('renders sub-hour durations in minutes', () => {
    expect(formatHours(0.5)).toBe('30m')
    expect(formatHours(0.75)).toBe('45m')
  })

  it('renders whole hours plainly', () => {
    expect(formatHours(2)).toBe('2h')
  })

  it('renders a mixed duration', () => {
    expect(formatHours(1.5)).toBe('1h 30m')
  })
})

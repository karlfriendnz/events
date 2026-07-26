/**
 * The occurrence limit on a repeat rule.
 *
 * Two things are easy to get wrong and quiet when wrong:
 *  - COUNT and UNTIL are mutually exclusive in RFC 5545. A rule carrying both is
 *    malformed and parsers disagree about which wins, so setting a count has to
 *    drop any UNTIL rather than produce a rule meaning two things.
 *  - The repeat dropdown matches options by EXACT value, so the count has to be
 *    strippable again or the Select silently shows blank while a repeat is set.
 */
import { describe, it, expect } from 'vitest'
import { rruleCount, rruleWithCount, isPresetRrule, rruleToSummary } from '../../composables/useRepeatOptions'

// A Sunday, so "Weekly on Sunday" is the preset built for this date.
const SUNDAY = new Date('2026-07-26T09:00:00')

describe('rruleCount', () => {
  it('reads the count when present', () => {
    expect(rruleCount('FREQ=WEEKLY;BYDAY=SU;COUNT=8')).toBe(8)
  })
  it('is null when unlimited', () => {
    expect(rruleCount('FREQ=WEEKLY;BYDAY=SU')).toBeNull()
  })
  it('ignores a nonsense count rather than trusting it', () => {
    expect(rruleCount('FREQ=WEEKLY;COUNT=0')).toBeNull()
    expect(rruleCount('FREQ=WEEKLY;COUNT=abc')).toBeNull()
  })
  it('does not match a different key ending in COUNT', () => {
    expect(rruleCount('FREQ=MONTHLY;BYMONTHDAY=8')).toBeNull()
  })
})

describe('rruleWithCount', () => {
  it('adds a count', () => {
    expect(rruleWithCount('FREQ=WEEKLY;BYDAY=SU', 8)).toBe('FREQ=WEEKLY;BYDAY=SU;COUNT=8')
  })
  it('replaces an existing count rather than appending a second', () => {
    expect(rruleWithCount('FREQ=WEEKLY;COUNT=3', 8)).toBe('FREQ=WEEKLY;COUNT=8')
  })
  it('clears the count when given null', () => {
    expect(rruleWithCount('FREQ=WEEKLY;BYDAY=SU;COUNT=8', null)).toBe('FREQ=WEEKLY;BYDAY=SU')
  })
  it('drops UNTIL when a count is set — the two cannot coexist', () => {
    expect(rruleWithCount('FREQ=WEEKLY;UNTIL=20261231', 8)).toBe('FREQ=WEEKLY;COUNT=8')
  })
  it('leaves UNTIL alone when only clearing the count', () => {
    expect(rruleWithCount('FREQ=WEEKLY;UNTIL=20261231;COUNT=8', null)).toBe('FREQ=WEEKLY;UNTIL=20261231')
  })
  it('leaves a non-repeating rule untouched', () => {
    expect(rruleWithCount('NONE', 8)).toBe('NONE')
    expect(rruleWithCount('', 8)).toBe('')
  })
  it('round-trips: adding then clearing returns the original', () => {
    const original = 'FREQ=WEEKLY;BYDAY=SU'
    expect(rruleWithCount(rruleWithCount(original, 12), null)).toBe(original)
  })
})

describe('isPresetRrule', () => {
  it('recognises a preset even once a count is attached', () => {
    expect(isPresetRrule('FREQ=WEEKLY;BYDAY=SU;COUNT=8', SUNDAY)).toBe(true)
  })
  it('recognises a bare preset', () => {
    expect(isPresetRrule('FREQ=DAILY', SUNDAY)).toBe(true)
  })
  it('rejects a rule built in the Custom dialog', () => {
    // Every-3-weeks on Mon/Wed is not offered as a preset.
    expect(isPresetRrule('FREQ=WEEKLY;INTERVAL=3;BYDAY=MO,WE', SUNDAY)).toBe(false)
  })
  it('rejects CUSTOM itself', () => {
    expect(isPresetRrule('CUSTOM', SUNDAY)).toBe(false)
  })
})

describe('the summary line reflects the count', () => {
  it('reads back what was set', () => {
    expect(rruleToSummary('FREQ=WEEKLY;BYDAY=SU;COUNT=8')).toContain('for 8 occurrences')
  })
  it('says nothing about occurrences when unlimited', () => {
    expect(rruleToSummary('FREQ=WEEKLY;BYDAY=SU')).not.toContain('occurrence')
  })
  it('singularises one occurrence', () => {
    expect(rruleToSummary('FREQ=DAILY;COUNT=1')).toContain('for 1 occurrence')
  })
})

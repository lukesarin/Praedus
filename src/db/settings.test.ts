import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StudyBlocksDB } from './db'
import { getTermStart, normalizeTermStart, setTermStart } from './settings'

let db: StudyBlocksDB
let n = 0

beforeEach(async () => {
  db = new StudyBlocksDB(`settings-test-${n++}`)
  await db.open()
})

afterEach(async () => {
  await db.delete()
})

describe('normalizeTermStart', () => {
  it('accepts a real calendar date', () => {
    expect(normalizeTermStart('2026-08-24')).toBe('2026-08-24')
    expect(normalizeTermStart('2028-02-29')).toBe('2028-02-29')
  })
  it('rejects anything else', () => {
    expect(normalizeTermStart('2026-13-01')).toBeUndefined()
    expect(normalizeTermStart('2026-02-30')).toBeUndefined()
    expect(normalizeTermStart('2027-02-29')).toBeUndefined()
    expect(normalizeTermStart('Aug 24')).toBeUndefined()
    expect(normalizeTermStart('2026-8-24')).toBeUndefined()
    expect(normalizeTermStart(42)).toBeUndefined()
    expect(normalizeTermStart(undefined)).toBeUndefined()
  })
})

describe('term start setting', () => {
  it('is undefined until set', async () => {
    expect(await getTermStart(db)).toBeUndefined()
  })
  it('round-trips', async () => {
    await setTermStart(db, '2026-08-24')
    expect(await getTermStart(db)).toBe('2026-08-24')
  })
  it('clears when set to undefined or invalid', async () => {
    await setTermStart(db, '2026-08-24')
    await setTermStart(db, undefined)
    expect(await getTermStart(db)).toBeUndefined()
    await setTermStart(db, '2026-08-24')
    await setTermStart(db, 'nope')
    expect(await getTermStart(db)).toBeUndefined()
  })
})

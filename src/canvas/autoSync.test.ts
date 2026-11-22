import { describe, expect, it } from 'vitest'
import type { Feed } from '../db/db'
import { shouldSync, type SyncReason } from './autoSync'

const NOW = Date.parse('2026-11-24T14:00:00Z')
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()
const canvas = (extra: Partial<Feed> = {}): Feed => ({
  id: 'url-abc',
  label: 'Canvas',
  url: 'https://s.instructure.com/feeds/calendars/user_ab.ics',
  ...extra,
})
const none = new Set<string>()
const reasons: SyncReason[] = ['launch', 'interval', 'visible']

describe('shouldSync', () => {
  it('never syncs sample data or uploaded files', () => {
    for (const r of reasons) {
      expect(shouldSync({ id: 'sample', label: 'Sample data' }, NOW, r, none)).toBe(false)
      expect(shouldSync({ id: 'file-x', label: 'export.ics' }, NOW, r, none)).toBe(false)
    }
  })

  it('never starts a second sync of a feed that is already syncing', () => {
    for (const r of reasons) expect(shouldSync(canvas(), NOW, r, new Set(['url-abc']))).toBe(false)
  })

  it('syncs every Canvas feed on launch and on the 30-minute timer', () => {
    expect(shouldSync(canvas({ lastSyncedAt: minutesAgo(1) }), NOW, 'launch', none)).toBe(true)
    expect(shouldSync(canvas({ lastSyncedAt: minutesAgo(1) }), NOW, 'interval', none)).toBe(true)
  })

  it('on returning to the tab, syncs only if the last sync is over 5 minutes old', () => {
    expect(shouldSync(canvas({ lastSyncedAt: minutesAgo(2) }), NOW, 'visible', none)).toBe(false)
    expect(shouldSync(canvas({ lastSyncedAt: minutesAgo(6) }), NOW, 'visible', none)).toBe(true)
    expect(shouldSync(canvas(), NOW, 'visible', none)).toBe(true)
  })

  it('retries a feed with an error on the same triggers, not sooner', () => {
    const failing = canvas({ lastSyncedAt: minutesAgo(2), lastError: 'Canvas took too long to answer.' })
    expect(shouldSync(failing, NOW, 'visible', none)).toBe(false)
    expect(shouldSync(failing, NOW, 'interval', none)).toBe(true)
  })
})

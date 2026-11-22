import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Feed } from '../db/db'
import { CanvasCard } from './CanvasCard'

const NOW = Date.parse('2026-11-24T14:00:00Z')
const feed = (extra: Partial<Feed> = {}): Feed => ({
  id: 'url-abc',
  label: 'Canvas · s.instructure.com',
  url: 'https://s.instructure.com/feeds/calendars/user_ab.ics',
  lastSyncedAt: new Date(NOW - 4 * 60_000).toISOString(),
  ...extra,
})
const noop = () => {}
const render = (f: Feed, opts: { syncing?: boolean; items?: number; courses?: number } = {}) =>
  renderToStaticMarkup(createElement(CanvasCard, {
    feed: f, itemCount: opts.items ?? 12, courseCount: opts.courses ?? 4,
    syncing: opts.syncing ?? false, now: NOW, onSyncNow: noop, onDisconnect: noop,
  }))

describe('CanvasCard', () => {
  it('shows a connected Canvas account with its last sync and counts', () => {
    const html = render(feed())
    expect(html).toContain('Connected')
    expect(html).toContain('Synced 4 minutes ago')
    expect(html).toContain('12 assignments · 4 courses')
    expect(html).toMatch(/<button[^>]*>Sync now<\/button>/)
    expect(html).toMatch(/<button[^>]*>Disconnect<\/button>/)
  })

  it('uses singular words for one assignment and one course', () => {
    expect(render(feed(), { items: 1, courses: 1 })).toContain('1 assignment · 1 course')
  })

  it('shows syncing and disables Sync now while a sync runs', () => {
    const html = render(feed(), { syncing: true })
    expect(html).toContain('Syncing…')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Sync now<\/button>/)
  })

  it('blocks Disconnect while a sync runs, so a finishing sync cannot bring the connection back', () => {
    expect(render(feed(), { syncing: true })).toMatch(/<button[^>]*disabled=""[^>]*>Disconnect<\/button>/)
    expect(render(feed())).not.toMatch(/<button[^>]*disabled=""[^>]*>Disconnect<\/button>/)
  })

  it('asks for attention with plain-language guidance when the last sync failed', () => {
    const html = render(feed({ lastError: 'Canvas answered with an error (404). Check that the link is current.' }))
    expect(html).toContain('Needs attention')
    expect(html).toContain('This Canvas link stopped working. Paste a new one from Canvas.')
  })
})

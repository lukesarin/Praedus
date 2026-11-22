import { describe, expect, it } from 'vitest'
import { friendlySyncError, isCanvasFeed, isCanvasFeedLink, normalizeCanvasLink } from './canvasLink'

const LINK = 'https://s.instructure.com/feeds/calendars/user_ab.ics'

describe('normalizeCanvasLink', () => {
  it('trims and turns webcal:// into https://', () => {
    expect(normalizeCanvasLink('  webcal://s.instructure.com/feeds/calendars/user_ab.ics ')).toBe(LINK)
  })
})

describe('isCanvasFeedLink', () => {
  it('accepts a Canvas calendar feed link, including its webcal form', () => {
    expect(isCanvasFeedLink(LINK)).toBe(true)
    expect(isCanvasFeedLink(' webcal://s.instructure.com/feeds/calendars/user_ab.ics')).toBe(true)
  })

  it('rejects plain http, other pages, links with credentials, and non-links', () => {
    expect(isCanvasFeedLink('http://s.instructure.com/feeds/calendars/user_ab.ics')).toBe(false)
    expect(isCanvasFeedLink('https://s.edu/calendar')).toBe(false)
    expect(isCanvasFeedLink('https://u:p@s.edu/feeds/calendars/user_a.ics')).toBe(false)
    expect(isCanvasFeedLink('not a url')).toBe(false)
  })
})

describe('isCanvasFeed', () => {
  it('is true only for feeds that sync from a Canvas link', () => {
    expect(isCanvasFeed({ id: 'url-x', label: 'Canvas', url: LINK })).toBe(true)
    expect(isCanvasFeed({ id: 'sample', label: 'Sample data' })).toBe(false)
    expect(isCanvasFeed({ id: 'file-x', label: 'export.ics' })).toBe(false)
  })
})

describe('friendlySyncError', () => {
  const INVALID = "That doesn't look like a Canvas calendar link. In Canvas, open Calendar → Calendar Feed and copy the link."
  const GONE = 'This Canvas link stopped working. Paste a new one from Canvas.'
  const OFFLINE = "Couldn't reach Praedus's sync service. Check your connection; we'll try again shortly."
  const OTHER = "Canvas didn't respond. We'll try again shortly."

  it('explains links the server refuses', () => {
    expect(friendlySyncError("That isn't a Canvas calendar feed link.")).toBe(INVALID)
    expect(friendlySyncError("That address isn't allowed.")).toBe(INVALID)
  })

  it('explains links Canvas no longer honors', () => {
    expect(friendlySyncError('Canvas answered with an error (404). Check that the link is current.')).toBe(GONE)
    expect(friendlySyncError("Canvas didn't send back a calendar. Check that the link is current.")).toBe(GONE)
  })

  it('explains when Praedus\'s sync service cannot be reached', () => {
    expect(friendlySyncError("Couldn't reach the feed helper. Is `npm run dev` running?")).toBe(OFFLINE)
  })

  it('explains when the school\'s Canvas address cannot be found, without blaming Praedus', () => {
    expect(friendlySyncError("Couldn't find the server s.edu.")).toBe(
      "Couldn't find your school's Canvas at that address. Check the link, or we'll try again shortly.",
    )
  })

  it('falls back to a calm retry message for anything else', () => {
    expect(friendlySyncError('Canvas took too long to answer.')).toBe(OTHER)
  })
})

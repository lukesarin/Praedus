import type { Feed } from '../db/db'

/** Same shape the feed helper accepts: https://<school>/feeds/calendars/<token>.ics */
const FEED_PATH = /^\/feeds\/calendars\/[A-Za-z0-9_.-]+\.ics$/

/** Canvas hands out `webcal://` links; the helper fetches them over https. */
export function normalizeCanvasLink(raw: string): string {
  return raw.trim().replace(/^webcal:\/\//i, 'https://')
}

export function isCanvasFeedLink(raw: string): boolean {
  let url: URL
  try {
    url = new URL(normalizeCanvasLink(raw))
  } catch {
    return false
  }
  return url.protocol === 'https:' && !url.username && !url.password && FEED_PATH.test(url.pathname)
}

/** Feeds that sync from a Canvas link (not sample data or uploaded files). */
export function isCanvasFeed(feed: Feed): boolean {
  return !!feed.url && isCanvasFeedLink(feed.url)
}

const INVALID = "That doesn't look like a Canvas calendar link. In Canvas, open Calendar → Calendar Feed and copy the link."
const GONE = 'This Canvas link stopped working. Paste a new one from Canvas.'
const OFFLINE = "Couldn't reach Praedus's sync service. Check your connection; we'll try again shortly."
const NO_SCHOOL = "Couldn't find your school's Canvas at that address. Check the link, or we'll try again shortly."
const OTHER = "Canvas didn't respond. We'll try again shortly."

/** Turns the feed helper's (and the browser's) messages into plain guidance for students. */
export function friendlySyncError(message: string): string {
  if (/isn't a Canvas calendar|isn't allowed/.test(message)) return INVALID
  if (/answered with an error|didn't send back a calendar/.test(message)) return GONE
  if (/Couldn't find the server/.test(message)) return NO_SCHOOL
  if (/feed helper/.test(message)) return OFFLINE
  return OTHER
}

/** The message shown when a link is rejected before contacting the server. */
export const INVALID_LINK_MESSAGE = INVALID

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Feed } from '../db/db'
import { resyncFeed } from '../import/syncFeed'
import { isCanvasFeed } from './canvasLink'

export type SyncReason = 'launch' | 'interval' | 'visible'

export const SYNC_INTERVAL_MS = 30 * 60_000
export const VISIBLE_MIN_GAP_MS = 5 * 60_000

/**
 * Whether a feed should sync now. Only Canvas links sync on their own; a feed with an
 * error simply waits for the next trigger, so an offline laptop never retries in a loop.
 */
export function shouldSync(feed: Feed, now: number, reason: SyncReason, syncing: ReadonlySet<string>): boolean {
  if (!isCanvasFeed(feed) || syncing.has(feed.id)) return false
  if (reason !== 'visible') return true
  return !feed.lastSyncedAt || now - Date.parse(feed.lastSyncedAt) > VISIBLE_MIN_GAP_MS
}

/**
 * Keeps Canvas links in sync while Praedus is open: on launch, every 30 minutes, and on
 * returning to the tab. Syncs run one at a time through the normal import, so done marks,
 * edits, estimates and study blocks are kept exactly as a manual sync keeps them.
 */
export function useAutoSync(feeds: Feed[] | undefined) {
  const [syncing, setSyncing] = useState<ReadonlySet<string>>(() => new Set())
  const syncingRef = useRef<Set<string>>(new Set())
  const feedsRef = useRef(feeds)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const launched = useRef(false)
  feedsRef.current = feeds

  const syncNow = useCallback((feed: Feed): Promise<void> => {
    if (syncingRef.current.has(feed.id)) return queue.current
    syncingRef.current.add(feed.id)
    setSyncing(new Set(syncingRef.current))
    queue.current = queue.current.then(async () => {
      try {
        await resyncFeed(feed)
      } catch {
        // The error is saved on the feed and shown on its card.
      } finally {
        syncingRef.current.delete(feed.id)
        setSyncing(new Set(syncingRef.current))
      }
    })
    return queue.current
  }, [])

  const run = useCallback((reason: SyncReason) => {
    const now = Date.now()
    for (const feed of feedsRef.current ?? []) {
      if (shouldSync(feed, now, reason, syncingRef.current)) void syncNow(feed)
    }
  }, [syncNow])

  useEffect(() => {
    if (feeds && !launched.current) {
      launched.current = true
      run('launch')
    }
  }, [feeds, run])

  useEffect(() => {
    const timer = setInterval(() => run('interval'), SYNC_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') run('visible')
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [run])

  return { syncing, syncNow }
}

import type { ParsedItem } from '../import/types'
import { itemId, type CalendarItem, type Course, type StudyBlocksDB } from './db'
import { nextCourseColor } from './colors'
import { dueInstant } from '../study/plan'
import { isTest } from '../study/testItems'

export type ImportResult = {
  added: number
  updated: number
  /** Deleted because they vanished from the feed. */
  removed: number
  /** Vanished from the feed (not yet past due) but kept because the student marked them done or edited them. */
  kept: number
  /** Past-due assignments and tests that aged out of Canvas's 30-day feed, kept as history. */
  history: number
}

/**
 * Merges a freshly parsed feed into the database. Feed-owned fields are refreshed;
 * student-owned fields (done, edits, estimates, reviewed, course colors) are never overwritten.
 *
 * An item missing from the feed is kept as history (`keptAsHistory`, study blocks included)
 * when it is past due and is an assignment or a test, whether or not the student touched it,
 * because Canvas's feed only reaches back 30 days. Any other missing item is kept with
 * `removedFromSource` if done or edited, and deleted (with its study blocks) otherwise.
 * `now` is only for tests; production uses the default.
 */
export async function importFeed(
  db: StudyBlocksDB,
  feedId: string,
  parsed: ParsedItem[],
  now: Date = new Date(),
): Promise<ImportResult> {
  // Last occurrence of a uid wins.
  const incoming = new Map<string, ParsedItem>()
  for (const p of parsed) incoming.set(itemId(feedId, p.uid), p)

  return db.transaction('rw', db.items, db.courses, db.studyBlocks, async () => {
    const courseIds = await ensureCourses(db, [...incoming.values()])
    const existing = new Map(
      (await db.items.where('feedId').equals(feedId).toArray()).map((i) => [i.id, i]),
    )
    const result: ImportResult = { added: 0, updated: 0, removed: 0, kept: 0, history: 0 }
    const toPut: CalendarItem[] = []

    for (const [id, p] of incoming) {
      const { courseName, ...fields } = p
      const fromFeed = {
        ...fields,
        id,
        feedId,
        courseId: courseName ? courseIds.get(courseName) : undefined,
      }
      const old = existing.get(id)
      if (!old) {
        toPut.push({ ...fromFeed, done: false, userEdited: false, removedFromSource: false })
        result.added++
      } else {
        const base = old.userEdited ? old : { ...fromFeed, courseId: fromFeed.courseId ?? old.courseId }
        toPut.push({
          ...base,
          done: old.done,
          userEdited: old.userEdited,
          removedFromSource: false,
          keptAsHistory: false,
          ...(old.reviewed !== undefined ? { reviewed: old.reviewed } : {}),
          ...(old.estimateMinutes !== undefined ? { estimateMinutes: old.estimateMinutes } : {}),
        })
        result.updated++
      }
    }

    const toDelete: string[] = []
    for (const old of existing.values()) {
      if (incoming.has(old.id)) continue
      const past = dueInstant(old) <= now.getTime()
      if (past && (old.kind === 'assignment' || isTest(old))) {
        toPut.push({ ...old, keptAsHistory: true, removedFromSource: false })
        result.history++
      } else if (old.done || old.userEdited) {
        toPut.push({ ...old, removedFromSource: true })
        result.kept++
      } else {
        toDelete.push(old.id)
        result.removed++
      }
    }

    await db.items.bulkPut(toPut)
    await db.items.bulkDelete(toDelete)
    if (toDelete.length) await db.studyBlocks.where('itemId').anyOf(toDelete).delete()
    return result
  })
}

/** Returns course name → id, creating any courses that don't exist yet. */
async function ensureCourses(db: StudyBlocksDB, items: ParsedItem[]): Promise<Map<string, string>> {
  const all = await db.courses.toArray()
  const ids = new Map(all.map((c) => [c.name, c.id]))
  let count = all.length
  const created: Course[] = []
  for (const { courseName } of items) {
    if (!courseName || ids.has(courseName)) continue
    const course = { id: crypto.randomUUID(), name: courseName, color: nextCourseColor(count++) }
    created.push(course)
    ids.set(courseName, course.id)
  }
  if (created.length) await db.courses.bulkAdd(created)
  return ids
}

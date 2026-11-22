import Dexie, { type EntityTable } from 'dexie'
import type { Commitment } from '../commitments/types'
import type { ParsedItem } from '../import/types'
import type { StudyBlock } from '../study/types'

/** A calendar source: a Canvas feed URL or an uploaded .ics file. Lives only in this browser. */
export type Feed = {
  id: string
  label: string
  /** Missing for uploaded files. */
  url?: string
  lastSyncedAt?: string
  lastError?: string
}

export type Course = {
  id: string
  name: string
  color: string
}

export type CalendarItem = Omit<ParsedItem, 'courseName'> & {
  /** `${feedId}|${uid}` */
  id: string
  feedId: string
  courseId?: string
  /** Set by the student. Never overwritten by a re-import. */
  done: boolean
  /** The student changed this item; re-imports leave its content alone. */
  userEdited: boolean
  /** The item disappeared from its feed but was kept because the student touched it. */
  removedFromSource: boolean
  /** How long the student expects it to take (minutes). Set by the student, kept on re-import. */
  estimateMinutes?: number
}

/** Small key/value store for per-student settings. */
export type Setting = { key: string; value: unknown }

export class StudyBlocksDB extends Dexie {
  declare feeds: EntityTable<Feed, 'id'>
  declare courses: EntityTable<Course, 'id'>
  declare items: EntityTable<CalendarItem, 'id'>
  declare commitments: EntityTable<Commitment, 'id'>
  declare settings: EntityTable<Setting, 'key'>
  declare studyBlocks: EntityTable<StudyBlock, 'id'>

  constructor(name = 'studyblocks') {
    super(name)
    this.version(1).stores({
      feeds: 'id',
      courses: 'id, &name',
      items: 'id, feedId, courseId, kind, start',
    })
    // Milestone 2: commitments (classes, shifts, …) and settings.
    this.version(2).stores({
      commitments: 'id',
      settings: 'key',
    })
    // Milestone 3: planned study blocks.
    this.version(3).stores({
      studyBlocks: 'id, itemId, start',
    })
  }
}

/**
 * The signed-in account's database. A live binding: `openUserDatabase` swaps it when someone
 * signs in, and every module that imports `db` sees the new one.
 */
export let db = new StudyBlocksDB()

/** Each account gets its own local database, so people sharing a computer never see each other's data. */
export function openUserDatabase(userId: string): StudyBlocksDB {
  const name = `praedus-${userId}`
  if (db.name !== name) {
    db.close()
    db = new StudyBlocksDB(name)
  }
  return db
}

const CLAIM_KEY = 'praedus.legacyClaimedBy'

/**
 * Data saved before accounts existed lives in the `studyblocks` database. The first account to
 * sign in on this browser gets a copy (only into an empty database); after that it's never
 * offered to anyone else.
 */
export async function claimLegacyData(
  target: StudyBlocksDB,
  userId: string,
  legacyName = 'studyblocks',
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): Promise<'claimed' | 'none' | 'taken'> {
  const owner = storage.getItem(CLAIM_KEY)
  if (owner && owner !== userId) return 'taken'
  if (owner === userId || !(await Dexie.exists(legacyName))) return 'none'
  const legacy = new StudyBlocksDB(legacyName)
  try {
    const counts = await Promise.all(legacy.tables.map((t) => t.count()))
    if (counts.every((c) => c === 0)) return 'none'
    const targetCounts = await Promise.all(target.tables.map((t) => t.count()))
    if (targetCounts.some((c) => c > 0)) return 'none'
    // Read everything first: awaiting another database inside the write transaction would end it early.
    const rows = await Promise.all(legacy.tables.map(async (t) => [t.name, await t.toArray()] as const))
    await target.transaction('rw', target.tables, async () => {
      for (const [name, data] of rows) await target.table(name).bulkPut(data)
    })
    storage.setItem(CLAIM_KEY, userId)
    return 'claimed'
  } finally {
    legacy.close()
  }
}

export function itemId(feedId: string, uid: string): string {
  return `${feedId}|${uid}`
}

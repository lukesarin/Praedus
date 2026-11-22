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
  /**
   * The item disappeared from its feed while not yet past due, but was kept because the student
   * touched it. (Past assignments and tests that vanish get `keptAsHistory` instead.)
   */
  removedFromSource: boolean
  /** How long the student expects it to take (minutes). Set by the student, kept on re-import. */
  estimateMinutes?: number
  /** The student reviewed for this test. Student-owned, independent of `done`; kept on re-import. */
  reviewed?: boolean
  /**
   * Set by sync when a past-due assignment or test aged out of Canvas's 30-day feed and was kept
   * as semester history. Cleared if the item reappears in the feed.
   */
  keptAsHistory?: boolean
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

export const db = new StudyBlocksDB()

export function itemId(feedId: string, uid: string): string {
  return `${feedId}|${uid}`
}

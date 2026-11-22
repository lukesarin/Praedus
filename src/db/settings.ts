import { normalizeStudySettings, type StudySettings } from '../study/types'
import type { StudyBlocksDB } from './db'

/** Warn when commitments are closer together than this many minutes. 0 turns warnings off. */
export const DEFAULT_MIN_GAP = 10
const MIN_GAP_KEY = 'minGapMinutes'

export function normalizeMinGap(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MIN_GAP
  return Math.min(Math.round(n), 240)
}

export async function getMinGap(db: StudyBlocksDB): Promise<number> {
  const row = await db.settings.get(MIN_GAP_KEY)
  return row === undefined ? DEFAULT_MIN_GAP : normalizeMinGap(row.value)
}

export async function setMinGap(db: StudyBlocksDB, minutes: number): Promise<void> {
  await db.settings.put({ key: MIN_GAP_KEY, value: normalizeMinGap(minutes) })
}

const TERM_START_KEY = 'termStart'

/** Only a real calendar date written exactly as YYYY-MM-DD. */
export function normalizeTermStart(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return undefined
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const check = new Date(Date.UTC(y, mo - 1, d))
  const real = check.getUTCFullYear() === y && check.getUTCMonth() === mo - 1 && check.getUTCDate() === d
  return real ? value : undefined
}

export async function getTermStart(db: StudyBlocksDB): Promise<string | undefined> {
  return normalizeTermStart((await db.settings.get(TERM_START_KEY))?.value)
}

export async function setTermStart(db: StudyBlocksDB, date: string | undefined): Promise<void> {
  const valid = normalizeTermStart(date)
  if (valid === undefined) await db.settings.delete(TERM_START_KEY)
  else await db.settings.put({ key: TERM_START_KEY, value: valid })
}

const STUDY_KEY = 'study'

export async function getStudySettings(db: StudyBlocksDB): Promise<StudySettings> {
  return normalizeStudySettings((await db.settings.get(STUDY_KEY))?.value)
}

export async function setStudySettings(db: StudyBlocksDB, settings: StudySettings): Promise<void> {
  await db.settings.put({ key: STUDY_KEY, value: normalizeStudySettings(settings) })
}

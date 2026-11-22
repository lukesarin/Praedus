/** What the app says it's doing while a week's cards are made. Timed estimates: the app can't see inside Claude's work. */
export const WAIT_STEPS = ['Reading your notes', 'Writing the lessons', 'Writing the problems', 'Checking every answer'] as const
/** Seconds at which each step is shown as done (the last one keeps spinning). */
const STEP_ENDS = [8, 25, 50]
const BAR_FULL_AT = 75
const BAR_MAX = 92
const LATE_AFTER = 120

export function waitProgress(seconds: number): { step: number; bar: number; late: boolean } {
  const step = STEP_ENDS.filter((end) => seconds >= end).length
  return { step, bar: Math.min(BAR_MAX, Math.round((seconds / BAR_FULL_AT) * BAR_MAX)), late: seconds >= LATE_AFTER }
}

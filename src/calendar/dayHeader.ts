/** The two lines of a week-view column header: a short weekday over the day of the month. */
export function dayHeaderParts(date: Date): { weekday: string; day: number } {
  return { weekday: date.toLocaleDateString('en-US', { weekday: 'short' }), day: date.getDate() }
}

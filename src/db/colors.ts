/** Muted colors that read well on both themes and stay clear of the mint accent. */
export const COURSE_COLORS = [
  '#8b7cf6', // violet
  '#4fa3d1', // blue
  '#f08bb4', // pink (was green: too close to the mint accent)
  '#e0a84f', // amber
  '#e06c75', // rose
  '#e8c35a', // gold (was teal: too close to the mint accent)
  '#c678dd', // orchid
  '#d19a66', // clay
]

export function nextCourseColor(existingCount: number): string {
  return COURSE_COLORS[existingCount % COURSE_COLORS.length]
}

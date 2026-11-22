import { courseCode } from '../map/donut'

/** Subjects whose cards are worked problems; every other class gets idea cards. */
const PROBLEM_SUBJECTS = new Set(['MATH', 'STAT', 'CS', 'CSE', 'CIS', 'COMP', 'PHYS', 'PHY', 'CHEM', 'ECON', 'ENGR', 'EE', 'ME'])

export type ClassKind = 'problems' | 'ideas'

export function classType(courseName: string): ClassKind {
  const subject = /^([A-Za-z]+) \d/.exec(courseCode(courseName))?.[1]?.toUpperCase()
  return subject && PROBLEM_SUBJECTS.has(subject) ? 'problems' : 'ideas'
}

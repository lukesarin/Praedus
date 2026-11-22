import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import * as dbModule from './db'
import { claimLegacyData, openUserDatabase, StudyBlocksDB } from './db'

function memoryStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

let n = 0
async function legacyWithData() {
  const name = `legacy-${n++}`
  const legacy = new StudyBlocksDB(name)
  await legacy.feeds.put({ id: 'f1', label: 'Canvas' })
  await legacy.courses.put({ id: 'c1', name: 'CS 210', color: '#8b7cf6' })
  await legacy.items.put({
    id: 'f1|u1', uid: 'u1', feedId: 'f1', kind: 'assignment', title: 'Lab', start: '2026-11-25T23:59:00Z',
    allDay: false, done: true, userEdited: false, removedFromSource: false,
  })
  await legacy.commitments.put({ id: 'k1', title: 'Work', type: 'work' } as never)
  await legacy.settings.put({ key: 'minGap', value: 15 })
  await legacy.studyBlocks.put({ id: 'b1', itemId: 'f1|u1', start: '2026-11-24T10:00:00Z', end: '2026-11-24T11:00:00Z', pinned: false })
  legacy.close()
  return name
}

describe('claimLegacyData', () => {
  it('moves the pre-accounts data into the first account that signs in', async () => {
    const legacy = await legacyWithData()
    const target = new StudyBlocksDB(`acct-a-${n++}`)
    expect(await claimLegacyData(target, 'user-a', legacy, memoryStorage())).toBe('claimed')
    expect(await target.feeds.count()).toBe(1)
    expect(await target.courses.count()).toBe(1)
    expect((await target.items.toArray())[0].done).toBe(true)
    expect(await target.commitments.count()).toBe(1)
    expect(await target.settings.get('minGap')).toEqual({ key: 'minGap', value: 15 })
    expect(await target.studyBlocks.count()).toBe(1)
  })

  it('never gives the same data to a second account on the same browser', async () => {
    const legacy = await legacyWithData()
    const storage = memoryStorage()
    await claimLegacyData(new StudyBlocksDB(`acct-a-${n++}`), 'user-a', legacy, storage)
    const second = new StudyBlocksDB(`acct-b-${n++}`)
    expect(await claimLegacyData(second, 'user-b', legacy, storage)).toBe('taken')
    expect(await second.items.count()).toBe(0)
  })

  it('does nothing, and creates nothing, when there is no old data', async () => {
    const name = `missing-${n++}`
    expect(await claimLegacyData(new StudyBlocksDB(`acct-c-${n++}`), 'user-c', name, memoryStorage())).toBe('none')
    expect(await Dexie.exists(name)).toBe(false)
  })
})

describe('openUserDatabase', () => {
  it('gives each account its own database and points the shared db at it', () => {
    const opened = openUserDatabase('abc')
    expect(opened.name).toBe('praedus-abc')
    expect(dbModule.db).toBe(opened)
  })
})

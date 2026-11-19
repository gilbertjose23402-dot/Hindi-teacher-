import { db, type KV } from '../db'
import { getSettings } from './store'

const SECRET_FIELDS = ['geminiKey', 'groqKey'] as const

export async function exportBackup(includeKeys: boolean): Promise<Blob> {
  const kv = await db.kv.toArray()
  const cleanKv = kv.map((row) => {
    if (row.key !== 'settings' || includeKeys) return row
    const v = { ...(row.value as Record<string, unknown>) }
    for (const f of SECRET_FIELDS) delete v[f]
    return { ...row, value: v }
  })
  const payload = {
    app: 'rani-tutor',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      kv: cleanKv,
      sessions: await db.sessions.toArray(),
      time: await db.time.toArray(),
      cards: await db.cards.toArray(),
    },
  }
  return new Blob([JSON.stringify(payload)], { type: 'application/json' })
}

export async function importBackup(file: File): Promise<void> {
  const payload = JSON.parse(await file.text())
  if (payload?.app !== 'rani-tutor' || !payload.data) throw new Error('This is not a Rani backup file.')
  const current = await getSettings()
  const { kv, sessions, time, cards } = payload.data
  await db.transaction('rw', db.kv, db.sessions, db.time, db.cards, async () => {
    await Promise.all([db.kv.clear(), db.sessions.clear(), db.time.clear(), db.cards.clear()])
    // Keep the API keys already on this phone if the backup doesn't contain them.
    const rows: KV[] = (kv ?? []).map((row: KV) => {
      if (row.key !== 'settings') return row
      const v = { ...(row.value as Record<string, unknown>) }
      for (const f of SECRET_FIELDS) if (!v[f]) v[f] = current[f]
      return { ...row, value: v }
    })
    await db.kv.bulkPut(rows)
    await db.sessions.bulkPut(sessions ?? [])
    await db.time.bulkPut(time ?? [])
    await db.cards.bulkPut(cards ?? [])
  })
}

export async function wipeAll(): Promise<void> {
  await db.delete()
  location.reload()
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

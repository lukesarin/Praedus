import { useEffect, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type DragEvent } from 'react'
import type { NoteInput } from './notes'

const ACCEPT = '.pdf,.txt,image/*'

const fromFile = (f: File): NoteInput => ({ name: f.name, mime: f.type, size: f.size, lastModified: f.lastModified, blob: f })

/** Files or text from a paste; nothing when the paste was meant for a text field. */
export function pastedNotes(e: ClipboardEvent | ReactClipboardEvent): NoteInput[] {
  const target = e.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable="true"]')) return []
  const data = e.clipboardData
  if (!data) return []
  const files = [...data.files]
  if (files.length) return files.map(fromFile)
  const text = data.getData('text/plain').trim()
  if (!text) return []
  const head = text.replace(/\s+/g, ' ').slice(0, 30).trim()
  return [{ name: `Pasted notes: ${head}${text.length > 30 ? '…' : ''}`, mime: 'text/plain', size: text.length, text }]
}

/** A hidden file input and a function that opens it. */
export function useFilePicker(onFiles: (inputs: NoteInput[]) => void) {
  const ref = useRef<HTMLInputElement>(null)
  const input = (
    <input ref={ref} type="file" multiple accept={ACCEPT} hidden
      onChange={(e) => {
        const files = [...(e.target.files ?? [])]
        if (files.length) onFiles(files.map(fromFile))
        e.target.value = ''
      }} />
  )
  return { input, open: () => ref.current?.click() }
}

function PageIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 1.5h5.5L13 5v9.5H4z" />
      <path d="M9.5 1.5V5H13" />
    </svg>
  )
}

type Props = { courseCode: string; summary: string; onFiles: (inputs: NoteInput[]) => void }

/** The class's notes drop area: drag files in, choose them, or paste anywhere on the study map. */
export function NotesDrop({ courseCode, summary, onFiles }: Props) {
  const [over, setOver] = useState(false)
  const depth = useRef(0)
  const picker = useFilePicker(onFiles)

  // Paste works anywhere on the study map, except into a text field.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const inputs = pastedNotes(e)
      if (!inputs.length) return
      e.preventDefault()
      onFiles(inputs)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [onFiles])

  const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes('Files')

  return (
    <section
      className={`notes-drop${over ? ' over' : ''}${summary ? ' has' : ''}`}
      aria-label={`Notes for ${courseCode}`}
      onDragEnter={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        depth.current += 1
        setOver(true)
      }}
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        depth.current = 0
        setOver(false)
        const files = [...e.dataTransfer.files]
        if (files.length) onFiles(files.map(fromFile))
      }}
    >
      <PageIcon />
      <div>
        <b>Drop notes for {courseCode}</b>
        <span>Slides, study guides, photos of notes. Or paste with ⌘V. They sort into weeks on their own.</span>
        <button type="button" onClick={picker.open}>Choose files</button>
        {summary && <p className="notes-sum">{summary}</p>}
      </div>
      {picker.input}
    </section>
  )
}

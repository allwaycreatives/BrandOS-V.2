'use client'

import { useEffect, useRef, useState } from 'react'

const MAX_ROWS = 30
const MAX_COLS = 12
const MAX_BYTES = 45000 // the database keeps up to 50,000 characters for a table

export const DEFAULT_TABLE = JSON.stringify({ rows: [['', '', ''], ['', '', ''], ['', '', '']] })

export function parseTable(content: string): string[][] {
  try {
    const data = JSON.parse(content)
    const raw: unknown[] = Array.isArray(data?.rows) ? data.rows : []
    const rows = raw.slice(0, MAX_ROWS).map((r) => (Array.isArray(r) ? r.slice(0, MAX_COLS).map((c) => (typeof c === 'string' ? c : '')) : []))
    const cols = Math.max(1, ...rows.map((r) => r.length))
    if (rows.length === 0) return JSON.parse(DEFAULT_TABLE).rows
    return rows.map((r) => [...r, ...Array(cols - r.length).fill('')])
  } catch {
    return JSON.parse(DEFAULT_TABLE).rows
  }
}

export const serializeTable = (rows: string[][]) => JSON.stringify({ rows })

const bare: React.CSSProperties = { border: 'none', background: 'transparent', outline: 'none', boxShadow: 'none', padding: '6px 8px', margin: 0, minHeight: 0, borderRadius: 0, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 12.5, color: 'inherit' }
const link: React.CSSProperties = { border: 'none', background: 'transparent', padding: 0, minHeight: 0, fontSize: 11, color: '#8a8a8a', cursor: 'pointer' }

// A small spreadsheet-style table. The top row is the header. Tab / arrows move between cells, Enter goes down a row.
export default function TableCard({ content, readOnly, selected, onChange }: { content: string; readOnly: boolean; selected: boolean; onChange: (text: string) => void }) {
  const [rows, setRows] = useState<string[][]>(() => parseTable(content))
  const [active, setActive] = useState(false)
  const cells = useRef(new Map<string, HTMLInputElement>())
  const pendingFocus = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dirty = useRef(false)
  const latest = useRef(rows)
  const send = useRef(onChange)
  send.current = onChange

  useEffect(() => {
    if (pendingFocus.current) {
      cells.current.get(pendingFocus.current)?.focus()
      pendingFocus.current = null
    }
  })

  useEffect(() => () => {
    clearTimeout(timer.current)
    if (dirty.current) send.current(serializeTable(latest.current))
  }, [])

  function commit(next: string[][]) {
    if (serializeTable(next).length > MAX_BYTES) return // the table is full; ignore more
    setRows(next)
    latest.current = next
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      dirty.current = false
      send.current(serializeTable(next))
    }, 500)
  }

  const cols = rows[0]?.length ?? 1
  const setCell = (r: number, c: number, v: string) => commit(rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v.slice(0, 200) : x)) : row)))
  const addRow = () => rows.length < MAX_ROWS && commit([...rows, Array(cols).fill('')])
  const addCol = () => cols < MAX_COLS && commit(rows.map((r) => [...r, '']))
  const delRow = () => rows.length > 1 && commit(rows.slice(0, -1))
  const delCol = () => cols > 1 && commit(rows.map((r) => r.slice(0, -1)))
  const go = (r: number, c: number) => cells.current.get(`${r}-${c}`)?.focus()

  const canEdit = !readOnly && (selected || active)
  return (
    <div onFocus={() => setActive(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActive(false) }} style={{ color: '#1a1a1a' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} style={{ border: '1px solid #e2e2e2', padding: 0, background: r === 0 ? '#f4f4f4' : '#fff', verticalAlign: 'top' }}>
                  <input
                    ref={(el) => { if (el) cells.current.set(`${r}-${c}`, el); else cells.current.delete(`${r}-${c}`) }}
                    value={cell}
                    readOnly={readOnly}
                    aria-label={`Row ${r + 1}, column ${c + 1}`}
                    onChange={(e) => setCell(r, c, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (r === rows.length - 1 && !readOnly) {
                          addRow()
                          pendingFocus.current = `${r + 1}-${c}`
                        } else go(Math.min(rows.length - 1, r + 1), c)
                      } else if (e.key === 'ArrowDown' && r < rows.length - 1) {
                        e.preventDefault()
                        go(r + 1, c)
                      } else if (e.key === 'ArrowUp' && r > 0) {
                        e.preventDefault()
                        go(r - 1, c)
                      }
                    }}
                    style={{ ...bare, fontWeight: r === 0 ? 700 : 400 }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit && (
        <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={addRow} style={link}>+ Row</button>
          <button type="button" onClick={addCol} style={link}>+ Column</button>
          {rows.length > 1 && <button type="button" onClick={delRow} style={link}>− Row</button>}
          {cols > 1 && <button type="button" onClick={delCol} style={link}>− Column</button>}
        </div>
      )}
    </div>
  )
}

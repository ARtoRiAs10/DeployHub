'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import {
  ArrowLeft, Plus, Trash2, Eye, EyeOff, Save, RefreshCw,
  ShieldCheck, AlertTriangle, KeyRound, Info
} from 'lucide-react'

interface EnvRow {
  key: string
  value: string
  isNew?: boolean
  isDirty?: boolean
}

export default function EnvVarsPage() {
  const { id } = useParams<{ id: string }>()
  const { getToken } = useAuth()

  const [project, setProject]   = useState<any>(null)
  const [rows, setRows]         = useState<EnvRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [error, setError]       = useState('')
  const [saved, setSaved]       = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const t = await getToken(); if (!t) return
      const [p, envData] = await Promise.all([
        api.getProject(id, t),
        api.getProjectEnv(id, t, false),
      ])
      setProject(p)
      const existing: EnvRow[] = Object.entries(envData.envVars || {}).map(([key, value]) => ({
        key, value: value as string, isNew: false, isDirty: false,
      }))
      setRows(existing)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [id, getToken])

  useEffect(() => { loadData() }, [loadData])

  async function revealValues() {
    if (revealed) { setRevealed(false); await loadData(); return }
    try {
      const t = await getToken(); if (!t) return
      const envData = await api.getProjectEnv(id, t, true)
      const r: EnvRow[] = Object.entries(envData.envVars || {}).map(([key, value]) => ({
        key, value: value as string, isNew: false, isDirty: false,
      }))
      setRows(r)
      setRevealed(true)
    } catch (e: any) { setError(e.message) }
  }

  function addRow() {
    setRows(prev => [...prev, { key: '', value: '', isNew: true, isDirty: true }])
  }

  function updateRow(idx: number, field: 'key' | 'value', val: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val, isDirty: true } : r))
  }

  function removeRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  async function saveEnvVars() {
    setError('')
    // Validate
    const emptyKeys = rows.filter(r => r.key.trim() === '')
    if (emptyKeys.length > 0) { setError('All keys must be non-empty'); return }
    const dupKeys = rows.map(r => r.key).filter((k, i, a) => a.indexOf(k) !== i)
    if (dupKeys.length > 0) { setError(`Duplicate keys: ${dupKeys.join(', ')}`); return }

    setSaving(true)
    try {
      const t = await getToken(); if (!t) return
      const envVars = Object.fromEntries(rows.map(r => [r.key.trim(), r.value]))
      await api.setProjectEnv(id, envVars, t)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
      setRevealed(false)
      await loadData()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const inp = 'w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono focus:border-blue-500/50 transition-colors'
  const ist = { background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' } as React.CSSProperties

  if (loading) return <div className="p-8 text-sm" style={{ color: 'var(--text3)' }}>Loading...</div>

  return (
    <div className="p-8 fade-in max-w-3xl">
      {/* Header */}
      <Link href={`/dashboard/projects/${id}`} className="flex items-center gap-2 text-sm mb-6 transition-colors hover:text-white" style={{ color: 'var(--text3)' }}>
        <ArrowLeft className="w-4 h-4" /> Back to {project?.name || 'Project'}
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(79,142,255,0.15)' }}>
            <KeyRound className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Environment Variables</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text3)' }}>{project?.name} · {rows.length} variable{rows.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={loadData} className="px-3 py-2 rounded-lg text-sm border transition-colors" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border px-4 py-3 mb-6 flex items-start gap-3" style={{ background: 'rgba(79,142,255,0.06)', borderColor: 'rgba(79,142,255,0.2)' }}>
        <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
        <p className="text-sm" style={{ color: 'var(--text2)' }}>
          These variables are injected into your backend container at deploy time via <code className="font-mono text-xs px-1 py-0.5 rounded" style={{ background: 'var(--surface2)' }}>docker run -e</code>.
          They are stored encrypted. Re-deploy your project after making changes for them to take effect.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={revealValues}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
          >
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {revealed ? 'Hide values' : 'Reveal values'}
          </button>
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Add variable
          </button>
        </div>
        {rows.length > 0 && (
          <button
            onClick={saveEnvVars}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: saved ? 'rgba(52,211,153,0.15)' : 'var(--accent)', color: saved ? '#34d399' : '#fff', borderColor: saved ? '#34d399' : 'transparent' }}
          >
            {saved
              ? <><ShieldCheck className="w-3.5 h-3.5" /> Saved!</>
              : <><Save className="w-3.5 h-3.5" />{saving ? 'Saving...' : 'Save changes'}</>}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border px-4 py-3 mb-4 flex items-center gap-2 text-sm" style={{ background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}>
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Env var rows */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        {rows.length === 0 ? (
          <div className="py-16 text-center">
            <KeyRound className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium mb-1">No environment variables</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text3)' }}>Add variables like DATABASE_URL, API_KEY, SECRET, etc.</p>
            <button onClick={addRow} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border mx-auto transition-colors" style={{ borderColor: 'var(--border2)', color: 'var(--text2)' }}>
              <Plus className="w-3.5 h-3.5" /> Add your first variable
            </button>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_1fr_auto] gap-0 px-4 py-2 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text3)' }}>
              <span className="text-xs font-medium">KEY</span>
              <span className="text-xs font-medium">VALUE</span>
              <span className="text-xs font-medium w-8" />
            </div>
            {/* Rows */}
            {rows.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_1fr_auto] gap-0 border-b last:border-b-0 p-2 items-center"
                style={{
                  background: row.isDirty ? 'rgba(79,142,255,0.04)' : 'var(--surface)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="pr-2">
                  <input
                    className={inp}
                    style={{ ...ist, borderColor: row.isDirty ? 'rgba(79,142,255,0.4)' : 'var(--border)' }}
                    placeholder="VARIABLE_NAME"
                    value={row.key}
                    onChange={e => updateRow(idx, 'key', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                    spellCheck={false}
                  />
                </div>
                <div className="pr-2">
                  <input
                    className={inp}
                    style={ist}
                    type={revealed ? 'text' : 'password'}
                    placeholder={revealed ? 'value' : '••••••••'}
                    value={row.value}
                    onChange={e => updateRow(idx, 'value', e.target.value)}
                    spellCheck={false}
                  />
                </div>
                <button
                  onClick={() => removeRow(idx)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/10"
                  style={{ color: 'var(--text3)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Bottom save button (for long lists) */}
      {rows.length > 3 && (
        <div className="flex justify-end mt-4">
          <button
            onClick={saveEnvVars}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: saved ? 'rgba(52,211,153,0.15)' : 'var(--accent)', color: saved ? '#34d399' : '#fff' }}
          >
            {saved
              ? <><ShieldCheck className="w-3.5 h-3.5" /> Saved!</>
              : <><Save className="w-3.5 h-3.5" />{saving ? 'Saving...' : 'Save all changes'}</>}
          </button>
        </div>
      )}

      {/* Security note */}
      <div className="mt-6 flex items-center gap-2 text-xs" style={{ color: 'var(--text3)' }}>
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>Values are stored encrypted in the database and injected securely at deploy time. They are never exposed in build logs.</span>
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { api } from '@/lib/api'
import { formatDate, FRAMEWORK_LABELS, FRAMEWORK_ICONS, STATUS_COLORS } from '@/lib/utils'
import { Plus, FolderGit2, GitBranch, Trash2, Search, FolderOpen, Server, HardDrive } from 'lucide-react'

const ALL_FW = Object.entries(FRAMEWORK_LABELS)

function Modal({ onClose, onCreated }: { onClose:()=>void; onCreated:()=>void }) {
  const { getToken } = useAuth()
  const [form, setForm] = useState({
    name: '', repoUrl: '', framework: '', buildCommand: '',
    outputDir: '', nodeVersion: '20', projectSubDir: '',
    isBackend: false,
  })
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function create() {
    setErr('')
    if (!form.name.trim()) { setErr('Name required'); return }
    setBusy(true)
    try {
      const t = await getToken(); if (!t) return
      await api.createProject(form, t)
      onCreated(); onClose()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  const inp = 'w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-1'
  const ist = { background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)'}}>
      <div className="w-full max-w-lg rounded-2xl border p-6 slide-in" style={{background:'var(--surface)',borderColor:'var(--border2)'}}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">New Project</h2>
          <button onClick={onClose} className="text-2xl leading-none" style={{color:'var(--text3)'}}>×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs mb-1.5" style={{color:'var(--text2)'}}>Name *</label>
            <input className={inp} style={ist} placeholder="my-app" value={form.name} onChange={e=>set('name',e.target.value)}/>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{color:'var(--text2)'}}>GitHub Repo URL</label>
            <input className={inp} style={ist} placeholder="https://github.com/user/repo" value={form.repoUrl} onChange={e=>set('repoUrl',e.target.value)}/>
          </div>
          <div>
            <label className="block text-xs mb-1.5 flex items-center gap-2" style={{color:'var(--text2)'}}>
              Project Subdirectory
              <span className="px-1.5 py-0.5 rounded text-xs" style={{background:'rgba(79,142,255,0.15)',color:'var(--accent)'}}>monorepo fix</span>
            </label>
            <input className={inp} style={ist} placeholder="e.g. backend  or  packages/api  (blank = auto-detect)" value={form.projectSubDir} onChange={e=>set('projectSubDir',e.target.value)}/>
            <p className="text-xs mt-1" style={{color:'var(--text3)'}}>If your code is in a subdirectory, specify it here. Auto-detection also handles this.</p>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{color:'var(--text2)'}}>Framework <span style={{color:'var(--text3)'}}>(optional)</span></label>
            <select className={inp} style={ist} value={form.framework} onChange={e=>set('framework',e.target.value)}>
              <option value="">Auto-detect</option>
              {ALL_FW.map(([k,v])=><option key={k} value={k}>{FRAMEWORK_ICONS[k]} {v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{color:'var(--text2)'}}>Build Command</label>
              <input className={inp} style={ist} placeholder="npm run build" value={form.buildCommand} onChange={e=>set('buildCommand',e.target.value)}/>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{color:'var(--text2)'}}>Output Dir</label>
              <input className={inp} style={ist} placeholder="dist" value={form.outputDir} onChange={e=>set('outputDir',e.target.value)}/>
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:'var(--text2)'}}>Node Version</label>
            <select className={inp} style={ist} value={form.nodeVersion} onChange={e=>set('nodeVersion',e.target.value)}>
              {['14','16','18','20','22'].map(v=><option key={v} value={v}>Node {v}</option>)}
            </select>
          </div>

          {/* FIX: Deploy target toggle — lets user explicitly mark a project as backend
              so it routes to EC2 even if auto-detection fails or hasn't run yet. */}
          <div
            className="flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer select-none"
            style={{borderColor: form.isBackend ? 'rgba(251,146,60,0.4)' : 'var(--border)', background: form.isBackend ? 'rgba(251,146,60,0.07)' : 'var(--surface2)'}}
            onClick={() => set('isBackend', !form.isBackend)}
          >
            <div className="flex items-center gap-3">
              {form.isBackend
                ? <Server className="w-4 h-4" style={{color:'#fb923c'}}/>
                : <HardDrive className="w-4 h-4" style={{color:'var(--text3)'}}/>}
              <div>
                <div className="text-sm font-medium">{form.isBackend ? 'Backend → EC2' : 'Frontend → S3'}</div>
                <div className="text-xs mt-0.5" style={{color:'var(--text3)'}}>
                  {form.isBackend
                    ? 'Deploys Docker image to EC2 via ECR. Use for Go, Rust, Node API, Python.'
                    : 'Uploads static build to S3. Use for Vite, Next.js, React, HTML.'}
                </div>
              </div>
            </div>
            <div className={`w-10 h-5 rounded-full transition-colors relative ${form.isBackend ? 'bg-orange-400' : 'bg-gray-600'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isBackend ? 'translate-x-5' : 'translate-x-0.5'}`}/>
            </div>
          </div>

          {err && <p className="text-sm" style={{color:'var(--red)'}}>{err}</p>}
          <button onClick={create} disabled={busy} className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50" style={{background:'var(--accent)',color:'#fff'}}>
            {busy ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const { getToken } = useAuth()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch]     = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try { const t = await getToken(); if (!t) return; setProjects(await api.getProjects(t)) }
    finally { setLoading(false) }
  }

  async function del(id: string, e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm('Delete project?')) return
    const t = await getToken(); if (!t) return
    await api.deleteProject(id, t)
    setProjects(p => p.filter(x => x.id !== id))
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.repoUrl || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8 fade-in">
      {showCreate && <Modal onClose={() => setShowCreate(false)} onCreated={load}/>}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm mt-1" style={{color:'var(--text2)'}}>{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90" style={{background:'var(--accent)',color:'#fff'}}>
          <Plus className="w-4 h-4"/> New Project
        </button>
      </div>

      {projects.length > 0 && (
        <div className="relative mb-6 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--text3)'}}/>
          <input className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border outline-none" style={{background:'var(--surface)',borderColor:'var(--border)',color:'var(--text)'}} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
      )}

      {loading ? <div className="text-sm" style={{color:'var(--text3)'}}>Loading...</div>
      : filtered.length === 0 && projects.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed rounded-2xl" style={{borderColor:'var(--border)'}}>
          <FolderGit2 className="w-12 h-12 mx-auto mb-4" style={{color:'var(--text3)'}}/>
          <h2 className="text-lg font-semibold mb-2">No projects yet</h2>
          <button onClick={() => setShowCreate(true)} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mx-auto transition-all hover:opacity-90" style={{background:'var(--accent)',color:'#fff'}}>
            <Plus className="w-4 h-4"/> New Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => {
            const latest = p.deployments?.[0]
            return (
              <Link href={`/dashboard/projects/${p.id}`} key={p.id}>
                <div className="rounded-xl border p-5 cursor-pointer group transition-all duration-200 hover:border-white/15 hover:-translate-y-0.5" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{background:'var(--surface2)'}}>
                      {FRAMEWORK_ICONS[p.framework] || '📦'}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Deploy target badge */}
                      <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${p.isBackend ? 'text-orange-400 bg-orange-400/10' : 'text-cyan-400 bg-cyan-400/10'}`}>
                        {p.isBackend ? <Server className="w-3 h-3"/> : <HardDrive className="w-3 h-3"/>}
                        {p.isBackend ? 'EC2' : 'S3'}
                      </span>
                      <button onClick={e => del(p.id, e)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded" style={{color:'var(--text3)'}}>
                        <Trash2 className="w-4 h-4"/>
                      </button>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1">{p.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs mb-2" style={{color:'var(--text3)'}}>
                    <GitBranch className="w-3 h-3"/>
                    {FRAMEWORK_LABELS[p.framework || ''] || 'Auto-detect'}
                  </div>
                  {p.projectSubDir && (
                    <div className="text-xs mb-2 px-2 py-1 rounded flex items-center gap-1" style={{background:'var(--surface2)',color:'var(--yellow)'}}>
                      <FolderOpen className="w-3 h-3"/>{p.projectSubDir}
                    </div>
                  )}
                  {p.repoUrl && (
                    <div className="text-xs truncate mb-3 font-mono" style={{color:'var(--text3)'}}>
                      {p.repoUrl.replace('https://github.com/', '')}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{color:'var(--text3)'}}>{formatDate(p.updatedAt)}</span>
                    {latest && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[latest.status]}`}>{latest.status}</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

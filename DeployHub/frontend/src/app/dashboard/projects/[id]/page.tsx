'use client'
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { formatDate, formatDuration, STATUS_COLORS, FRAMEWORK_LABELS, FRAMEWORK_ICONS, DETECTION_METHOD_LABELS, DETECTION_METHOD_COLORS } from '@/lib/utils'
import { ArrowLeft, GitBranch, Upload, Rocket, ExternalLink, RefreshCw, Pencil, Save, X, FolderOpen, Server, HardDrive } from 'lucide-react'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { getToken } = useAuth()
  const [project, setProject]       = useState<any>(null)
  const [deployments, setDeployments] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'github'|'zip'>('github')
  const [ghBranch, setGhBranch]     = useState('main')
  const [deploying, setDeploying]   = useState(false)
  const [zipDeploying, setZipDeploying] = useState(false)
  const [deployError, setDeployError]   = useState('')
  const [editing, setEditing]       = useState(false)
  const [editForm, setEditForm]     = useState<any>({})
  const [saving, setSaving]         = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    try {
      const t = await getToken(); if (!t) return
      const [p, d] = await Promise.all([api.getProject(id, t), api.getDeployments({ projectId: id, limit: 20 }, t)])
      setProject(p); setDeployments(d)
      setEditForm({ name:p.name, repoUrl:p.repoUrl||'', framework:p.framework||'', buildCommand:p.buildCommand||'', outputDir:p.outputDir||'', nodeVersion:p.nodeVersion||'20', projectSubDir:p.projectSubDir||'', isBackend:p.isBackend||false })
    } finally { setLoading(false) }
  }

  async function deployGH() {
    if (!project?.repoUrl) { setDeployError('No repo URL configured'); return }
    setDeployError(''); setDeploying(true)
    try {
      const t = await getToken(); if (!t) return
      await api.deployFromGitHub({ projectId: id, repoUrl: project.repoUrl, branch: ghBranch, projectSubDir: project.projectSubDir }, t)
      await loadData()
    } catch (e:any) { setDeployError(e.message) } finally { setDeploying(false) }
  }

  async function deployZip(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setZipDeploying(true); setDeployError('')
    try {
      const t = await getToken(); if (!t) return
      const fd = new FormData(); fd.append('file', file); fd.append('projectId', id)
      if (project.projectSubDir) fd.append('projectSubDir', project.projectSubDir)
      await api.deployFromZip(fd, t); await loadData()
    } catch (e:any) { setDeployError(e.message) } finally { setZipDeploying(false) }
  }

  async function saveSettings() {
    setSaving(true)
    try { const t = await getToken(); if (!t) return; await api.updateProject(id, editForm, t); await loadData(); setEditing(false) }
    catch (e:any) { setDeployError(e.message) } finally { setSaving(false) }
  }

  const inp = "w-full px-3 py-2 rounded-lg text-sm border outline-none"
  const ist = { background:'var(--surface2)', borderColor:'var(--border)', color:'var(--text)' } as React.CSSProperties

  if (loading) return <div className="p-8 text-sm" style={{color:'var(--text3)'}}>Loading...</div>
  if (!project) return <div className="p-8 text-sm" style={{color:'var(--red)'}}>Project not found</div>

  return (
    <div className="p-8 fade-in">
      <Link href="/dashboard/projects" className="flex items-center gap-2 text-sm mb-6 transition-colors hover:text-white" style={{color:'var(--text3)'}}>
        <ArrowLeft className="w-4 h-4"/> Back to Projects
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{background:'var(--surface)'}}>{FRAMEWORK_ICONS[project.framework]||'📦'}</div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm" style={{color:'var(--text3)'}}>{FRAMEWORK_LABELS[project.framework||'']||'Auto-detect'}</span>
              {project.repoUrl && <a href={project.repoUrl} target="_blank" rel="noreferrer" className="text-sm flex items-center gap-1" style={{color:'var(--accent)'}}><GitBranch className="w-3 h-3"/>{project.repoUrl.replace('https://github.com/','')}</a>}
              {project.projectSubDir && <span className="text-sm flex items-center gap-1" style={{color:'var(--yellow)'}}><FolderOpen className="w-3 h-3"/>{project.projectSubDir}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="px-3 py-2 rounded-lg text-sm border transition-colors" style={{borderColor:'var(--border)',color:'var(--text2)'}}><RefreshCw className="w-3.5 h-3.5"/></button>
          <button onClick={()=>setEditing(!editing)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors" style={{borderColor:'var(--border)',color:'var(--text2)'}}><Pencil className="w-3.5 h-3.5"/> Settings</button>
        </div>
      </div>

      {editing && (
        <div className="rounded-xl border p-5 mb-6 slide-in" style={{background:'var(--surface)',borderColor:'var(--border2)'}}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Edit Project Settings</h3>
            <button onClick={()=>setEditing(false)} style={{color:'var(--text3)'}}><X className="w-4 h-4"/></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs mb-1" style={{color:'var(--text2)'}}>Name</label><input className={inp} style={ist} value={editForm.name} onChange={e=>setEditForm((f:any)=>({...f,name:e.target.value}))}/></div>
            <div><label className="block text-xs mb-1" style={{color:'var(--text2)'}}>Repo URL</label><input className={inp} style={ist} value={editForm.repoUrl} onChange={e=>setEditForm((f:any)=>({...f,repoUrl:e.target.value}))}/></div>
            <div>
              <label className="block text-xs mb-1 flex items-center gap-2" style={{color:'var(--text2)'}}>Project Subdirectory <span className="px-1.5 py-0.5 rounded text-xs" style={{background:'rgba(79,142,255,0.15)',color:'var(--accent)'}}>nested repo fix</span></label>
              <input className={inp} style={ist} placeholder="e.g. backend" value={editForm.projectSubDir} onChange={e=>setEditForm((f:any)=>({...f,projectSubDir:e.target.value}))}/>
            </div>
            <div><label className="block text-xs mb-1" style={{color:'var(--text2)'}}>Framework</label>
              <select className={inp} style={ist} value={editForm.framework} onChange={e=>setEditForm((f:any)=>({...f,framework:e.target.value}))}>
                <option value="">Auto-detect</option>
                {Object.entries(FRAMEWORK_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="block text-xs mb-1" style={{color:'var(--text2)'}}>Build Command</label><input className={inp} style={ist} placeholder="npm run build" value={editForm.buildCommand} onChange={e=>setEditForm((f:any)=>({...f,buildCommand:e.target.value}))}/></div>
            <div><label className="block text-xs mb-1" style={{color:'var(--text2)'}}>Output Dir</label><input className={inp} style={ist} placeholder="dist" value={editForm.outputDir} onChange={e=>setEditForm((f:any)=>({...f,outputDir:e.target.value}))}/></div>
          </div>
          {/* FIX: deploy target toggle in settings so user can override auto-detection */}
          <div
            className="flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer select-none mt-4"
            style={{borderColor: editForm.isBackend ? 'rgba(251,146,60,0.4)' : 'var(--border)', background: editForm.isBackend ? 'rgba(251,146,60,0.07)' : 'var(--surface2)'}}
            onClick={() => setEditForm((f:any) => ({ ...f, isBackend: !f.isBackend }))}
          >
            <div className="flex items-center gap-3">
              {editForm.isBackend
                ? <Server className="w-4 h-4" style={{color:'#fb923c'}}/>
                : <HardDrive className="w-4 h-4" style={{color:'var(--text3)'}}/>}
              <div>
                <div className="text-sm font-medium">{editForm.isBackend ? 'Backend → EC2' : 'Frontend → S3'}</div>
                <div className="text-xs mt-0.5" style={{color:'var(--text3)'}}>
                  {editForm.isBackend
                    ? 'Deploys Docker image to EC2 via ECR (Go, Rust, Node API, Python)'
                    : 'Uploads static build to S3 (Vite, Next.js, React, HTML)'}
                </div>
              </div>
            </div>
            <div className={`w-10 h-5 rounded-full transition-colors relative ${editForm.isBackend ? 'bg-orange-400' : 'bg-gray-600'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editForm.isBackend ? 'translate-x-5' : 'translate-x-0.5'}`}/>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={saveSettings} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50" style={{background:'var(--accent)',color:'#fff'}}><Save className="w-3.5 h-3.5"/>{saving?'Saving...':' Save Changes'}</button>
            <button onClick={()=>setEditing(false)} className="px-4 py-2 rounded-lg text-sm border transition-colors" style={{borderColor:'var(--border)',color:'var(--text2)'}}>Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
            <div className="px-5 py-4 border-b" style={{borderColor:'var(--border)'}}><h3 className="font-semibold text-sm">New Deployment</h3></div>
            <div className="p-5">
              <div className="flex rounded-lg p-1 mb-4" style={{background:'var(--surface2)'}}>
                {(['github','zip'] as const).map(t=>(
                  <button key={t} onClick={()=>setTab(t)} className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all"
                    style={{background:tab===t?'var(--surface)':'transparent',color:tab===t?'var(--text)':'var(--text3)'}}>
                    {t==='github'?'🔗 GitHub':'📦 ZIP'}
                  </button>
                ))}
              </div>
              {tab==='github' ? (
                <div className="space-y-3">
                  <div><label className="block text-xs mb-1" style={{color:'var(--text3)'}}>Repository</label><div className="px-3 py-2 rounded-lg text-xs truncate" style={{background:'var(--surface2)',color:'var(--text3)'}}>{project.repoUrl||'No repo configured'}</div></div>
                  {project.projectSubDir && <div><label className="block text-xs mb-1" style={{color:'var(--text3)'}}>Project path</label><div className="px-3 py-2 rounded-lg text-xs font-mono" style={{background:'var(--surface2)',color:'var(--yellow)'}}>📂 {project.projectSubDir}</div></div>}
                  <div><label className="block text-xs mb-1" style={{color:'var(--text3)'}}>Branch</label><input className={inp} style={ist} value={ghBranch} onChange={e=>setGhBranch(e.target.value)} placeholder="main"/></div>
                  {deployError && <p className="text-xs" style={{color:'var(--red)'}}>{deployError}</p>}
                  <button onClick={deployGH} disabled={deploying||!project.repoUrl} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40" style={{background:'var(--accent)',color:'#fff'}}>
                    <Rocket className="w-4 h-4"/>{deploying?'Deploying...':'Deploy'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="border-2 border-dashed rounded-xl p-6 text-center" style={{borderColor:'var(--border)'}}>
                    <Upload className="w-8 h-8 mx-auto mb-2" style={{color:'var(--text3)'}}/>
                    <p className="text-sm mb-3" style={{color:'var(--text3)'}}>Upload a ZIP file</p>
                    <input ref={fileRef} type="file" accept=".zip" className="hidden" id="zip-input" onChange={deployZip}/>
                    <label htmlFor="zip-input"><span className="px-4 py-2 rounded-lg text-sm border cursor-pointer inline-block transition-colors" style={{borderColor:'var(--border2)',color:'var(--text2)'}}>{zipDeploying?'Deploying...':'Choose ZIP'}</span></label>
                  </div>
                  {deployError && <p className="text-xs" style={{color:'var(--red)'}}>{deployError}</p>}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-xl border" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
            <div className="px-5 py-4 border-b" style={{borderColor:'var(--border)'}}><h3 className="font-semibold text-sm">Settings</h3></div>
            <div className="p-5 space-y-3">
              {[['Framework',FRAMEWORK_LABELS[project.framework||'']||'Auto-detect'],['Build',project.buildCommand||'Auto-detect'],['Output',project.outputDir||'Auto-detect'],['Node',`Node ${project.nodeVersion||'20'}`],['Subdirectory',project.projectSubDir||'Auto-detect']].map(([l,v])=>(
                <div key={l} className="flex justify-between text-xs"><span style={{color:'var(--text3)'}}>{l}</span><span className="font-mono" style={{color:'var(--text2)'}}>{v}</span></div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-2">
          <div className="rounded-xl border" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
            <div className="px-5 py-4 border-b" style={{borderColor:'var(--border)'}}><h3 className="font-semibold text-sm">Deployment History</h3></div>
            {deployments.length===0 ? <div className="p-12 text-center text-sm" style={{color:'var(--text3)'}}>No deployments yet</div>
            : <div className="divide-y" style={{borderColor:'var(--border)'}}>
              {deployments.map(d=>(
                <Link href={`/dashboard/deployments/${d.id}`} key={d.id}>
                  <div className="flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${d.status==='SUCCESS'?'bg-green-400':d.status==='FAILED'?'bg-red-400':d.status==='BUILDING'?'bg-blue-400 pulse-dot':'bg-yellow-400'}`}/>
                      <div>
                        <div className="text-sm font-medium">{d.commitMsg||(d.source==='ZIP'?'📦 ZIP deploy':'🔗 GitHub deploy')}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {d.commitHash&&<span className="text-xs font-mono" style={{color:'var(--text3)'}}>{d.commitHash}</span>}
                          {d.branch&&<span className="text-xs" style={{color:'var(--text3)'}}>on {d.branch}</span>}
                          <span className="text-xs" style={{color:'var(--text3)'}}>{formatDate(d.createdAt)}</span>
                          {d.detectionMethod&&<span className={`text-xs px-1.5 py-0.5 rounded font-medium ${DETECTION_METHOD_COLORS[d.detectionMethod]||''}`}>{DETECTION_METHOD_LABELS[d.detectionMethod]||d.detectionMethod}</span>}
                          <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${d.isBackend?'text-orange-400 bg-orange-400/10':'text-cyan-400 bg-cyan-400/10'}`}>{d.isBackend?<><Server className="w-2.5 h-2.5"/>EC2</>:<><HardDrive className="w-2.5 h-2.5"/>S3</>}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs" style={{color:'var(--text3)'}}>{formatDuration(d.createdAt,d.finishedAt)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>{d.status}</span>
                      {d.previewUrl&&<a href={d.previewUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:'var(--text3)'}}><ExternalLink className="w-3.5 h-3.5"/></a>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>}
          </div>
        </div>
      </div>
    </div>
  )
}

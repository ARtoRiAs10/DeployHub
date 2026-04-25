'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { api } from '@/lib/api'
import { formatDate, formatDuration, STATUS_COLORS, FRAMEWORK_ICONS, DETECTION_METHOD_LABELS, DETECTION_METHOD_COLORS } from '@/lib/utils'
import { FolderGit2, Rocket, CheckCircle, XCircle, Zap, ExternalLink, Plus, Server, HardDrive } from 'lucide-react'

function Stat({ label, value, color, icon }: any) {
  return (
    <div className="rounded-xl p-5 border" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider" style={{color:'var(--text3)'}}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:color+'20',color}}>{icon}</div>
      </div>
      <div className="text-3xl font-bold tracking-tight">{value}</div>
    </div>
  )
}

export default function DashboardPage() {
  const { getToken } = useAuth()
  const [projects, setProjects] = useState<any[]>([])
  const [deployments, setDeployments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken(); if (!token) return
        const [p, d] = await Promise.all([api.getProjects(token), api.getDeployments({ limit:8 }, token)])
        setProjects(p); setDeployments(d)
      } finally { setLoading(false) }
    }
    load()
  }, [getToken])

  const success = deployments.filter(d => d.status === 'SUCCESS').length
  const failed  = deployments.filter(d => d.status === 'FAILED').length
  const active  = deployments.filter(d => ['QUEUED','BUILDING'].includes(d.status)).length

  return (
    <div className="p-8 fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-sm mt-1" style={{color:'var(--text2)'}}>Your deployment dashboard</p>
        </div>
        <Link href="/dashboard/projects">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90" style={{background:'var(--accent)',color:'#fff'}}>
            <Plus className="w-4 h-4"/> New Project
          </button>
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Stat label="Projects"   value={loading?'—':projects.length}  color="var(--accent)"  icon={<FolderGit2 className="w-4 h-4"/>}/>
        <Stat label="Active"     value={loading?'—':active}           color="var(--yellow)"  icon={<Zap className="w-4 h-4"/>}/>
        <Stat label="Successful" value={loading?'—':success}          color="var(--green)"   icon={<CheckCircle className="w-4 h-4"/>}/>
        <Stat label="Failed"     value={loading?'—':failed}           color="var(--red)"     icon={<XCircle className="w-4 h-4"/>}/>
      </div>
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2 rounded-xl border" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{borderColor:'var(--border)'}}>
            <span className="font-semibold text-sm">Recent Projects</span>
            <Link href="/dashboard/projects" className="text-xs" style={{color:'var(--accent)'}}>View all →</Link>
          </div>
          <div className="divide-y" style={{borderColor:'var(--border)'}}>
            {loading ? <div className="p-5 text-sm" style={{color:'var(--text3)'}}>Loading...</div>
            : projects.length === 0 ? <div className="p-8 text-center text-sm" style={{color:'var(--text3)'}}>No projects yet</div>
            : projects.slice(0,6).map(p => (
              <Link href={`/dashboard/projects/${p.id}`} key={p.id}>
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{FRAMEWORK_ICONS[p.framework]||'📦'}</span>
                    <div>
                      <div className="font-medium text-sm">{p.name}</div>
                      {p.projectSubDir && <div className="text-xs font-mono" style={{color:'var(--yellow)'}}>📂 {p.projectSubDir}</div>}
                    </div>
                  </div>
                  {p.deployments?.[0] && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.deployments[0].status]}`}>{p.deployments[0].status}</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="col-span-3 rounded-xl border" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{borderColor:'var(--border)'}}>
            <span className="font-semibold text-sm">Recent Deployments</span>
            <Link href="/dashboard/deployments" className="text-xs" style={{color:'var(--accent)'}}>View all →</Link>
          </div>
          <div className="divide-y" style={{borderColor:'var(--border)'}}>
            {loading ? <div className="p-5 text-sm" style={{color:'var(--text3)'}}>Loading...</div>
            : deployments.length === 0 ? <div className="p-8 text-center text-sm" style={{color:'var(--text3)'}}>No deployments yet</div>
            : deployments.map(d => (
              <Link href={`/dashboard/deployments/${d.id}`} key={d.id}>
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${d.status==='SUCCESS'?'bg-green-400':d.status==='FAILED'?'bg-red-400':d.status==='BUILDING'?'bg-blue-400 pulse-dot':'bg-yellow-400'}`}/>
                    <div>
                      <div className="font-medium text-sm">{d.project?.name}</div>
                      <div className="text-xs mt-0.5" style={{color:'var(--text3)'}}>{d.commitMsg?d.commitMsg.slice(0,40):(d.source==='ZIP'?'📦 ZIP':'🔗 GitHub')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {d.detectionMethod && <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium hidden lg:inline ${DETECTION_METHOD_COLORS[d.detectionMethod]||''}`}>{DETECTION_METHOD_LABELS[d.detectionMethod]||d.detectionMethod}</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${d.isBackend?'text-orange-400 bg-orange-400/10':'text-cyan-400 bg-cyan-400/10'}`}>
                      {d.isBackend?<><Server className="w-3 h-3"/>EC2</>:<><HardDrive className="w-3 h-3"/>S3</>}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>{d.status}</span>
                    {d.previewUrl&&d.status==='SUCCESS'&&<a href={d.previewUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:'var(--text3)'}}><ExternalLink className="w-3.5 h-3.5"/></a>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

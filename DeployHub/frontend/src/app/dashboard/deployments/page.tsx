'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { api } from '@/lib/api'
import { formatDate, formatDuration, STATUS_COLORS, FRAMEWORK_ICONS, DETECTION_METHOD_LABELS, DETECTION_METHOD_COLORS } from '@/lib/utils'
import { Rocket, ExternalLink, RefreshCw, Server, HardDrive, Search } from 'lucide-react'

export default function DeploymentsPage() {
  const { getToken } = useAuth()
  const [deployments, setDeployments] = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<'ALL'|'SUCCESS'|'FAILED'|'BUILDING'>('ALL')
  const [search, setSearch]           = useState('')

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    try { const t = await getToken(); if (!t) return; setDeployments(await api.getDeployments({ limit:50 }, t)) }
    finally { setLoading(false) }
  }

  const filtered = deployments.filter(d => {
    const mf = filter==='ALL' || d.status===filter
    const ms = !search || (d.project?.name||'').toLowerCase().includes(search.toLowerCase()) || (d.commitMsg||'').toLowerCase().includes(search.toLowerCase())
    return mf && ms
  })

  return (
    <div className="p-8 fade-in">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold tracking-tight">Deployments</h1><p className="text-sm mt-1" style={{color:'var(--text2)'}}>All deployments across all projects</p></div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors" style={{borderColor:'var(--border)',color:'var(--text2)'}}><RefreshCw className="w-4 h-4"/> Refresh</button>
      </div>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex rounded-lg p-1 border" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
          {(['ALL','SUCCESS','FAILED','BUILDING'] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{background:filter===f?'var(--surface2)':'transparent',color:filter===f?'var(--text)':'var(--text3)'}}>
              {f}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{color:'var(--text3)'}}/>
          <input className="pl-8 pr-3 py-2 rounded-lg text-sm border outline-none" style={{background:'var(--surface)',borderColor:'var(--border)',color:'var(--text)'}} placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <span className="text-xs ml-auto" style={{color:'var(--text3)'}}>{filtered.length} result{filtered.length!==1?'s':''}</span>
      </div>
      {loading ? <div className="text-sm" style={{color:'var(--text3)'}}>Loading...</div>
      : filtered.length===0 ? (
        <div className="text-center py-24 border-2 border-dashed rounded-2xl" style={{borderColor:'var(--border)'}}>
          <Rocket className="w-12 h-12 mx-auto mb-4" style={{color:'var(--text3)'}}/><p className="text-sm" style={{color:'var(--text3)'}}>No deployments found</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
          <div className="divide-y" style={{borderColor:'var(--border)'}}>
            {filtered.map(d=>(
              <Link href={`/dashboard/deployments/${d.id}`} key={d.id}>
                <div className="flex items-center justify-between px-6 py-4 hover:bg-white/3 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${d.status==='SUCCESS'?'bg-green-400':d.status==='FAILED'?'bg-red-400':d.status==='BUILDING'?'bg-blue-400 pulse-dot':'bg-yellow-400'}`}/>
                    <div className="w-8 text-lg">{FRAMEWORK_ICONS[d.framework]||'📦'}</div>
                    <div>
                      <div className="font-medium text-sm">{d.project?.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {d.commitHash&&<span className="text-xs font-mono" style={{color:'var(--text3)'}}>{d.commitHash}</span>}
                        <span className="text-xs" style={{color:'var(--text3)'}}>{d.commitMsg?d.commitMsg.slice(0,45):(d.source==='ZIP'?'📦 ZIP':'🔗 GitHub')}</span>
                        {d.detectionMethod&&<span className={`text-xs px-1.5 py-0.5 rounded font-medium ${DETECTION_METHOD_COLORS[d.detectionMethod]||''}`}>{DETECTION_METHOD_LABELS[d.detectionMethod]||d.detectionMethod}</span>}
                        <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${d.isBackend?'text-orange-400 bg-orange-400/10':'text-cyan-400 bg-cyan-400/10'}`}>{d.isBackend?<><Server className="w-2.5 h-2.5"/>EC2</>:<><HardDrive className="w-2.5 h-2.5"/>S3</>}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xs" style={{color:'var(--text3)'}}>{formatDuration(d.createdAt,d.finishedAt)}</span>
                    <span className="text-xs" style={{color:'var(--text3)'}}>{formatDate(d.createdAt)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>{d.status}</span>
                    {d.previewUrl&&d.status==='SUCCESS'&&<a href={d.previewUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:'var(--text3)'}}><ExternalLink className="w-3.5 h-3.5"/></a>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

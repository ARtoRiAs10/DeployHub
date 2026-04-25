'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { api } from '@/lib/api'
import { formatDate, formatDuration, STATUS_COLORS, FRAMEWORK_ICONS, DETECTION_METHOD_LABELS, DETECTION_METHOD_COLORS } from '@/lib/utils'
import { Activity, Server, HardDrive } from 'lucide-react'
export default function ActivityPage() {
  const { getToken } = useAuth()
  const [deployments, setDeployments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(()=>{ async function load() { try { const t=await getToken(); if(!t) return; setDeployments(await api.getDeployments({limit:100},t)) } finally { setLoading(false) } } load() },[getToken])
  const groups: Record<string,any[]> = {}
  deployments.forEach(d=>{ const k=new Date(d.createdAt).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}); if(!groups[k]) groups[k]=[]; groups[k].push(d) })
  return (
    <div className="p-8 fade-in">
      <div className="mb-8"><h1 className="text-2xl font-bold tracking-tight">Activity</h1><p className="text-sm mt-1" style={{color:'var(--text2)'}}>Full deployment timeline</p></div>
      {loading ? <div className="text-sm" style={{color:'var(--text3)'}}>Loading...</div>
      : deployments.length===0 ? <div className="text-center py-24"><Activity className="w-12 h-12 mx-auto mb-4" style={{color:'var(--text3)'}}/><p className="text-sm" style={{color:'var(--text3)'}}>No activity yet</p></div>
      : <div className="space-y-8 max-w-3xl">
        {Object.entries(groups).map(([date,items])=>(
          <div key={date}>
            <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'var(--text3)'}}>{date}</div>
            <div className="space-y-2">
              {items.map(d=>(
                <Link href={`/dashboard/deployments/${d.id}`} key={d.id}>
                  <div className="flex items-center gap-4 p-4 rounded-xl border cursor-pointer hover:border-white/15 transition-all" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${d.status==='SUCCESS'?'bg-green-400':d.status==='FAILED'?'bg-red-400':d.status==='BUILDING'?'bg-blue-400 pulse-dot':'bg-yellow-400'}`}/>
                    <span className="text-lg shrink-0">{FRAMEWORK_ICONS[d.framework]||'📦'}</span>
                    <div className="flex-1 min-w-0"><span className="font-medium text-sm">{d.project?.name}</span><span className="mx-2 text-xs" style={{color:'var(--text3)'}}>—</span><span className="text-sm" style={{color:'var(--text2)'}}>{d.commitMsg?d.commitMsg.slice(0,50):(d.source==='ZIP'?'ZIP deploy':'GitHub deploy')}</span></div>
                    <div className="flex items-center gap-2 shrink-0">
                      {d.detectionMethod&&<span className={`text-xs px-1.5 py-0.5 rounded ${DETECTION_METHOD_COLORS[d.detectionMethod]||''}`}>{DETECTION_METHOD_LABELS[d.detectionMethod]||d.detectionMethod}</span>}
                      <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${d.isBackend?'text-orange-400 bg-orange-400/10':'text-cyan-400 bg-cyan-400/10'}`}>{d.isBackend?<><Server className="w-3 h-3"/>EC2</>:<><HardDrive className="w-3 h-3"/>S3</>}</span>
                      <span className="text-xs" style={{color:'var(--text3)'}}>{formatDuration(d.createdAt,d.finishedAt)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>{d.status}</span>
                      <span className="text-xs" style={{color:'var(--text3)'}}>{formatDate(d.createdAt)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>}
    </div>
  )
}

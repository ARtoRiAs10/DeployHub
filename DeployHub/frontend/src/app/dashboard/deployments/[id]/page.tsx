'use client'
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { formatDate, formatDuration, STATUS_COLORS, FRAMEWORK_LABELS, FRAMEWORK_ICONS, DETECTION_METHOD_LABELS, DETECTION_METHOD_COLORS } from '@/lib/utils'
import { ArrowLeft, ExternalLink, RefreshCw, Terminal, Globe, GitCommit, Clock, Zap, Server, HardDrive, RotateCcw } from 'lucide-react'

export default function DeploymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { getToken } = useAuth()
  const [deployment, setDeployment] = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [redeploying, setRedeploying] = useState(false)
  const logRef    = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<NodeJS.Timeout|null>(null)

  useEffect(() => { loadDeployment(); return ()=>{ if(pollingRef.current) clearInterval(pollingRef.current) } }, [id])

  async function loadDeployment() {
    const t = await getToken(); if (!t) return
    try {
      const d = await api.getDeployment(id, t); setDeployment(d)
      // Start polling immediately if deployment is active.
      // Use 1500ms so build log updates appear quickly in the terminal.
      if (['QUEUED','BUILDING'].includes(d.status)) {
        startPolling()
      } else {
        // Deployment already finished — stop any lingering poll
        stopPolling()
      }
    } finally { setLoading(false) }
  }

  function startPolling() {
    if (pollingRef.current) return  // already polling
    pollingRef.current = setInterval(async () => {
      try {
        const t2 = await getToken(); if (!t2) return
        const updated = await api.getDeployment(id, t2)
        setDeployment(updated)
        if (!['QUEUED','BUILDING'].includes(updated.status)) {
          stopPolling()
        }
      } catch {
        // network blip — keep polling, don't crash
      }
    }, 1500)
  }

  function stopPolling() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
  }

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [deployment?.buildLog])

  async function redeploy() {
    setRedeploying(true)
    try { const t = await getToken(); if (!t) return; await api.redeployFromDeployment(id, t); await loadDeployment() }
    catch {} finally { setRedeploying(false) }
  }

  if (loading) return <div className="p-8 text-sm" style={{color:'var(--text3)'}}>Loading...</div>
  if (!deployment) return <div className="p-8 text-sm" style={{color:'var(--red)'}}>Deployment not found</div>

  const isActive  = ['QUEUED','BUILDING'].includes(deployment.status)
  const isSuccess = deployment.status==='SUCCESS'
  const isFailed  = deployment.status==='FAILED'
  const isEC2     = deployment.isBackend

  return (
    <div className="p-8 fade-in">
      <Link href={`/dashboard/projects/${deployment.projectId}`} className="flex items-center gap-2 text-sm mb-6 transition-colors hover:text-white" style={{color:'var(--text3)'}}>
        <ArrowLeft className="w-4 h-4"/> Back to {deployment.project?.name}
      </Link>
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight">Deployment</h1>
            <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[deployment.status]}`}>
              {deployment.status}{isActive&&<span className="w-1.5 h-1.5 rounded-full bg-blue-400 pulse-dot"/>}
            </span>
            {isActive&&<button onClick={loadDeployment} className="flex items-center gap-1 text-xs px-2 py-1 rounded border" style={{borderColor:'var(--border)',color:'var(--text3)'}}><RefreshCw className="w-3 h-3 animate-spin"/> Live</button>}
          </div>
          <div className="flex items-center gap-3 text-sm" style={{color:'var(--text3)'}}>
            <span className="font-mono">{id.slice(0,14)}...</span>
            {deployment.detectionMethod&&<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DETECTION_METHOD_COLORS[deployment.detectionMethod]||''}`}>{DETECTION_METHOD_LABELS[deployment.detectionMethod]||deployment.detectionMethod}</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${isEC2?'text-orange-400 bg-orange-400/10':'text-cyan-400 bg-cyan-400/10'}`}>{isEC2?<><Server className="w-3 h-3"/>EC2</>:<><HardDrive className="w-3 h-3"/>S3</>}</span>
            {deployment.projectSubDir&&<span className="text-xs flex items-center gap-1" style={{color:'var(--yellow)'}}>📂 {deployment.projectSubDir}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {!isActive&&<button onClick={redeploy} disabled={redeploying} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors disabled:opacity-50" style={{borderColor:'var(--border)',color:'var(--text2)'}}><RotateCcw className="w-3.5 h-3.5"/>{redeploying?'...':'Redeploy'}</button>}
          {isSuccess&&deployment.previewUrl&&<a href={deployment.previewUrl} target="_blank" rel="noreferrer"><button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90" style={{background:'var(--green)',color:'#000'}}><Globe className="w-4 h-4"/>{isEC2?'Open App':'Visit Site'}</button></a>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border p-5 space-y-4" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
            {[
              {icon:<Clock className="w-4 h-4"/>,    label:'Started',   val:formatDate(deployment.createdAt)},
              {icon:<Zap className="w-4 h-4"/>,      label:'Duration',  val:formatDuration(deployment.createdAt,deployment.finishedAt)},
              {icon:<GitCommit className="w-4 h-4"/>,label:'Commit',    val:deployment.commitHash?<span className="font-mono text-xs">{deployment.commitHash}</span>:'—'},
              {icon:<GitCommit className="w-4 h-4"/>,label:'Branch',    val:deployment.branch||'—'},
              {icon:<Terminal className="w-4 h-4"/>, label:'Framework', val:<span className="flex items-center gap-1.5">{FRAMEWORK_ICONS[deployment.framework]||''} {FRAMEWORK_LABELS[deployment.framework||'']||'Auto'}</span>},
              {icon:<Terminal className="w-4 h-4"/>, label:'Source',    val:deployment.source},
              {icon:isEC2?<Server className="w-4 h-4"/>:<HardDrive className="w-4 h-4"/>, label:'Target', val:isEC2?'EC2 (dynamic)':'S3 (static)'},
            ].map(({icon,label,val})=>(
              <div key={label} className="flex items-start gap-3">
                <span style={{color:'var(--text3)',marginTop:2}}>{icon}</span>
                <div><div className="text-xs" style={{color:'var(--text3)'}}>{label}</div><div className="text-sm mt-0.5">{val}</div></div>
              </div>
            ))}
          </div>
          {deployment.previewUrl&&<div className="rounded-xl border p-4" style={{background:isSuccess?'rgba(61,220,132,0.05)':'var(--surface)',borderColor:isSuccess?'rgba(61,220,132,0.2)':'var(--border)'}}>
            <div className="text-xs font-medium mb-2" style={{color:isSuccess?'var(--green)':'var(--text3)'}}>{isEC2?'App URL':'Preview URL'}</div>
            <a href={deployment.previewUrl} target="_blank" rel="noreferrer" className="text-xs break-all flex items-start gap-1" style={{color:isSuccess?'var(--green)':'var(--text2)'}}><ExternalLink className="w-3 h-3 mt-0.5 shrink-0"/>{deployment.previewUrl}</a>
          </div>}
          {isFailed&&deployment.errorMsg&&<div className="rounded-xl border p-4" style={{background:'rgba(255,79,79,0.05)',borderColor:'rgba(255,79,79,0.2)'}}>
            <div className="text-xs font-medium mb-2" style={{color:'var(--red)'}}>Error</div>
            <p className="text-xs leading-relaxed" style={{color:'#ff9999'}}>{deployment.errorMsg}</p>
          </div>}
        </div>

        <div className="col-span-2">
          <div className="rounded-xl border overflow-hidden" style={{borderColor:'var(--border)'}}>
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
              <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full" style={{background:'var(--red)'}}/><div className="w-3 h-3 rounded-full" style={{background:'var(--yellow)'}}/><div className="w-3 h-3 rounded-full" style={{background:'var(--green)'}}/></div>
              <span className="text-xs font-medium" style={{color:'var(--text3)'}}>build log{isActive&&<span className="ml-2 text-blue-400 animate-pulse"> — streaming...</span>}</span>
            </div>
            <div ref={logRef} className="log-container relative h-[520px] overflow-y-auto p-5 font-mono text-xs leading-6">
              {deployment.buildLog && deployment.buildLog.trim().length > 0
                ? deployment.buildLog.split('\n').map((line:string,i:number)=>{
                    let c = 'rgba(240,242,245,0.4)'
                    if (line.includes('✓')||line.includes('SUCCESS'))         c='#3ddc84'
                    else if (line.includes('❌')||line.includes('failed')||line.includes('Error')) c='#ff6b6b'
                    else if (line.includes('🔍')||line.includes('🐳'))        c='#4f8eff'
                    else if (line.includes('🔨')||line.includes('📦'))        c='#ffc53d'
                    else if (line.startsWith('Step')||line.startsWith('--->')) c='rgba(240,242,245,0.7)'
                    else if (line.startsWith('FROM')||line.startsWith('RUN')||line.startsWith('COPY')) c='#c678dd'
                    return <div key={i} style={{color:c}}>{line||'\u00a0'}</div>
                  })
                : deployment.status === 'QUEUED'
                  ? <div className="animate-pulse" style={{color:'var(--text3)'}}>⏳ Queued — waiting for worker to pick up job...</div>
                  : deployment.status === 'BUILDING'
                    ? <div className="animate-pulse" style={{color:'var(--text3)'}}>🔨 Build starting — logs will appear shortly...</div>
                    : <div style={{color:'var(--text3)'}}>No log available</div>
              }
              {isActive&&<div className="flex items-center gap-1 mt-1"><span className="inline-block w-2 h-4 animate-pulse" style={{background:'var(--text)'}}/></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
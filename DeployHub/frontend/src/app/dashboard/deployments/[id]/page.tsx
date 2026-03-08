'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatDate, formatDuration, STATUS_COLORS, FRAMEWORK_LABELS } from '@/lib/utils'
import { ArrowLeft, ExternalLink, RefreshCw, Terminal, Globe, GitCommit, Clock } from 'lucide-react'

export default function DeploymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { getToken } = useAuth()
  const [deployment, setDeployment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const logRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadDeployment()
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [id])

  async function loadDeployment() {
    const token = await getToken()
    if (!token) return
    try {
      const d = await api.getDeployment(id, token)
      setDeployment(d)

      // Auto-refresh if still building or queued
      if (['QUEUED', 'BUILDING'].includes(d.status)) {
        if (!pollingRef.current) {
          pollingRef.current = setInterval(async () => {
            const token2 = await getToken()
            if (!token2) return
            const updated = await api.getDeployment(id, token2)
            setDeployment(updated)
            if (!['QUEUED', 'BUILDING'].includes(updated.status)) {
              clearInterval(pollingRef.current!)
              pollingRef.current = null
            }
          }, 3000)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [deployment?.buildLog])

  if (loading) return <div className="p-8 text-white/30">Loading...</div>
  if (!deployment) return <div className="p-8 text-red-400">Deployment not found</div>

  const isActive = ['QUEUED', 'BUILDING'].includes(deployment.status)

  return (
    <div className="p-8">
      <Link href={`/dashboard/projects/${deployment.projectId}`}
        className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to {deployment.project?.name}
      </Link>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deployment</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[deployment.status]}`}>
              {deployment.status}
              {deployment.status === 'BUILDING' && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              )}
            </span>
            <span className="text-sm text-white/40 font-mono">{id.slice(0, 12)}...</span>
          </div>
        </div>
        <div className="flex gap-2">
          {isActive && (
            <Button variant="outline" size="sm" onClick={loadDeployment} className="gap-2 border-white/10">
              <RefreshCw className="w-4 h-4 animate-spin" /> Live
            </Button>
          )}
          {deployment.previewUrl && deployment.status === 'SUCCESS' && (
            <a href={deployment.previewUrl} target="_blank" rel="noreferrer">
              <Button size="sm" className="gap-2">
                <Globe className="w-4 h-4" /> Visit Site
              </Button>
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Meta info */}
        <div className="space-y-4">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-5 space-y-4">
              {[
                {
                  icon: <Clock className="w-4 h-4 text-white/40" />,
                  label: 'Started',
                  value: formatDate(deployment.createdAt),
                },
                {
                  icon: <Clock className="w-4 h-4 text-white/40" />,
                  label: 'Duration',
                  value: formatDuration(deployment.createdAt, deployment.finishedAt),
                },
                {
                  icon: <GitCommit className="w-4 h-4 text-white/40" />,
                  label: 'Commit',
                  value: deployment.commitHash ? (
                    <span className="font-mono text-xs">{deployment.commitHash}</span>
                  ) : '—',
                },
                {
                  icon: <GitCommit className="w-4 h-4 text-white/40" />,
                  label: 'Branch',
                  value: deployment.branch || '—',
                },
                {
                  icon: <Terminal className="w-4 h-4 text-white/40" />,
                  label: 'Framework',
                  value: FRAMEWORK_LABELS[deployment.framework || ''] || 'Auto-detected',
                },
                {
                  icon: <Terminal className="w-4 h-4 text-white/40" />,
                  label: 'Source',
                  value: deployment.source,
                },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  {icon}
                  <div>
                    <div className="text-xs text-white/40">{label}</div>
                    <div className="text-sm mt-0.5">{value}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {deployment.previewUrl && (
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="p-4">
                <div className="text-xs text-green-400 mb-2 font-medium">Preview URL</div>
                <a href={deployment.previewUrl} target="_blank" rel="noreferrer"
                  className="text-xs text-green-300 hover:text-green-100 break-all flex items-start gap-1">
                  <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
                  {deployment.previewUrl}
                </a>
              </CardContent>
            </Card>
          )}

          {deployment.errorMsg && (
            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="p-4">
                <div className="text-xs text-red-400 mb-2 font-medium">Error</div>
                <p className="text-xs text-red-300">{deployment.errorMsg}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Build Log */}
        <div className="col-span-2">
          <Card className="bg-[#0d1117] border-white/10">
            <CardHeader className="border-b border-white/10 py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Build Log
                {isActive && (
                  <span className="text-xs text-blue-400 font-normal">— streaming live...</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div
                ref={logRef}
                className="log-container h-[500px] overflow-y-auto p-4 font-mono text-xs leading-relaxed"
              >
                {deployment.buildLog ? (
                  deployment.buildLog.split('\n').map((line: string, i: number) => (
                    <div key={i} className={
                      line.includes('✓') || line.includes('SUCCESS') ? 'text-green-400' :
                      line.includes('❌') || line.includes('failed') || line.includes('Error') ? 'text-red-400' :
                      line.includes('🔍') || line.includes('🐳') || line.includes('☁️') ? 'text-blue-400' :
                      line.includes('🔨') || line.includes('📦') ? 'text-yellow-400' :
                      'text-white/50'
                    }>
                      {line || '\u00a0'}
                    </div>
                  ))
                ) : isActive ? (
                  <div className="text-white/30 animate-pulse">Waiting for build to start...</div>
                ) : (
                  <div className="text-white/30">No log available</div>
                )}
                {isActive && (
                  <div className="flex items-center gap-1 mt-2">
                    <span className="w-2 h-4 bg-white/60 animate-pulse" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

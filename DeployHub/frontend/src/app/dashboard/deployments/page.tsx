'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'
import { formatDate, formatDuration, STATUS_COLORS, FRAMEWORK_LABELS } from '@/lib/utils'
import { Rocket, ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DeploymentsPage() {
  const { getToken } = useAuth()
  const [deployments, setDeployments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const data = await api.getDeployments({ limit: 50 }, token)
      setDeployments(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deployments</h1>
          <p className="text-white/50 text-sm mt-1">All your deployments across projects</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2 border-white/10">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-white/30">Loading deployments...</div>
      ) : deployments.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-white/10 rounded-2xl">
          <Rocket className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No deployments yet</h2>
          <p className="text-white/40 text-sm">Go to a project and deploy your first build</p>
        </div>
      ) : (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {deployments.map((d) => (
                <Link href={`/dashboard/deployments/${d.id}`} key={d.id}>
                  <div className="flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${
                        d.status === 'SUCCESS' ? 'bg-green-400' :
                        d.status === 'FAILED' ? 'bg-red-400' :
                        d.status === 'BUILDING' ? 'bg-blue-400 animate-pulse' :
                        'bg-yellow-400'
                      }`} />
                      <div>
                        <div className="font-medium text-sm">{d.project?.name}</div>
                        <div className="text-xs text-white/30">
                          {d.commitHash && <span className="font-mono mr-2">{d.commitHash}</span>}
                          {d.commitMsg && <span className="mr-2">{d.commitMsg.slice(0, 50)}</span>}
                          {FRAMEWORK_LABELS[d.framework || ''] || 'Auto'} ·{' '}
                          {d.source === 'ZIP' ? '📦 ZIP' : '🔗 GitHub'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-white/30">{formatDuration(d.createdAt, d.finishedAt)}</span>
                      <span className="text-xs text-white/30">{formatDate(d.createdAt)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>
                        {d.status}
                      </span>
                      {d.previewUrl && d.status === 'SUCCESS' && (
                        <a href={d.previewUrl} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-white/30 hover:text-white transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

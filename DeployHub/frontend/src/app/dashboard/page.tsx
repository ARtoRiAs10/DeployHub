'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatDate, STATUS_COLORS, FRAMEWORK_LABELS } from '@/lib/utils'
import { FolderGit2, Rocket, CheckCircle, XCircle, Clock, Plus, ExternalLink } from 'lucide-react'

export default function DashboardPage() {
  const { getToken } = useAuth()
  const [projects, setProjects] = useState<any[]>([])
  const [recentDeployments, setRecentDeployments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        if (!token) return
        const [p, d] = await Promise.all([
          api.getProjects(token),
          api.getDeployments({ limit: 5 }, token),
        ])
        setProjects(p)
        setRecentDeployments(d)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken])

  const stats = {
    total: projects.length,
    deployments: recentDeployments.length,
    success: recentDeployments.filter((d) => d.status === 'SUCCESS').length,
    failed: recentDeployments.filter((d) => d.status === 'FAILED').length,
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-white/50 text-sm mt-1">Your deployment dashboard</p>
        </div>
        <Link href="/dashboard/projects">
          <Button className="gap-2">
            <Plus className="w-4 h-4" /> New Project
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Projects', value: stats.total, icon: <FolderGit2 className="w-5 h-5 text-blue-400" /> },
          { label: 'Deployments', value: stats.deployments, icon: <Rocket className="w-5 h-5 text-purple-400" /> },
          { label: 'Successful', value: stats.success, icon: <CheckCircle className="w-5 h-5 text-green-400" /> },
          { label: 'Failed', value: stats.failed, icon: <XCircle className="w-5 h-5 text-red-400" /> },
        ].map((s) => (
          <Card key={s.label} className="bg-white/5 border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/50">{s.label}</span>
                {s.icon}
              </div>
              <div className="text-3xl font-bold">{loading ? '—' : s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Projects */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Recent Projects
              <Link href="/dashboard/projects" className="text-xs text-white/40 hover:text-white font-normal">
                View all →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-white/30 text-sm">Loading...</div>
            ) : projects.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-white/30 text-sm mb-3">No projects yet</p>
                <Link href="/dashboard/projects">
                  <Button size="sm" variant="outline">Create your first project</Button>
                </Link>
              </div>
            ) : (
              projects.slice(0, 5).map((p) => {
                const latestDeploy = p.deployments?.[0]
                return (
                  <Link href={`/dashboard/projects/${p.id}`} key={p.id}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                      <div>
                        <div className="font-medium text-sm">{p.name}</div>
                        <div className="text-xs text-white/40">
                          {FRAMEWORK_LABELS[p.framework || ''] || 'Unknown'} · {formatDate(p.updatedAt)}
                        </div>
                      </div>
                      {latestDeploy && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[latestDeploy.status]}`}>
                          {latestDeploy.status}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Deployments */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Recent Deployments
              <Link href="/dashboard/deployments" className="text-xs text-white/40 hover:text-white font-normal">
                View all →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-white/30 text-sm">Loading...</div>
            ) : recentDeployments.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-white/30 text-sm">No deployments yet</p>
              </div>
            ) : (
              recentDeployments.map((d) => (
                <Link href={`/dashboard/deployments/${d.id}`} key={d.id}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium text-sm">{d.project?.name}</div>
                        <div className="text-xs text-white/40">{formatDate(d.createdAt)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>
                        {d.status}
                      </span>
                      {d.previewUrl && (
                        <a href={d.previewUrl} target="_blank" rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-white/30 hover:text-white">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

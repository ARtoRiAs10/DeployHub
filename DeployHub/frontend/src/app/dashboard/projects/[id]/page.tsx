'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { formatDate, formatDuration, STATUS_COLORS, FRAMEWORK_LABELS } from '@/lib/utils'
import { ArrowLeft, GitBranch, Upload, Rocket, ExternalLink, RefreshCw } from 'lucide-react'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { getToken } = useAuth()
  const [project, setProject] = useState<any>(null)
  const [deployments, setDeployments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // GitHub deploy form
  const [ghBranch, setGhBranch] = useState('main')
  const [deploying, setDeploying] = useState(false)
  const [deployError, setDeployError] = useState('')

  // ZIP deploy
  const fileRef = useRef<HTMLInputElement>(null)
  const [zipDeploying, setZipDeploying] = useState(false)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    try {
      const token = await getToken()
      if (!token) return
      const [p, d] = await Promise.all([
        api.getProject(id, token),
        api.getDeployments({ projectId: id, limit: 20 }, token),
      ])
      setProject(p)
      setDeployments(d)
    } finally {
      setLoading(false)
    }
  }

  async function handleGitHubDeploy() {
    if (!project?.repoUrl) { setDeployError('No repo URL configured'); return }
    setDeployError('')
    setDeploying(true)
    try {
      const token = await getToken()
      if (!token) return
      await api.deployFromGitHub({ projectId: id, repoUrl: project.repoUrl, branch: ghBranch }, token)
      await loadData()
    } catch (e: any) {
      setDeployError(e.message)
    } finally {
      setDeploying(false)
    }
  }

  async function handleZipDeploy() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setZipDeploying(true)
    try {
      const token = await getToken()
      if (!token) return
      const fd = new FormData()
      fd.append('file', file)
      fd.append('projectId', id)
      await api.deployFromZip(fd, token)
      await loadData()
    } catch (e: any) {
      setDeployError(e.message)
    } finally {
      setZipDeploying(false)
    }
  }

  if (loading) return <div className="p-8 text-white/30">Loading...</div>
  if (!project) return <div className="p-8 text-red-400">Project not found</div>

  return (
    <div className="p-8">
      <Link href="/dashboard/projects" className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </Link>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-white/40">{FRAMEWORK_LABELS[project.framework || ''] || 'Auto-detect'}</span>
            {project.repoUrl && (
              <a href={project.repoUrl} target="_blank" rel="noreferrer"
                className="text-sm text-blue-400 hover:underline flex items-center gap-1">
                <GitBranch className="w-3 h-3" /> {project.repoUrl.replace('https://github.com/', '')}
              </a>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-2 border-white/10">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Deploy Panel */}
        <div className="col-span-1">
          <Card className="bg-white/5 border-white/10">
            <CardHeader><CardTitle className="text-base">New Deployment</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="github">
                <TabsList className="w-full bg-white/5 mb-4">
                  <TabsTrigger value="github" className="flex-1 text-xs">GitHub</TabsTrigger>
                  <TabsTrigger value="zip" className="flex-1 text-xs">ZIP Upload</TabsTrigger>
                </TabsList>
                <TabsContent value="github" className="space-y-3">
                  <div>
                    <Label className="text-xs text-white/60">Repository</Label>
                    <div className="mt-1 text-sm text-white/40 truncate bg-white/5 rounded px-2 py-1.5">
                      {project.repoUrl || 'No repo configured'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-white/60">Branch</Label>
                    <Input value={ghBranch} onChange={e => setGhBranch(e.target.value)}
                      className="mt-1 bg-white/5 border-white/10 text-sm" placeholder="main" />
                  </div>
                  {deployError && <p className="text-red-400 text-xs">{deployError}</p>}
                  <Button className="w-full gap-2" onClick={handleGitHubDeploy}
                    disabled={deploying || !project.repoUrl}>
                    <Rocket className="w-4 h-4" />
                    {deploying ? 'Deploying...' : 'Deploy'}
                  </Button>
                </TabsContent>
                <TabsContent value="zip" className="space-y-3">
                  <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center">
                    <Upload className="w-8 h-8 text-white/20 mx-auto mb-2" />
                    <p className="text-sm text-white/40 mb-2">Upload a ZIP file</p>
                    <input ref={fileRef} type="file" accept=".zip" className="hidden" id="zip-input"
                      onChange={handleZipDeploy} />
                    <label htmlFor="zip-input">
                      <Button variant="outline" size="sm" className="border-white/10 cursor-pointer" asChild>
                        <span>{zipDeploying ? 'Deploying...' : 'Choose ZIP'}</span>
                      </Button>
                    </label>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Project Settings */}
          <Card className="bg-white/5 border-white/10 mt-4">
            <CardHeader><CardTitle className="text-base text-sm">Settings</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {[
                { label: 'Framework', value: FRAMEWORK_LABELS[project.framework || ''] || 'Auto-detect' },
                { label: 'Build Command', value: project.buildCommand || 'Auto-detect' },
                { label: 'Output Dir', value: project.outputDir || 'Auto-detect' },
                { label: 'Node Version', value: `Node ${project.nodeVersion || '20'}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-white/40">{label}</span>
                  <span className="text-white/70 font-mono">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Deployments list */}
        <div className="col-span-2">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-base">Deployment History</CardTitle>
            </CardHeader>
            <CardContent>
              {deployments.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-sm">
                  No deployments yet. Deploy your first build →
                </div>
              ) : (
                <div className="space-y-2">
                  {deployments.map((d) => (
                    <Link href={`/dashboard/deployments/${d.id}`} key={d.id}>
                      <div className="flex items-center justify-between p-4 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-2 rounded-full ${
                            d.status === 'SUCCESS' ? 'bg-green-400' :
                            d.status === 'FAILED' ? 'bg-red-400' :
                            d.status === 'BUILDING' ? 'bg-blue-400 animate-pulse' :
                            'bg-yellow-400'
                          }`} />
                          <div>
                            <div className="text-sm font-medium">
                              {d.commitMsg || d.source === 'ZIP' ? '📦 ZIP Deploy' : 'GitHub Deploy'}
                            </div>
                            <div className="text-xs text-white/30">
                              {d.commitHash && <span className="font-mono mr-2">{d.commitHash}</span>}
                              {d.branch && <span className="mr-2">on {d.branch}</span>}
                              {formatDate(d.createdAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-white/30">
                            {formatDuration(d.createdAt, d.finishedAt)}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>
                            {d.status}
                          </span>
                          {d.previewUrl && (
                            <a href={d.previewUrl} target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-white/30 hover:text-white">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

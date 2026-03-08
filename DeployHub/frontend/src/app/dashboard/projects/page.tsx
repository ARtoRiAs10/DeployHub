'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { formatDate, FRAMEWORK_LABELS, STATUS_COLORS } from '@/lib/utils'
import { Plus, FolderGit2, GitBranch, Trash2, ExternalLink } from 'lucide-react'

export default function ProjectsPage() {
  const { getToken } = useAuth()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: '', repoUrl: '', framework: '', buildCommand: '', outputDir: '', nodeVersion: '20',
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    try {
      const token = await getToken()
      if (!token) return
      const data = await api.getProjects(token)
      setProjects(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    setError('')
    if (!form.name.trim()) { setError('Project name is required'); return }
    setCreating(true)
    try {
      const token = await getToken()
      if (!token) return
      await api.createProject(form, token)
      setOpen(false)
      setForm({ name: '', repoUrl: '', framework: '', buildCommand: '', outputDir: '', nodeVersion: '20' })
      await loadProjects()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm('Delete this project and all its deployments?')) return
    const token = await getToken()
    if (!token) return
    await api.deleteProject(id, token)
    setProjects(p => p.filter(p => p.id !== id))
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-white/50 text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> New Project</Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0d1117] border-white/10 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Project Name *</Label>
                <Input placeholder="my-awesome-app" className="mt-1 bg-white/5 border-white/10"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>GitHub Repo URL</Label>
                <Input placeholder="https://github.com/user/repo" className="mt-1 bg-white/5 border-white/10"
                  value={form.repoUrl} onChange={e => setForm(f => ({ ...f, repoUrl: e.target.value }))} />
              </div>
              <div>
                <Label>Framework (optional, auto-detected)</Label>
                <Select value={form.framework} onValueChange={v => setForm(f => ({ ...f, framework: v }))}>
                  <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                    <SelectValue placeholder="Auto-detect" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                    {Object.entries(FRAMEWORK_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Build Command</Label>
                  <Input placeholder="npm run build" className="mt-1 bg-white/5 border-white/10"
                    value={form.buildCommand} onChange={e => setForm(f => ({ ...f, buildCommand: e.target.value }))} />
                </div>
                <div>
                  <Label>Output Dir</Label>
                  <Input placeholder="dist" className="mt-1 bg-white/5 border-white/10"
                    value={form.outputDir} onChange={e => setForm(f => ({ ...f, outputDir: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Node Version</Label>
                <Select value={form.nodeVersion} onValueChange={v => setForm(f => ({ ...f, nodeVersion: v }))}>
                  <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                    {['14', '16', '18', '20'].map(v => (
                      <SelectItem key={v} value={v}>Node {v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <Button className="w-full" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-white/30">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-white/10 rounded-2xl">
          <FolderGit2 className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No projects yet</h2>
          <p className="text-white/40 mb-6 text-sm">Create your first project to start deploying</p>
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => {
            const latest = p.deployments?.[0]
            return (
              <Link href={`/dashboard/projects/${p.id}`} key={p.id}>
                <Card className="bg-white/5 border-white/10 hover:bg-white/8 transition-colors cursor-pointer group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                        <FolderGit2 className="w-5 h-5 text-white/60" />
                      </div>
                      <button
                        onClick={(e) => handleDelete(p.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h3 className="font-semibold mb-1">{p.name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-white/40 mb-3">
                      <GitBranch className="w-3 h-3" />
                      <span>{FRAMEWORK_LABELS[p.framework || ''] || 'Auto-detect'}</span>
                    </div>
                    {p.repoUrl && (
                      <div className="text-xs text-white/30 truncate mb-3">{p.repoUrl}</div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/30">{formatDate(p.updatedAt)}</span>
                      {latest && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[latest.status]}`}>
                          {latest.status}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

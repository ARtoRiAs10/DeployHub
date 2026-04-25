'use client'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap, LayoutDashboard, FolderGit2, Rocket, Settings, Activity } from 'lucide-react'
import BackendStatus from '@/components/BackendStatus'

const NAV = [
  { href:'/dashboard',             label:'Overview',    Icon:LayoutDashboard },
  { href:'/dashboard/projects',    label:'Projects',    Icon:FolderGit2 },
  { href:'/dashboard/deployments', label:'Deployments', Icon:Rocket },
  { href:'/dashboard/activity',    label:'Activity',    Icon:Activity },
  { href:'/dashboard/settings',    label:'Settings',    Icon:Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen text-white flex" style={{background:'var(--bg)'}}>
      <aside className="w-60 shrink-0 flex flex-col border-r" style={{borderColor:'var(--border)',background:'var(--surface)'}}>

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 px-5 h-16 border-b shrink-0" style={{borderColor:'var(--border)'}}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:'var(--accent)'}}>
            <Zap className="w-4 h-4 text-white"/>
          </div>
          <span className="font-bold text-base tracking-tight">DeployHub</span>
        </Link>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href} href={href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all"
                style={{
                  color: active ? 'var(--text)' : 'var(--text2)',
                  background: active ? 'var(--surface2)' : 'transparent',
                  fontWeight: active ? 500 : 400,
                }}
              >
                <Icon className="w-4 h-4 shrink-0"/>
                {label}
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{background:'var(--accent)'}}/>}
              </Link>
            )
          })}
        </nav>

        {/* Account */}
        <div className="px-5 py-4 border-t flex items-center gap-3" style={{borderColor:'var(--border)'}}>
          <UserButton afterSignOutUrl="/"/>
          <span className="text-sm" style={{color:'var(--text2)'}}>Account</span>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Backend connection status banner — shows in sidebar area above main content */}
        <BackendStatus />
        <main className="flex-1 overflow-auto grid-bg">{children}</main>
      </div>
    </div>
  )
}

import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { Zap, LayoutDashboard, FolderGit2, Rocket } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 flex flex-col p-4 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 mb-8 px-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-black" />
          </div>
          <span className="text-xl font-bold">DeployHub</span>
        </Link>

        <nav className="flex-1 space-y-1">
          {[
            { href: '/dashboard', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
            { href: '/dashboard/projects', label: 'Projects', icon: <FolderGit2 className="w-4 h-4" /> },
            { href: '/dashboard/deployments', label: 'Deployments', icon: <Rocket className="w-4 h-4" /> },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 pt-4 flex items-center gap-3 px-2">
          <UserButton afterSignOutUrl="/" />
          <span className="text-sm text-white/60">Account</span>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

import Link from 'next/link'
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { Zap, GitBranch, Globe, Terminal, ArrowRight } from 'lucide-react'
export default function HomePage() {
  return (
    <div className="min-h-screen text-white" style={{background:'var(--bg)'}}>
      <nav className="border-b px-6 py-4" style={{borderColor:'var(--border)'}}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:'var(--accent)'}}><Zap className="w-4 h-4 text-white"/></div>
            <span className="text-xl font-bold">DeployHub</span>
          </div>
          <div className="flex items-center gap-4">
            <SignedOut>
              <Link href="/sign-in" className="text-sm transition-colors" style={{color:'var(--text2)'}}>Sign in</Link>
              <Link href="/sign-up" className="text-sm px-4 py-2 rounded-lg font-medium text-black" style={{background:'white'}}>Get Started</Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="text-sm px-4 py-2 rounded-lg font-medium text-black" style={{background:'white'}}>Dashboard</Link>
              <UserButton afterSignOutUrl="/"/>
            </SignedIn>
          </div>
        </div>
      </nav>
      <section className="max-w-4xl mx-auto px-6 py-32 text-center">
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm mb-8 border" style={{background:'rgba(79,142,255,0.08)',borderColor:'rgba(79,142,255,0.2)',color:'var(--accent)'}}>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{background:'var(--green)'}}/>
          Three-layer auto-detection now live
        </div>
        <h1 className="text-6xl font-bold mb-6 leading-tight" style={{background:'linear-gradient(to bottom, #f0f2f5, rgba(240,242,245,0.4))',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
          Deploy anything.<br/>Instantly.
        </h1>
        <p className="text-xl mb-12 max-w-2xl mx-auto" style={{color:'var(--text2)'}}>
          Push your GitHub repo or upload a ZIP. DeployHub auto-detects your framework,
          builds it in Docker, and deploys to EC2 or S3 — in seconds.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/sign-up" className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:opacity-90" style={{background:'var(--accent)',color:'#fff'}}>
            Start deploying <ArrowRight className="w-4 h-4"/>
          </Link>
          <Link href="/dashboard" className="px-6 py-3 rounded-xl font-semibold border transition-all" style={{borderColor:'var(--border2)',color:'var(--text2)'}}>
            View Dashboard
          </Link>
        </div>
      </section>
      <section className="max-w-5xl mx-auto px-6 pb-24 grid grid-cols-3 gap-6">
        {[
          {icon:<GitBranch className="w-5 h-5"/>, title:'GitHub + ZIP', desc:'Connect any public repo or upload a ZIP file. Supports monorepos with nested project detection.'},
          {icon:<Terminal className="w-5 h-5"/>, title:'Smart Detection', desc:'3-layer pipeline: user config → curated list → AI fallback. Handles Go, Python, Node, Rust, PHP and more.'},
          {icon:<Globe className="w-5 h-5"/>, title:'EC2 & S3', desc:'Dynamic apps go to EC2 via ECR + SSM. Static sites go to S3. Fully automatic based on framework type.'},
        ].map(({icon,title,desc}) => (
          <div key={title} className="rounded-xl p-6 border" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{background:'rgba(79,142,255,0.1)',color:'var(--accent)'}}>{icon}</div>
            <h3 className="font-semibold mb-2">{title}</h3>
            <p className="text-sm" style={{color:'var(--text2)'}}>{desc}</p>
          </div>
        ))}
      </section>
    </div>
  )
}

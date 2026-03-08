import Link from 'next/link'
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { ArrowRight, Zap, GitBranch, Globe, Shield, Terminal, Package } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <span className="text-xl font-bold">DeployHub</span>
          </div>
          <div className="flex items-center gap-4">
            <SignedOut>
              <Link href="/sign-in"
                className="text-sm text-white/70 hover:text-white transition-colors">
                Sign in
              </Link>
              <Link href="/sign-up"
                className="text-sm bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-white/90 transition-colors">
                Get Started
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard"
                className="text-sm bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-white/90 transition-colors">
                Dashboard
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-32 text-center">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-white/60 mb-8">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Zero-config deployments now live
        </div>
        <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent leading-tight">
          Deploy anything.<br />Instantly.
        </h1>
        <p className="text-xl text-white/50 max-w-2xl mx-auto mb-12">
          Push your GitHub repo or upload a ZIP. DeployHub auto-detects your framework,
          builds it in Docker, and serves it from S3 — in seconds.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/sign-up"
            className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-semibold hover:bg-white/90 transition-all">
            Start Deploying Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="#how-it-works"
            className="inline-flex items-center gap-2 border border-white/20 text-white px-6 py-3 rounded-xl font-medium hover:bg-white/5 transition-all">
            How it works
          </Link>
        </div>
      </section>

      {/* Terminal demo */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="bg-[#0d1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-2 text-xs text-white/30">DeployHub Build Log</span>
          </div>
          <div className="p-6 font-mono text-sm space-y-1">
            {[
              { text: '$ git clone https://github.com/user/my-nextjs-app', color: 'text-white/60' },
              { text: '🔍 Detected framework: Next.js', color: 'text-blue-400' },
              { text: '🐳 Generated Dockerfile for Next.js', color: 'text-purple-400' },
              { text: '🔨 Building Docker image...', color: 'text-yellow-400' },
              { text: '   Step 1/5: FROM node:20-alpine', color: 'text-white/40' },
              { text: '   Step 2/5: RUN npm ci', color: 'text-white/40' },
              { text: '   Step 3/5: RUN npm run build', color: 'text-white/40' },
              { text: '✓ Docker image built successfully', color: 'text-green-400' },
              { text: '☁️  Uploading 47 files to S3...', color: 'text-yellow-400' },
              { text: '✓ Deployed! → https://my-app.deployhub.io', color: 'text-green-400 font-bold' },
            ].map((line, i) => (
              <div key={i} className={line.color}>{line.text}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-6 pb-24">
        <h2 className="text-4xl font-bold text-center mb-4">Everything you need to ship</h2>
        <p className="text-center text-white/50 mb-16 max-w-xl mx-auto">
          From push to production in under a minute. No DevOps knowledge required.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <GitBranch className="w-6 h-6" />,
              title: 'GitHub & ZIP Deploys',
              desc: 'Connect any public GitHub repo or upload a ZIP file. Both work seamlessly.',
            },
            {
              icon: <Terminal className="w-6 h-6" />,
              title: 'Auto-detected Dockerfiles',
              desc: 'No Dockerfile? No problem. We detect Next.js, Vite, Python, Go, Rust and more.',
            },
            {
              icon: <Package className="w-6 h-6" />,
              title: 'Isolated Docker Builds',
              desc: 'Every deployment runs in a clean Docker container. Consistent, reproducible builds.',
            },
            {
              icon: <Globe className="w-6 h-6" />,
              title: 'Instant Preview URLs',
              desc: 'Each deployment gets a unique URL served from S3. Share previews instantly.',
            },
            {
              icon: <Shield className="w-6 h-6" />,
              title: 'Secure by Default',
              desc: 'Clerk authentication keeps your projects private. Each build is user-isolated.',
            },
            {
              icon: <Zap className="w-6 h-6" />,
              title: 'Real-time Build Logs',
              desc: 'Watch your build happen live. See every step from clone to S3 upload.',
            },
          ].map((f, i) => (
            <div key={i} className="p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/8 transition-colors">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4 text-white">
                {f.icon}
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-white/10 rounded-3xl p-16 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to deploy?</h2>
          <p className="text-white/50 mb-8">Join developers shipping faster with DeployHub.</p>
          <Link href="/sign-up"
            className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-xl font-semibold hover:bg-white/90 transition-all text-lg">
            Start for free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-white/30">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span>DeployHub</span>
          </div>
          <span>Built with Next.js, Docker & S3</span>
        </div>
      </footer>
    </div>
  )
}

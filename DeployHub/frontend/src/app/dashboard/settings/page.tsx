'use client'
import { useState } from 'react'
import { Copy, Check, Server, HardDrive } from 'lucide-react'
const EXAMPLES: Record<string,string> = {
  vite:          JSON.stringify({framework:'vite',buildCommand:'npm run build',outputDir:'dist',nodeVersion:'20'},null,2),
  nextjs:        JSON.stringify({framework:'nextjs',buildCommand:'npm run build',nodeVersion:'20'},null,2),
  'node-backend':JSON.stringify({framework:'node-backend',entryPoint:'src/index.js',startCommand:'node src/index.js'},null,2),
  fastapi:       JSON.stringify({framework:'fastapi',entryPoint:'main.py',startCommand:'uvicorn main:app --host 0.0.0.0 --port 8000'},null,2),
  flask:         JSON.stringify({framework:'flask',entryPoint:'app.py',startCommand:'gunicorn app:app --bind 0.0.0.0:8000'},null,2),
  'nested repo': JSON.stringify({framework:'go',projectSubDir:'backend'},null,2),
}
function Copy2({ text }: { text:string }) {
  const [done,setDone] = useState(false)
  function copy() { navigator.clipboard.writeText(text); setDone(true); setTimeout(()=>setDone(false),2000) }
  return <button onClick={copy} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors" style={{borderColor:'var(--border)',color:'var(--text2)'}}>{done?<Check className="w-3.5 h-3.5 text-green-400"/>:<Copy className="w-3.5 h-3.5"/>}{done?'Copied!':'Copy'}</button>
}
export default function SettingsPage() {
  const [sel,setSel] = useState('vite')
  return (
    <div className="p-8 fade-in max-w-4xl">
      <div className="mb-8"><h1 className="text-2xl font-bold tracking-tight">Settings & Docs</h1><p className="text-sm mt-1" style={{color:'var(--text2)'}}>Configuration reference and deployhub.json guide</p></div>
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-4">Deploy Targets</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            {icon:<Server className="w-5 h-5"/>,color:'var(--orange)',bg:'rgba(255,140,75,0.1)',title:'EC2 (Dynamic)',sub:'Backend / SSR apps',desc:'Server frameworks (Node, Python, Go, Rust, PHP, Next.js) are built into Docker images, pushed to ECR, and deployed to your EC2 instance via SSM.',badge:'isBackend: true → ECR → EC2'},
            {icon:<HardDrive className="w-5 h-5"/>,color:'#22d3ee',bg:'rgba(34,211,238,0.1)',title:'S3 (Static)',sub:'Frontend / static sites',desc:'Static frameworks (Vite, CRA, Gatsby, Astro, plain HTML) are built in Docker, extracted, and uploaded to S3 for public serving.',badge:'isBackend: false → S3 bucket'},
          ].map(({icon,color,bg,title,sub,desc,badge})=>(
            <div key={title} className="rounded-xl border p-5" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
              <div className="flex items-center gap-3 mb-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{background:bg,color}}>{icon}</div><div><div className="font-semibold">{title}</div><div className="text-xs" style={{color:'var(--text3)'}}>{sub}</div></div></div>
              <p className="text-sm mb-3" style={{color:'var(--text2)'}}>{desc}</p>
              <div className="text-xs px-3 py-2 rounded-lg font-mono" style={{background:'var(--surface2)',color:'var(--text3)'}}>{badge}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-4">Detection Pipeline</h2>
        <div className="rounded-xl border overflow-hidden" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
          {[
            {n:'1',c:'#a855f7',t:'deployhub.json',d:'User config file at repo root. Any field set here skips detection for that field. Always wins.'},
            {n:'2',c:'var(--green)',t:'Curated List',d:'Fast pattern matching for 5 frameworks: Next.js, Vite, Express/Fastify, FastAPI/Flask, Static HTML. Covers ~95% of repos. Scans subdirectories automatically for nested projects.'},
            {n:'3',c:'var(--accent)',t:'Full Pattern Detector',d:'Extended matching for Go, Rust, Django, Nuxt, SvelteKit, Astro, Gatsby, PHP, and more.'},
            {n:'4',c:'var(--orange)',t:'AI (OpenRouter)',d:'Sends a repo snapshot to LLM for framework detection + Dockerfile generation. Only triggered when all other methods fail. Set OPENROUTER_API_KEY to enable.'},
          ].map(({n,c,t,d})=>(
            <div key={t} className="flex items-start gap-4 p-5 border-b last:border-b-0" style={{borderColor:'var(--border)'}}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{background:c+'20',color:c}}>{n}</div>
              <div><div className="font-medium text-sm mb-1">{t}</div><div className="text-sm" style={{color:'var(--text2)'}}>{d}</div></div>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-2">Nested / Monorepo Projects</h2>
        <p className="text-sm mb-4" style={{color:'var(--text2)'}}>If your project code is in a subdirectory (e.g. <code className="font-mono text-xs px-1 py-0.5 rounded" style={{background:'var(--surface2)'}}>repo/backend/go.mod</code>), DeployHub handles it three ways:</p>
        <div className="grid grid-cols-3 gap-3">
          {['Auto-detect scans 1 level of subdirs','Set projectSubDir in project settings','deployhub.json with projectSubDir key'].map(m=>(
            <div key={m} className="p-4 rounded-xl border text-sm" style={{background:'var(--surface)',borderColor:'var(--border)',color:'var(--text2)'}}>✓ {m}</div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-4">deployhub.json</h2>
        <div className="rounded-xl border overflow-hidden" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
          <div className="flex border-b overflow-x-auto" style={{borderColor:'var(--border)'}}>
            {Object.keys(EXAMPLES).map(k=>(
              <button key={k} onClick={()=>setSel(k)} className="px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors"
                style={{color:sel===k?'var(--text)':'var(--text3)',borderBottom:sel===k?'2px solid var(--accent)':'2px solid transparent'}}>
                {k}
              </button>
            ))}
          </div>
          <div className="relative"><div className="absolute top-3 right-3 z-10"><Copy2 text={EXAMPLES[sel]}/></div><pre className="p-5 text-sm font-mono overflow-x-auto" style={{color:'var(--green)'}}>{EXAMPLES[sel]}</pre></div>
          <div className="border-t p-5" style={{borderColor:'var(--border)'}}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{color:'var(--text3)'}}>All Fields</div>
            <div className="grid grid-cols-2 gap-2">
              {[['framework','Force a framework (skips all detection)'],['buildCommand','Override build command'],['outputDir','Output directory for static builds'],['nodeVersion','Node.js version for Docker (default: 20)'],['isBackend','true→EC2, false→S3'],['entryPoint','Server entry file'],['startCommand','Full server start command'],['projectSubDir','Subdirectory with actual project (monorepos)']].map(([f,d])=>(
                <div key={f} className="flex gap-2 text-xs">
                  <code className="font-mono shrink-0 px-1.5 py-0.5 rounded" style={{background:'var(--surface2)',color:'var(--accent)'}}>{f}</code>
                  <span style={{color:'var(--text3)'}}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

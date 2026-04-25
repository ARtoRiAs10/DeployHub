'use client'
import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Wifi, WifiOff, X, Zap, Server, HardDrive } from 'lucide-react'
import { checkBackendHealth, getBackendStatus, type BackendStatus } from '@/lib/api'

type ConnectionState = 'checking' | 'connected' | 'disconnected'

export default function BackendStatus() {
  const [state, setState]       = useState<ConnectionState>('checking')
  const [status, setStatus]     = useState<BackendStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [showFeatures, setShowFeatures] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      const health = await checkBackendHealth()
      if (cancelled) return

      if (!health) {
        setState('disconnected')
        return
      }

      setState('connected')
      const s = await getBackendStatus()
      if (!cancelled) setStatus(s)
    }

    check()

    // Re-check every 30 seconds
    const interval = setInterval(check, 30_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Don't render during first check OR when connected + dismissed
  if (state === 'checking') return null
  if (state === 'connected' && dismissed) return null

  // Connected — show minimal indicator with feature flags
  if (state === 'connected') {
    const missingFeatures = status ? Object.entries(status.features)
      .filter(([, enabled]) => !enabled)
      .map(([key]) => FEATURE_LABELS[key] || key) : []

    return (
      <div className="mx-6 mb-0 mt-3">
        <div
          className="flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs"
          style={{ background: 'rgba(61,220,132,0.05)', borderColor: 'rgba(61,220,132,0.2)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ boxShadow: '0 0 6px #4ade80' }} />
            <span style={{ color: 'var(--green)' }}>Backend connected</span>
            {status && (
              <span style={{ color: 'var(--text3)' }}>
                · {status.region}
              </span>
            )}
            {missingFeatures.length > 0 && (
              <button
                onClick={() => setShowFeatures(f => !f)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(255,193,7,0.1)', color: 'var(--yellow)' }}
              >
                <AlertTriangle className="w-3 h-3" />
                {missingFeatures.length} feature{missingFeatures.length > 1 ? 's' : ''} disabled
              </button>
            )}
          </div>
          <button onClick={() => setDismissed(true)} style={{ color: 'var(--text3)' }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Feature flags dropdown */}
        {showFeatures && status && (
          <div
            className="mt-1 rounded-xl border p-4 text-xs"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="font-medium mb-3" style={{ color: 'var(--text2)' }}>Feature availability</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(status.features).map(([key, enabled]) => (
                <div key={key} className="flex items-center gap-2">
                  {enabled
                    ? <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    : <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--yellow)' }} />
                  }
                  <span style={{ color: enabled ? 'var(--text2)' : 'var(--text3)' }}>
                    {FEATURE_LABELS[key] || key}
                    {!enabled && <span className="ml-1 opacity-60">(not configured)</span>}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3" style={{ color: 'var(--text3)' }}>
              Set missing variables in <code className="font-mono px-1 rounded" style={{ background: 'var(--surface2)' }}>backend/.env</code> and restart the server.
            </p>
          </div>
        )}
      </div>
    )
  }

  // Disconnected — prominent error banner
  return (
    <div className="mx-6 mb-0 mt-3">
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl border text-sm"
        style={{ background: 'rgba(255,79,79,0.07)', borderColor: 'rgba(255,79,79,0.25)' }}
      >
        <WifiOff className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--red)' }} />
        <div className="flex-1 min-w-0">
          <div className="font-medium mb-1" style={{ color: 'var(--red)' }}>
            Cannot reach backend
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--text3)' }}>
            Make sure the backend server is running on{' '}
            <code className="font-mono px-1 rounded" style={{ background: 'var(--surface2)' }}>
              {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}
            </code>
            {' '}and that <code className="font-mono px-1 rounded" style={{ background: 'var(--surface2)' }}>NEXT_PUBLIC_API_URL</code>{' '}
            in <code className="font-mono px-1 rounded" style={{ background: 'var(--surface2)' }}>frontend/.env.local</code> is correct.
          </div>
          <div className="mt-2 text-xs font-mono" style={{ color: 'var(--text3)' }}>
            cd backend && npm run dev
          </div>
        </div>
      </div>
    </div>
  )
}

const FEATURE_LABELS: Record<string, string> = {
  aiDetection:  'AI framework detection (OpenRouter)',
  ec2Deploys:   'Backend deployments (EC2)',
  s3Deploys:    'Frontend deployments (S3)',
  customDomain: 'Custom deployment domain',
}

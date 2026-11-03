import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { PageHeader } from '../App'
import { Seg, Spinner } from './UploadStep'

const DEFAULTS = { angle: 0, tx: 0, ty: 0, scale: 1 }

export default function RegisterStep({ icga, ffa, onError, onBack, onDone }) {
  const [params, setParams] = useState(DEFAULTS)
  const [view, setView] = useState('overlay')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [blinkOn, setBlinkOn] = useState(true)
  const timer = useRef()

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setLoading(true)
      try { setPreview(await api.register({ icga_id: icga.id, ffa_id: ffa.id, ...params, preview: true })) }
      catch (e) { onError(e.message) } finally { setLoading(false) }
    }, 120)
    return () => clearTimeout(timer.current)
  }, [params, icga.id, ffa.id])

  useEffect(() => {
    if (view !== 'blink') return
    const t = setInterval(() => setBlinkOn((b) => !b), 600)
    return () => clearInterval(t)
  }, [view])

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'BUTTON'].includes(e.target.tagName) && e.target.type !== 'range') return
      const step = e.shiftKey ? 20 : 2
      const m = { ArrowLeft: ['tx', -step], ArrowRight: ['tx', step], ArrowUp: ['ty', -step], ArrowDown: ['ty', step],
        '[': ['angle', -0.1], ']': ['angle', 0.1] }[e.key]
      if (!m) return
      e.preventDefault()
      setParams((p) => ({ ...p, [m[0]]: +(p[m[0]] + m[1]).toFixed(2) }))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const confirm = async () => {
    setSaving(true)
    try { onDone((await api.register({ icga_id: icga.id, ffa_id: ffa.id, ...params, preview: false })).id) }
    catch (e) { onError(e.message) } finally { setSaving(false) }
  }

  const src = !preview ? null : view === 'overlay' ? preview.overlay : view === 'registered' ? preview.registered
    : blinkOn ? api.imageUrl(icga.id) : preview.overlay

  return (
    <>
      <PageHeader title="Registration"
        description="Move the FFA until its vessels sit on the ICGA. Aligned vessels show as white in the overlay.">
        <button className="btn-secondary" onClick={onBack}>Back</button>
        <button className="btn-primary" onClick={confirm} disabled={saving}>
          {saving && <Spinner />} {saving ? 'Saving registration' : 'Save registration'}
        </button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Viewer
          toolbar={<>
            <Seg value={view} onChange={setView} options={[['overlay', 'Overlay'], ['registered', 'ICGA − FFA'], ['blink', 'Flicker']]} />
            <div className="flex items-center gap-4 text-xs text-white/60">
              {view === 'overlay' && <>
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[#ff3dff]" />ICGA</span>
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[#3dff3d]" />FFA</span>
              </>}
              {loading && <Spinner />}
            </div>
          </>}>
          {src && <img src={src} alt="Registration preview" className="h-full w-full object-contain" draggable={false} />}
        </Viewer>

        <aside className="panel h-fit">
          <h2 className="border-b border-line-soft px-4 py-2.5 text-sm font-semibold">Transform applied to FFA</h2>
          <div className="space-y-4 p-4">
            <Slider label="Rotation" unit="°" min={-15} max={15} step={0.1} value={params.angle} onChange={(angle) => setParams({ ...params, angle })} />
            <Slider label="Horizontal shift" unit="px" min={-500} max={500} step={1} value={params.tx} onChange={(tx) => setParams({ ...params, tx })} />
            <Slider label="Vertical shift" unit="px" min={-500} max={500} step={1} value={params.ty} onChange={(ty) => setParams({ ...params, ty })} />
            <Slider label="Scale" unit="×" min={0.85} max={1.15} step={0.005} value={params.scale} onChange={(scale) => setParams({ ...params, scale })} />
          </div>
          <div className="flex items-center justify-between border-t border-line-soft px-4 py-2.5">
            <span className="text-xs text-muted">Arrow keys shift, [ and ] rotate</span>
            <button className="btn-quiet h-6 text-xs" onClick={() => setParams(DEFAULTS)}>Reset</button>
          </div>
        </aside>
      </div>
    </>
  )
}

export function Viewer({ toolbar, children, footer }) {
  return (
    <section className="overflow-hidden rounded-md border border-[#2A2F36] bg-black">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#16191D] px-3 py-2 [&_.seg]:border-white/10 [&_.seg]:bg-black/40 [&_.seg>button]:text-white/60 [&_.seg>button[aria-pressed=true]]:bg-white/10 [&_.seg>button[aria-pressed=true]]:text-white [&_.seg>button[aria-pressed=true]]:shadow-none">
        {toolbar}
      </div>
      <div className="relative aspect-square">
        {children}
        <Reticle />
      </div>
      {footer}
    </section>
  )
}

function Reticle() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <line x1="50" y1="0" x2="50" y2="100" stroke="white" strokeOpacity=".14" strokeWidth=".12" />
      <line x1="0" y1="50" x2="100" y2="50" stroke="white" strokeOpacity=".14" strokeWidth=".12" />
    </svg>
  )
}

function Slider({ label, unit, min, max, step, value, onChange }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-ink-2">{label}</span>
        <span className="flex items-center gap-1">
          <input type="number" value={value} step={step} aria-label={label}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="input h-7 w-20 text-right text-xs" />
          <span className="w-4 text-xs text-muted">{unit}</span>
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={`${label} slider`}
        onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
    </div>
  )
}

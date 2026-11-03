import { useEffect, useRef, useState } from 'react'
import { api, IMAGE_SIZE, DEFAULT_MM_PER_PX } from '../api'
import { PageHeader } from '../App'
import { Viewer } from './RegisterStep'
import { Seg, Spinner } from './UploadStep'

const COLORS = { origin: '#FF5C5C', a: '#F2B544', v: '#3FD0B0' }
const TOOLS = [
  { key: 'origin', label: 'Optic nerve head', short: 'ON' },
  ...[1, 2, 3, 4].map((q) => ({ key: `a${q}`, label: `Ampulla, Q${q}`, short: `A${q}` })),
  ...[1, 2, 3, 4].map((q) => ({ key: `v${q}`, label: `Vessel, Q${q}`, short: `V${q}` })),
]
const colorOf = (key) => COLORS[key === 'origin' ? 'origin' : key[0]]
const get = (p, k) => (k === 'origin' ? p.origin : k[0] === 'a' ? p.ampullae[k[1]] : p.vessels[k[1]])
const set = (p, k, v) => {
  if (k === 'origin') return { ...p, origin: v }
  const f = k[0] === 'a' ? 'ampullae' : 'vessels'
  return { ...p, [f]: { ...p[f], [k[1]]: v } }
}

export default function LandmarkStep({ imageId, points, setPoints, mmPerPx, setMmPerPx, busy, onBack, onRun }) {
  const [tool, setTool] = useState('origin')
  const [zoom, setZoom] = useState('1')
  const [hover, setHover] = useState(null)
  const wrap = useRef()

  // Undo / redo history of { points, tool } snapshots
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const change = (updater) => {
    setPast((h) => [...h, { points, tool }].slice(-200))
    setFuture([])
    setPoints(updater)
  }
  const undo = () => {
    if (!past.length) return
    const prev = past[past.length - 1]
    setPast((h) => h.slice(0, -1))
    setFuture((f) => [{ points, tool }, ...f])
    setPoints(prev.points)
    setTool(prev.tool)
  }
  const redo = () => {
    if (!future.length) return
    const next = future[0]
    setFuture((f) => f.slice(1))
    setPast((h) => [...h, { points, tool }])
    setPoints(next.points)
    setTool(next.tool)
  }

  // Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo (ignored while typing in a field)
  const keys = useRef()
  keys.current = { undo, redo }
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const t = e.target
      if (t && (t.tagName === 'TEXTAREA' || t.isContentEditable ||
        (t.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(t.type)))) return
      // e.code = physical key, so it works on any keyboard layout
      const isZ = e.code === 'KeyZ' || e.key?.toLowerCase() === 'z'
      const isY = e.code === 'KeyY' || e.key?.toLowerCase() === 'y'
      if (isZ && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); keys.current.undo() }
      else if ((isZ && e.shiftKey) || isY) { e.preventDefault(); e.stopPropagation(); keys.current.redo() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [])

  const toImage = (e) => {
    const r = wrap.current.getBoundingClientRect()
    return [Math.round(((e.clientX - r.left) / r.width) * IMAGE_SIZE), Math.round(((e.clientY - r.top) / r.height) * IMAGE_SIZE)]
  }
  const place = (e) => {
    change((p) => set(p, tool, toImage(e)))
    const i = TOOLS.findIndex((t) => t.key === tool)
    const next = TOOLS.slice(i + 1).find((t) => t.key[0] !== 'v' && !get(points, t.key))
    if (next) setTool(next.key)
  }

  const o = points.origin
  const quadrant = ([x, y]) => (!o ? null : y < o[1] ? (x >= o[0] ? 1 : 2) : x < o[0] ? 3 : 4)
  const active = TOOLS.find((t) => t.key === tool)

  return (
    <>
      <PageHeader title="Landmarks"
        description="Mark the optic nerve head, then the vortex vein ampulla in each quadrant. Outflow and density are measured automatically; vessel picks are optional.">
        <button className="btn-secondary" onClick={onBack}>Back</button>
        <button className="btn-primary" onClick={onRun} disabled={busy}>
          {busy && <Spinner />} {busy ? 'Measuring' : 'Run measurements'}
        </button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-md border border-[#2A2F36] bg-black">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#16191D] px-3 py-2 text-xs text-white/70">
            <div className="flex items-center gap-3">
              <div className="flex overflow-hidden rounded border border-white/10">
                <button onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)" aria-label="Undo"
                  className="flex h-7 items-center gap-1.5 px-2.5 text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:text-white/25 disabled:hover:bg-transparent">
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden><path d="M5.5 3.5 2.5 6.5l3 3M2.5 6.5H10a3.5 3.5 0 0 1 0 7H7" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
                  Undo
                </button>
                <button onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"
                  className="flex h-7 items-center border-l border-white/10 px-2 text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:text-white/25 disabled:hover:bg-transparent">
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden><path d="m10.5 3.5 3 3-3 3M13.5 6.5H6a3.5 3.5 0 0 0 0 7h3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
                </button>
              </div>
              <span>Placing <b className="font-semibold" style={{ color: colorOf(tool) }}>{active.label}</b></span>
            </div>
            <div className="flex items-center gap-4">
              <span className="w-40 text-right tabular-nums text-white/50">
                {hover ? `x ${hover[0]}, y ${hover[1]}${o ? `, Q${quadrant(hover)}` : ''}` : ''}
              </span>
              <div className="seg !border-white/10 !bg-black/40 [&>button]:!text-white/60 [&>button[aria-pressed=true]]:!bg-white/10 [&>button[aria-pressed=true]]:!text-white [&>button[aria-pressed=true]]:!shadow-none">
                {['1', '1.5', '2.5'].map((z) => <button key={z} aria-pressed={zoom === z} onClick={() => setZoom(z)}>{z}×</button>)}
              </div>
            </div>
          </div>
          <div className="max-h-[76vh] overflow-auto">
            <div ref={wrap} className="relative cursor-crosshair select-none" style={{ width: `${zoom * 100}%` }}
              onClick={place} onMouseMove={(e) => setHover(toImage(e))} onMouseLeave={() => setHover(null)}>
              <img src={api.imageUrl(imageId, 2000)} alt="Registered image" className="block w-full" draggable={false} />
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${IMAGE_SIZE} ${IMAGE_SIZE}`}>
                {o && (<g stroke="white" strokeOpacity=".4" strokeWidth="5">
                  <line x1={o[0]} y1="0" x2={o[0]} y2={IMAGE_SIZE} />
                  <line x1="0" y1={o[1]} x2={IMAGE_SIZE} y2={o[1]} />
                  {[[1, 1, -1], [2, -1, -1], [3, -1, 1], [4, 1, 1]].map(([q, sx, sy]) => (
                    <text key={q} x={o[0] + sx * 130} y={o[1] + sy * 130} fill="white" fillOpacity=".55" stroke="none"
                      fontSize="72" fontWeight="600" textAnchor="middle" dominantBaseline="middle">Q{q}</text>
                  ))}
                </g>)}
                {TOOLS.map((t) => {
                  const p = get(points, t.key)
                  if (!p) return null
                  const c = colorOf(t.key)
                  return (
                    <g key={t.key}>
                      {t.key[0] === 'a' && o && <line x1={o[0]} y1={o[1]} x2={p[0]} y2={p[1]} stroke={c} strokeWidth="6" strokeOpacity=".85" />}
                      <circle cx={p[0]} cy={p[1]} r={t.key[0] === 'v' ? 36 : 22} fill={t.key[0] === 'v' ? 'none' : c} stroke={c} strokeWidth="8" />
                      <text x={p[0] + 44} y={p[1] - 34} fill={c} fontSize="64" fontWeight="600">{t.short}</text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="panel">
            <h2 className="border-b border-line-soft px-4 py-2.5 text-sm font-semibold">Points</h2>
            <PointGroup title="Origin" keys={['origin']} {...{ tool, setTool, points }} setPoints={change} />
            <PointGroup title="Vortex vein ampullae" keys={['a1', 'a2', 'a3', 'a4']} {...{ tool, setTool, points }} setPoints={change} />
            <PointGroup title="Prominent vessel (optional)" keys={['v1', 'v2', 'v3', 'v4']} {...{ tool, setTool, points }} setPoints={change} />
          </section>

          <section className="panel">
            <h2 className="border-b border-line-soft px-4 py-2.5 text-sm font-semibold">Calibration</h2>
            <div className="p-4">
              <label className="field-label" htmlFor="mmpx">Millimetres per pixel</label>
              <div className="flex gap-2">
                <input id="mmpx" type="number" step="0.0001" className="input tabular-nums" value={+mmPerPx.toFixed(6)}
                  onChange={(e) => setMmPerPx(parseFloat(e.target.value) || DEFAULT_MM_PER_PX)} />
                <button className="btn-secondary" onClick={() => setMmPerPx(DEFAULT_MM_PER_PX)}>Default</button>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">The default (2.54 / 96) is the factor used in the study notebooks.</p>
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}

function PointGroup({ title, keys, tool, setTool, points, setPoints }) {
  return (
    <div className="border-b border-line-soft px-2 py-2 last:border-0">
      <div className="px-2 pb-1 text-xs text-muted">{title}</div>
      {keys.map((k) => {
        const t = TOOLS.find((x) => x.key === k)
        const p = get(points, k)
        return (
          <div key={k} className={`flex items-center rounded ${tool === k ? 'bg-icg-tint' : 'hover:bg-canvas'}`}>
            <button onClick={() => setTool(k)} className="flex flex-1 items-center gap-2.5 px-2 py-1.5 text-left text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p ? colorOf(k) : 'transparent', border: `1.5px solid ${colorOf(k)}` }} />
              <span className={tool === k ? 'font-medium text-ink' : 'text-ink-2'}>{t.label}</span>
              <span className="ml-auto text-xs tabular-nums text-subtle">{p ? `${p[0]}, ${p[1]}` : 'Not set'}</span>
            </button>
            {p && (
              <button className="mr-1 grid h-6 w-6 place-items-center rounded text-subtle hover:bg-line-soft hover:text-danger"
                aria-label={`Clear ${t.label}`} onClick={() => setPoints((pts) => set(pts, k, null))}>
                <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden><path d="m3 3 6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.5" /></svg>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

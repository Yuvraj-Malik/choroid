import { useState } from 'react'
import { PageHeader } from '../App'
import { Viewer } from './RegisterStep'
import { Seg } from './UploadStep'

const f = (v, d = 3) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(d))

const VIEW_LABELS = { outflow: 'Outflow', density: 'Density', diameter: 'Vessels', ampulla: 'Ampullae' }
const CAPTIONS = {
  outflow: 'ICGA multiplied by the adaptive and global threshold masks. Outline shows the region of interest; quadrant brightness is the pixel sum divided by ROI pixels.',
  density: 'Adaptive mean binarisation (block 71). The dimmed area lies outside the region of interest.',
  diameter: 'Segmented choroidal vessels in green with centrelines in orange. Rings mark vessels you picked.',
  ampulla: 'Quadrant axes from the optic nerve head and the straight-line distance to each ampulla.',
}

export default function ResultsStep({ patient, analysis, reference, onBack }) {
  const r = analysis.results
  const views = Object.keys(analysis.images)
  const [view, setView] = useState(views[0])
  const ctrl = reference?.control
  const uv = reference?.uveitis
  const picked = r.diameter?.average_picked_mm != null

  const metrics = [
    r.density && { key: 'density', name: 'Vessel density', value: r.density.density, digits: 3, ref: 'density',
      detail: `Strict ROI count ${f(r.density.density_strict_roi)}` },
    r.outflow && { key: 'asym', name: 'Outflow asymmetry', value: r.outflow.asymmetry, digits: 1, ref: 'asymmetry',
      detail: `Brightest Q${r.outflow.max_quadrant}, dimmest Q${r.outflow.min_quadrant}` },
    r.diameter && { key: 'diam', name: 'Prominent vessel diameter', unit: 'mm', digits: 3, ref: 'diameter_mm',
      value: picked ? r.diameter.average_picked_mm : r.diameter.average_prominent_mm,
      detail: picked ? 'Mean of picked vessels' : 'Automatic, 99th percentile of centreline width' },
    { key: 'amp', name: 'Ampulla distance', unit: 'px', digits: 0, noZ: true,
      value: r.ampulla ? r.ampulla.average_mm / analysis.mm_per_px : null,
      detail: r.ampulla ? `Mean of ${Object.keys(r.ampulla.per_quadrant).length} quadrants, ${f(r.ampulla.average_mm, 2)} mm at current calibration` : 'Place the optic nerve head and ampullae to measure',
      caution: r.ampulla && 'Shown in pixels: the study measured on a downscaled view, so its millimetre values use a different scale.' },
  ].filter(Boolean)

  const rows = [1, 2, 3, 4].map((q) => ({
    q,
    brightness: r.outflow?.brightness[q],
    density: r.density?.per_quadrant[q],
    diameter: r.diameter?.per_quadrant[q]?.picked_mm ?? r.diameter?.per_quadrant[q]?.prominent_mm,
    isPick: r.diameter?.per_quadrant[q]?.picked_mm != null,
    ampMm: r.ampulla?.per_quadrant[q]?.mm,
    ampPx: r.ampulla?.per_quadrant[q]?.px,
  }))

  const exportCsv = () => {
    const head = ['case', 'eye', 'group', 'quadrant', 'brightness', 'density', 'diameter_mm', 'diameter_source', 'ampulla_mm', 'ampulla_px']
    const lines = rows.map((x) => [patient.name, patient.eye, patient.group, `Q${x.q}`, x.brightness, x.density, x.diameter,
      x.isPick ? 'picked' : 'automatic', x.ampMm, x.ampPx])
    lines.push([patient.name, patient.eye, patient.group, 'overall', '', r.density?.density,
      picked ? r.diameter?.average_picked_mm : r.diameter?.average_prominent_mm, picked ? 'picked' : 'automatic', r.ampulla?.average_mm, ''])
    lines.push([patient.name, patient.eye, patient.group, 'outflow_asymmetry', r.outflow?.asymmetry])
    download(`${patient.name || 'case'}_choroid.csv`, [head, ...lines].map((l) => l.map((v) => v ?? '').join(',')).join('\n'), 'text/csv')
  }
  const exportJson = () => download(`${patient.name || 'case'}_choroid.json`,
    JSON.stringify({ patient, mm_per_px: analysis.mm_per_px, ...r }, null, 2), 'application/json')

  return (
    <>
      <PageHeader title={patient.name ? `Results for ${patient.name}` : 'Results'}
        description={`${patient.eye} eye, ${patient.group.toLowerCase()} group. Reference values are from the study cohort spreadsheets.`}>
        <button className="btn-secondary" onClick={onBack}>Edit landmarks</button>
        <button className="btn-secondary" onClick={exportJson}>Export JSON</button>
        <button className="btn-primary" onClick={exportCsv}>Export CSV</button>
      </PageHeader>

      <section className="panel mb-6 grid divide-y divide-line-soft sm:grid-cols-2 sm:divide-x xl:grid-cols-4 xl:divide-y-0">
        {metrics.map((m) => <Metric key={m.key} m={m} control={ctrl?.[m.ref]} uveitis={uv?.[m.ref]} />)}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <Viewer
          toolbar={<Seg value={view} onChange={setView} options={views.map((v) => [v, VIEW_LABELS[v]])} />}
          footer={<p className="border-t border-white/10 bg-[#16191D] px-3 py-2 text-xs leading-5 text-white/60">{CAPTIONS[view]}</p>}>
          <img src={analysis.images[view]} alt={`${VIEW_LABELS[view]} overlay`} className="h-full w-full object-contain" />
        </Viewer>

        <div className="space-y-6">
          <section className="panel overflow-hidden">
            <h2 className="border-b border-line-soft px-4 py-2.5 text-sm font-semibold">By quadrant</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Quadrant</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Bright.</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Density</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-2 text-right font-medium">Vessel (mm)</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">Ampulla (px)</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map((x) => (
                    <tr key={x.q} className="border-t border-line-soft">
                      <th scope="row" className="px-3 py-2.5 text-left font-medium">Q{x.q}</th>
                      <td className="px-2 py-2.5 text-right">
                        {f(x.brightness, 1)}
                        {r.outflow?.max_quadrant === x.q && <Tag tone="fluo">max</Tag>}
                        {r.outflow?.min_quadrant === x.q && <Tag tone="icg">min</Tag>}
                      </td>
                      <td className="px-2 py-2.5 text-right">{f(x.density)}</td>
                      <td className="px-2 py-2.5 text-right">{f(x.diameter)}{x.isPick && <Tag tone="icg">pick</Tag>}</td>
                      <td className="px-3 py-2.5 text-right">{x.ampPx != null ? Math.round(x.ampPx) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {r.outflow && <BrightnessChart brightness={r.outflow.brightness} control={ctrl?.brightness} />}

          <p className="text-xs leading-5 text-muted">
            For research use. Outflow and density reproduce the study notebooks and agree with the recorded cohort values
            to within a few percent; the original region-of-interest masks were tuned by hand per image.
          </p>
        </div>
      </div>
    </>
  )
}

function Metric({ m, control, uveitis }) {
  const z = !m.noZ && control && m.value != null ? (m.value - control.mean) / control.std : null
  return (
    <div className="flex flex-col p-4">
      <h3 className="text-sm text-muted">{m.name}</h3>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-[28px] font-semibold leading-9 tracking-[-0.02em] tabular-nums">{f(m.value, m.digits)}</span>
        {m.unit && <span className="text-sm text-muted">{m.unit}</span>}
      </div>
      <p className="text-xs text-muted">{m.detail}</p>
      {control && (
        <div className="mt-4">
          <RangeBar value={m.value} control={control} uveitis={uveitis} />
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs tabular-nums">
            <dt className="flex items-center gap-1.5 text-muted"><i className="h-2 w-2 rounded-sm bg-icg/40" />Control</dt>
            <dd className="text-right text-ink-2">{f(control.mean, m.digits)} ± {f(control.std, m.digits)} (n = {control.n})</dd>
            {uveitis && <>
              <dt className="flex items-center gap-1.5 text-muted"><i className="h-2 w-2 rounded-sm bg-fluo/40" />Uveitis</dt>
              <dd className="text-right text-ink-2">{f(uveitis.mean, m.digits)} ± {f(uveitis.std, m.digits)} (n = {uveitis.n})</dd>
            </>}
          </dl>
        </div>
      )}
      {z != null && (
        <p className={`mt-3 border-t border-line-soft pt-2 text-xs tabular-nums ${Math.abs(z) > 2 ? 'font-medium text-danger' : Math.abs(z) > 1 ? 'text-fluo' : 'text-muted'}`}>
          {Math.abs(z) < 0.05 ? 'At the control mean' : `${Math.abs(z).toFixed(1)} SD ${z > 0 ? 'above' : 'below'} the control mean`}
        </p>
      )}
      {m.caution && <p className="mt-3 border-t border-line-soft pt-2 text-xs leading-5 text-fluo">{m.caution}</p>}
    </div>
  )
}

function RangeBar({ value, control, uveitis }) {
  const pts = [control.mean - 3 * control.std, control.mean + 3 * control.std]
  if (uveitis) pts.push(uveitis.mean - 2 * uveitis.std, uveitis.mean + 2 * uveitis.std)
  if (value != null) pts.push(value)
  const lo = Math.min(...pts), hi = Math.max(...pts)
  const pct = (v) => ((v - lo) / (hi - lo)) * 100
  const band = (mu, sd, cls) => (
    <div className={`absolute h-full ${cls}`} style={{ left: `${pct(mu - sd)}%`, width: `${pct(mu + sd) - pct(mu - sd)}%` }} />
  )
  return (
    <div className="relative h-5" aria-hidden>
      <div className="absolute inset-x-0 top-2 h-1 rounded-sm bg-line-soft" />
      <div className="absolute inset-x-0 top-2 h-1">
        {band(control.mean, control.std, 'bg-icg/40')}
        {uveitis && band(uveitis.mean, uveitis.std, 'bg-fluo/40')}
      </div>
      {value != null && <div className="absolute top-0 h-5 w-[2px] -translate-x-1/2 bg-ink" style={{ left: `${pct(value)}%` }} />}
    </div>
  )
}

function BrightnessChart({ brightness, control }) {
  const max = Math.max(...Object.values(brightness), ...(control ? Object.values(control) : [0])) * 1.05
  return (
    <section className="panel">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
        <h2 className="text-sm font-semibold">Quadrant brightness</h2>
        <span className="flex items-center gap-1.5 text-xs text-muted"><i className="h-3 w-[2px] bg-ink" />Control mean</span>
      </div>
      <div className="space-y-2.5 p-4">
        {[1, 2, 3, 4].map((q) => (
          <div key={q} className="grid grid-cols-[28px_1fr_40px] items-center gap-3 text-xs">
            <span className="font-medium">Q{q}</span>
            <div className="relative h-3 bg-line-soft">
              <div className="h-full bg-icg" style={{ width: `${(brightness[q] / max) * 100}%` }} />
              {control && <div className="absolute -top-1 h-5 w-[2px] bg-ink" style={{ left: `${(control[q] / max) * 100}%` }} />}
            </div>
            <span className="text-right tabular-nums">{f(brightness[q], 1)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Tag({ tone, children }) {
  const cls = tone === 'fluo' ? 'bg-fluo-tint text-fluo' : 'bg-icg-tint text-icg'
  return <span className={`ml-1.5 rounded-sm px-1 py-px text-2xs font-medium ${cls}`}>{children}</span>
}

function download(name, text, type) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

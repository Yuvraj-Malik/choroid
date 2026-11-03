import { useState } from 'react'
import { api } from '../api'
import { PageHeader } from '../App'

export default function UploadStep({ patient, setPatient, mode, setMode, uploads, setUploads, onError, onNext }) {
  const ready = mode === 'pair' ? uploads.icga && uploads.ffa : uploads.registered

  return (
    <>
      <PageHeader title="New case"
        description="Enter the case details and add the angiograms. Images are scaled to 4000 × 4000 px and converted to grayscale, matching the study pipeline.">
        <button className="btn-primary" disabled={!ready} onClick={onNext}>
          {mode === 'pair' ? 'Continue to registration' : 'Continue to landmarks'}
        </button>
      </PageHeader>

      <section className="panel mb-6">
        <h2 className="border-b border-line-soft px-4 py-2.5 text-sm font-semibold">Case details</h2>
        <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="block">
            <span className="field-label">Case ID</span>
            <input className="input" value={patient.name} placeholder="Hospital or study ID, e.g. UC15759"
              onChange={(e) => setPatient({ ...patient, name: e.target.value })} />
          </label>
          <div>
            <span className="field-label">Eye</span>
            <Seg options={['Right', 'Left']} value={patient.eye} onChange={(eye) => setPatient({ ...patient, eye })} />
          </div>
          <div>
            <span className="field-label">Group</span>
            <Seg options={['Uveitis', 'Control']} value={patient.group} onChange={(group) => setPatient({ ...patient, group })} />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-2.5">
          <h2 className="text-sm font-semibold">Images</h2>
          <Seg value={mode} onChange={setMode}
            options={[['pair', 'ICGA and FFA pair'], ['registered', 'Already registered']]} />
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          {mode === 'pair' ? (
            <>
              <FileSlot kind="icga" title="ICGA" detail="Indocyanine green angiogram, mid phase" swatch="bg-icg"
                value={uploads.icga} onChange={(v) => setUploads((u) => ({ ...u, icga: v }))} onError={onError} />
              <FileSlot kind="ffa" title="FFA" detail="Fluorescein angiogram, same session" swatch="bg-fluo"
                value={uploads.ffa} onChange={(v) => setUploads((u) => ({ ...u, ffa: v }))} onError={onError} />
            </>
          ) : (
            <FileSlot kind="registered" title="Registered image" detail="ICGA minus aligned FFA, e.g. Registered_image_*.jpg" swatch="bg-ink-2"
              value={uploads.registered} onChange={(v) => setUploads((u) => ({ ...u, registered: v }))} onError={onError} />
          )}
        </div>
      </section>
    </>
  )
}

export function Seg({ options, value, onChange }) {
  return (
    <div className="seg" role="group">
      {options.map((o) => {
        const [k, l] = Array.isArray(o) ? o : [o, o]
        return <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>
      })}
    </div>
  )
}

function FileSlot({ kind, title, detail, swatch, value, onChange, onError }) {
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)

  const handle = async (file) => {
    if (!file) return
    setBusy(true); onError('')
    try {
      onChange({ ...(await api.upload(file, kind)), name: file.name, bytes: file.size })
    } catch (e) {
      onError(`Could not upload ${file.name}: ${e.message}`)
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-md border border-line">
      <div className="flex items-center gap-2 border-b border-line-soft px-3 py-2">
        <span className={`h-2 w-2 rounded-sm ${swatch}`} />
        <span className="text-sm font-medium">{title}</span>
        <span className="truncate text-xs text-muted">{detail}</span>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]) }}
        className={`flex cursor-pointer items-center gap-4 p-3 transition-colors ${over ? 'bg-icg-tint' : 'hover:bg-canvas'}`}>
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => handle(e.target.files[0])} />
        <div className={`grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded ${value ? 'bg-black' : 'border border-dashed border-line bg-canvas'}`}>
          {value
            ? <img src={api.imageUrl(value.id, 300)} alt={`${title} preview`} className="h-full w-full object-contain" />
            : <svg viewBox="0 0 24 24" className="h-6 w-6 text-subtle" aria-hidden><path d="M12 16V5m0 0-4 4m4-4 4 4M5 19h14" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>}
        </div>
        <div className="min-w-0 text-sm">
          {busy ? <span className="text-muted">Uploading…</span>
            : value ? (
              <>
                <div className="truncate font-medium">{value.name}</div>
                <div className="mt-0.5 text-xs text-muted">{(value.bytes / 1e6).toFixed(1)} MB, stored at 4000 × 4000 px</div>
                <div className="mt-2 text-xs font-medium text-icg">Replace file</div>
              </>
            ) : (
              <>
                <div className="font-medium">Choose a file or drag it here</div>
                <div className="mt-0.5 text-xs text-muted">JPG, PNG or TIFF</div>
              </>
            )}
        </div>
      </label>
    </div>
  )
}

export function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
}

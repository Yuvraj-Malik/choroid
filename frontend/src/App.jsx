import { useEffect, useState } from 'react'
import { api, DEFAULT_MM_PER_PX } from './api'
import Sidebar from './components/Stepper'
import UploadStep from './components/UploadStep'
import RegisterStep from './components/RegisterStep'
import LandmarkStep from './components/LandmarkStep'
import ResultsStep from './components/ResultsStep'

const emptyPoints = () => ({
  origin: null,
  ampullae: { 1: null, 2: null, 3: null, 4: null },
  vessels: { 1: null, 2: null, 3: null, 4: null },
})

export default function App() {
  const [step, setStep] = useState(0)
  const [patient, setPatient] = useState({ name: '', eye: 'Right', group: 'Uveitis' })
  const [mode, setMode] = useState('pair')
  const [uploads, setUploads] = useState({ icga: null, ffa: null, registered: null })
  const [registeredId, setRegisteredId] = useState(null)
  const [points, setPoints] = useState(emptyPoints)
  const [mmPerPx, setMmPerPx] = useState(DEFAULT_MM_PER_PX)
  const [analysis, setAnalysis] = useState(null)
  const [reference, setReference] = useState(null)
  const [online, setOnline] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.reference().then((r) => { setReference(r); setOnline(true) }).catch(() => setOnline(false))
  }, [])

  const reset = () => {
    setStep(0); setUploads({ icga: null, ffa: null, registered: null }); setRegisteredId(null)
    setPoints(emptyPoints()); setAnalysis(null); setError('')
    setPatient({ name: '', eye: 'Right', group: 'Uveitis' })
  }

  const runAnalysis = async () => {
    setBusy(true); setError('')
    try {
      setAnalysis(await api.analyze({
        image_id: registeredId, mm_per_px: mmPerPx, origin: points.origin,
        ampullae: points.ampullae, vessel_picks: points.vessels,
      }))
      setStep(3)
    } catch (e) {
      setError(`Analysis failed: ${e.message}`)
    } finally { setBusy(false) }
  }

  const steps = [
    { title: 'Images', hint: mode === 'pair' ? 'ICGA and FFA' : 'Registered image' },
    { title: 'Registration', hint: mode === 'pair' ? 'Align FFA to ICGA' : 'Skipped' },
    { title: 'Landmarks', hint: 'Optic nerve, ampullae' },
    { title: 'Results', hint: 'Biomarkers and export' },
  ]
  const canVisit = (i) =>
    i === 0 || (i === 1 && mode === 'pair' && uploads.icga && uploads.ffa) ||
    (i === 2 && registeredId) || (i === 3 && analysis)

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar steps={steps} current={step} canVisit={canVisit} onSelect={setStep}
        patient={patient} online={online} onReset={reset} />

      <main className="min-w-0 flex-1">
        {error && (
          <div role="alert" className="flex items-center justify-between border-b border-danger/20 bg-danger-tint px-6 py-2.5 text-sm text-danger">
            {error}
            <button className="btn-quiet !text-danger" onClick={() => setError('')}>Dismiss</button>
          </div>
        )}
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8">
          {step === 0 && (
            <UploadStep patient={patient} setPatient={setPatient} mode={mode} setMode={setMode}
              uploads={uploads} setUploads={setUploads} onError={setError}
              onNext={() => {
                if (mode === 'registered') { setRegisteredId(uploads.registered.id); setPoints(emptyPoints()); setStep(2) }
                else setStep(1)
              }} />
          )}
          {step === 1 && (
            <RegisterStep icga={uploads.icga} ffa={uploads.ffa} onError={setError} onBack={() => setStep(0)}
              onDone={(id) => { setRegisteredId(id); setPoints(emptyPoints()); setStep(2) }} />
          )}
          {step === 2 && (
            <LandmarkStep imageId={registeredId} points={points} setPoints={setPoints}
              mmPerPx={mmPerPx} setMmPerPx={setMmPerPx} busy={busy}
              onBack={() => setStep(mode === 'pair' ? 1 : 0)} onRun={runAnalysis} />
          )}
          {step === 3 && analysis && (
            <ResultsStep patient={patient} analysis={analysis} reference={reference} onBack={() => setStep(2)} />
          )}
        </div>
      </main>
    </div>
  )
}

export function PageHeader({ title, description, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm leading-6 text-muted">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </div>
  )
}

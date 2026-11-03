// Left rail: product name, current case, workflow steps, service status.
export default function Sidebar({ steps, current, canVisit, onSelect, patient, online, onReset }) {
  return (
    <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-5 py-4 lg:block">
        <div>
          <div className="text-[15px] font-semibold tracking-[-0.01em]">Choroid Analyzer</div>
          <div className="mt-0.5 text-xs text-muted">Widefield FFA and ICGA measurements</div>
        </div>
        <button className="btn-secondary lg:hidden" onClick={onReset}>New case</button>
      </div>

      <div className="hidden border-y border-line-soft px-5 py-4 lg:block">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Current case</span>
          <button className="text-xs font-medium text-icg hover:underline" onClick={onReset}>New case</button>
        </div>
        <div className="mt-1.5 truncate text-sm font-medium">{patient.name || 'Unnamed case'}</div>
        <div className="mt-0.5 text-xs text-muted">{patient.eye} eye, {patient.group.toLowerCase()} group</div>
      </div>

      <nav aria-label="Workflow" className="overflow-x-auto px-3 pb-3 lg:flex-1 lg:py-4">
        <ol className="flex gap-1 lg:flex-col">
          {steps.map((s, i) => {
            const active = i === current
            const done = i < current
            const enabled = canVisit(i)
            return (
              <li key={s.title} className="shrink-0">
                <button disabled={!enabled} onClick={() => onSelect(i)} aria-current={active ? 'step' : undefined}
                  className={`flex w-full items-start gap-3 rounded px-2 py-2 text-left transition-colors
                    ${active ? 'bg-icg-tint' : enabled ? 'hover:bg-canvas' : 'cursor-default'}`}>
                  <span className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full text-2xs font-semibold
                    ${active ? 'bg-icg text-white' : done ? 'bg-ink-2 text-white' : 'border border-line text-subtle'}`}>
                    {done ? (
                      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden><path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
                    ) : i + 1}
                  </span>
                  <span>
                    <span className={`block text-sm ${active ? 'font-semibold text-icg' : enabled ? 'font-medium text-ink' : 'text-subtle'}`}>{s.title}</span>
                    <span className="hidden text-xs text-muted lg:block">{s.hint}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="hidden border-t border-line-soft px-5 py-3 text-xs text-muted lg:flex lg:items-center lg:gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${online === false ? 'bg-danger' : online ? 'bg-icg' : 'bg-subtle'}`} />
        {online === false ? 'Analysis service offline (port 8000)' : online ? 'Analysis service connected' : 'Connecting'}
      </div>
    </aside>
  )
}

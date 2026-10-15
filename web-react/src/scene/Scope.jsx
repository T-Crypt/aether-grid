// Scope: the borderless scene region that replaces every old card.
//
// A scope is a transparent region of the one continuous surface, delineated
// only by a hairline edge, four corner ticks and a small caption
// (`4_CKS / CTX` style title + eyebrow + right-slot readout). No fill, no
// shadow, no radius. When its data source is absent (`ghosted`) it stays in
// the layout: caption intact, brackets dimmed, body showing a "no source"
// state, so the rest of the scene is unaffected.

function CornerTicks({ dim = false }) {
  const base = `scope-tick ${dim ? 'scope-tick-dim' : ''}`
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      <i className={`${base} left-0 top-0 border-l border-t`} />
      <i className={`${base} right-0 top-0 border-r border-t`} />
      <i className={`${base} bottom-0 left-0 border-b border-l`} />
      <i className={`${base} bottom-0 right-0 border-b border-r`} />
    </span>
  )
}

export default function Scope({
  id,
  title,
  eyebrow,
  right,
  accent = 'acc',
  ghosted = false,
  ghostNote,
  className = '',
  bodyClassName = '',
  children,
}) {
  const tone = accent === 'col' ? 'text-col' : accent === 'dat' ? 'text-dat' : accent === 'alm' ? 'text-alm' : 'text-acc'
  return (
    <section
      id={id}
      aria-label={title}
      aria-busy={ghosted || undefined}
      className={`scope relative flex min-h-0 min-w-0 flex-col transition-[opacity,filter] duration-500 ${
        ghosted ? 'scope-ghost' : ''
      } ${className}`}
    >
      <CornerTicks dim={ghosted} />
      <header className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 pt-2">
        <span className="micro hidden sm:inline">{eyebrow}</span>
        <h2 className={`label-eyebrow truncate ${tone}`}>{title}</h2>
        {right != null ? <span className="micro ml-auto truncate tabular-nums">{right}</span> : null}
        {ghosted ? (
          <span className="micro text-ink-3">{ghostNote || 'no source'}</span>
        ) : null}
      </header>
      <div className={`relative flex min-h-0 flex-1 flex-col px-3 pb-2 pt-1.5 ${bodyClassName}`}>{children}</div>
    </section>
  )
}

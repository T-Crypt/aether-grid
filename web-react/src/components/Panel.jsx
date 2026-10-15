import { motion } from 'framer-motion'

const ACCENT_VAR = { acc: '--acc', dat: '--dat', col: '--col' }

/** Four glowing L-marks at the corners: the FUI grammar, at hairline weight. */
export function Brackets({ color = 'rgb(var(--acc) / 0.55)' }) {
  const base = 'absolute h-3 w-3 border-current'
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-10" style={{ color }}>
      <i className={`${base} left-0 top-0 border-l border-t`} />
      <i className={`${base} right-0 top-0 border-r border-t`} />
      <i className={`${base} bottom-0 left-0 border-b border-l`} />
      <i className={`${base} bottom-0 right-0 border-b border-r`} />
    </span>
  )
}

/**
 * Frosted diagnostic panel. `stagger` feeds the entrance choreography so the
 * deck assembles top-to-bottom instead of popping in as one block.
 */
export default function Panel({
  title,
  eyebrow,
  right,
  icon: Icon,
  accent = 'acc',
  stagger = 0,
  className = '',
  bodyClassName = '',
  children,
}) {
  const accentColor = `rgb(var(${ACCENT_VAR[accent] || '--acc'}))`
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: stagger }}
      className={`glass group relative flex min-w-0 flex-col rounded-md transition-colors duration-300 hover:border-acc/30 ${className}`}
    >
      <Brackets color={accentColor} />
      <header className="flex items-center justify-between gap-3 px-4 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          {Icon ? <Icon size={13} style={{ color: accentColor }} className="shrink-0" aria-hidden="true" /> : null}
          <h2 className="label-eyebrow truncate" style={{ color: accentColor }}>
            {title}
          </h2>
          {eyebrow ? <span className="micro hidden truncate sm:inline">{eyebrow}</span> : null}
        </div>
        {right ? <span className="micro shrink-0 tabular-nums">{right}</span> : null}
      </header>
      <div className={`flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3 ${bodyClassName}`}>{children}</div>
    </motion.section>
  )
}

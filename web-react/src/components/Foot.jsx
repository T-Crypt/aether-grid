export default function Foot({ snap }) {
  const engines = snap.engines || []
  return (
    <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-acc/10 pt-3 text-2xs text-ink-3">
      <span>
        AETHER GRID · <span className="text-acc">CONSOLE</span> · REACT BUILD
      </span>
      <span className="tabular-nums">
        FEED {snap.feed} · ENG {engines.filter((e) => e.up).length}/{engines.length} ·{' '}
        <span className="text-ink-2">SEEDED SIMULATOR · 1 HZ</span>
      </span>
    </footer>
  )
}

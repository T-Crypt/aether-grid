import { useScene } from '../scene/SceneRoot'

export default function Foot() {
  const { snap } = useScene()
  const engines = snap.engines || []
  return (
    <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-acc/10 pt-2.5 text-2xs text-ink-3">
      <span>
        AETHER GRID · <span className="text-acc">CONSOLE</span> · REACT BUILD
      </span>
      <span className="tabular-nums">
        FEED {snap.feed} · ENG {engines.filter((e) => e.up).length}/{engines.length} ·{' '}
        <span className="text-ink-2">
          {snap.mode === 'demo' ? 'SEEDED SIMULATOR' : 'COLLECTOR FEED'} · {snap.feed === 'poll' ? '0.5' : '1'} HZ
        </span>
      </span>
    </footer>
  )
}

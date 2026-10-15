// Static texture base under everything: grid lines, skin-tint washes,
// vignette, scanlines, film grain. The state-reactive wash is the
// Declination canvas above this layer.

export default function Atmosphere() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="grid-lines absolute inset-0 opacity-60" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 12% -10%, rgb(var(--acc) / 0.07) 0%, transparent 55%),' +
            'radial-gradient(90% 70% at 100% 0%, rgb(var(--col) / 0.05) 0%, transparent 60%),' +
            'radial-gradient(140% 120% at 50% 120%, rgb(var(--acc) / 0.05) 0%, transparent 60%)',
        }}
      />
      <div className="scene-warm absolute inset-0" />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.5) 100%)' }}
      />
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(0,0,0,0.35) 2px, rgba(0,0,0,0.35) 3px)',
        }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-[0.035] mix-blend-overlay">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  )
}

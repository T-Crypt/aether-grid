// The seven Aether Grid skins. Token values mirror the palette in src/index.css.
//
// `palette` mirrors the CSS custom properties in src/index.css as
// space-separated RGB channels. The CSS is what Tailwind classes read; this
// copy is what the <canvas> painters read, because getComputedStyle() inside a
// paint loop would be far too expensive. Change one, change the other.

export const SKINS = [
  {
    id: 'hexlab',
    label: 'Hex-Lab',
    accent: '#00e0e0',
    palette: { acc: '0 224 224', dat: '240 220 80', col: '255 64 192', alm: '255 71 78' },
  },
  {
    id: 'aether',
    label: 'Aether',
    accent: '#8f7bff',
    palette: { acc: '143 123 255', dat: '111 231 173', col: '255 92 138' , alm: '255 71 78' },
  },
  {
    id: 'braid',
    label: 'The Braid',
    accent: '#b7f0e1',
    palette: { acc: '183 240 225', dat: '255 209 102', col: '255 143 107' , alm: '255 71 78' },
  },
  {
    id: 'isodose',
    label: 'IsoDose',
    accent: '#ff5a4a',
    palette: { acc: '255 90 74', dat: '255 197 92', col: '89 195 255' , alm: '255 71 78' },
  },
  {
    id: 'corvane',
    label: 'Corvane',
    accent: '#59c3ff',
    palette: { acc: '89 195 255', dat: '111 231 173', col: '255 92 138' , alm: '255 71 78' },
  },
  {
    id: 'sounding',
    label: 'Sounding',
    accent: '#ffb000',
    palette: { acc: '255 176 0', dat: '111 231 173', col: '89 195 255' , alm: '255 71 78' },
  },
  {
    id: 'gullet',
    label: 'Gullet',
    accent: '#7cff6b',
    palette: { acc: '124 255 107', dat: '89 195 255', col: '255 92 138' , alm: '255 71 78' },
  },
]

export const SKIN_IDS = SKINS.map((s) => s.id)
export const DEFAULT_SKIN = 'hexlab'

export function skinById(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0]
}

const FAVICON = (hex) =>
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M4 25H28' stroke='%23647294' stroke-width='1.5' stroke-linecap='round'/%3E%3Cpath d='M6 10.5A13.5 13.5 0 0 1 26 10.5' fill='none' stroke='%23" +
  hex +
  "' stroke-width='1.5' stroke-linecap='round' opacity='.55'/%3E%3Cpath d='M9.5 14.5A9 9 0 0 1 22.5 14.5' fill='none' stroke='%23" +
  hex +
  "' stroke-width='2' stroke-linecap='round'/%3E%3Ccircle cx='16' cy='19' r='3' fill='%23" +
  hex +
  "'/%3E%3C/svg%3E"

export function faviconFor(id) {
  return FAVICON(skinById(id).accent.slice(1))
}

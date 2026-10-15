// The scene registry. Pure data, no component imports, so both SceneRoot and
// main.jsx can read it without a cycle.
//
// A scene is a complete visual program for the same telemetry: its Root
// component (registered in App.jsx), its label, its default scheme, the base
// schemes it offers, and an optional per-scheme palette table for the canvas
// painters. A scheme missing from a scene's table falls back to the base skin
// table in lib/skins.js, so no scene/scheme pair can resolve broken.
//
// The DOM tokens (pan, bgg, text tiers) resolve in src/index.css through
// [data-scene][data-skin] blocks on <html>; this table mirrors only the
// canvas channels (acc, dat, col, alm) painters read off conductor.palette.

import { SKIN_IDS, skinById } from './skins'

export const SCENES = [
  {
    id: 'hexlab',
    label: 'Hex-Lab',
    defaultScheme: 'hexlab',
    schemes: SKIN_IDS,
    palettes: {}, // empty: every base scheme applies to hex-lab as-is
  },
  {
    // Reference palette (uispace.org/safehouse): sky-cyan accent #50C0E0,
    // data amber #FFC850, cool white #FFFFFF, alarm #FF4830. Corvane's base
    // accent (#59C3FF) is the closest base scheme, so it carries the native
    // table; the other six keep their base role colours on the scene surfaces.
    id: 'safehouse',
    label: 'Safehouse',
    defaultScheme: 'corvane',
    schemes: SKIN_IDS,
    palettes: {
      corvane: { acc: '80 192 224', dat: '255 200 80', col: '255 255 255', alm: '255 72 48' },
    },
  },
  {
    // Reference palette (uispace.org/bloom-line): leaf-green accent #6BE8A4,
    // grow-light amber #F0C060, cool #7DD8C4, soft-pink alarm #F09BAA. Gullet's
    // base accent (#7CFF6B) is the closest base scheme, so it carries the
    // native table; the other six keep their base role colours on the scene's
    // leaf-green surfaces.
    id: 'bloom-line',
    label: 'Bloom-Line',
    defaultScheme: 'gullet',
    schemes: SKIN_IDS,
    palettes: {
      gullet: { acc: '107 232 164', dat: '240 192 96', col: '125 216 196', alm: '240 155 170' },
    },
  },
  {
    // Reference palette (uispace.org/cyber-pass): lamp amber #FFAD3B, data
    // cream #FFD99F, cool violet #A87BFF, held alarm #FFDC2B. Sounding's base
    // accent (#FFB000) is the closest base scheme, so it carries the native
    // table; the other six keep their base role colours on the scene's
    // rust-plate surfaces.
    id: 'cyber-pass',
    label: 'Cyber-Pass',
    defaultScheme: 'sounding',
    schemes: SKIN_IDS,
    palettes: {
      sounding: { acc: '255 173 59', dat: '255 217 159', col: '168 123 255', alm: '255 220 43' },
    },
  },
  {
    // Reference palette (deepsignal card): teal accent #7DB8C4, data green
    // #5BE872, amber #FFB000, alarm coral #E8543F. Hexlab's cool base is the
    // closest base scheme, so it carries the native table; the other six
    // keep their base role colours on the scene's CRT surfaces.
    id: 'deepsignal',
    label: 'Deepsignal',
    defaultScheme: 'hexlab',
    schemes: SKIN_IDS,
    palettes: {
      hexlab: { acc: '125 184 196', dat: '91 232 114', col: '255 176 0', alm: '232 84 63' },
    },
  },
]

export const SCENE_IDS = SCENES.map((s) => s.id)
export const DEFAULT_SCENE = 'hexlab'

export function sceneById(id) {
  return SCENES.find((s) => s.id === id) || SCENES[0]
}

// Palette channels ("R G B" strings) for one scene/scheme pair.
export function resolvePalette(sceneId, schemeId) {
  const scene = sceneById(sceneId)
  if (scene.palettes[schemeId]) return scene.palettes[schemeId]
  return skinById(schemeId).palette
}

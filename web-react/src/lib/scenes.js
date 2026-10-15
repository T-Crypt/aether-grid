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

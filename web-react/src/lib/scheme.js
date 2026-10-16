// Scene and scheme persistence, in one place.
//
// The boot path (main.jsx) and the scene switch (SceneRoot) must agree on
// three things: where the choice is stored, which stored value wins, and what
// a scene falls back to. They used to implement that twice, so a reload and a
// scene switch could land on different schemes. Both call in here.
//
// The rules, in order:
//   1. the scheme last chosen in this scene
//   2. for the base scene only, the legacy global key, so skins chosen before
//      scenes existed still apply
//   3. the scene's native default scheme from the registry

import { DEFAULT_SCENE, SCENE_IDS, sceneById } from './scenes'
import { SKIN_IDS } from './skins'

export const SCENE_KEY = 'aether.console.scene'
export const SKIN_KEY = 'aether.console.skin'

function read(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null // storage blocked: fall through to the default
  }
}

// The scene to boot into when the URL does not name one.
export function savedScene() {
  const saved = read(SCENE_KEY)
  return saved && SCENE_IDS.includes(saved) ? saved : DEFAULT_SCENE
}

// The scheme a scene opens on.
export function schemeForScene(scene) {
  const perScene = read(SKIN_KEY + '.' + scene)
  if (perScene && SKIN_IDS.includes(perScene)) return perScene
  if (scene === DEFAULT_SCENE) {
    const legacy = read(SKIN_KEY)
    if (legacy && SKIN_IDS.includes(legacy)) return legacy
  }
  return sceneById(scene).defaultScheme
}

// Remember the live scene and its scheme. The base scene also writes the
// legacy global key, which is what a pre-scenes install reads.
export function rememberScene(scene, skin) {
  try {
    localStorage.setItem(SCENE_KEY, scene)
    localStorage.setItem(SKIN_KEY + '.' + scene, skin)
    if (scene === DEFAULT_SCENE) localStorage.setItem(SKIN_KEY, skin)
  } catch {
    /* storage blocked: the choice lasts this session only */
  }
}

/**
 * SpriteAnimComponent.js
 * Pure component for 8-direction spritesheet animation state.
 * Actions:
 *   0: Stand/Idle, 1: Walk, 2: Run, 3: Physical Attack,
 *   4: Dead, 5: Hurt, 6: Block, 7: Magic Cast
 */
export function createSpriteAnimComponent(visualDef) {
  return {
    atlasPath: visualDef.atlas_path,
    thumbPath: visualDef.thumb_path,
    vfxId: visualDef.vfx_id || '10008',
    skillIcon: visualDef.skill_icon,
    anchor: visualDef.anchor || [0.5, 0.9],
    feetY: visualDef.feet_y || 100,
    action: 0,
    frameIdx: 0,
    frameTimer: 0,
    frameDuration: 0.085,
    loop: true,
    returnAction: 0
  };
}

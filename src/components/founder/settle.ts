// Easing by wall-clock time, for animations that must land however slow the
// frames are. The kit's approach() clamps each step to 1/30 s, which keeps a
// transition smooth after an idle stretch but stretches it to many seconds on a
// slow GPU — long enough to outlast the ambient window and freeze half-drawn.
// settle() caps a step at a quarter second instead, so a draw-in that takes
// ~2 s at 60 fps still takes ~2 s at 4 fps. Pair it with invalidate() until the
// value reaches its target; it snaps there, so the loop ends.

const MAX_STEP = 0.25;

export function settle(current: number, target: number, delta: number, still: boolean, smoothTime = 0.6): number {
  if (still) return target;
  const dt = Math.min(delta, MAX_STEP);
  const k = 1 - Math.exp(-dt / Math.max(0.0001, smoothTime / 4));
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 1e-3 * Math.max(1, Math.abs(target)) ? target : next;
}

// Easing for the Partner and Impact scenes' numbers. The shared kit's
// approach() caps each step at 1/30 s, so on a slow GPU (a few frames a
// second) a transition can outlast the ambient window and freeze half-way,
// with blocks that no longer match the legend. Here the cap is generous
// enough to keep wall-clock timing on slow devices, and useSettle keeps the
// scene drawing until every eased value has reached its data.

import { useMotion } from "@/components/three/SceneCanvas";

/** Largest step per frame: enough for ~8 fps to keep real time, small enough that a long idle doesn't jump. */
const STEP_CAP = 0.12;

export function ease(current: number, target: number, delta: number, still: boolean, smoothTime = 0.5): number {
  if (still) return target;
  const dt = Math.min(delta, STEP_CAP);
  const k = 1 - Math.exp(-dt / Math.max(1e-4, smoothTime / 4));
  const next = current + (target - current) * k;
  return Math.abs(target - next) < Math.max(1e-3, Math.abs(target) * 1e-3) ? target : next;
}

/** Call with each eased value and its target inside useFrame: the scene keeps drawing until they match. */
export function useSettle() {
  const { kick, still } = useMotion();
  return (current: number, target: number) => {
    if (!still && current !== target) kick(0.3);
  };
}

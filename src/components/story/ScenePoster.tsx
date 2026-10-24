// The same picture as the WebGL scene, projected in plain TypeScript and drawn
// as SVG: the fallback when WebGL is missing or lost, the reduced-motion still,
// and the closing image. No three.js is loaded for it.

import { useMemo } from "react";
import { firstMile, MODE_COLORS, others, ridgelines, SHOTS, shotsFor, SUN_DIR, type Vec3 } from "./terrain";

const W = 1600;
const H = 900;

function project(shot: (typeof SHOTS)[number]) {
  const [px, py, pz] = shot.position;
  const [tx, ty, tz] = shot.target;
  let fx = tx - px;
  let fy = ty - py;
  let fz = tz - pz;
  const fl = Math.hypot(fx, fy, fz);
  fx /= fl;
  fy /= fl;
  fz /= fl;
  // right = forward × up(0,1,0)
  let rx = -fz;
  let rz = fx;
  const rl = Math.hypot(rx, rz);
  rx /= rl;
  rz /= rl;
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;
  const f = 1 / Math.tan(((shot.fov * Math.PI) / 180) / 2);
  return (p: Vec3): [number, number, number] | null => {
    const dx = p[0] - px;
    const dy = p[1] - py;
    const dz = p[2] - pz;
    const z = dx * fx + dy * fy + dz * fz;
    if (z < 0.2) return null;
    const x = (dx * rx + dz * rz) / z;
    const y = (dx * ux + dy * uy + dz * uz) / z;
    return [W / 2 + (x * f * H) / 2, H / 2 - (y * f * H) / 2, z];
  };
}

function path(points: Vec3[], proj: ReturnType<typeof project>): string {
  let d = "";
  let pen = false;
  for (const p of points) {
    const s = proj(p);
    if (!s) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${s[0].toFixed(1)},${s[1].toFixed(1)}`;
    pen = true;
  }
  return d;
}

export function ScenePoster({ beat = 3, className, portrait = false, label = "One warm line among many, meeting at a start line at dawn." }: { beat?: number; className?: string; portrait?: boolean; label?: string }) {
  const art = useMemo(() => {
    const shot = shotsFor(portrait)[Math.min(beat, SHOTS.length - 1)]!;
    const proj = project(shot);
    // The sun is at infinity: project a point far along its direction from the camera.
    const far: Vec3 = [shot.position[0] + SUN_DIR[0] * 1000, shot.position[1] + SUN_DIR[1] * 1000, shot.position[2] + SUN_DIR[2] * 1000];
    return {
      sun: proj(far),
      ridges: ridgelines(30, 90).map((row) => path(row, proj)),
      crowd: beat >= 2 ? others(30).map((o) => ({ d: path(o.points, proj), color: MODE_COLORS[o.mode] })) : [],
      main: path(beat === 0 ? firstMile().slice(0, 68) : firstMile(), proj),
    };
  }, [beat, portrait]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={label}>
      <defs>
        <radialGradient id="poster-sun">
          <stop offset="0" stopColor="#fff1d6" stopOpacity="1" />
          <stop offset="0.08" stopColor="#ffd59a" stopOpacity="0.95" />
          <stop offset="0.3" stopColor="#f3a14b" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f3812b" stopOpacity="0" />
        </radialGradient>
        <filter id="poster-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {art.sun ? <circle cx={art.sun[0]} cy={art.sun[1]} r={420} fill="url(#poster-sun)" /> : null}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {art.ridges.map((d, i) => (
          <path key={i} d={d} stroke="#8a7a86" strokeOpacity={0.16 + (i / art.ridges.length) * 0.12} strokeWidth={1} />
        ))}
        {art.crowd.map((c, i) => (
          <path key={i} d={c.d} stroke={c.color} strokeOpacity={0.85} strokeWidth={2} />
        ))}
        <path d={art.main} stroke="#f7963f" strokeWidth={4.5} filter="url(#poster-glow)" />
      </g>
    </svg>
  );
}

"use client";

// The dark stage the Partner and Impact scenes stand on: an ember-black floor
// that fades into the page, a faint measuring grid, and a warm pool of light
// under the subject — so the money reads as light in the dark, the way the
// rest of the Afterglow pages glow.

import { Grid } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

/** A soft radial glow, drawn once to a small canvas. */
function glowTexture(color: string, strength: number) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const c = new THREE.Color(color);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  g.addColorStop(0, `rgba(${rgb},${strength})`);
  g.addColorStop(0.45, `rgba(${rgb},${strength * 0.35})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function EmberFloor({ y, center = [0, 0], radius = 11, glow = "#ff6a13", strength = 0.1 }: { y: number; center?: [number, number]; radius?: number; glow?: string; strength?: number }) {
  const texture = useMemo(() => glowTexture(glow, strength), [glow, strength]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={y} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#0f0905" roughness={0.62} metalness={0.25} />
      </mesh>
      <Grid
        position={[center[0], y + 0.004, center[1]]}
        args={[60, 60]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#170f09"
        sectionSize={5}
        sectionThickness={0.9}
        sectionColor="#2e1b10"
        fadeDistance={30}
        fadeStrength={2}
        infiniteGrid
      />
      <mesh rotation-x={-Math.PI / 2} position={[center[0], y + 0.008, center[1]]}>
        <planeGeometry args={[radius * 2, radius * 2]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

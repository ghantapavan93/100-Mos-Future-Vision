"use client";

// A text pill that lives in the scene: drawn once to a canvas texture (at the
// device's pixel ratio, in the page's own font) and shown as a sprite that
// keeps the same size on screen at any distance. No DOM portals, so no extra
// React roots to mount and unmount behind the scene's back.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/** Scratch vector for reading a label's parent scale each frame, without allocating. */
const WORLD_SCALE = new THREE.Vector3();

const FONT = "'Atkinson Hyperlegible Next Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif";
const NUM_FONT = "'FL Digits', 'Atkinson Hyperlegible Next Variable', system-ui, sans-serif";

export interface LabelProps {
  text: string;
  /** Smaller second part, after a dot (a count, a status). */
  detail?: string;
  position: [number, number, number];
  /** Label height on screen, in CSS pixels. */
  px?: number;
  background?: string;
  color?: string;
  /** Draw on top of everything (a label shouldn't hide behind the thing it names). */
  onTop?: boolean;
}

function draw(text: string, detail: string | undefined, background: string, color: string, dpr: number) {
  const size = 26 * dpr;
  const padX = 14 * dpr;
  const height = 44 * dpr;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const main = `600 ${size}px ${FONT}`;
  const sub = `400 ${size * 0.92}px ${NUM_FONT}`;
  ctx.font = main;
  const w1 = ctx.measureText(text).width;
  ctx.font = sub;
  const tail = detail ? ` · ${detail}` : "";
  const w2 = tail ? ctx.measureText(tail).width : 0;
  canvas.width = Math.ceil(w1 + w2 + padX * 2);
  canvas.height = height;
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, height / 2);
  ctx.fill();
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.font = main;
  ctx.fillText(text, padX, height / 2 + dpr);
  if (tail) {
    ctx.globalAlpha = 0.72;
    ctx.font = sub;
    ctx.fillText(tail, padX + w1, height / 2 + dpr);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, aspect: canvas.width / canvas.height };
}

export function Label({ text, detail, position, px = 30, background = "rgba(18,16,14,0.86)", color = "#f7f2ea", onTop = true }: LabelProps) {
  const { size, camera, invalidate } = useThree();
  // Already loaded on most visits: start true so the label isn't drawn twice (a second, late frame).
  const [fontsReady, setFontsReady] = useState(() => typeof document !== "undefined" && document.fonts.status === "loaded");
  useEffect(() => {
    if (fontsReady) return;
    let live = true;
    void document.fonts.ready.then(() => live && setFontsReady(true));
    return () => {
      live = false;
    };
  }, []);
  const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  const { texture, aspect } = useMemo(() => draw(text, detail, background, color, dpr), [text, detail, background, color, dpr, fontsReady]);
  useEffect(() => {
    invalidate();
    return () => texture.dispose();
  }, [texture, invalidate]);

  // With size attenuation off, a sprite's scale is in units of "height at distance 1". Scenes change
  // the lens in their own frame loops, so the size follows the camera every frame, not just at render.
  const sprite = useRef<THREE.Sprite>(null);
  useFrame(() => {
    const s = sprite.current;
    if (!s) return;
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 40;
    const unit = (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2))) / Math.max(1, size.height);
    // A floor, so label text never drops below about 10–11 px on screen, even inside a scaled-down
    // group. A group still growing in from nothing (under 0.2) keeps its own size, never a giant label.
    const parent = s.parent ? s.parent.getWorldScale(WORLD_SCALE).y : 1;
    const floor = (size.width < 600 ? 17 : 19) * unit;
    const h = parent >= 0.2 ? Math.max(px * unit, floor / parent) : px * unit;
    s.scale.set(h * aspect, h, 1);
  });
  return (
    <sprite ref={sprite} position={position} renderOrder={onTop ? 10 : 0}>
      <spriteMaterial map={texture} sizeAttenuation={false} transparent depthTest={!onTop} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

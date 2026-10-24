"use client";

// "Who says?": every tip the coach may draw on hangs in a grid (the caller
// orders them: Kayla's lessons first, help lines last). Each card reads at a
// glance: a band and a mark in its kind's colour (a tick for ready, a clock for
// waiting on someone's OK, a cross for a help line) and a few big words; the
// legend beside the scene carries the longer words. When a member asks, the
// tips the answer uses come forward, glow, and send a thread to the answer. An
// urgent or referral answer brings the help lines to the front and lets
// everything else fade.
//
// A dark reading room: the cards are smoked glass printed in light type, lit by
// a warm key and a cool rim, and the only bright things are what the answer
// actually stands on.

import { ContactShadows, Line, RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { CardStatus, Safety } from "@/domain/quantum/types";
import { Label } from "@/components/three/Label";
import { LIGHT } from "@/components/three/palette";
import { Composition, MAX_DT, SceneCanvas, approach, glowColor, useKickOn, useLiveClock, useMotion, usePortrait } from "@/components/three/SceneCanvas";
import type { StageProps } from "@/components/three/Stage";
import { STATUS_COLOR, type CoachCard, type CoachSceneProps } from "./colors";

export type { CoachCard, CoachSceneProps } from "./colors";

const P = LIGHT.day;

/**
 * The few words each card shows on the wall. The full title is what "Who says?"
 * shows on the phone; a card missing here prints its full title.
 */
const WALL_TITLE: Record<string, string> = {
  "pag-some": "Some beats none",
  "pag-weekly": "The weekly picture",
  "pag-gradual": "Build up gradually",
  "screen-symptoms": "Stop and get care",
  heat: "Hot days",
  lifeline: "988 crisis line",
  care: "Who to ask about pain",
  "lesson-start": "Start where you are",
  "lesson-grace": "A gap erases nothing",
  "lesson-pace": "Every pace counts",
  "lesson-together": "Find your people",
  "lesson-rest": "Rest days count",
  "rule-race-ladder": "One rung at a time",
};

/** The mark in each card's corner: ready to use, waiting on someone's OK, or a help line. */
const MARK: Record<CardStatus, "tick" | "clock" | "cross"> = {
  "public-guideline": "tick",
  "proposed-lesson": "clock",
  "proposed-rule": "clock",
  resource: "cross",
};
const SAFETY_COLOR: Record<Safety, string> = { ok: P.accent, support: "#ffc14d", refer: "#ff8a3d", urgent: "#ff4a3a" };
const DISPLAY = "'Inter Variable', 'Inter', system-ui, sans-serif";

const CARD_W = 1.8;
const CARD_H = 1.2;

// ── Card faces: printed once to a canvas, in the page's own fonts ─────────────

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function mark(ctx: CanvasRenderingContext2D, kind: (typeof MARK)[CardStatus], color: string, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = `${color}2e`;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "tick") {
    ctx.moveTo(x - r * 0.45, y + r * 0.02);
    ctx.lineTo(x - r * 0.1, y + r * 0.36);
    ctx.lineTo(x + r * 0.48, y - r * 0.32);
  } else if (kind === "clock") {
    ctx.moveTo(x, y - r * 0.52);
    ctx.lineTo(x, y);
    ctx.lineTo(x + r * 0.4, y + r * 0.22);
  } else {
    ctx.moveTo(x, y - r * 0.5);
    ctx.lineTo(x, y + r * 0.5);
    ctx.moveTo(x - r * 0.5, y);
    ctx.lineTo(x + r * 0.5, y);
  }
  ctx.stroke();
}

function face(card: CoachCard): THREE.CanvasTexture {
  const W = 600;
  const H = 400;
  const PAD = 38;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const color = STATUS_COLOR[card.status];
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#241f1b");
  bg.addColorStop(1, "#141210");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, 20);
  mark(ctx, MARK[card.status], color, PAD + 30, 20 + PAD + 22, 30);
  // The biggest type that fits the space under the mark: two lines for most cards, three at most.
  const words = WALL_TITLE[card.id] ?? card.title;
  const top = 20 + PAD + 22 + 30 + 26;
  const room = H - top - PAD + 8;
  let size = 104;
  let lines: string[] = [];
  for (; size >= 58; size -= 4) {
    ctx.font = `800 ${size}px ${DISPLAY}`;
    lines = wrap(ctx, words, W - PAD * 2);
    if (lines.length <= 3 && lines.length * size * 1.04 <= room && lines.every((l) => ctx.measureText(l).width <= W - PAD * 2)) break;
  }
  ctx.fillStyle = "#f7f2ea";
  ctx.textBaseline = "alphabetic";
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, PAD, top + size * 0.8 + i * size * 1.04));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ── Layout ───────────────────────────────────────────────────────────────────

/**
 * Where things sit. On wide screens the hero's words cover the left of the
 * canvas, so the cards stand in a grid on the right with the answer just left
 * of its top row. Portrait screens put the answer above the grid.
 */
interface Frame {
  cols: number;
  gridX: number;
  top: number;
  orb: THREE.Vector3;
  /** How large the crisis and care cards grow when they step forward. */
  alarmScale: number;
}

function frameFor(portrait: boolean): Frame {
  return portrait
    ? { cols: 4, gridX: 0, top: 2.7, orb: new THREE.Vector3(0, 4.25, 0.8), alarmScale: 1.9 }
    : // Three columns, so the wall fits beside the headline; the orb waits above the headline's end, not on it.
      { cols: 3, gridX: 1.25, top: 4.0, orb: new THREE.Vector3(-2.55, 3.55, 0.9), alarmScale: 1.25 };
}

interface Pose {
  pos: THREE.Vector3;
  scale: number;
  dim: number;
}

const ROW = CARD_H + 0.22;
const COL = CARD_W + 0.24;

/** Where every card rests, comes forward, or steps aside, for the current answer. */
function layout(cards: CoachCard[], cited: string[], safety: Safety | null, f: Frame, portrait: boolean): Record<string, Pose> {
  const out: Record<string, Pose> = {};
  const alarm = safety === "urgent" || safety === "refer";
  const resources = cited.filter((id) => cards.find((x) => x.id === id)?.status === "resource");
  const rows = Math.ceil(cards.length / f.cols);
  cards.forEach((c, i) => {
    const col = i % f.cols;
    const row = Math.floor(i / f.cols);
    const off = col - (f.cols - 1) / 2;
    const rest = new THREE.Vector3(f.gridX + off * COL, f.top - row * ROW, -0.15 * Math.abs(off));
    if (cited.includes(c.id)) {
      if (alarm && c.status === "resource") {
        // The crisis and care lines step out in front of everything, side by side, over the middle
        // of the grid (on phones, low enough that the answer's light above stays in view).
        const j = resources.indexOf(c.id);
        out[c.id] = { pos: new THREE.Vector3(f.gridX + (j - (resources.length - 1) / 2) * (CARD_W * f.alarmScale + 0.2), portrait ? f.top - ROW : f.top - ((rows - 1) * ROW) / 2, 2.4), scale: f.alarmScale, dim: 1 };
      } else out[c.id] = { pos: rest.clone().add(new THREE.Vector3(0, 0, 1.1)), scale: 1.06, dim: alarm ? 0.5 : 1 };
    } else out[c.id] = { pos: rest, scale: 1, dim: cited.length ? (alarm ? 0.14 : 0.24) : 0.96 };
  });
  return out;
}

function Card({ card, pose, cited }: { card: CoachCard; pose: Pose; cited: boolean }) {
  const { still } = useMotion();
  const liveClock = useLiveClock();
  const group = useRef<THREE.Group>(null);
  const paper = useRef<THREE.MeshStandardMaterial>(null);
  const print = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const [fontsReady, setFontsReady] = useState(() => typeof document !== "undefined" && document.fonts.status === "loaded");
  useEffect(() => {
    if (fontsReady) return;
    let live = true;
    void document.fonts.ready.then(() => live && setFontsReady(true));
    return () => {
      live = false;
    };
  }, [fontsReady]);
  // Redrawn once the page's fonts have loaded, so the print uses Inter, not a fallback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const texture = useMemo(() => face(card), [card, fontsReady]);
  useEffect(() => () => texture.dispose(), [texture]);
  const glow = useMemo(() => glowColor(STATUS_COLOR[card.status], 2), [card.status]);
  const seed = useMemo(() => [...card.id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 17, [card.id]);

  // Where the card is travelling to, without the bob: the bob rides on top, so the travel can land
  // (an approach toward a target that never stops moving would keep the scene drawing forever).
  const base = useRef(pose.pos.clone());
  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, MAX_DT);
    // Zero at the moment the scene goes live, whatever the card's own phase.
    const t = liveClock(state.clock.elapsedTime);
    const bob = still ? 0 : (Math.sin(t * 0.9 + seed) - Math.sin(seed)) * 0.035;
    const b = base.current;
    b.set(approach(b.x, pose.pos.x, dt, still, 0.7), approach(b.y, pose.pos.y, dt, still, 0.7), approach(b.z, pose.pos.z, dt, still, 0.7));
    g.position.set(b.x, b.y + bob, b.z);
    g.scale.setScalar(approach(g.scale.x, pose.scale, dt, still, 0.7));
    // A slight turn toward the middle, so the wall of cards reads as gently curved.
    g.rotation.y = -g.position.x * 0.035;
    const o = approach(print.current?.opacity ?? 1, pose.dim, dt, still, 0.6);
    if (print.current) print.current.opacity = o;
    if (paper.current) paper.current.opacity = o;
    if (halo.current) halo.current.opacity = approach(halo.current.opacity, cited ? 1 : 0, dt, still, 0.6);
  });

  return (
    <group ref={group} position={pose.pos.toArray()}>
      {/* A lit frame behind a cited card: it blooms in the card's colour. */}
      <mesh position-z={-0.04}>
        <planeGeometry args={[CARD_W + 0.14, CARD_H + 0.14]} />
        <meshBasicMaterial ref={halo} color={glow} toneMapped={false} transparent opacity={0} depthWrite={false} />
      </mesh>
      <RoundedBox args={[CARD_W, CARD_H, 0.06]} radius={0.04} smoothness={3}>
        <meshStandardMaterial ref={paper} color="#1d1a17" roughness={0.38} metalness={0.25} transparent />
      </RoundedBox>
      <mesh position-z={0.032}>
        <planeGeometry args={[CARD_W - 0.04, CARD_H - 0.04]} />
        <meshBasicMaterial ref={print} map={texture} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function Orb({ at, safety, topic, portrait }: { at: THREE.Vector3; safety: Safety | null; topic: string | null; portrait: boolean }) {
  const { still } = useMotion();
  const live = useLiveClock();
  const core = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const color = safety ? SAFETY_COLOR[safety] : "#f2b544";
  // Below the bloom threshold until there is an answer to light it.
  const glow = useMemo(() => glowColor(color, safety ? 2.2 : 0.55), [color, safety]);
  useFrame((state) => {
    const t = live(state.clock.elapsedTime);
    if (core.current) core.current.scale.setScalar(still || !safety ? 1 : 1 + Math.sin(t * 2.4) * 0.05);
    if (shell.current && !still) shell.current.rotation.y = t * 0.25;
  });
  return (
    <group position={at}>
      <mesh ref={core}>
        <sphereGeometry args={[0.36, 40, 30]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      {/* A glassy shell around the light. */}
      <mesh ref={shell}>
        <icosahedronGeometry args={[0.7, 3]} />
        <meshPhysicalMaterial color="#d9cfc2" roughness={0.1} metalness={0.1} transparent opacity={0.18} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      <pointLight color={color} intensity={safety ? 5 : 0.8} distance={7} decay={2} />
      {/* Above the light: on wide screens it sits above the headline's end, on phones above the cards. */}
      <Label text={topic ?? "Nothing asked yet"} detail={topic ? "the answer" : undefined} position={[0, 1.08, 0]} px={portrait ? 18 : 22} background="rgba(18,16,14,0.9)" color="#f7f2ea" />
    </group>
  );
}

function Threads({ cards, cited, poses, f }: { cards: CoachCard[]; cited: string[]; poses: Record<string, Pose>; f: Frame }) {
  const lines = useMemo(
    () =>
      cited
        .map((id) => cards.find((c) => c.id === id))
        .filter((c): c is CoachCard => Boolean(c))
        .map((c) => {
          const pose = poses[c.id]!;
          const p = pose.pos.clone();
          // Leave the card from the edge that faces the answer, so the thread never crosses the print.
          if (f.orb.y > p.y + CARD_H) p.y += (CARD_H * pose.scale) / 2;
          else p.x -= (CARD_W * pose.scale) / 2;
          const mid = p.clone().lerp(f.orb, 0.5);
          mid.z += 0.9;
          return { id: c.id, color: glowColor(STATUS_COLOR[c.status], 1.6), points: [p.toArray(), mid.toArray(), f.orb.toArray()] as [number, number, number][] };
        }),
    [cards, cited, poses, f],
  );
  return (
    <>
      {lines.map((l) => (
        <Line key={l.id} points={l.points} color={l.color} lineWidth={2.4} transparent opacity={0.9} toneMapped={false} />
      ))}
    </>
  );
}

/** Half the width the portrait layout needs on screen, in world units. */
const PORTRAIT_HALF_WIDTH = 4.5;

function Rig() {
  const { camera, size } = useThree();
  const { still, pointer } = useMotion();
  const portrait = usePortrait();
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const dt = Math.min(delta, MAX_DT);
    const px = still ? 0 : pointer.current.x * 0.7;
    const py = still ? 0 : pointer.current.y * 0.3;
    look.set(portrait ? 0 : 0.2, portrait ? 2.2 : 2.3, 0);
    const fov = portrait ? 46 : 36;
    // Portrait canvases can be very tall (the hero stacks its legend under the words):
    // stand back exactly far enough that all four columns fit the width.
    const aspect = size.width / Math.max(1, size.height);
    const fit = PORTRAIT_HALF_WIDTH / (Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect);
    // Below 1280 the words take more of the width and the legend rises: the wall stands back a little.
    const tight = size.width < 1280;
    const [wx, wy, wz] = portrait ? [px * 0.4, 2.8 + py, Math.min(70, Math.max(16, fit))] : [0.4 + px, 3.0 + py, tight ? 17.2 : 15.4];
    cam.position.set(approach(cam.position.x, wx, dt, still, 1), approach(cam.position.y, wy, dt, still, 1), approach(cam.position.z, wz, dt, still, 1));
    cam.fov = fov;
    cam.lookAt(look);
    cam.updateProjectionMatrix();
  });
  return null;
}

function Room({ name, cards, cited, safety, topic, answerKey }: CoachSceneProps) {
  const portrait = usePortrait();
  const { size } = useThree();
  // On a phone the words start about 40% of the way down: centre the block about 210 px from the top.
  const up = portrait ? Math.max(0, 0.5 - 210 / Math.max(1, size.height)) : 0.27;
  const tight = size.width < 1280;
  const f = useMemo(() => frameFor(portrait), [portrait]);
  const poses = useMemo(() => layout(cards, cited, safety, f, portrait), [cards, cited, safety, f, portrait]);
  return (
    <>
      <KickOn deps={[answerKey, cited.join(","), safety, name]} />
      {/* Beside the words, the wall sits high, so its last row clears the legend below it. */}
      <Composition right={tight ? 0.25 : 0.23} lift={0.18} up={up} />
      {/* The portrait camera stands much further back; its fog starts further back too. */}
      <fog attach="fog" args={portrait ? [P.bg, 60, 120] : [P.bg, 22, 44]} />
      <hemisphereLight args={["#3a2c22", "#0c0b0a", 0.85]} />
      {/* A warm key from the front-left, a cool rim from behind: the cards read as glass, not paper. */}
      <directionalLight position={[-5, 9, 9]} intensity={1.9} color="#ffc08a" />
      <directionalLight position={[6, 5, -6]} intensity={1.2} color={P.fill} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.9}>
        <planeGeometry args={[120, 120]} />
        <meshBasicMaterial color={P.bg} />
      </mesh>
      <ContactShadows position={[0, -0.89, 0]} scale={20} blur={2.8} opacity={0.6} far={6} color="#000000" />
      {cards.map((c) => (
        <Card key={c.id} card={c} pose={poses[c.id]!} cited={cited.includes(c.id)} />
      ))}
      <Threads cards={cards} cited={cited} poses={poses} f={f} />
      <Orb at={f.orb} safety={safety} topic={topic} portrait={portrait} />
      <Rig />
    </>
  );
}

export default function CoachScene({ name, cards, cited, safety, topic, answerKey, ...stage }: CoachSceneProps & StageProps) {
  return (
    <SceneCanvas name="coach" background={P.bg} camera={{ position: [0.4, 3.0, 15.4], fov: 36, near: 0.1, far: 80 }} glow={0.95} threshold={0.45} vignette={0.5} grain={0.03} {...stage}>
      <Room name={name} cards={cards} cited={cited} safety={safety} topic={topic} answerKey={answerKey} />
    </SceneCanvas>
  );
}

function KickOn({ deps }: { deps: unknown[] }) {
  useKickOn(deps);
  return null;
}

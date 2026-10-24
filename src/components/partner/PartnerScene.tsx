"use client";

// Where a partner's money goes, as a waterfall you can walk around: the fee is
// the first block; each cost peels off it in turn (running the walks, staff
// time, card fees when there are any, the giving-back share); what is left for
// the team stands at the end, with the modelled P10–P90 range as a glass sleeve around
// it. One vertical scale, linear from $0, for every block — a loss hangs below
// the zero line in red. Along the deck's front runs the deal's track: done
// steps solid, the current one lit with the partner's marker, later ones hollow.
//
// Dark stage (Afterglow): the blocks are lit money on ember-black — each one
// carries a glowing cap in its own colour, the deck's front edge burns orange,
// and the floor is a faint measuring grid under a warm pool of light.

import { Environment, Lightformer, Line, RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Band, Economics } from "@/domain/finance";
import { usd } from "@/domain/finance";
import { DEAL_STAGES, type DealStage } from "@/domain/types";
import { Label } from "@/components/three/Label";
import { LIGHT } from "@/components/three/palette";
import { Composition, SceneCanvas, glowColor, useKickOn, useLiveClock, useMotion, usePortrait } from "@/components/three/SceneCanvas";
import type { StageProps } from "@/components/three/Stage";
import { ease, useSettle } from "./ease";
import { EmberFloor } from "./EmberFloor";
import { MONEY_COLOR } from "./moneyColors";

export interface PartnerSceneProps {
  partner: string;
  economics: Economics;
  band: Band;
  stage: DealStage;
  signed: boolean;
  paid: boolean;
}

const P = LIGHT.golden;
/** Text and quiet lines on the dark stage. */
const MUTED = "#bba791";
const RULE = "#7e6852";
/** The deck and plinths: lit from the edges, dark on top. */
const DECK = "#1c130c";

/** Horizontal field of view on phones, in degrees: the whole picture fits the width at any hero height. */
const PHONE_HFOV = 27.5;
/** The vertical span every block shares, in world units. */
const SPAN = 5.6;
const W = 1.12;
const GAP = 1.62;

/** The deal's stage in the words Kayla uses, for the marker riding the track. */
const STAGE_SHORT: Record<DealStage, string> = {
  inquiry: "Talking",
  qualified: "Interested",
  proposal: "Offer ready",
  contract: "Signed",
  live: "Live",
  reported: "Report sent",
  renewed: "Coming back",
  lost: "Said no",
};

interface Step {
  key: keyof typeof MONEY_COLOR;
  label: string;
  /** The name on a phone, where five names share 390 px: the legend under the picture says it in full. */
  short: string;
  /** Top and bottom in dollars. */
  top: number;
  bottom: number;
}

function steps(e: Economics): Step[] {
  let level = e.revenue;
  const peel = (key: Step["key"], label: string, amount: number, short = label): Step => {
    const s = { key, label, short, top: level, bottom: level - amount };
    level -= amount;
    return s;
  };
  const out: Step[] = [
    { key: "fee", label: "Fee", short: "Fee", top: e.revenue, bottom: 0 },
    peel("delivery", "Walks", e.delivery),
    peel("staff", "Staff", e.staffCost),
    // Card fees only stand when there are some: a $0 block is a label with nothing to name.
    ...(e.processing > 0 ? [peel("processing", "Card fees", e.processing, "Fees")] : []),
    peel("impact", "Giving back", e.impact, "Giving"),
  ];
  const left = e.contribution;
  out.push(
    left < 0
      ? { key: "loss", label: "Not covered yet", short: "Short", top: 0, bottom: left }
      : { key: "left", label: "Left for the team", short: "Left", top: left, bottom: 0 },
  );
  return out;
}

/**
 * One block, easing to its new top and bottom whenever the numbers change. `row`
 * staggers the names so neighbours never touch; `floor` is the lowest point drawn
 * (below $0 when the price doesn't cover the costs).
 */
function Block({ step, k, x, lit, row, floor }: { step: Step; k: number; x: number; lit: boolean; row: number; floor: number }) {
  const { still } = useMotion();
  const settle = useSettle();
  const portrait = usePortrait();
  const group = useRef<THREE.Group>(null);
  const cap = useRef<THREE.Mesh>(null);
  const tag = useRef<THREE.Group>(null);
  const now = useRef({ top: 0, bottom: 0 });
  const color = MONEY_COLOR[step.key];
  // Every block carries a lit cap in its own colour; the fee, the impact share and what's left burn brightest.
  const glow = useMemo(() => glowColor(color, lit ? 2.1 : 1.15), [color, lit]);

  useFrame((_, delta) => {
    now.current.top = ease(now.current.top, step.top * k, delta, still, 0.7);
    now.current.bottom = ease(now.current.bottom, step.bottom * k, delta, still, 0.7);
    settle(now.current.top, step.top * k);
    settle(now.current.bottom, step.bottom * k);
    const h = Math.max(0.02, now.current.top - now.current.bottom);
    if (group.current) {
      group.current.scale.y = h;
      group.current.position.y = now.current.bottom + h / 2;
    }
    if (cap.current) cap.current.position.y = now.current.top + 0.012;
    // A loss is labelled under its block, everything else on top. On a phone the blocks stand close and the walks
    // share the fee's top, so the walks' amount rides a little higher than the fee's instead of touching it.
    const lift = portrait && step.key === "delivery" ? 0.8 : 0;
    if (tag.current) tag.current.position.y = step.key === "loss" ? now.current.bottom - 0.42 : now.current.top + 0.42 + lift;
  });

  const amount = step.key === "fee" || step.key === "left" ? step.top - step.bottom : step.key === "loss" ? step.bottom : -(step.top - step.bottom);
  return (
    <group position={[x, 0, 0]}>
      <group ref={group}>
        {/* Unit-height box scaled to the step: rounded corners stay round because the radius is small. */}
        <RoundedBox args={[W, 1, W]} radius={0.04} smoothness={3} castShadow receiveShadow>
          <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={step.key === "fee" ? 0.05 : 0.12} roughness={0.32} metalness={0.12} clearcoat={1} clearcoatRoughness={0.18} />
        </RoundedBox>
      </group>
      <mesh ref={cap} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[W * 0.86, W * 0.86]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      {/* The amount sits on top of its block. The name stands in front of the deck, like an axis, in two staggered rows —
          or, when blocks hang below $0, under the lowest of them, so no name lands on a block. */}
      <group ref={tag}>
        {/* Dark pills (the kit's default) on the dark stage; a loss gets a red one. */}
        {step.key === "loss" ? (
          <Label text={`−${usd(-amount)}`} position={[0, 0, 0]} px={portrait ? 17 : 22} background="rgba(255,122,89,0.95)" color="#110b07" />
        ) : (
          <Label text={amount < 0 ? `−${usd(-amount)}` : usd(amount)} position={[0, 0, 0]} px={portrait ? 17 : 22} />
        )}
      </group>
      <Label
        text={portrait ? step.short : step.label}
        // On a phone the camera looks almost level, so the names drop below the deck (drawn over the floor) to clear its burning front edge.
        position={floor < -0.01 ? [0, floor - 0.95 - row * 0.42, 0] : [0, portrait ? -0.75 : 0.02, TRACK_Z + 1.3 + row * 0.62]}
        px={portrait ? 15 : 20}
        background="rgba(0,0,0,0)"
        color={MUTED}
        onTop={floor < -0.01 || portrait}
      />
    </group>
  );
}

/** The modelled range around what's left: a glass sleeve from P10 to P90, a bright line at the median. */
function Range({ band, k, x }: { band: Band; k: number; x: number }) {
  const { still } = useMotion();
  const settle = useSettle();
  const sleeve = useRef<THREE.Mesh>(null);
  const median = useRef<THREE.Group>(null);
  const loEdge = useRef<THREE.Group>(null);
  const hiEdge = useRef<THREE.Group>(null);
  const now = useRef({ lo: 0, hi: 0, mid: 0 });
  const glow = useMemo(() => glowColor(P.ok, 2.4), []);
  const edge = useMemo(() => glowColor(P.ok, 1.3), []);
  const r = (W + 0.36) / 2;
  const outline = useMemo<[number, number, number][]>(() => [[-r, 0, -r], [r, 0, -r], [r, 0, r], [-r, 0, r], [-r, 0, -r]], [r]);
  useFrame((_, delta) => {
    now.current.lo = ease(now.current.lo, band.p10 * k, delta, still, 0.8);
    now.current.hi = ease(now.current.hi, band.p90 * k, delta, still, 0.8);
    now.current.mid = ease(now.current.mid, band.p50 * k, delta, still, 0.8);
    settle(now.current.lo, band.p10 * k);
    settle(now.current.hi, band.p90 * k);
    settle(now.current.mid, band.p50 * k);
    const h = Math.max(0.02, now.current.hi - now.current.lo);
    if (sleeve.current) {
      sleeve.current.scale.y = h;
      sleeve.current.position.y = now.current.lo + h / 2;
    }
    if (median.current) median.current.position.y = now.current.mid;
    if (loEdge.current) loEdge.current.position.y = now.current.lo;
    if (hiEdge.current) hiEdge.current.position.y = now.current.hi;
  });
  return (
    <group position={[x, 0, 0]}>
      <mesh ref={sleeve}>
        <boxGeometry args={[W + 0.34, 1, W + 0.34]} />
        {/* Modelled, not money: a faint volume of light, never a solid. */}
        <meshBasicMaterial color={P.ok} transparent opacity={0.09} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={loEdge}>
        <Line points={outline} color={edge} lineWidth={1.2} dashed dashSize={0.1} gapSize={0.08} toneMapped={false} />
      </group>
      <group ref={hiEdge}>
        <Line points={outline} color={edge} lineWidth={1.2} dashed dashSize={0.1} gapSize={0.08} toneMapped={false} />
      </group>
      {/* The median: a bright ring around the sleeve, not a plate across it. */}
      <group ref={median}>
        <Line points={outline} color={glow} lineWidth={2.2} toneMapped={false} />
      </group>
    </group>
  );
}

/** Thin dashed connectors from each block's bottom to the next block's top: the waterfall's "and then". */
function Connectors({ list, k, xs }: { list: Step[]; k: number; xs: number[] }) {
  const lines = useMemo(() => {
    const out: [number, number, number][][] = [];
    for (let i = 0; i < list.length - 2; i++) {
      const y = (i === 0 ? list[0]!.top : list[i]!.bottom) * k;
      out.push([
        [xs[i]! + W / 2, y, 0],
        [xs[i + 1]! - W / 2, y, 0],
      ]);
    }
    return out;
  }, [list, k, xs]);
  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color={MUTED} lineWidth={1.2} dashed dashSize={0.08} gapSize={0.07} transparent opacity={0.6} />
      ))}
    </>
  );
}

/** The deck everything stands on, with the $0 line along it; the deal's track runs across its front. */
function Deck({ from, to, see }: { from: number; to: number; see: boolean }) {
  const back = -(W / 2 + 0.7);
  const front = TRACK_Z + 0.9;
  // Dimmer while the deck is glass, so a loss under the line reads first.
  const rim = useMemo(() => glowColor(P.accent, see ? 1.1 : 1.9), [see]);
  const x0 = (from + to) / 2 - (to - from + 2.6) / 2;
  const x1 = (from + to) / 2 + (to - from + 2.6) / 2;
  return (
    <group>
      <RoundedBox args={[to - from + 2.6, 0.18, front - back]} radius={0.06} smoothness={3} position={[(from + to) / 2, -0.09, (front + back) / 2]} receiveShadow>
        {/* When anything is below $0 the deck turns to glass, so a loss is never hidden under it. */}
        <meshStandardMaterial color={DECK} roughness={0.5} metalness={0.2} transparent={see} opacity={see ? 0.22 : 1} depthWrite={!see} />
      </RoundedBox>
      {/* The front edge burns orange: the stage's footlight. */}
      <Line points={[[x0, 0.004, front], [x1, 0.004, front]]} color={rim} lineWidth={2} toneMapped={false} />
      <Line points={[[from - 1.1, 0.006, W / 2 + 0.25], [to + 1.1, 0.006, W / 2 + 0.25]]} color={P.ink} lineWidth={1.3} transparent opacity={0.55} />
      <Label text="$0" position={[from - 1.5, 0.08, W / 2 + 0.25]} px={20} />
    </group>
  );
}

const TRACK_Z = 2.05;

/** The deal's stages as a track of steps along the deck's front edge: done steps solid, the current one lit, later ones hollow. */
function Track({ stage, signed, paid, partner, from, to }: { stage: DealStage; signed: boolean; paid: boolean; partner: string; from: number; to: number }) {
  const { still } = useMotion();
  const live = useLiveClock();
  const settle = useSettle();
  const portrait = usePortrait();
  const lost = stage === "lost";
  const current = lost ? -1 : DEAL_STAGES.indexOf(stage);
  const marker = useRef<THREE.Group>(null);
  const markerGlow = useMemo(() => glowColor(P.accent, 2.4), []);
  const coin = useMemo(() => glowColor(P.gold, 2), []);
  const ring = useMemo(() => glowColor(P.accent, 1.8), []);
  const n = DEAL_STAGES.length;
  const at = (i: number): [number, number, number] => [from + (i / (n - 1)) * (to - from), 0.1 + i * 0.05, TRACK_Z];
  const target = at(Math.max(0, current));
  const path = useMemo(() => DEAL_STAGES.map((_, i) => [at(i)[0], at(i)[1] + 0.01, TRACK_Z] as [number, number, number]), [from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((state, delta) => {
    const g = marker.current;
    if (!g) return;
    g.position.x = ease(g.position.x, target[0], delta, still, 0.8);
    settle(g.position.x, target[0]);
    // A slow float, only while the scene is allowed to move.
    const bob = Math.sin(live(state.clock.elapsedTime) * 1.6) * 0.05;
    g.position.y = target[1] + 0.5 + bob;
  });
  return (
    <group>
      <Line points={path} color={RULE} lineWidth={1.2} dashed dashSize={0.1} gapSize={0.08} transparent opacity={0.9} />
      {DEAL_STAGES.map((s, i) => {
        const done = i < current;
        const now = i === current;
        const [x, y, z] = at(i);
        return (
          <group key={s} position={[x, 0, z]}>
            <mesh position-y={y / 2} castShadow receiveShadow>
              <cylinderGeometry args={[0.3, 0.33, y, 40]} />
              {done || now ? (
                <meshStandardMaterial color={now ? P.accent : "#b8703f"} emissive={now ? P.accent : "#b8703f"} emissiveIntensity={now ? 0.55 : 0.12} roughness={0.4} />
              ) : (
                <meshStandardMaterial color={DECK} roughness={0.6} transparent opacity={0.55} />
              )}
            </mesh>
            {!done && !now ? (
              <mesh position-y={y + 0.003} rotation-x={-Math.PI / 2}>
                <ringGeometry args={[0.25, 0.31, 40]} />
                <meshBasicMaterial color={RULE} transparent opacity={0.9} />
              </mesh>
            ) : null}
            {/* Signed but not paid: the signing step carries an open ring; once paid, a gold coin. */}
            {s === "contract" && signed ? (
              paid ? (
                <mesh position={[0.46, 0.06, 0.1]} castShadow>
                  <cylinderGeometry args={[0.15, 0.15, 0.07, 32]} />
                  <meshBasicMaterial color={coin} toneMapped={false} />
                </mesh>
              ) : (
                <mesh position={[0, y + 0.02, 0]} rotation-x={-Math.PI / 2}>
                  <ringGeometry args={[0.4, 0.45, 48]} />
                  <meshBasicMaterial color={ring} toneMapped={false} />
                </mesh>
              )
            ) : null}
          </group>
        );
      })}
      {!lost ? (
        <group ref={marker} position={[target[0], target[1] + 0.5, target[2]]}>
          <mesh castShadow>
            <sphereGeometry args={[0.13, 32, 24]} />
            <meshBasicMaterial color={markerGlow} toneMapped={false} />
          </mesh>
          <Label
            text={partner}
            detail={signed && !paid ? "signed, not paid yet" : signed ? `${STAGE_SHORT[stage].toLowerCase()}, paid` : STAGE_SHORT[stage].toLowerCase()}
            position={[0, 0.42, 0]}
            px={portrait ? 19 : 22}
            background="rgba(255,106,19,0.95)"
            color="#110b07"
          />
        </group>
      ) : null}
    </group>
  );
}

function Rig({ centerY }: { centerY: number }) {
  const { camera, size } = useThree();
  const { still, pointer } = useMotion();
  const settle = useSettle();
  const portrait = usePortrait();
  // Phones hold the horizontal field of view, so a taller hero (the empty state has more words) never crops the sides.
  // Set during render (idempotent) as well as each frame: labels size themselves from the camera's fov when they render,
  // and this Rig renders before them.
  const fov = portrait ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(PHONE_HFOV / 2)) / (size.width / Math.max(1, size.height)))) : 34;
  const lens = camera as THREE.PerspectiveCamera;
  if (lens.fov !== fov) {
    lens.fov = fov;
    lens.updateProjectionMatrix();
  }
  const look = useMemo(() => new THREE.Vector3(), []);
  // The first frame is composed, not travelled to (a phone would otherwise glide in from the desktop shot).
  const placed = useRef(false);
  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const first = !placed.current;
    placed.current = true;
    const px = still ? 0 : pointer.current.x * 0.9;
    const py = still ? 0 : pointer.current.y * 0.45;
    // The camera rises and falls with the middle of the picture, so a deep loss stays in frame.
    const lift = centerY - 2.8;
    const [wx, wy, wz] = portrait ? [0.4 + px, 9.5 + py + lift, 30] : [1.6 + px, 8.9 + py + lift, 26];
    const snap = still || first;
    cam.position.set(ease(cam.position.x, wx, delta, snap, 1), ease(cam.position.y, wy, delta, snap, 1), ease(cam.position.z, wz, delta, snap, 1));
    settle(cam.position.x, wx);
    settle(cam.position.z, wz);
    settle(cam.position.y, wy);
    // Aim at the middle of everything drawn, from the deepest loss to the top of the fee.
    look.set(portrait ? 0 : 0.3, centerY + (portrait ? 0.2 : 0), 0.6);
    cam.fov = fov;
    cam.lookAt(look);
    cam.updateProjectionMatrix();
  });
  return null;
}

export default function PartnerScene({ partner, economics: e, band, stage, signed, paid, ...stage$ }: PartnerSceneProps & StageProps) {
  const list = useMemo(() => steps(e), [e]);
  // One scale for every block and the range: the fee plus the deepest loss fits the span.
  const low = Math.min(0, e.contribution, band.p10);
  const k = SPAN / Math.max(1, e.revenue - low);
  const xs = list.map((_, i) => (i - (list.length - 1) / 2) * GAP);
  const lastX = xs[xs.length - 1]!;
  return (
    <SceneCanvas name="partner" background={P.bg} camera={{ position: [1.6, 8.9, 26], fov: 34, near: 0.1, far: 140 }} glow={0.85} threshold={0.45} vignette={0.5} grain={0.03} shadows {...stage$}>
      <KickOn deps={[e.revenue, e.delivery, e.staffCost, e.processing, e.impact, e.contribution, band.p10, band.p90, stage, signed, paid]} />
      <Rig centerY={((e.revenue + low) / 2) * k} />
      <Framing />
      <fog attach="fog" args={[P.bg, 30, 64]} />
      {/* Reflections only: a warm softbox left, a cool one right, a ring overhead — offline, no HDR. */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={1.4} color="#ffb067" position={[-6, 6, 4]} scale={[10, 6, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#6f7fb8" position={[8, 4, -6]} scale={[8, 4, 1]} />
        <Lightformer form="ring" intensity={0.8} color="#ffc27a" position={[0, 9, 0]} scale={4} />
      </Environment>
      <hemisphereLight args={["#5a3720", "#050302", 0.7]} />
      <directionalLight position={[7, 5, 11]} intensity={0.55} color={P.fill} />
      {/* A low warm key from the west: long shadows to the right of every block, lit edges facing the viewer. */}
      <directionalLight
        position={[-9, 8, 7]}
        intensity={2.4}
        color={P.key}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={14}
        shadow-camera-top={10}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <EmberFloor y={Math.min(-0.2, low * k - 0.3)} center={[(xs[0]! + lastX) / 2, 0.6]} radius={12} />
      <Deck from={xs[0]!} to={lastX} see={list.some((s) => s.bottom < 0)} />
      <Connectors list={list} k={k} xs={xs} />
      {list.map((s, i) => (
        <Block key={s.key} step={s} k={k} x={xs[i]!} row={i % 2} floor={low * k} lit={s.key === "fee" || s.key === "left" || s.key === "impact"} />
      ))}
      <Range band={band} k={k} x={lastX} />
      <Track stage={stage} signed={signed} paid={paid} partner={partner} from={xs[0]!} to={lastX} />
    </SceneCanvas>
  );
}

/** Words bottom-left and the legend bottom-right: the waterfall floats above, right of centre — further right below 1280, clear of the headline. */
function Framing() {
  const { size } = useThree();
  return <Composition right={size.width < 1280 ? 0.26 : 0.23} lift={0.22} up={0.29} />;
}

function KickOn({ deps }: { deps: unknown[] }) {
  useKickOn(deps);
  return null;
}

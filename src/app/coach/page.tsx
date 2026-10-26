import type { Metadata } from "next";
import { CoachLens } from "@/components/coach/CoachLens";

export const metadata: Metadata = { title: "Quantum Health Coach — 100 Miles of Summer" };

export default function CoachPage() {
  return <CoachLens />;
}

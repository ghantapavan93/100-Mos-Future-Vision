import type { Metadata } from "next";
import { CoachLens } from "@/components/coach/CoachLens";

export const metadata: Metadata = { title: "Ask a question — 100 Miles of Summer" };

export default function CoachPage() {
  return <CoachLens />;
}

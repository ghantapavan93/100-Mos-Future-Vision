import type { Metadata } from "next";
import { VisionScreen } from "@/components/vision/VisionScreen";

export const metadata: Metadata = { title: "The big picture — 100 Miles of Summer" };

export default function VisionPage() {
  return <VisionScreen />;
}

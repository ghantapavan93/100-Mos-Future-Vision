import type { Metadata } from "next";
import { FutureLab } from "@/components/future/FutureLab";

export const metadata: Metadata = { title: "Next three summers — 100 Miles of Summer" };

export default function FuturePage() {
  return <FutureLab />;
}

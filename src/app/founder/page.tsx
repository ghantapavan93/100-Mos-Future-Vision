import type { Metadata } from "next";
import { FounderConsole } from "@/components/founder/FounderConsole";

export const metadata: Metadata = { title: "Kayla's week — 100 Miles of Summer" };

export default function FounderPage() {
  return <FounderConsole />;
}

import type { Metadata } from "next";
import { BuildExplorer } from "@/components/build/BuildExplorer";

export const metadata: Metadata = { title: "Roadmap — 100 Miles of Summer" };

export default function Page() {
  return <BuildExplorer />;
}

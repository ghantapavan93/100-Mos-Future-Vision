import type { Metadata } from "next";
import { ImpactLedger } from "@/components/impact/ImpactLedger";

export const metadata: Metadata = { title: "Giving back — 100 Miles of Summer" };

export default function Page() {
  return <ImpactLedger />;
}

import type { Metadata } from "next";
import { DeviceCheck } from "@/components/inspect/DeviceCheck";

export const metadata: Metadata = { title: "3D check — 100 Miles of Summer" };

export default function DeviceCheckPage() {
  return <DeviceCheck />;
}

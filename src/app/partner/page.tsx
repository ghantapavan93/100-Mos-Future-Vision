import type { Metadata } from "next";
import { PartnerStudio } from "@/components/partner/PartnerStudio";

export const metadata: Metadata = { title: "Sponsors — 100 Miles of Summer" };

export default function Page() {
  return <PartnerStudio />;
}

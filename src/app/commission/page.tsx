import type { Metadata } from "next";
import { CommissionStudio } from "@/components/commission/CommissionStudio";

export const metadata: Metadata = { title: "One commission, three cities — 100 Miles of Summer" };

export default function Page() {
  return <CommissionStudio />;
}

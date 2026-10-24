import type { Metadata } from "next";
import { CirclesLens } from "@/components/circles/CirclesLens";

export const metadata: Metadata = { title: "City Circles — 100 Miles of Summer" };

export default function CirclesPage() {
  return <CirclesLens />;
}

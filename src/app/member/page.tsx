import type { Metadata } from "next";
import { MemberLens } from "@/components/member/MemberLens";

export const metadata: Metadata = { title: "Member app — 100 Miles of Summer" };

export default function Page() {
  return <MemberLens />;
}
